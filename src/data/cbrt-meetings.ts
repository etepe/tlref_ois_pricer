/**
 * CBRT Monetary Policy Committee (PPK) meeting dates, 2026-2028.
 *
 * Approximates the CBRT's announced calendar (8 meetings per year, roughly
 * every 5-6 weeks). Dates are sorted ascending — required by the pricing
 * core when building the forward TLREF path.
 */

export const CBRT_MEETING_DATES: readonly string[] = [
  // 2026
  "2026-01-22",
  "2026-03-05",
  "2026-04-23",
  "2026-06-18",
  "2026-07-23",
  "2026-09-10",
  "2026-10-22",
  "2026-12-10",
  // 2027
  "2027-01-21",
  "2027-03-04",
  "2027-04-22",
  "2027-06-17",
  "2027-07-22",
  "2027-09-09",
  "2027-10-21",
  "2027-12-09",
  // 2028
  "2028-01-20",
  "2028-03-02",
  "2028-04-20",
  "2028-06-15",
  "2028-07-20",
  "2028-09-07",
  "2028-10-19",
  "2028-12-07",
];

/**
 * Front-loaded example cut scenario totalling -525 bps.
 * With spot 39.99%, terminal TLREF = 39.99 - 5.25 = 34.74%.
 * Keys are chosen so that if value date is around April 2026 all cuts
 * remain in the forward window.
 */
export const DEFAULT_CUTS: Readonly<Record<string, number>> = {
  "2026-04-23": -100,
  "2026-06-18": -100,
  "2026-07-23":  -75,
  "2026-09-10":  -75,
  "2026-10-22":  -75,
  "2026-12-10":  -50,
  "2027-01-21":  -50,
};
