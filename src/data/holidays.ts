/**
 * Turkish public holidays 2026–2036.
 *
 * - Fixed-date holidays repeat every year (Yılbaşı, Ulusal Egemenlik,
 *   İşçi Bayramı, Gençlik Bayramı, Demokrasi, Zafer, Cumhuriyet).
 * - Ramazan Bayramı and Kurban Bayramı are Hijri-calendar based and
 *   hard-coded per year using the TR-government published schedule.
 *   The "arife" (half-day before the religious bayram) is modeled as
 *   a FULL non-business day per product decision — this matches how
 *   TR banks typically close their books.
 *
 * Dates are ISO `YYYY-MM-DD` strings interpreted as calendar dates
 * (no timezone — the calendar module treats everything as UTC).
 *
 * Exported:
 *   - `TURKISH_HOLIDAYS` — the full ordered list with human-readable names
 *   - `HOLIDAY_SET`      — memoized Set<string> for O(1) `has` lookup
 */

export interface Holiday {
  readonly date: string; // YYYY-MM-DD
  readonly name: string;
}

// --- Fixed-date holidays -----------------------------------------------------

const FIXED_HOLIDAYS: ReadonlyArray<{ mmdd: string; name: string }> = [
  { mmdd: "01-01", name: "Yılbaşı" },
  { mmdd: "04-23", name: "Ulusal Egemenlik ve Çocuk Bayramı" },
  { mmdd: "05-01", name: "Emek ve Dayanışma Günü" },
  { mmdd: "05-19", name: "Atatürk'ü Anma, Gençlik ve Spor Bayramı" },
  { mmdd: "07-15", name: "Demokrasi ve Milli Birlik Günü" },
  { mmdd: "08-30", name: "Zafer Bayramı" },
  { mmdd: "10-29", name: "Cumhuriyet Bayramı" },
];

const YEARS: ReadonlyArray<number> = [
  2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036,
];

// --- Hijri-based holidays (TR-gov published, arife included as full day) ----
//
// Each entry is [startDate, lastDate] inclusive. Arife is `startDate`.
// Ramazan Bayramı: 4 days (1 arife + 3 full). Kurban Bayramı: 5 days (1 arife + 4 full).

interface HijriRange {
  readonly start: string;
  readonly end: string;
  readonly name: string;
}

const HIJRI_HOLIDAYS: ReadonlyArray<HijriRange> = [
  // 2026
  { start: "2026-03-19", end: "2026-03-22", name: "Ramazan Bayramı" },
  { start: "2026-05-26", end: "2026-05-30", name: "Kurban Bayramı" },
  // 2027
  { start: "2027-03-09", end: "2027-03-12", name: "Ramazan Bayramı" },
  { start: "2027-05-16", end: "2027-05-20", name: "Kurban Bayramı" },
  // 2028
  { start: "2028-02-26", end: "2028-02-29", name: "Ramazan Bayramı" },
  { start: "2028-05-04", end: "2028-05-08", name: "Kurban Bayramı" },
  // 2029
  { start: "2029-02-14", end: "2029-02-17", name: "Ramazan Bayramı" },
  { start: "2029-04-23", end: "2029-04-27", name: "Kurban Bayramı" }, // 04-23 overlaps Ulusal Egemenlik; Set dedupes
  // 2030
  { start: "2030-02-04", end: "2030-02-07", name: "Ramazan Bayramı" },
  { start: "2030-04-13", end: "2030-04-17", name: "Kurban Bayramı" },
  // 2031
  { start: "2031-01-24", end: "2031-01-27", name: "Ramazan Bayramı" },
  { start: "2031-04-02", end: "2031-04-06", name: "Kurban Bayramı" },
  // 2032
  { start: "2032-01-13", end: "2032-01-16", name: "Ramazan Bayramı" },
  { start: "2032-03-21", end: "2032-03-25", name: "Kurban Bayramı" },
  // 2033 — two Ramazan Bayramı occurrences (early Jan + late Dec)
  { start: "2033-01-02", end: "2033-01-05", name: "Ramazan Bayramı" },
  { start: "2033-03-10", end: "2033-03-14", name: "Kurban Bayramı" },
  { start: "2033-12-22", end: "2033-12-25", name: "Ramazan Bayramı" },
  // 2034
  { start: "2034-02-28", end: "2034-03-04", name: "Kurban Bayramı" },
  { start: "2034-12-11", end: "2034-12-14", name: "Ramazan Bayramı" },
  // 2035
  { start: "2035-02-17", end: "2035-02-21", name: "Kurban Bayramı" },
  { start: "2035-12-01", end: "2035-12-04", name: "Ramazan Bayramı" },
  // 2036
  { start: "2036-02-07", end: "2036-02-11", name: "Kurban Bayramı" },
  { start: "2036-11-19", end: "2036-11-22", name: "Ramazan Bayramı" },
];

// --- Build the ordered holiday list -----------------------------------------

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function expandRange(range: HijriRange): Holiday[] {
  const out: Holiday[] = [];
  const [sy, sm, sd] = range.start.split("-").map(Number) as [number, number, number];
  const [ey, em, ed] = range.end.split("-").map(Number) as [number, number, number];
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  for (let t = startMs; t <= endMs; t += 86_400_000) {
    const d = new Date(t);
    const iso = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    out.push({ date: iso, name: range.name });
  }
  return out;
}

function buildHolidays(): ReadonlyArray<Holiday> {
  const list: Holiday[] = [];
  for (const year of YEARS) {
    for (const { mmdd, name } of FIXED_HOLIDAYS) {
      list.push({ date: `${year}-${mmdd}`, name });
    }
  }
  for (const range of HIJRI_HOLIDAYS) {
    list.push(...expandRange(range));
  }
  list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return list;
}

export const TURKISH_HOLIDAYS: ReadonlyArray<Holiday> = buildHolidays();

export const HOLIDAY_SET: ReadonlySet<string> = new Set(
  TURKISH_HOLIDAYS.map((h) => h.date),
);
