/**
 * Istanbul business-day calendar utilities.
 *
 * All dates are handled as UTC-normalized midnights so local timezone
 * transitions cannot shift day counts — interest accrual is sensitive
 * to off-by-one errors. Ported from ois_pricer/engine_v2/calendar.py
 * plus data_provider.py helpers (is_business_day, add_bdays, next_bday).
 */

import { HOLIDAY_SET } from "../data/holidays";

const MS_PER_DAY = 86_400_000;

// --- Date utilities ---------------------------------------------------------

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Return a UTC-midnight copy of `d`. */
export function toUtcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** ISO `YYYY-MM-DD` key using the date's UTC components. */
export function toIso(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Parse an ISO `YYYY-MM-DD` string into a UTC-midnight Date. */
export function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

/** Return a Date `n` calendar days after `d` (UTC-safe). */
export function addDays(d: Date, n: number): Date {
  return new Date(toUtcMidnight(d).getTime() + n * MS_PER_DAY);
}

/**
 * Add `n` months to `d`, clamping to the last valid day of the target
 * month. Mirrors the `calendar.monthrange` trick in ois_pricer's
 * engine.py so `Jan 31 + 1M = Feb 28/29`, not `Mar 3`.
 */
export function addMonths(d: Date, n: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const day = d.getUTCDate();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, lastDay)));
}

/** Whole-day distance `b - a` using UTC-normalized midnights. */
export function daysBetween(a: Date, b: Date): number {
  const ua = toUtcMidnight(a).getTime();
  const ub = toUtcMidnight(b).getTime();
  return Math.round((ub - ua) / MS_PER_DAY);
}

// --- Business-day predicates ------------------------------------------------

/**
 * True iff `d` is an Istanbul business day — not a weekend and not a
 * Turkish public holiday listed in {@link HOLIDAY_SET}.
 */
export function isBusinessDay(d: Date): boolean {
  const u = toUtcMidnight(d);
  const dow = u.getUTCDay(); // 0 = Sun, 6 = Sat
  if (dow === 0 || dow === 6) return false;
  return !HOLIDAY_SET.has(toIso(u));
}

/**
 * First business day ≥ `d`. Matches `next_bday` in
 * ois_pricer/data_provider.py: if `d` is already a BD, return it.
 */
export function nextBusinessDay(d: Date): Date {
  let cur = toUtcMidnight(d);
  while (!isBusinessDay(cur)) cur = addDays(cur, 1);
  return cur;
}

/**
 * Add `n` business days to `d` (strictly forward). Mirrors
 * `add_bdays` in ois_pricer: walks day-by-day, counts BDs,
 * stops when count == n. `addBusinessDays(d, 0)` returns `d`.
 */
export function addBusinessDays(d: Date, n: number): Date {
  let cur = toUtcMidnight(d);
  let count = 0;
  while (count < n) {
    cur = addDays(cur, 1);
    if (isBusinessDay(cur)) count++;
  }
  return cur;
}

/**
 * Modified Following convention, matching engine_v2/calendar.py:
 *   - Roll forward to the first BD.
 *   - If that roll lands in a different calendar month, roll backward
 *     from the original date instead.
 */
export function modifiedFollowing(d: Date): Date {
  const original = toUtcMidnight(d);
  let fwd = original;
  while (!isBusinessDay(fwd)) fwd = addDays(fwd, 1);
  if (fwd.getUTCMonth() === original.getUTCMonth()) return fwd;

  let back = original;
  while (!isBusinessDay(back)) back = addDays(back, -1);
  return back;
}
