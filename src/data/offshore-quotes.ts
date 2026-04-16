/**
 * Default offshore TRY (TRYI) quotes. Source: Bloomberg TRYI* series as
 * of 2026-04-13; mirrors `Q_OFF` in ois_pricer/frontend/tlref-ois-pricer.jsx.
 *
 * Day count is Act/360 (offshore convention). DFs are the Bloomberg-
 * screen values; the Market Data tab recomputes them from the user's
 * edited rate using offshoreDFFromRate.
 */

import type { OffshoreQuote } from "../core/types";

export const DEFAULT_OFFSHORE_QUOTES: readonly OffshoreQuote[] = [
  { tenor: "ON",  days: 0,    rate: 31.75, df: 1.00000, ticker: "TRYION" },
  { tenor: "TN",  days: 1,    rate: 28.00, df: 0.99922, ticker: "TRYITN" },
  { tenor: "1W",  days: 7,    rate: 30.35, df: 0.99411, ticker: "TRYI1W" },
  { tenor: "2W",  days: 14,   rate: 33.15, df: 0.98722, ticker: "TRYI2W" },
  { tenor: "1M",  days: 30,   rate: 34.53, df: 0.97124, ticker: "TRYI1M" },
  { tenor: "2M",  days: 63,   rate: 36.35, df: 0.94034, ticker: "TRYI2M" },
  { tenor: "3M",  days: 91,   rate: 37.40, df: 0.91365, ticker: "TRYI3M" },
  { tenor: "6M",  days: 183,  rate: 38.75, df: 0.83543, ticker: "TRYI6M" },
  { tenor: "9M",  days: 275,  rate: 39.69, df: 0.76710, ticker: "TRYI9M" },
  { tenor: "1Y",  days: 365,  rate: 41.02, df: 0.70629, ticker: "TRYI12M" },
  { tenor: "18M", days: 548,  rate: 38.05, df: 0.63321, ticker: "TRYI18M" },
  { tenor: "2Y",  days: 731,  rate: 39.04, df: 0.55768, ticker: "TRYI2Y" },
  { tenor: "3Y",  days: 1096, rate: 36.94, df: 0.47101, ticker: "TRYI3Y" },
];
