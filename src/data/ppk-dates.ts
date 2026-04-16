/**
 * CBRT Monetary Policy Committee (PPK) meeting calendar, 2026-2029.
 *
 * Sourced from the `PPK_DATES` constant in ois_pricer/frontend/tlref-ois-pricer.jsx,
 * which matches the CBRT's announced schedule. Dates are sorted ascending.
 * The pricer uses these for implied PPK forward-rate extraction and as
 * anchor points on the Scenario tab's PPK override sliders.
 */

export const CBRT_MEETING_DATES: readonly string[] = [
  "2026-04-24",
  "2026-06-12",
  "2026-07-24",
  "2026-09-11",
  "2026-10-23",
  "2026-12-11",
  "2027-01-22",
  "2027-03-18",
  "2027-04-26",
  "2027-06-11",
  "2027-07-23",
  "2027-09-03",
  "2027-10-15",
  "2027-11-26",
  "2028-01-07",
  "2028-02-18",
  "2028-03-31",
  "2028-05-12",
  "2028-06-23",
  "2028-08-04",
  "2028-09-15",
  "2028-10-27",
  "2028-12-08",
  "2029-01-19",
  "2029-03-02",
  "2029-04-13",
];

/** Default trade date used by the app (sabit, see PLAN). */
export const DEFAULT_TRADE_DATE = "2026-04-13";
