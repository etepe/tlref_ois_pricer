/**
 * Market-implied policy rate between consecutive PPK meetings.
 *
 * Ported from ois_pricer/engine_v2/bootstrap.py::extract_implied_ppk.
 * For each future meeting date md_i, we compute the simple forward rate
 * from the previous anchor (md_{i-1} or value date) to md_i:
 *
 *   f_i = (DF(prev) / DF(md_i) − 1) · 365 / period_days
 *
 * This is the rate that — if set as a constant short-rate between the
 * two anchors — would reproduce the ratio of DFs the market has priced.
 * A rising forward curve implies hikes; a falling curve implies cuts.
 */

import { daysBetween, parseIso } from "./calendar";
import { interpolateDF } from "./interpolation";
import type { BootstrapResult, ImpliedPPK } from "./types";

/**
 * Extract implied PPK rates for all future meeting dates.
 *
 * `ppkDates` must be ISO `YYYY-MM-DD`. Past meetings (≤ value date) are
 * skipped silently — the curve has no information about them.
 */
export function extractImpliedPPK(
  result: BootstrapResult,
  ppkDates: readonly string[],
): ImpliedPPK[] {
  const vd = parseIso(result.valueDate);
  const vdIso = result.valueDate;

  const future = [...ppkDates].filter((d) => d > vdIso).sort();

  const out: ImpliedPPK[] = [];
  let prevDate = vd;
  let prevDF = 1.0;

  for (const iso of future) {
    const md = parseIso(iso);
    const daysFromVd = daysBetween(vd, md);
    const periodDays = daysBetween(prevDate, md);
    const df = interpolateDF(result.nodes, daysFromVd);

    if (periodDays > 0 && prevDF > 0 && df > 0) {
      const fwd = ((prevDF / df - 1.0) * 365.0) / periodDays;
      out.push({
        date: iso,
        daysFromVd,
        periodDays,
        df,
        forwardRate: fwd,
        impliedRatePct: fwd * 100.0,
      });
    }
    prevDate = md;
    prevDF = df;
  }

  return out;
}
