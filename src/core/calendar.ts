/**
 * Istanbul business-day calendar utilities for the TLREF OIS pricer.
 *
 * All dates are interpreted as UTC calendar dates — time-of-day is ignored
 * and inputs are normalized to midnight UTC before any arithmetic, so that
 * local timezone / DST transitions cannot cause off-by-one errors in day
 * counts, which matter for interest accrual.
 */

import { HOLIDAY_SET } from "../data/holidays";

const MS_PER_DAY = 86_400_000;

// --- Internal helpers -------------------------------------------------------

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Normalize a Date to midnight UTC on its Y/M/D in UTC. */
function toUtcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** ISO `YYYY-MM-DD` key derived from the date's UTC components. */
function toKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Return a new Date `n` days after `d` (UTC-normalized). */
function addDays(d: Date, n: number): Date {
  return new Date(toUtcMidnight(d).getTime() + n * MS_PER_DAY);
}

// --- Public API -------------------------------------------------------------

/**
 * True iff `d` is an Istanbul business day — i.e. not a weekend and not
 * a Turkish public holiday listed in {@link HOLIDAY_SET}.
 */
export function isBizDay(d: Date): boolean {
  const u = toUtcMidnight(d);
  const dow = u.getUTCDay(); // 0 = Sunday, 6 = Saturday
  if (dow === 0 || dow === 6) return false;
  return !HOLIDAY_SET.has(toKey(u));
}

/**
 * Modified Following business-day convention:
 *   - Roll forward day-by-day until a business day is found.
 *   - If that roll crosses into the next calendar month, roll backward
 *     from the original date instead.
 */
export function modifiedFollowing(d: Date): Date {
  const start = toUtcMidnight(d);
  if (isBizDay(start)) return start;

  // Forward scan
  let fwd = start;
  for (let i = 0; i < 10; i++) {
    fwd = addDays(fwd, 1);
    if (isBizDay(fwd)) break;
  }

  if (fwd.getUTCMonth() === start.getUTCMonth()) {
    return fwd;
  }

  // Crossed month boundary — backward scan from the original date.
  let back = start;
  for (let i = 0; i < 10; i++) {
    back = addDays(back, -1);
    if (isBizDay(back)) return back;
  }
  // Fallback (should never hit in practice): return the forward result.
  return fwd;
}

/**
 * Whole-day distance `b - a` using UTC-normalized midnights.
 * Result can be negative if `b` is before `a`.
 */
export function daysBetween(a: Date, b: Date): number {
  const ua = toUtcMidnight(a).getTime();
  const ub = toUtcMidnight(b).getTime();
  return Math.round((ub - ua) / MS_PER_DAY);
}

/**
 * G-factor (number of calendar days a TLREF fixing applies for),
 * capped so it cannot run past the swap maturity.
 *
 *   g = max(1, min(nextBizDay(d) - d, maturity - d))
 *
 * Examples:
 *   - Friday → next biz day is Monday ⇒ g = 3
 *   - Friday where maturity is Saturday ⇒ g = 1 (maturity cap)
 */
export function gFactorCapped(d: Date, maturity: Date): number {
  const start = toUtcMidnight(d);
  const mat = toUtcMidnight(maturity);

  // Next business day strictly after `d` (plain forward scan, no month
  // rollback — this is an accrual horizon, not a settlement roll).
  let next = start;
  for (let i = 0; i < 30; i++) {
    next = addDays(next, 1);
    if (isBizDay(next)) break;
  }

  const toNext = daysBetween(start, next);
  const toMat = daysBetween(start, mat);
  return Math.max(1, Math.min(toNext, toMat));
}
