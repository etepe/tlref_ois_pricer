import { describe, it, expect } from "vitest";
import {
  isBizDay,
  modifiedFollowing,
  gFactorCapped,
  daysBetween,
} from "../src/core/calendar";

/** Build a UTC-midnight Date from a y/m/d triple. */
function d(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m - 1, day));
}

describe("isBizDay", () => {
  it("returns false on weekends", () => {
    expect(isBizDay(d(2026, 6, 13))).toBe(false); // Saturday
    expect(isBizDay(d(2026, 6, 14))).toBe(false); // Sunday
  });

  it("returns false on Ulusal Egemenlik (2026-04-23)", () => {
    expect(isBizDay(d(2026, 4, 23))).toBe(false);
  });

  it("returns true on a plain weekday", () => {
    expect(isBizDay(d(2026, 4, 10))).toBe(true); // Friday
    expect(isBizDay(d(2026, 6, 12))).toBe(true); // Friday
    expect(isBizDay(d(2026, 6, 15))).toBe(true); // Monday
  });

  it("returns false on Ramazan Bayramı arife (2026-03-19)", () => {
    expect(isBizDay(d(2026, 3, 19))).toBe(false);
  });

  it("returns false on Kurban Bayramı (2026-05-28)", () => {
    expect(isBizDay(d(2026, 5, 28))).toBe(false);
  });
});

describe("modifiedFollowing", () => {
  it("Saturday 2026-06-13 rolls forward to Monday 2026-06-15", () => {
    const out = modifiedFollowing(d(2026, 6, 13));
    expect(out.getTime()).toBe(d(2026, 6, 15).getTime());
  });

  it("is a no-op on an existing business day", () => {
    const out = modifiedFollowing(d(2026, 4, 10));
    expect(out.getTime()).toBe(d(2026, 4, 10).getTime());
  });

  it("rolls backward when forward roll crosses a month boundary", () => {
    // 2026-01-31 is Saturday; forward would land on 2026-02-02 Mon
    // (different month), so Modified Following backs up to 2026-01-30 Fri.
    const out = modifiedFollowing(d(2026, 1, 31));
    expect(out.getTime()).toBe(d(2026, 1, 30).getTime());
  });
});

describe("daysBetween", () => {
  it("computes inclusive day differences", () => {
    expect(daysBetween(d(2026, 4, 10), d(2026, 4, 13))).toBe(3);
    expect(daysBetween(d(2026, 6, 12), d(2026, 6, 13))).toBe(1);
  });

  it("is anti-symmetric", () => {
    const a = d(2026, 1, 1);
    const b = d(2026, 12, 31);
    expect(daysBetween(a, b)).toBe(-daysBetween(b, a));
  });
});

describe("gFactorCapped", () => {
  it("Friday → Monday (no cap) returns 3", () => {
    // d = 2026-04-10 Fri, maturity = 2026-04-13 Mon
    expect(gFactorCapped(d(2026, 4, 10), d(2026, 4, 13))).toBe(3);
  });

  it("maturity cap pulls g-factor down to 1 (Fri → Sat maturity)", () => {
    // d = 2026-06-12 Fri, maturity = 2026-06-13 Sat
    expect(gFactorCapped(d(2026, 6, 12), d(2026, 6, 13))).toBe(1);
  });

  it("no cap needed when maturity is past next biz day", () => {
    // d = 2026-06-12 Fri, maturity = 2026-06-16 Tue ⇒ next biz day Mon, g = 3
    expect(gFactorCapped(d(2026, 6, 12), d(2026, 6, 16))).toBe(3);
  });

  it("mid-week fixing has g = 1", () => {
    // d = 2026-06-15 Mon, maturity far out
    expect(gFactorCapped(d(2026, 6, 15), d(2027, 1, 1))).toBe(1);
  });

  it("never returns less than 1 even if maturity equals d", () => {
    expect(gFactorCapped(d(2026, 6, 12), d(2026, 6, 12))).toBe(1);
  });
});
