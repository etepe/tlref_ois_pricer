/**
 * Default onshore OIS bid/ask quotes used when no Bloomberg data is
 * loaded. Values snapshot the 2026-04-13 TRY_ois sheet in FX_market_2.xlsm
 * and mirror the `Q_OIS` constant in ois_pricer/frontend/tlref-ois-pricer.jsx.
 *
 * The Market Data tab lets users edit these in-place — they are the seed
 * state, not hardcoded read-only values.
 */

import type { OISQuote } from "../core/types";

export const DEFAULT_OIS_QUOTES: readonly OISQuote[] = [
  { tenor: "1W",  months: 0,  days: 7,  bid: 39.60, ask: 40.60 },
  { tenor: "2W",  months: 0,  days: 14, bid: 39.75, ask: 40.75 },
  { tenor: "1M",  months: 1,  days: 0,  bid: 40.30, ask: 40.50 },
  { tenor: "2M",  months: 2,  days: 0,  bid: 40.69, ask: 40.89 },
  { tenor: "3M",  months: 3,  days: 0,  bid: 41.15, ask: 41.35 },
  { tenor: "6M",  months: 6,  days: 0,  bid: 39.98, ask: 40.18 },
  { tenor: "9M",  months: 9,  days: 0,  bid: 38.98, ask: 39.18 },
  { tenor: "1Y",  months: 12, days: 0,  bid: 38.05, ask: 38.25 },
  { tenor: "18M", months: 18, days: 0,  bid: 36.75, ask: 36.95 },
  { tenor: "2Y",  months: 24, days: 0,  bid: 35.68, ask: 35.88 },
  { tenor: "3Y",  months: 36, days: 0,  bid: 34.08, ask: 34.30 },
  { tenor: "4Y",  months: 48, days: 0,  bid: 32.84, ask: 33.05 },
  { tenor: "5Y",  months: 60, days: 0,  bid: 31.79, ask: 32.02 },
];
