/**
 * Log-linear interpolation of discount factors.
 *
 * Ported from engine_v2/bootstrap.py::interpolate_df. Interpolation is
 * performed in log-DF space — equivalent to linear interpolation of the
 * continuously-compounded zero rate, and market-standard for OIS curves.
 *
 *   ln(DF(t)) = ln(DF_lo) + w · (ln(DF_hi) − ln(DF_lo))
 *   w = (t − t_lo) / (t_hi − t_lo)
 *
 * Boundaries: DF(0) = 1 (hard anchor). Past the longest node we
 * extrapolate by holding the zero rate flat, which is a more natural
 * continuation than flat-DF or flat-rate at the short side.
 */

import type { DFNode } from "./types";

/**
 * Log-linear DF interpolation at `targetDays` over the given node set.
 *
 * `nodes` need not be sorted; this routine sorts a shallow copy by
 * `days`. Duplicate `days` are not expected (bootstrap dedups first)
 * and are handled by taking the last occurrence via the sort.
 */
export function interpolateDF(nodes: readonly DFNode[], targetDays: number): number {
  if (targetDays <= 0) return 1.0;

  const sorted = [...nodes].sort((a, b) => a.days - b.days);

  // Exact hit.
  for (const n of sorted) {
    if (n.days === targetDays) return n.df;
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // Below the shortest node: clamp (curve doesn't extrapolate back before t=0).
  if (targetDays <= first.days) return first.df;

  // Above the longest: flat-zero-rate extrapolation.
  if (targetDays >= last.days) {
    if (last.days > 0 && last.df > 0) {
      const zr = (-Math.log(last.df) / last.days) * 365.0;
      return Math.exp((-zr * targetDays) / 365.0);
    }
    return 1.0;
  }

  // Bracket and log-linear interpolate.
  let lo = first;
  let hi = last;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].days <= targetDays && targetDays <= sorted[i + 1].days) {
      lo = sorted[i];
      hi = sorted[i + 1];
      break;
    }
  }
  if (hi.days === lo.days) return lo.df;

  const lnLo = lo.df > 0 ? Math.log(lo.df) : -50.0;
  const lnHi = hi.df > 0 ? Math.log(hi.df) : -50.0;
  const w = (targetDays - lo.days) / (hi.days - lo.days);
  return Math.exp(lnLo + w * (lnHi - lnLo));
}

/**
 * Simple zero rate at `days` (Act/365, percent).
 *
 *   z = (1/DF − 1) · dayCount/days × 100
 *
 * `dayCount` defaults to 365 (onshore TRY OIS); pass 360 for offshore
 * TRYI so the returned rate is comparable to Bloomberg's TRYI screens.
 */
export function zeroRate(
  nodes: readonly DFNode[],
  days: number,
  dayCount: 360 | 365 = 365,
): number {
  if (days <= 0) return 0;
  const df = interpolateDF(nodes, days);
  if (df <= 0) return 0;
  return ((1.0 / df - 1.0) * dayCount) / days * 100.0;
}
