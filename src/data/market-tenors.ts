/**
 * Hardcoded market quotes for the 13 standard TLREF OIS tenors.
 *
 * Maturities are fixed ISO dates (anchored at a 2026-04-13 trade date) —
 * the UI uses the selected value date as the pricing start but does NOT
 * shift the tenor calendar. Market rates are indicative snapshots.
 */

export interface MarketTenor {
  /** Short display label, e.g. "1W", "18M", "5Y". */
  label: string;
  /** ISO YYYY-MM-DD maturity (unadjusted; core applies Modified Following). */
  maturity: string;
  /** Quoted market fixed rate in percent. */
  marketRate: number;
}

export const MARKET_TENORS: readonly MarketTenor[] = [
  { label: "1W",  maturity: "2026-04-20", marketRate: 40.12 },
  { label: "2W",  maturity: "2026-04-27", marketRate: 40.16 },
  { label: "1M",  maturity: "2026-05-13", marketRate: 40.40 },
  { label: "2M",  maturity: "2026-06-13", marketRate: 40.70 },
  { label: "3M",  maturity: "2026-07-13", marketRate: 40.99 },
  { label: "6M",  maturity: "2026-10-13", marketRate: 39.80 },
  { label: "9M",  maturity: "2027-01-13", marketRate: 38.82 },
  { label: "1Y",  maturity: "2027-04-13", marketRate: 37.92 },
  { label: "18M", maturity: "2027-10-13", marketRate: 36.65 },
  { label: "2Y",  maturity: "2028-04-13", marketRate: 35.57 },
  { label: "3Y",  maturity: "2029-04-13", marketRate: 33.98 },
  { label: "4Y",  maturity: "2030-04-13", marketRate: 32.73 },
  { label: "5Y",  maturity: "2031-04-13", marketRate: 31.69 },
];
