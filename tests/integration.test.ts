/**
 * End-to-end integration tests for the TLREF OIS pricer.
 *
 * These tests exercise the full pipeline (`buildDailyDF` →
 * `computeParRate`) by treating the pricer as a black box and verifying:
 *
 *   1. Round-trip consistency — market rates can be inverted to an
 *      implied CBRT cut path, and repricing with that path reproduces
 *      the inputs within 0.01 bps.
 *   2. Monotonicity — more aggressive cuts lower long-tenor swap rates,
 *      and with no meetings the long-tenor rate collapses to spot TLREF
 *      (up to a small compounding-convexity gap).
 *   3. Convexity — with a flat TLREF the ZC rate exceeds the simple
 *      average by a positive amount that grows with tenor length.
 *   4. Boundary behaviour — TLREF=0, TLREF=100, empty meeting list, and
 *      value-date == maturity all behave sensibly without throwing.
 *
 * No production code is modified. A local `bisect` helper + a local
 * sequential cut-path stripper are defined inline and stay private to
 * this test file.
 */

import { describe, it, expect } from "vitest";
import { computeParRate } from "../src/core/pricing";
import type { Meeting } from "../src/core/types";

// ---------- fixtures --------------------------------------------------------

/** Start (value) date used throughout — a known biz-day Monday. */
const START = "2026-04-13";

// ---------- local helpers (test-only, not exported) -------------------------

/**
 * Generic bisection root finder for a monotone scalar function.
 *
 * Requires `f(lo)` and `f(hi)` to straddle zero. Returns the midpoint
 * whose `|f|` is below `tol` (or whose bracket width is below `tol`).
 */
function bisect(
  f: (x: number) => number,
  lo: number,
  hi: number,
  tol = 1e-10,
  maxIter = 200,
): number {
  let flo = f(lo);
  let fhi = f(hi);
  if (flo === 0) return lo;
  if (fhi === 0) return hi;
  if (Math.sign(flo) === Math.sign(fhi)) {
    throw new Error(
      `bisect: root not bracketed — f(${lo})=${flo}, f(${hi})=${fhi}`,
    );
  }
  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    const fmid = f(mid);
    if (Math.abs(fmid) < tol || (hi - lo) / 2 < tol) return mid;
    if (Math.sign(fmid) === Math.sign(flo)) {
      lo = mid;
      flo = fmid;
    } else {
      hi = mid;
      fhi = fmid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Strip an implied CBRT cut path from a list of market quotes via
 * sequential bootstrap.
 *
 * For each meeting `i` (in order), find the tenor whose maturity
 * straddles only meetings `0..i` (i.e. the tenor that introduces
 * meeting `i` as the last unknown). Solve for `meetings[i].cut` with
 * bisection on `computeParRate`, holding earlier (already-solved)
 * cuts fixed and later cuts at 0. `fairRate` is monotonically
 * increasing in `cut` (more cut ⇒ lower future TLREF ⇒ lower rate),
 * which makes bisection well-defined.
 *
 * Expects `marketQuotes.length === meetingDates.length`, `meetingDates`
 * sorted ascending, and `marketQuotes` sorted ascending by maturity,
 * with `meetingDates[i] ∈ (startDate, marketQuotes[i].maturity)`.
 */
function stripCutPath(
  startDate: string,
  startTlref: number,
  meetingDates: string[],
  marketQuotes: ReadonlyArray<{ maturity: string; rate: number }>,
): Meeting[] {
  if (marketQuotes.length !== meetingDates.length) {
    throw new Error("need exactly one quote per meeting");
  }
  const meetings: Meeting[] = meetingDates.map((date) => ({ date, cut: 0 }));

  for (let i = 0; i < meetingDates.length; i++) {
    const quote = marketQuotes[i];
    if (!(meetingDates[i] > startDate && meetingDates[i] < quote.maturity)) {
      throw new Error(
        `meeting[${i}]=${meetingDates[i]} must lie in (${startDate}, ${quote.maturity})`,
      );
    }
    const target = quote.rate;
    const f = (cutBps: number): number => {
      meetings[i].cut = cutBps;
      const res = computeParRate(startDate, quote.maturity, meetings, startTlref);
      return res.fairRate - target;
    };
    // Cut range [-5000, +5000] bps (±50 pct) covers any realistic path.
    const solved = bisect(f, -5000, 5000, 1e-10, 200);
    meetings[i].cut = solved;
  }
  return meetings;
}

// ---------- 1. Round-trip ---------------------------------------------------

describe("integration: round-trip price → strip → reprice", () => {
  // Seed scenario: three CBRT meetings, non-trivial mixed cuts.
  const seedMeetings: Meeting[] = [
    { date: "2026-06-19", cut: -250 }, // -2.5 pct
    { date: "2026-08-21", cut: -150 }, // -1.5 pct
    { date: "2026-10-23", cut: -100 }, // -1.0 pct
  ];
  const seedStartTlref = 40.0;

  // Tenors chosen so quote[i] straddles meetings[0..i] only:
  //   - 2026-07-13 (91d, ZC) crosses the 06-19 meeting
  //   - 2026-09-14 (154d, PAR) crosses 06-19 + 08-21
  //   - 2026-11-13 (214d, PAR) crosses all three
  const tenors = ["2026-07-13", "2026-09-14", "2026-11-13"];

  it("strips the implied cuts and reprices within 0.01 bps", () => {
    // 1. Generate "market" quotes from the seed scenario.
    const seedQuotes = tenors.map((maturity) => {
      const res = computeParRate(START, maturity, seedMeetings, seedStartTlref);
      expect(res.method).not.toBe("ERR");
      return { maturity, rate: res.fairRate };
    });

    // Sanity: the three branches actually used.
    expect(
      computeParRate(START, tenors[0], seedMeetings, seedStartTlref).method,
    ).toBe("ZC");
    expect(
      computeParRate(START, tenors[1], seedMeetings, seedStartTlref).method,
    ).toBe("PAR");
    expect(
      computeParRate(START, tenors[2], seedMeetings, seedStartTlref).method,
    ).toBe("PAR");

    // 2. Strip the implied cut path from the quotes.
    const stripped = stripCutPath(
      START,
      seedStartTlref,
      seedMeetings.map((m) => m.date),
      seedQuotes,
    );

    // Stripped cuts should recover the seed cuts to solver tolerance.
    for (let i = 0; i < seedMeetings.length; i++) {
      expect(stripped[i].date).toBe(seedMeetings[i].date);
      // Tolerance 0.1 bps on the cut itself — looser than the reprice
      // tolerance because one bp of cut ≈ one bp of short-tenor rate.
      expect(Math.abs(stripped[i].cut - seedMeetings[i].cut)).toBeLessThan(0.1);
    }

    // 3. Reprice every tenor with the stripped path.
    for (let i = 0; i < tenors.length; i++) {
      const repriced = computeParRate(START, tenors[i], stripped, seedStartTlref);
      expect(repriced.method).not.toBe("ERR");
      // 0.01 bps = 0.0001 percent — the headline round-trip accuracy.
      expect(Math.abs(repriced.fairRate - seedQuotes[i].rate)).toBeLessThan(1e-4);
    }
  });
});

// ---------- 2. Monotonicity -------------------------------------------------

describe("integration: monotonicity in cut path", () => {
  const meetingDates = ["2026-06-19", "2026-08-21", "2026-10-23"];
  // 5Y tenor — comfortably in the PAR branch, dominated by cut-path effect.
  const longMat = "2031-04-14";
  const startTlref = 40.0;

  function mkMeetings(cuts: number[]): Meeting[] {
    return meetingDates.map((date, i) => ({ date, cut: cuts[i] }));
  }

  it("more aggressive cuts produce strictly lower long-tenor rates", () => {
    const aggressive = computeParRate(
      START,
      longMat,
      mkMeetings([-500, -500, -500]),
      startTlref,
    );
    const flat = computeParRate(
      START,
      longMat,
      mkMeetings([0, 0, 0]),
      startTlref,
    );
    const hikes = computeParRate(
      START,
      longMat,
      mkMeetings([+500, +500, +500]),
      startTlref,
    );

    expect(aggressive.method).toBe("PAR");
    expect(flat.method).toBe("PAR");
    expect(hikes.method).toBe("PAR");
    expect(aggressive.fairRate).toBeLessThan(flat.fairRate);
    expect(flat.fairRate).toBeLessThan(hikes.fairRate);
  });

  it("with no meetings the 5Y rate stays near spot TLREF (within convexity band)", () => {
    const res = computeParRate(START, longMat, [], startTlref);
    expect(res.method).toBe("PAR");
    // At 40 pct daily compounding, the par-rate convexity gap over a 5Y
    // horizon is ~200 bps. Allow ±300 bps as a conservative cap that
    // still excludes any catastrophic pricer bug.
    expect(Math.abs(res.fairRate - startTlref)).toBeLessThan(3.0);
  });

  it("with no meetings a 30d tenor is close to spot TLREF", () => {
    const res = computeParRate(START, "2026-05-13", [], startTlref);
    expect(res.method).toBe("ZC");
    // 30d ZC convexity gap at 40 pct is ~60 bps. Cap at 100 bps.
    expect(Math.abs(res.fairRate - startTlref)).toBeLessThan(1.0);
  });
});

// ---------- 3. Convexity ----------------------------------------------------

describe("integration: ZC compounding convexity over simple average", () => {
  const startTlref = 40.0;

  // All in the ZC branch (≤95 calendar days), flat 40% path.
  const tenor30 = computeParRate(START, "2026-05-13", [], startTlref);
  const tenor60 = computeParRate(START, "2026-06-12", [], startTlref);
  const tenor90 = computeParRate(START, "2026-07-13", [], startTlref);

  it("lands on the ZC branch for all three tenors", () => {
    expect(tenor30.method).toBe("ZC");
    expect(tenor60.method).toBe("ZC");
    expect(tenor90.method).toBe("ZC");
    expect(tenor90.calDays).toBeLessThanOrEqual(95);
  });

  it("ZC rate exceeds the 40% simple average at every tenor", () => {
    // By Jensen: Π(1+r·gᵢ/365) > 1 + r·Σgᵢ/365 whenever r > 0, so the
    // implied zero-coupon rate is strictly above the flat input.
    expect(tenor30.fairRate).toBeGreaterThan(40.0);
    expect(tenor60.fairRate).toBeGreaterThan(40.0);
    expect(tenor90.fairRate).toBeGreaterThan(40.0);
  });

  it("the convexity gap grows with tenor length", () => {
    const gap30 = tenor30.fairRate - 40.0;
    const gap60 = tenor60.fairRate - 40.0;
    const gap90 = tenor90.fairRate - 40.0;
    expect(gap30).toBeGreaterThan(0);
    expect(gap60).toBeGreaterThan(gap30);
    expect(gap90).toBeGreaterThan(gap60);
    // At 40 pct flat the 90d ZC convexity gap is ~200 bps. Cap at
    // 300 bps — large enough to cover the measured value but tight
    // enough that a pricing-formula regression would still blow up.
    expect(gap90).toBeLessThan(3.0);
  });
});

// ---------- 4. Boundary cases -----------------------------------------------

describe("integration: boundary cases", () => {
  it("TLREF = 0 → all tenors price to ~0", () => {
    const tenors = ["2026-05-13", "2026-06-12", "2026-07-13"];
    for (const mat of tenors) {
      const res = computeParRate(START, mat, [], 0);
      expect(res.method).toBe("ZC");
      // Compound = 1 on every biz day ⇒ DF = 1 ⇒ fair = 0 exactly.
      expect(Math.abs(res.fairRate)).toBeLessThan(1e-12);
    }
  });

  it("TLREF = 100 → computes a finite, larger-than-100 rate without throwing", () => {
    let res: ReturnType<typeof computeParRate> | undefined;
    expect(() => {
      res = computeParRate(START, "2026-05-13", [], 100);
    }).not.toThrow();
    expect(res!.method).toBe("ZC");
    expect(Number.isFinite(res!.fairRate)).toBe(true);
    // Compounding convexity pushes the implied ZC rate above the flat 100%.
    expect(res!.fairRate).toBeGreaterThan(100);
  });

  it("empty meetings list → all tenors ≈ spot TLREF (convexity only)", () => {
    const spot = 40.0;
    const zc = computeParRate(START, "2026-05-13", [], spot);
    const par = computeParRate(START, "2027-04-13", [], spot);

    expect(zc.method).toBe("ZC");
    expect(par.method).toBe("PAR");
    // 30d ZC convexity gap at 40 pct ≈ 60 bps; cap at 100 bps.
    expect(Math.abs(zc.fairRate - spot)).toBeLessThan(1.0);
    // 1Y PAR convexity gap ≈ 200 bps; cap at 300 bps.
    expect(Math.abs(par.fairRate - spot)).toBeLessThan(3.0);
  });

  it("value date == maturity → calDays=0, method=ERR, no throw", () => {
    let res: ReturnType<typeof computeParRate> | undefined;
    expect(() => {
      res = computeParRate(START, START, [], 40);
    }).not.toThrow();
    expect(res!.calDays).toBe(0);
    expect(res!.method).toBe("ERR");
    expect(Number.isNaN(res!.fairRate)).toBe(true);
    expect(res!.periods).toBe(0);
  });
});
