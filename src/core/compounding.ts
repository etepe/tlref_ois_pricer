/**
 * Daily discount-factor builder for the TLREF OIS pricer.
 *
 * Given a starting TLREF level (in percent) and a list of upcoming CBRT
 * meeting decisions, this module produces a forward path for TLREF and
 * compounds it on a business-day-by-business-day basis to yield a daily
 * discount-factor map covering the swap's lifetime.
 *
 * Convention (TLREF OIS, ACT/365):
 *
 *   DF(T) = 1 / Π_i ( 1 + r_i · g_i / 365 )
 *
 * where the product is taken over business-day fixings i in [start, T),
 * `r_i` is the TLREF level on fixing day i (decimal), and `g_i` is the
 * accrual horizon for that fixing — the number of calendar days the
 * fixing applies for, capped at the swap's maturity.
 */

import { isBizDay, gFactorCapped } from "./calendar";
import type { Meeting } from "./types";

const MS_PER_DAY = 86_400_000;

// --- Internal date helpers --------------------------------------------------
//
// Kept local instead of widening calendar.ts's public surface — they are
// trivial and only used by the daily walk below.

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

function parseIsoDate(s: string): Date {
  const [y, m, day] = s.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, day));
}

// --- Public API -------------------------------------------------------------

/**
 * Implied TLREF level (in **percent**) on `dateStr`, given the starting
 * level and the sorted list of CBRT meeting decisions.
 *
 * A meeting decision applies starting on its own date (inclusive), so on
 * the day before the meeting the old level still holds.
 *
 * `meetings` MUST be sorted ascending by `date`. ISO `YYYY-MM-DD` strings
 * compare lexicographically, so plain string `<=` is correct here.
 *
 * Example:
 *   tlrefAt("2026-04-21", 39.99, [{date: "2026-04-22", cut: -250}]) → 39.99
 *   tlrefAt("2026-04-22", 39.99, [{date: "2026-04-22", cut: -250}]) → 37.49
 */
export function tlrefAt(
  dateStr: string,
  startTlref: number,
  meetings: Meeting[],
): number {
  let level = startTlref;
  for (const m of meetings) {
    if (m.date <= dateStr) {
      // bps → percent
      level += m.cut / 100;
    } else {
      // sorted: nothing further can apply
      break;
    }
  }
  return level;
}

/**
 * Build a daily discount-factor map for the swap's lifetime.
 *
 * Walks calendar days from `startDate` through `adjMatDate` inclusive.
 * On every business day the running compound product is updated using the
 * TLREF level for that day and the maturity-capped g-factor:
 *
 *     compound *= 1 + r · g / 365     (only on business days)
 *     DF(d)    = 1 / compound          (recorded for every calendar day)
 *
 * `DF(startDate)` is anchored at 1.0. Non-business days carry forward the
 * current `compound` (DF is flat across weekends/holidays until the next
 * business-day fixing triggers an update). A Friday whose g-factor reaches
 * past `adjMatDate` is correctly truncated by `gFactorCapped`.
 *
 * `adjMatDate` is expected to already be business-day adjusted by the
 * caller (e.g. via `modifiedFollowing`).
 */
export function buildDailyDF(
  startDate: string,
  adjMatDate: Date,
  meetings: Meeting[],
  startTlref: number,
): Map<string, number> {
  const dfMap = new Map<string, number>();
  const mat = toUtcMidnight(adjMatDate);
  const matMs = mat.getTime();

  let cursor = parseIsoDate(startDate);
  let compound = 1;

  dfMap.set(toKey(cursor), 1);

  while (cursor.getTime() < matMs) {
    if (isBizDay(cursor)) {
      const r = tlrefAt(toKey(cursor), startTlref, meetings) / 100;
      const g = gFactorCapped(cursor, mat);
      compound *= 1 + (r * g) / 365;
    }
    cursor = addDays(cursor, 1);
    dfMap.set(toKey(cursor), 1 / compound);
  }

  return dfMap;
}
