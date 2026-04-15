/**
 * Bond Z-spread analytics.
 *
 * Port of the Z-spread logic from ois_pricer/frontend/tlref-ois-pricer.jsx
 * (which is a tighter in-browser version of engine.py's bond pricer).
 *
 * Z-spread is the constant spread `s` that, when added to the curve-
 * implied period rate, prices the bond's discounted cash flows to its
 * observed market price. Found by bisection on [-50%, +50%]. The
 * spread is quoted in the same units as the rate (percent of face),
 * converted to basis points at the reporting layer.
 *
 *   PV(s) = Σᵢ CFᵢ / (1 + (rᵢ + s)/dayCount · prd)^(daysᵢ / prd)
 *
 * where rᵢ is the zero rate at time tᵢ on the chosen curve (OIS or
 * offshore) and `prd` is the coupon period length (91 days for quarterly,
 * 182 for semi-annual).
 */

import { addMonths, daysBetween, parseIso } from "./calendar";
import { interpolateDF } from "./interpolation";
import type {
  Bond,
  BondAnalytics,
  BondCashFlow,
  DFNode,
} from "./types";

/**
 * Generate the bond's cash flows relative to the value date.
 *
 * For floaters, coupons are computed forward from the OIS curve using
 * the forward-rate formula over each period. The principal (100) is
 * added to the final cash flow. Zero-coupon bonds collapse to a single
 * terminal payment.
 */
export function generateCashFlows(
  bond: Bond,
  valueDate: Date,
  oisNodes: readonly DFNode[],
): BondCashFlow[] {
  const matDate = parseIso(bond.maturity);
  const totalDays = daysBetween(valueDate, matDate);
  if (totalDays <= 0) return [];

  if (bond.freq === 0 || bond.coupon === 0) {
    return [{ days: totalDays, cf: 100 }];
  }

  const monthStep = bond.freq === 4 ? 3 : 6;

  // Walk coupon dates backward from maturity and keep those > valueDate.
  const dates: number[] = [];
  let cursor = matDate;
  while (daysBetween(valueDate, cursor) > 0) {
    dates.unshift(daysBetween(valueDate, cursor));
    cursor = addMonths(cursor, -monthStep);
  }
  if (dates.length === 0) return [{ days: totalDays, cf: 100 }];

  if (bond.type === "flt") {
    // Forward-rate coupons from the pure OIS curve.
    return dates.map((dc, i) => {
      const dp = i > 0 ? dates[i - 1] : 0;
      const dfPrev = interpolateDF(oisNodes, dp);
      const dfCur = interpolateDF(oisNodes, dc);
      const fw = (dfPrev / dfCur - 1.0) * 100.0;
      return { days: dc, cf: i === dates.length - 1 ? fw + 100 : fw };
    });
  }

  // Fixed coupon.
  const cpp = bond.coupon / bond.freq;
  return dates.map((dc, i) => ({
    days: dc,
    cf: i === dates.length - 1 ? cpp + 100 : cpp,
  }));
}

/**
 * Compute the bond's PV at spread `s` on the given curve.
 *
 * `prd` = 91 for quarterly (floaters), 182 for semi-annual (fixed).
 * `dayCount` = 365 for OIS (Act/365), 360 for offshore (Act/360).
 */
function priceAtSpread(
  cfs: readonly BondCashFlow[],
  nodes: readonly DFNode[],
  spread: number,
  prd: number,
  dayCount: 360 | 365,
): number {
  let pv = 0;
  for (const { days, cf } of cfs) {
    if (days <= 0) continue;
    const df = interpolateDF(nodes, days);
    if (df <= 0) continue;
    const r = (Math.pow(1.0 / df, prd / days) - 1.0) * (dayCount / prd);
    pv += cf / Math.pow(1.0 + (r + spread) / dayCount * prd, days / prd);
  }
  return pv;
}

/**
 * Solve for the Z-spread that makes PV == target.
 *
 * Bisection on [-0.5, +0.5] (i.e. ±50% in rate units). 120 iterations
 * converge to < 1e-4 in PV even for deep-discount bonds. Returns the
 * spread in rate units (e.g. 0.01 = 1% = 100 bp).
 */
export function solveZSpread(
  cfs: readonly BondCashFlow[],
  nodes: readonly DFNode[],
  target: number,
  prd: number,
  dayCount: 360 | 365 = 365,
): number {
  let lo = -0.5;
  let hi = 0.5;
  for (let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2;
    const pv = priceAtSpread(cfs, nodes, mid, prd, dayCount);
    if (Math.abs(pv - target) < 1e-4) return mid;
    if (pv > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Price a single bond on both curves and return Z-spreads.
 *
 * Skips bonds with DTM ≤ 0 (already matured) by returning `null`;
 * callers are expected to filter these out.
 */
export function priceBond(
  bond: Bond,
  oisNodes: readonly DFNode[],
  offNodes: readonly DFNode[],
  valueDate: Date,
): BondAnalytics | null {
  const dtm = daysBetween(valueDate, parseIso(bond.maturity));
  if (dtm <= 0) return null;

  const prd = bond.freq === 4 ? 91 : 182;
  const cfs = generateCashFlows(bond, valueDate, oisNodes);
  if (cfs.length === 0) return null;

  let pvOIS = 0;
  for (const { days, cf } of cfs) {
    if (days > 0) pvOIS += cf * interpolateDF(oisNodes, days);
  }

  const zOIS = solveZSpread(cfs, oisNodes, bond.lastPrice, prd, 365) * 100.0;
  const zOff = solveZSpread(cfs, offNodes, bond.lastPrice, prd, 360) * 100.0;

  // Yield on OIS = OIS zero rate at DTM + Z-spread.
  const dfT = interpolateDF(oisNodes, dtm);
  const oisZero = dtm > 0 ? ((1.0 / dfT - 1.0) * 365.0) / dtm * 100.0 : 0;

  return {
    bond,
    dtm,
    zSpreadOIS: zOIS,
    zSpreadOff: zOff,
    pvOIS,
    yieldOIS: oisZero + zOIS,
  };
}

/** Price a list of bonds; filters matured/invalid entries; sorts by DTM. */
export function priceBonds(
  bonds: readonly Bond[],
  oisNodes: readonly DFNode[],
  offNodes: readonly DFNode[],
  valueDate: Date,
): BondAnalytics[] {
  return bonds
    .map((b) => priceBond(b, oisNodes, offNodes, valueDate))
    .filter((x): x is BondAnalytics => x !== null)
    .sort((a, b) => a.dtm - b.dtm);
}
