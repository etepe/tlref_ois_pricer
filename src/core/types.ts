/**
 * Shared core types for the TLREF OIS pricer.
 */

/**
 * A CBRT policy-rate decision used to construct the forward TLREF path.
 *
 * `cut` is in basis points relative to the previous level — e.g.
 * `-250` means a 250 bps cut, `+150` means a 150 bps hike. The decision
 * is applied **starting on `date`** (inclusive), so on `date - 1` the
 * old level still holds and on `date` the new level is in force.
 */
export interface Meeting {
  /** ISO `YYYY-MM-DD`, the first day on which the new rate applies. */
  date: string;
  /** Rate change in basis points (signed). */
  cut: number;
}

/**
 * Daily discount-factor map keyed by ISO `YYYY-MM-DD`. Wraps the raw
 * `Map<string, number>` so downstream pricer code can attach metadata
 * (e.g. start date, maturity, source curve) without breaking callers.
 */
export interface DFResult {
  dfMap: Map<string, number>;
}
