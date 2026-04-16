/**
 * TLREF OIS curve bootstrap.
 *
 * Port of ois_pricer/engine_v2/bootstrap.py. Conventions:
 *   - Day count: Act/365
 *   - Settlement: T+1 (value date = trade date + 1 BD)
 *   - Maturity: Modified Following
 *   - Short end (≤ 95 days): simple-compounded zero discount
 *   - Long end: sequential quarterly bootstrap with par-rate
 *     interpolation for tenors not on the 3M grid
 *
 * Validated against the reference Excel to 0.00 bp on all standard
 * tenors (see README.md in ois_pricer).
 */

import {
  addBusinessDays,
  addMonths,
  daysBetween,
  modifiedFollowing,
  parseIso,
  toIso,
} from "./calendar";
import type {
  BootstrapResult,
  DFNode,
  OISQuote,
  QuoteSide,
} from "./types";

// --- Internal ---------------------------------------------------------------

interface TenorInput {
  quote: OISQuote;
  matDate: Date;
  days: number;
  /** Decimal rate (0.4025 = 40.25%) on the requested side. */
  rate: number;
}

function quoteRate(q: OISQuote, side: QuoteSide): number {
  const pct = side === "bid" ? q.bid : side === "ask" ? q.ask : (q.bid + q.ask) / 2.0;
  return pct / 100.0;
}

/**
 * OIS maturity date from a value date.
 *   - Month tenors: value + N months, Modified Following
 *   - Day/week tenors: value + N calendar days, Modified Following
 * Matches `compute_maturity` in engine_v2/bootstrap.py.
 */
export function computeMaturity(
  valueDate: Date,
  months: number,
  days: number,
): Date {
  const raw = months > 0
    ? addMonths(valueDate, months)
    : new Date(valueDate.getTime() + days * 86_400_000);
  return modifiedFollowing(raw);
}

/**
 * Bootstrap the TLREF OIS curve from a market quote vector.
 *
 * Steps:
 *   1. Determine value date = trade + 1 BD.
 *   2. Build tenor inputs (maturity, days, rate) sorted by days.
 *   3. Short end (≤ 95d): DF = 1 / (1 + r · d/365).
 *   4. Long end: walk a quarterly grid (3M, 6M, 9M, …). At each step
 *      interpolate the par rate linearly from the original market
 *      quotes, then solve the sequential swap-PV equation for DF_n:
 *
 *        DF_n = (1 − r_n · Σ(τ_i · DF_i) / 365)
 *             / (1 + r_n · τ_n / 365)
 *
 *   5. Dedup by `days`, keeping the later (longer-tenor-matched) node.
 */
export function bootstrap(
  quotes: readonly OISQuote[],
  tradeDate: Date,
  side: QuoteSide = "mid",
): BootstrapResult {
  const valueDate = addBusinessDays(tradeDate, 1);

  const tenorInputs: TenorInput[] = quotes.map((q) => {
    const mat = computeMaturity(valueDate, q.months, q.days);
    return {
      quote: q,
      matDate: mat,
      days: daysBetween(valueDate, mat),
      rate: quoteRate(q, side),
    };
  });
  tenorInputs.sort((a, b) => a.days - b.days);

  // Anchor at t=0.
  const nodes: DFNode[] = [
    { days: 0, df: 1.0, matDate: toIso(valueDate), tenor: "T0", parRate: 0 },
  ];

  // Short end — simple-compounded ZC discount.
  for (const t of tenorInputs) {
    if (t.days > 95) continue;
    const df = 1.0 / (1.0 + (t.rate * t.days) / 365.0);
    nodes.push({
      days: t.days,
      df,
      matDate: toIso(t.matDate),
      tenor: t.quote.tenor,
      parRate: t.rate,
    });
  }

  // Long end — sequential quarterly bootstrap.
  const longEnd = tenorInputs.filter((t) => t.days > 95);
  if (longEnd.length > 0) {
    const maxMonths = Math.max(...longEnd.map((t) => t.quote.months));

    // Full market quote set (days, rate), sorted, for par-rate interpolation.
    const mktPts: Array<[number, number]> = tenorInputs
      .map((t) => [t.days, t.rate] as [number, number])
      .sort((a, b) => a[0] - b[0]);

    const interpPar = (targetDays: number): number => {
      for (const [d, r] of mktPts) if (d === targetDays) return r;
      for (let i = 0; i < mktPts.length - 1; i++) {
        const [d0, r0] = mktPts[i];
        const [d1, r1] = mktPts[i + 1];
        if (d0 <= targetDays && targetDays <= d1) {
          const w = (targetDays - d0) / (d1 - d0);
          return r0 + w * (r1 - r0);
        }
      }
      return targetDays > mktPts[mktPts.length - 1][0]
        ? mktPts[mktPts.length - 1][1]
        : mktPts[0][1];
    };

    interface GridEntry {
      days: number;
      tau: number;
      df: number;
    }
    const grid: GridEntry[] = [];

    for (let qm = 3; qm <= maxMonths; qm += 3) {
      const mat = computeMaturity(valueDate, qm, 0);
      const qDays = daysBetween(valueDate, mat);
      const parR = interpPar(qDays);
      const prevD = grid.length > 0 ? grid[grid.length - 1].days : 0;
      const tauN = qDays - prevD;
      const sumTauDf = grid.reduce((s, g) => s + g.tau * g.df, 0);

      const dfN =
        (1.0 - (parR * sumTauDf) / 365.0) / (1.0 + (parR * tauN) / 365.0);

      let tenorLabel = `${qm}M`;
      for (const t of longEnd) {
        if (t.days === qDays) {
          tenorLabel = t.quote.tenor;
          break;
        }
      }

      grid.push({ days: qDays, tau: tauN, df: dfN });
      nodes.push({
        days: qDays,
        df: dfN,
        matDate: toIso(mat),
        tenor: tenorLabel,
        parRate: parR,
      });
    }
  }

  // Sort + dedup by days (keep later entries — market-labeled wins over grid-labeled).
  nodes.sort((a, b) => a.days - b.days);
  const unique: DFNode[] = [];
  for (const n of nodes) {
    if (unique.length === 0 || unique[unique.length - 1].days !== n.days) {
      unique.push(n);
    } else {
      unique[unique.length - 1] = n;
    }
  }

  return {
    valueDate: toIso(valueDate),
    tradeDate: toIso(tradeDate),
    nodes: unique,
  };
}

/**
 * Convenience wrapper: accept an ISO trade date string, return the
 * bootstrap result.
 */
export function bootstrapIso(
  quotes: readonly OISQuote[],
  tradeDateIso: string,
  side: QuoteSide = "mid",
): BootstrapResult {
  return bootstrap(quotes, parseIso(tradeDateIso), side);
}
