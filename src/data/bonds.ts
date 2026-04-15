/**
 * Default TLREF-universe bond list. 22 ISINs covering floating, fixed,
 * and zero-coupon bonds sampled from the TRY sovereign curve around the
 * 2026-04-13 trade date. Mirrors the `BONDS` constant in
 * ois_pricer/frontend/tlref-ois-pricer.jsx.
 *
 * Floating (flt) = TLREF-linked, quarterly reset, dirty price quotes.
 * Fixed (fix)   = semi-annual coupon, clean price quotes.
 * Zero (zcb)    = single principal cash flow at maturity.
 */

import type { Bond } from "../core/types";

export const DEFAULT_BONDS: readonly Bond[] = [
  { isin: "TRB170626T13", maturity: "2026-06-17", coupon: 0,     freq: 0, lastPrice: 93.545,  type: "zcb" },
  { isin: "TRT080726T13", maturity: "2026-07-08", coupon: 42.35, freq: 4, lastPrice: 100.20,  type: "flt" },
  { isin: "TRT190826T19", maturity: "2026-08-19", coupon: 40.08, freq: 4, lastPrice: 100.80,  type: "flt" },
  { isin: "TRT060127T10", maturity: "2027-01-06", coupon: 0,     freq: 0, lastPrice: 77.254,  type: "zcb" },
  { isin: "TRT130127T11", maturity: "2027-01-13", coupon: 39.90, freq: 4, lastPrice: 99.00,   type: "flt" },
  { isin: "TRT160627T13", maturity: "2027-06-16", coupon: 40.32, freq: 4, lastPrice: 101.05,  type: "flt" },
  { isin: "TRT140727T14", maturity: "2027-07-14", coupon: 37.84, freq: 2, lastPrice: 99.40,   type: "fix" },
  { isin: "TRT131027T10", maturity: "2027-10-13", coupon: 39.90, freq: 4, lastPrice: 100.40,  type: "flt" },
  { isin: "TRT131027T36", maturity: "2027-10-13", coupon: 36.78, freq: 2, lastPrice: 99.45,   type: "fix" },
  { isin: "TRD171127T13", maturity: "2027-11-17", coupon: 39.00, freq: 2, lastPrice: 100.00,  type: "fix" },
  { isin: "TRT190128T14", maturity: "2028-01-19", coupon: 39.82, freq: 4, lastPrice: 100.25,  type: "flt" },
  { isin: "TRT010328T12", maturity: "2028-03-01", coupon: 40.63, freq: 4, lastPrice: 100.40,  type: "flt" },
  { isin: "TRT170528T12", maturity: "2028-05-17", coupon: 40.08, freq: 4, lastPrice: 100.20,  type: "flt" },
  { isin: "TRT060928T11", maturity: "2028-09-06", coupon: 40.48, freq: 4, lastPrice: 100.50,  type: "flt" },
  { isin: "TRT081128T15", maturity: "2028-11-08", coupon: 31.08, freq: 2, lastPrice: 92.25,   type: "fix" },
  { isin: "TRT061228T16", maturity: "2028-12-06", coupon: 40.48, freq: 4, lastPrice: 100.425, type: "flt" },
  { isin: "TRT070329T15", maturity: "2029-03-07", coupon: 40.48, freq: 4, lastPrice: 100.20,  type: "flt" },
  { isin: "TRT040729T14", maturity: "2029-04-07", coupon: 40.01, freq: 2, lastPrice: 100.00,  type: "fix" },
  { isin: "TRT130629T30", maturity: "2029-06-13", coupon: 40.32, freq: 4, lastPrice: 100.10,  type: "flt" },
  { isin: "TRT120929T12", maturity: "2029-09-12", coupon: 30.00, freq: 2, lastPrice: 90.175,  type: "fix" },
  { isin: "TRT090130T12", maturity: "2030-01-09", coupon: 37.20, freq: 2, lastPrice: 97.075,  type: "fix" },
  { isin: "TRT100730T13", maturity: "2030-07-10", coupon: 34.10, freq: 2, lastPrice: 100.00,  type: "fix" },
];
