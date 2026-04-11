/**
 * TLREF OIS swap fair-rate solver.
 *
 * Given a start date, maturity, starting TLREF level, and a CBRT meeting
 * path, compute the par fixed rate that makes the swap worth zero.
 *
 * Two branches match market convention for short-vs-long tenors:
 *
 *   - Zero-coupon (ZC), tenors ≤ 95 calendar days:
 *         fair = (1/DF(T) − 1) · 365/t · 100
 *
 *   - Par swap (PAR), tenors > 95 days with quarterly resets:
 *         fair = (1 − DF(T)) / Σᵢ (dcfᵢ · DFᵢ) · 100
 *
 * Discount factors come from `buildDailyDF` (ACT/365, compounded on
 * business-day fixings). Maturity is Modified-Following-adjusted before
 * any calculation so `calDays` and `DF(T)` agree on the same date.
 */

import { modifiedFollowing, daysBetween } from "./calendar";
import { buildDailyDF } from "./compounding";
import type { Meeting } from "./types";

const MS_PER_DAY = 86_400_000;

// --- Local date helpers -----------------------------------------------------
//
// Kept private to mirror the compounding.ts pattern — avoid widening the
// calendar.ts public surface for trivial helpers only used here.

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toUtcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function toKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(toUtcMidnight(d).getTime() + n * MS_PER_DAY);
}

function parseIso(s: string): Date {
  const [y, m, day] = s.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, day));
}

/**
 * Add `n` months to `d`, clamping the day to the last day of the target
 * month. Prevents the Jan-31 + 1M → Mar-3 overflow that `Date.UTC` would
 * otherwise produce, which matters for quarterly schedules starting on
 * day 29/30/31.
 */
function addMonths(d: Date, n: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const day = d.getUTCDate();
  // Day 0 of next month = last day of target month.
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, lastDay)));
}

// --- Public API -------------------------------------------------------------

export interface PricingResult {
  /** Fair fixed rate in percent (e.g. 39.85). */
  fairRate: number;
  /** Calendar days from start to adjusted maturity. */
  calDays: number;
  /** Pricing branch taken. `ERR` on failure. */
  method: "ZC" | "PAR" | "ERR";
  /** 1 for ZC, number of coupons for PAR, 0 for ERR. */
  periods: number;
  /** Modified-Following-adjusted maturity, ISO `YYYY-MM-DD`. */
  adjMat: string;
}

/**
 * Build the quarterly coupon schedule for a PAR swap.
 *
 * Walks forward in 3-month steps from `startDate`. Each intermediate date
 * is Modified-Following adjusted. As soon as a rolled date reaches or
 * passes `matDate`, `matDate` is pushed as the terminal coupon and the
 * walk stops — the caller is expected to pass an already-MF-adjusted
 * maturity, so the terminal element is a business day by construction.
 *
 * Stub final periods (e.g. a 5-day tail on a 96-day swap) are produced
 * naturally and priced correctly by the DCF term in the annuity.
 *
 * Example:
 *   start=2026-04-13 Mon, mat=2027-04-13 Tue
 *   → [2026-07-13, 2026-10-13, 2027-01-13, 2027-04-13]
 */
export function quarterlySchedule(startDate: Date, matDate: Date): Date[] {
  const out: Date[] = [];
  const start = toUtcMidnight(startDate);
  const mat = toUtcMidnight(matDate);
  const matMs = mat.getTime();

  for (let i = 1; i < 1000; i++) {
    const raw = addMonths(start, 3 * i);
    if (raw.getTime() >= matMs) {
      out.push(mat);
      return out;
    }
    out.push(modifiedFollowing(raw));
  }
  // Safety fallback — should never hit for any realistic tenor.
  out.push(mat);
  return out;
}

/**
 * Look up `target`'s discount factor in `dfMap`.
 *
 * `buildDailyDF` populates every calendar day in the swap window, so the
 * exact-key hit is the normal path. A ±5 calendar-day proximity scan is
 * kept as a defensive fallback in case a caller queries a date slightly
 * outside the map (e.g. rounding in later schedule-generation changes).
 *
 * Throws if nothing is found within ±5 days.
 */
export function getDF(dfMap: Map<string, number>, target: Date): number {
  const key = toKey(target);
  const exact = dfMap.get(key);
  if (exact !== undefined) return exact;

  for (let offset = 1; offset <= 5; offset++) {
    const before = dfMap.get(toKey(addDays(target, -offset)));
    if (before !== undefined) return before;
    const after = dfMap.get(toKey(addDays(target, offset)));
    if (after !== undefined) return after;
  }
  throw new Error(`DF not found near ${key}`);
}

/**
 * Compute the OIS swap par fixed rate.
 *
 * Branches on calendar-day tenor:
 *   - calDays ≤ 95 → single-period zero-coupon formula
 *   - calDays > 95 → quarterly par-swap formula
 *
 * The maturity is Modified-Following adjusted first, so `calDays` and
 * `DF(T)` always refer to the same date. The PAR annuity is anchored at
 * the unadjusted start date (not the first coupon) so that the first
 * period's DCF is measured from trade start.
 *
 * Returns `method: 'ERR'` with `NaN` rate on any failure (bad maturity,
 * DF lookup miss, etc.) — the UI surfaces this as an error state.
 */
export function computeParRate(
  startDate: string,
  maturityDate: string,
  meetings: Meeting[],
  startTlref: number,
): PricingResult {
  try {
    const startD = parseIso(startDate);
    const adjMat = modifiedFollowing(parseIso(maturityDate));
    const adjMatStr = toKey(adjMat);
    const calDays = daysBetween(startD, adjMat);

    if (calDays <= 0) {
      return { fairRate: NaN, calDays, method: "ERR", periods: 0, adjMat: adjMatStr };
    }

    const dfMap = buildDailyDF(startDate, adjMat, meetings, startTlref);
    const dfT = getDF(dfMap, adjMat);

    if (calDays <= 95) {
      const fairRate = ((1 / dfT - 1) * 365) / calDays * 100;
      return { fairRate, calDays, method: "ZC", periods: 1, adjMat: adjMatStr };
    }

    const coupons = quarterlySchedule(startD, adjMat);
    let annuity = 0;
    let prev = startD;
    for (const c of coupons) {
      const dcf = daysBetween(prev, c) / 365;
      annuity += dcf * getDF(dfMap, c);
      prev = c;
    }
    const fairRate = ((1 - dfT) / annuity) * 100;
    return { fairRate, calDays, method: "PAR", periods: coupons.length, adjMat: adjMatStr };
  } catch {
    let adjMatStr = "";
    try {
      adjMatStr = toKey(modifiedFollowing(parseIso(maturityDate)));
    } catch {
      /* swallow secondary failure */
    }
    return { fairRate: NaN, calDays: 0, method: "ERR", periods: 0, adjMat: adjMatStr };
  }
}
