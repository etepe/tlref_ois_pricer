import { useMemo, useState } from "react";
import { computeParRate } from "./core/pricing";
import { tlrefAt } from "./core/compounding";
import type { Meeting } from "./core/types";
import { MARKET_TENORS } from "./data/market-tenors";
import { CBRT_MEETING_DATES, DEFAULT_CUTS } from "./data/cbrt-meetings";

// --- Helpers ----------------------------------------------------------------

const MS_PER_DAY = 86_400_000;

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mmdd(iso: string): string {
  return iso.slice(5);
}

function yymm(iso: string): string {
  return iso.slice(2, 7);
}

function isoToMs(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function msToIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// --- App --------------------------------------------------------------------

export default function App(): JSX.Element {
  const [spotTlref, setSpotTlref] = useState<number>(39.99);
  const [valueDate, setValueDate] = useState<string>(todayIso());
  const [cuts, setCuts] = useState<Record<string, number>>({ ...DEFAULT_CUTS });
  const [showAllMeetings, setShowAllMeetings] = useState<boolean>(false);
  const [selectedTenor, setSelectedTenor] = useState<string | null>(null);

  const meetings: Meeting[] = useMemo(
    () =>
      CBRT_MEETING_DATES.filter((d) => d >= valueDate).map((d) => ({
        date: d,
        cut: cuts[d] ?? 0,
      })),
    [valueDate, cuts],
  );

  const visibleMeetings = useMemo(
    () => (showAllMeetings ? meetings : meetings.slice(0, 14)),
    [meetings, showAllMeetings],
  );

  const totalBps = useMemo(
    () => meetings.reduce((s, m) => s + m.cut, 0),
    [meetings],
  );

  const terminalRate = useMemo(
    () => spotTlref + totalBps / 100,
    [spotTlref, totalBps],
  );

  const pricingResults = useMemo(
    () =>
      MARKET_TENORS.map((t) => ({
        ...t,
        result: computeParRate(valueDate, t.maturity, meetings, spotTlref),
      })),
    [valueDate, meetings, spotTlref],
  );

  const forwardPath = useMemo(() => {
    const pts: { date: string; rate: number; cut: number }[] = [
      { date: valueDate, rate: spotTlref, cut: 0 },
    ];
    for (const m of meetings) {
      pts.push({
        date: m.date,
        rate: tlrefAt(m.date, spotTlref, meetings),
        cut: m.cut,
      });
    }
    return pts;
  }, [valueDate, spotTlref, meetings]);

  const selectedResult = useMemo(
    () => pricingResults.find((r) => r.label === selectedTenor) ?? null,
    [pricingResults, selectedTenor],
  );

  // --- Color helpers --------------------------------------------------------

  const bpsColor = (bps: number): string => {
    if (bps < 0) return "text-positive";
    if (bps > 0) return "text-negative";
    return "text-fg-dimmed";
  };

  const bpsSliderAccent = (bps: number): string => {
    if (bps < 0) return "accent-positive";
    if (bps > 0) return "accent-negative";
    return "accent-fg-dimmed";
  };

  const diffColor = (bps: number): string => {
    if (!Number.isFinite(bps) || Math.abs(bps) <= 15) return "text-fg-muted";
    return bps < 0 ? "text-positive" : "text-negative";
  };

  // --- Render ---------------------------------------------------------------

  return (
    <div className="min-h-screen bg-bg text-fg font-mono p-4 md:p-6">
      {/* HEADER */}
      <header className="mb-4 border-b border-line pb-3">
        <h1 className="text-accent font-bold text-2xl tracking-wider">
          TLREF OIS PRİCER
        </h1>
        <p className="text-xs text-fg-muted mt-1">
          Quarterly Par Rate · ACT/365 · Modified Following · İstanbul
        </p>
      </header>

      {/* CONTROLS */}
      <section className="flex flex-wrap items-end gap-6 mb-4 bg-bg-panel border border-line rounded px-4 py-3">
        <label className="flex flex-col text-xs">
          <span className="text-fg-muted mb-1">Spot TLREF (%)</span>
          <input
            type="number"
            step="0.01"
            value={spotTlref}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setSpotTlref(Number.isNaN(v) ? 0 : v);
            }}
            className="bg-bg border border-line rounded px-2 py-1 text-accent font-bold w-32 focus:outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col text-xs">
          <span className="text-fg-muted mb-1">Value Date</span>
          <input
            type="date"
            value={valueDate}
            onChange={(e) => setValueDate(e.target.value)}
            className="bg-bg border border-line rounded px-2 py-1 text-fg w-40 focus:outline-none focus:border-accent"
          />
        </label>
        <div className="flex flex-col text-xs">
          <span className="text-fg-muted mb-1">Özet</span>
          <div className="font-bold">
            <span className="text-fg-muted">Toplam: </span>
            <span className={bpsColor(totalBps)}>
              {totalBps > 0 ? "+" : ""}
              {totalBps} bps
            </span>
            <span className="text-fg-muted ml-4">Terminal: </span>
            <span className="text-value">{terminalRate.toFixed(2)}%</span>
          </div>
        </div>
      </section>

      {/* MAIN GRID */}
      <section className="grid md:grid-cols-2 gap-4 mb-4">
        {/* Meetings Panel */}
        <div className="bg-bg-panel border border-line rounded">
          <div className="flex items-center justify-between px-4 py-2 border-b border-line">
            <h2 className="text-xs text-fg-muted uppercase tracking-wider">
              TCMB PPK Toplantıları
            </h2>
            <button
              onClick={() => setShowAllMeetings((v) => !v)}
              className="text-xs text-accent hover:text-value border border-line px-2 py-0.5 rounded"
            >
              {showAllMeetings ? "Kısa" : "Tümü"}
            </button>
          </div>
          <div className="overflow-x-auto max-h-[460px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-bg-panel">
                <tr className="text-fg-muted border-b border-line">
                  <th className="text-left px-3 py-1.5 font-normal">Tarih</th>
                  <th className="text-right px-3 py-1.5 font-normal">Δ (bps)</th>
                  <th className="text-right px-3 py-1.5 font-normal">TLREF</th>
                </tr>
              </thead>
              <tbody>
                {visibleMeetings.map((m) => {
                  const fwd = tlrefAt(m.date, spotTlref, meetings);
                  return (
                    <tr
                      key={m.date}
                      className="border-b border-line/50 hover:bg-bg"
                    >
                      <td className="px-3 py-1 text-fg-muted">{m.date}</td>
                      <td className="px-3 py-1">
                        <div className="flex items-center gap-2 justify-end">
                          <input
                            type="range"
                            min={-500}
                            max={500}
                            step={25}
                            value={m.cut}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              setCuts((prev) => ({
                                ...prev,
                                [m.date]: Number.isNaN(v) ? 0 : v,
                              }));
                            }}
                            className={`flex-1 min-w-0 h-1 cursor-pointer bps-slider ${bpsSliderAccent(m.cut)} ${bpsColor(m.cut)}`}
                          />
                          <span
                            className={`font-bold tabular-nums w-12 text-right ${bpsColor(m.cut)}`}
                          >
                            {m.cut > 0 ? `+${m.cut}` : m.cut}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-1 text-right text-value">
                        {fwd.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* OIS Pricing Panel */}
        <div className="bg-bg-panel border border-line rounded">
          <div className="px-4 py-2 border-b border-line">
            <h2 className="text-xs text-fg-muted uppercase tracking-wider">
              OIS Fiyatlama
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-fg-muted border-b border-line">
                  <th className="text-left px-3 py-1.5 font-normal">Tenor</th>
                  <th className="text-left px-3 py-1.5 font-normal">Vade</th>
                  <th className="text-left px-3 py-1.5 font-normal">Adj</th>
                  <th className="text-right px-3 py-1.5 font-normal">Model</th>
                  <th className="text-right px-3 py-1.5 font-normal">Piyasa</th>
                  <th className="text-right px-3 py-1.5 font-normal">Fark</th>
                  <th className="text-right px-3 py-1.5 font-normal">Gün</th>
                  <th className="text-center px-3 py-1.5 font-normal">Tip</th>
                </tr>
              </thead>
              <tbody>
                {pricingResults.map(({ label, maturity, marketRate, result }) => {
                  const diffBps = (result.fairRate - marketRate) * 100;
                  const adjusted = result.adjMat !== maturity;
                  return (
                    <tr
                      key={label}
                      onClick={() => setSelectedTenor(label)}
                      className="border-b border-line/50 hover:bg-bg cursor-pointer"
                    >
                      <td className="px-3 py-1 text-fg">{label}</td>
                      <td className="px-3 py-1 text-fg-muted">
                        {mmdd(maturity)}
                      </td>
                      <td className="px-3 py-1">
                        {adjusted ? (
                          <span className="text-accent">
                            {mmdd(result.adjMat)}
                          </span>
                        ) : (
                          <span className="text-fg-dimmed">=</span>
                        )}
                      </td>
                      <td className="px-3 py-1 text-right text-accent font-bold">
                        {Number.isFinite(result.fairRate)
                          ? result.fairRate.toFixed(2)
                          : "—"}
                      </td>
                      <td className="px-3 py-1 text-right text-fg-muted">
                        {marketRate.toFixed(2)}
                      </td>
                      <td className={`px-3 py-1 text-right ${diffColor(diffBps)}`}>
                        {Number.isFinite(diffBps)
                          ? `${diffBps > 0 ? "+" : ""}${diffBps.toFixed(0)}`
                          : "—"}
                      </td>
                      <td className="px-3 py-1 text-right text-fg-muted">
                        {result.calDays}
                      </td>
                      <td className="px-3 py-1 text-center text-fg-muted">
                        {result.method}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FORWARD CHART */}
      <section className="bg-bg-panel border border-line rounded p-4 mb-4">
        <h2 className="text-xs text-fg-muted uppercase tracking-wider mb-2">
          Forward TLREF Path
        </h2>
        <ForwardChart points={forwardPath} />
      </section>

      {/* FORMULA REFERENCE */}
      <footer className="grid md:grid-cols-3 gap-4 text-[11px] text-fg-muted border-t border-line pt-3">
        <div>
          <span className="text-fg-dimmed">DF:</span>{" "}
          DF(T) = 1 / Π(1 + rᵢ·gᵢ/365)
        </div>
        <div>
          <span className="text-fg-dimmed">ZC (≤95d):</span>{" "}
          fair = (1/DF − 1) · 365/t · 100
        </div>
        <div>
          <span className="text-fg-dimmed">PAR (&gt;95d):</span>{" "}
          fair = (1 − DF) / Σ(dcfᵢ·DFᵢ) · 100
        </div>
      </footer>

      {/* POPOVER */}
      {selectedResult && (
        <div
          onClick={() => setSelectedTenor(null)}
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-bg-panel border border-accent rounded p-5 max-w-sm w-full"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-xs text-fg-muted uppercase tracking-wider">
                  Tenor Detay
                </div>
                <div className="text-2xl text-accent font-bold">
                  {selectedResult.label}
                </div>
              </div>
              <button
                onClick={() => setSelectedTenor(null)}
                className="text-fg-muted hover:text-fg text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="space-y-1.5 text-xs">
              <DetailRow
                label="Vade (ham):"
                value={selectedResult.maturity}
              />
              <DetailRow
                label="Vade (Adj):"
                value={selectedResult.result.adjMat}
                highlight={
                  selectedResult.result.adjMat !== selectedResult.maturity
                }
              />
              <DetailRow
                label="Calendar days:"
                value={String(selectedResult.result.calDays)}
              />
              <DetailRow
                label="Kupon dönemi:"
                value={`${selectedResult.result.periods}`}
              />
              <DetailRow
                label="Metod:"
                value={selectedResult.result.method}
                highlight
              />
              <DetailRow
                label="Model rate:"
                value={
                  Number.isFinite(selectedResult.result.fairRate)
                    ? `${selectedResult.result.fairRate.toFixed(4)}%`
                    : "—"
                }
                highlight
              />
              <DetailRow
                label="Piyasa:"
                value={`${selectedResult.marketRate.toFixed(2)}%`}
              />
              <div className="border-t border-line pt-2 mt-3">
                <div className="text-fg-muted mb-1">Formül:</div>
                <div className="text-fg text-[11px] leading-tight">
                  {selectedResult.result.method === "ZC"
                    ? "fair = (1/DF(T) − 1) · 365/t · 100"
                    : selectedResult.result.method === "PAR"
                      ? "fair = (1 − DF(T)) / Σᵢ(dcfᵢ · DF(Tᵢ)) · 100"
                      : "(pricing error)"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---------------------------------------------------------

function DetailRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}): JSX.Element {
  return (
    <div className="flex justify-between">
      <span className="text-fg-muted">{label}</span>
      <span className={highlight ? "text-accent font-bold" : "text-fg"}>
        {value}
      </span>
    </div>
  );
}

interface ChartPoint {
  date: string;
  rate: number;
  cut: number;
}

function ForwardChart({ points }: { points: ChartPoint[] }): JSX.Element {
  if (points.length === 0) {
    return (
      <div className="text-fg-muted text-xs h-[220px] flex items-center justify-center">
        No forward path to display
      </div>
    );
  }

  // Extend with a 90-day tail so the final step is visible.
  const last = points[points.length - 1];
  const extended: ChartPoint[] = [
    ...points,
    { date: msToIso(isoToMs(last.date) + 90 * MS_PER_DAY), rate: last.rate, cut: 0 },
  ];

  const W = 900;
  const H = 220;
  const padL = 52;
  const padR = 18;
  const padT = 14;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xs = extended.map((p) => isoToMs(p.date));
  const xMin = xs[0];
  const xMax = xs[xs.length - 1];
  const xSpan = Math.max(1, xMax - xMin);

  const rates = extended.map((p) => p.rate);
  let yMin = Math.min(...rates);
  let yMax = Math.max(...rates);
  const pad = Math.max(0.5, (yMax - yMin) * 0.15);
  yMin -= pad;
  yMax += pad;
  const ySpan = Math.max(0.001, yMax - yMin);

  const xOf = (ms: number): number => padL + ((ms - xMin) / xSpan) * innerW;
  const yOf = (r: number): number =>
    padT + (1 - (r - yMin) / ySpan) * innerH;

  // Step-after path
  let d = "";
  extended.forEach((p, i) => {
    const x = xOf(isoToMs(p.date));
    const y = yOf(p.rate);
    if (i === 0) {
      d += `M ${x} ${y}`;
    } else {
      const prevY = yOf(extended[i - 1].rate);
      d += ` L ${x} ${prevY} L ${x} ${y}`;
    }
  });

  const yTicks = [yMax, (yMin + yMax) / 2, yMin];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-[220px]"
    >
      {/* Gridlines */}
      {yTicks.map((t, i) => (
        <line
          key={`g-${i}`}
          x1={padL}
          x2={W - padR}
          y1={yOf(t)}
          y2={yOf(t)}
          stroke="#1e2736"
          strokeDasharray="2 3"
        />
      ))}
      {/* Y labels */}
      {yTicks.map((t, i) => (
        <text
          key={`yl-${i}`}
          x={padL - 6}
          y={yOf(t) + 3}
          textAnchor="end"
          fontSize="10"
          fill="#6b7280"
          fontFamily="JetBrains Mono, monospace"
        >
          {t.toFixed(2)}
        </text>
      ))}
      {/* Step line */}
      <path
        d={d}
        fill="none"
        stroke="#ff8c00"
        strokeWidth={1.5}
        strokeLinejoin="miter"
      />
      {/* Points (exclude tail) */}
      {points.map((p, i) => {
        const color =
          p.cut < 0 ? "#10b981" : p.cut > 0 ? "#ef4444" : "#6b7280";
        return (
          <circle
            key={`pt-${i}`}
            cx={xOf(isoToMs(p.date))}
            cy={yOf(p.rate)}
            r={3}
            fill={color}
            stroke="#0a0e17"
            strokeWidth={1}
          />
        );
      })}
      {/* X labels — every 4th point */}
      {points.map((p, i) => {
        if (i % 4 !== 0) return null;
        return (
          <text
            key={`xl-${i}`}
            x={xOf(isoToMs(p.date))}
            y={H - padB + 14}
            textAnchor="middle"
            fontSize="10"
            fill="#6b7280"
            fontFamily="JetBrains Mono, monospace"
          >
            {yymm(p.date)}
          </text>
        );
      })}
    </svg>
  );
}
