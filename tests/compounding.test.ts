import { describe, it, expect } from "vitest";
import { tlrefAt, buildDailyDF } from "../src/core/compounding";
import type { Meeting } from "../src/core/types";

/** Build a UTC-midnight Date from a y/m/d triple. */
function d(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m - 1, day));
}

describe("tlrefAt", () => {
  const meetings: Meeting[] = [{ date: "2026-04-22", cut: -250 }];

  it("returns startTlref the day before a meeting", () => {
    expect(tlrefAt("2026-04-21", 39.99, meetings)).toBeCloseTo(39.99, 12);
  });

  it("applies the bps cut on the meeting date", () => {
    expect(tlrefAt("2026-04-22", 39.99, meetings)).toBeCloseTo(37.49, 12);
  });

  it("returns startTlref when there are no meetings", () => {
    expect(tlrefAt("2026-12-31", 40, [])).toBe(40);
  });

  it("applies multiple cuts cumulatively, only those <= dateStr", () => {
    const ms: Meeting[] = [
      { date: "2026-04-22", cut: -250 },
      { date: "2026-06-10", cut: -150 },
      { date: "2026-08-12", cut: 100 },
    ];
    expect(tlrefAt("2026-04-21", 40, ms)).toBeCloseTo(40, 12); // none
    expect(tlrefAt("2026-04-22", 40, ms)).toBeCloseTo(37.5, 12); // -2.50
    expect(tlrefAt("2026-06-10", 40, ms)).toBeCloseTo(36.0, 12); // -2.50 -1.50
    expect(tlrefAt("2026-08-12", 40, ms)).toBeCloseTo(37.0, 12); // -2.50 -1.50 +1.00
  });
});

describe("buildDailyDF — constant 40% over 7 days (5 biz + weekend)", () => {
  // 2026-06-08 Mon → 2026-06-15 Mon (no Turkish holidays in this stretch).
  // Mon..Thu fixings carry g=1, Fri carries g=3 (next biz day = Mon = mat).
  const startTlref = 40;
  const r = startTlref / 100;
  const dfMap = buildDailyDF("2026-06-08", d(2026, 6, 15), [], startTlref);

  // Exact compound: (1 + r/365)^4 * (1 + 3r/365)
  // (≈ 1/(1 + 0.40*7/365), the spec's small-rate approximation)
  const expectedMatDF = 1 / ((1 + r / 365) ** 4 * (1 + (3 * r) / 365));

  it("anchors DF(startDate) at 1.0", () => {
    expect(dfMap.get("2026-06-08")).toBe(1);
  });

  it("matches the exact compound product at maturity", () => {
    const got = dfMap.get("2026-06-15");
    expect(got).toBeDefined();
    expect(got!).toBeCloseTo(expectedMatDF, 12);
  });

  it("is flat across the weekend (Fri's g=3 already booked)", () => {
    const fri = dfMap.get("2026-06-12")!;
    const sat = dfMap.get("2026-06-13")!;
    const sun = dfMap.get("2026-06-14")!;
    // After Fri's update, the cursor steps Fri→Sat and records DF(Sat).
    // Sat & Sun are non-biz so no further compounding happens.
    expect(sat).toBeCloseTo(sun, 12);
    // Fri's recorded DF was set BEFORE its own update (it was the
    // dfMap entry written when stepping Thu→Fri), so DF(Sat) should
    // equal DF(Fri) / (1 + 3r/365).
    expect(sat).toBeCloseTo(fri / (1 + (3 * r) / 365), 12);
  });

  it("populates DF for every calendar day in [start, mat]", () => {
    const expectedKeys = [
      "2026-06-08",
      "2026-06-09",
      "2026-06-10",
      "2026-06-11",
      "2026-06-12",
      "2026-06-13",
      "2026-06-14",
      "2026-06-15",
    ];
    for (const k of expectedKeys) expect(dfMap.has(k)).toBe(true);
  });
});

describe("buildDailyDF — meeting in the middle of a 30-day period", () => {
  // 2026-06-01 Mon → 2026-07-01 Wed; no Turkish holidays in June 2026.
  // Meeting on Wed 2026-06-17 cuts 250 bps: 40% → 37.5%.
  const meetings: Meeting[] = [{ date: "2026-06-17", cut: -250 }];
  const startTlref = 40;
  const dfMap = buildDailyDF("2026-06-01", d(2026, 7, 1), meetings, startTlref);

  it("uses the old rate strictly before the meeting date", () => {
    expect(tlrefAt("2026-06-16", startTlref, meetings)).toBe(40);
  });

  it("uses the new rate on the meeting date", () => {
    expect(tlrefAt("2026-06-17", startTlref, meetings)).toBeCloseTo(37.5, 12);
  });

  it("DF ratio across a pre-meeting mid-week day uses the old rate", () => {
    // 2026-06-03 Wed (g=1) → next-day DF reflects compounding at 40%.
    const d3 = dfMap.get("2026-06-03")!;
    const d4 = dfMap.get("2026-06-04")!;
    expect(d4 / d3).toBeCloseTo(1 / (1 + 0.4 / 365), 12);
  });

  it("DF ratio across the meeting day uses the new rate", () => {
    // 2026-06-17 Wed (g=1) → next-day DF reflects compounding at 37.5%.
    const d17 = dfMap.get("2026-06-17")!;
    const d18 = dfMap.get("2026-06-18")!;
    expect(d18 / d17).toBeCloseTo(1 / (1 + 0.375 / 365), 12);
  });
});

describe("buildDailyDF — maturity cap on the final Friday g-factor", () => {
  const r = 0.4;

  it("caps Friday's g to 1 when maturity is the next day (Sat)", () => {
    // Mon 2026-06-08 → Sat 2026-06-13. Biz days Mon..Fri.
    // Fri's gFactorCapped(Fri, Sat) = min(3, 1) = 1.
    const dfMap = buildDailyDF("2026-06-08", d(2026, 6, 13), [], 40);
    const expected = 1 / (1 + r / 365) ** 5;
    expect(dfMap.get("2026-06-13")!).toBeCloseTo(expected, 12);
  });

  it("uses Friday's full g=3 when maturity is the following Mon", () => {
    // Mon 2026-06-08 → Mon 2026-06-15. Mon..Thu g=1, Fri g=3 (no cap).
    const dfMap = buildDailyDF("2026-06-08", d(2026, 6, 15), [], 40);
    const expected = 1 / ((1 + r / 365) ** 4 * (1 + (3 * r) / 365));
    expect(dfMap.get("2026-06-15")!).toBeCloseTo(expected, 12);
  });
});
