import { describe, it, expect } from "vitest";
import { computeParRate, quarterlySchedule, getDF } from "../src/core/pricing";
import type { Meeting } from "../src/core/types";

/** Build a UTC-midnight Date from a y/m/d triple. */
function d(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m - 1, day));
}

describe("quarterlySchedule", () => {
  it("produces 4 quarterly coupons for a 1Y swap starting mid-April", () => {
    // 2026-04-13 Mon, 2027-04-13 Tue — all 13ths are biz days in 2026-27.
    const out = quarterlySchedule(d(2026, 4, 13), d(2027, 4, 13));
    expect(out).toHaveLength(4);
    expect(out[0].getTime()).toBe(d(2026, 7, 13).getTime());
    expect(out[1].getTime()).toBe(d(2026, 10, 13).getTime());
    expect(out[2].getTime()).toBe(d(2027, 1, 13).getTime());
    expect(out[3].getTime()).toBe(d(2027, 4, 13).getTime());
  });

  it("uses matDate when the next step overshoots (short stub)", () => {
    // 100-day swap: start+3M ≈ 91d, then mat ≈ 100d → [MF(start+3M), mat].
    const out = quarterlySchedule(d(2026, 4, 13), d(2026, 7, 22));
    expect(out).toHaveLength(2);
    expect(out[1].getTime()).toBe(d(2026, 7, 22).getTime());
  });

  it("uses matDate on the very first step for ≤3M swaps", () => {
    const out = quarterlySchedule(d(2026, 4, 13), d(2026, 5, 13));
    expect(out).toHaveLength(1);
    expect(out[0].getTime()).toBe(d(2026, 5, 13).getTime());
  });
});

describe("getDF", () => {
  const map = new Map<string, number>([
    ["2026-06-15", 0.95],
    ["2026-06-16", 0.94],
  ]);

  it("returns the exact-key DF when present", () => {
    expect(getDF(map, d(2026, 6, 15))).toBe(0.95);
  });

  it("finds the nearest DF within ±5 days", () => {
    expect(getDF(map, d(2026, 6, 17))).toBe(0.94); // -1
    expect(getDF(map, d(2026, 6, 13))).toBe(0.95); // +2
  });

  it("throws when no DF is found within ±5 days", () => {
    expect(() => getDF(map, d(2027, 1, 1))).toThrow(/DF not found/);
  });
});

describe("computeParRate — ZC sanity (flat 40%, 7-day swap)", () => {
  const res = computeParRate("2026-04-13", "2026-04-20", [], 40);

  it("picks the ZC branch with correct metadata", () => {
    expect(res.method).toBe("ZC");
    expect(res.periods).toBe(1);
    expect(res.calDays).toBe(7);
    expect(res.adjMat).toBe("2026-04-20");
  });

  it("fair rate is ~40% (compounding skew ~11 bps on 7 days)", () => {
    // Flat 40% ACT/365 compound over 7 days: DF ≈ (1+r/365)^4·(1+3r/365).
    // ZC formula uses simple interest, so fair ≈ 40.11%.
    expect(res.fairRate).toBeCloseTo(40, 0);
  });
});

describe("computeParRate — cut effect inside a 1M swap", () => {
  const meetings: Meeting[] = [{ date: "2026-04-22", cut: -250 }];
  const res = computeParRate("2026-04-13", "2026-05-13", meetings, 40);

  it("picks the ZC branch (30 days ≤ 95)", () => {
    expect(res.method).toBe("ZC");
  });

  it("blended fair rate sits strictly between the two levels", () => {
    // Level 1: 40% until 2026-04-22; level 2: 37.50% thereafter.
    expect(res.fairRate).toBeLessThan(40);
    expect(res.fairRate).toBeGreaterThan(37.5);
  });
});

describe("computeParRate — ZC/PAR branch continuity near 95 days", () => {
  // Flat 40%, no meetings. 91d → ZC; 96d (rolls to 98d Mon) → PAR (stub tail).
  // At ~90 days of ACT/365 compounding, fair ≈ 42% (not 40) because the ZC
  // simple-interest formula back-solves the compound DF.
  const zc = computeParRate("2026-04-13", "2026-07-13", [], 40);
  const par = computeParRate("2026-04-13", "2026-07-18", [], 40);

  it("ZC side at 91 days takes the ZC branch", () => {
    expect(zc.method).toBe("ZC");
    expect(zc.calDays).toBe(91);
    expect(zc.fairRate).toBeGreaterThan(41);
    expect(zc.fairRate).toBeLessThan(43);
  });

  it("PAR side at ~96 days takes the PAR branch", () => {
    expect(par.method).toBe("PAR");
    // 2026-07-18 is Saturday → adjMat rolls to Mon 2026-07-20 (98 days).
    expect(par.calDays).toBeGreaterThan(95);
    expect(par.fairRate).toBeGreaterThan(41);
    expect(par.fairRate).toBeLessThan(43);
  });

  it("fair rates agree across the branch switch (within 20 bps)", () => {
    expect(Math.abs(par.fairRate - zc.fairRate)).toBeLessThan(0.2);
  });
});

describe("computeParRate — Modified Following maturity adjustment", () => {
  // 2026-06-13 is Saturday → MF forward to Monday 2026-06-15 (same month).
  const res = computeParRate("2026-04-13", "2026-06-13", [], 40);

  it("reports the adjusted maturity", () => {
    expect(res.adjMat).toBe("2026-06-15");
  });

  it("calDays counts to the adjusted maturity, not the raw input", () => {
    expect(res.calDays).toBe(63);
  });

  it("still ZC branch with a plausible compound-skewed rate", () => {
    expect(res.method).toBe("ZC");
    // 63-day ACT/365 compounding at 40% → ZC fair ≈ 41.35%.
    expect(res.fairRate).toBeGreaterThan(41);
    expect(res.fairRate).toBeLessThan(42);
  });
});

describe("computeParRate — 5Y par rate with aggressive cut path", () => {
  const meetings: Meeting[] = [
    { date: "2026-06-10", cut: -250 },
    { date: "2026-09-10", cut: -250 },
    { date: "2026-12-10", cut: -250 },
    { date: "2027-03-10", cut: -200 },
  ];
  // Terminal TLREF = 40 − 9.5 = 30.5%.
  const res = computeParRate("2026-04-13", "2031-04-14", meetings, 40);

  it("picks the PAR branch with ~20 quarterly coupons", () => {
    expect(res.method).toBe("PAR");
    expect(res.periods).toBeGreaterThan(15);
    expect(res.periods).toBeLessThan(25);
  });

  it("par rate exceeds the terminal 30.5% level (front-loaded high rates dominate)", () => {
    expect(res.fairRate).toBeGreaterThan(31);
  });

  it("par rate stays below the starting 40% level", () => {
    expect(res.fairRate).toBeLessThan(35);
  });
});

describe("computeParRate — error path", () => {
  it("returns method ERR when maturity is before start", () => {
    const res = computeParRate("2026-04-13", "2026-04-10", [], 40);
    expect(res.method).toBe("ERR");
    expect(Number.isNaN(res.fairRate)).toBe(true);
    expect(res.periods).toBe(0);
  });
});
