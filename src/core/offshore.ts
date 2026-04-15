/**
 * Offshore TRY (TRYI) curve.
 *
 * Unlike the onshore OIS curve, offshore data arrives from Bloomberg
 * (TRYION/TRYITN/TRYI*) as ticker-level quotes that already include a
 * discount factor field — day count is Act/360, and the DF column is
 * the market screen value, not a bootstrapped number.
 *
 * We therefore don't bootstrap; we just turn the quotes into DF nodes
 * with `days > 0` so the UI can interpolate zero rates and compare the
 * offshore zero curve against the onshore OIS curve (basis).
 */

import type { DFNode, OffshoreQuote } from "./types";

/**
 * Turn offshore quotes into interpolable DF nodes.
 *
 * Includes a t=0 anchor at DF=1. Quotes with `days ≤ 0` (ON/TN can be
 * same-day) are dropped so the resulting node set is strictly monotone
 * in `days`, which the log-linear interpolator requires.
 */
export function buildOffshoreNodes(quotes: readonly OffshoreQuote[]): DFNode[] {
  const nodes: DFNode[] = [
    { days: 0, df: 1.0, matDate: "", tenor: "T0", parRate: 0 },
  ];

  for (const q of quotes) {
    if (q.days <= 0) continue;
    nodes.push({
      days: q.days,
      df: q.df,
      matDate: "",
      tenor: q.tenor,
      parRate: q.rate / 100.0,
    });
  }

  nodes.sort((a, b) => a.days - b.days);
  return nodes;
}

/**
 * Recompute an offshore DF from (rate, days) on Act/360:
 *   DF = 1 / (1 + rate · days / 360)
 *
 * Used by the Market Data tab when the user edits a rate so the DF
 * column stays in sync.
 */
export function offshoreDFFromRate(ratePct: number, days: number): number {
  if (days <= 0) return 1.0;
  return 1.0 / (1.0 + (ratePct / 100.0) * (days / 360.0));
}
