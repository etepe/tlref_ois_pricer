/**
 * Unified Rates tab: merges the former Market Data (inputs), Curves &
 * Basis (derived charts/table), and Implied PPK (policy analysis) into
 * a single scrollable page.
 *
 * The flow top-to-bottom mirrors the pricing pipeline:
 *   1. MARKET DATA    — editable OIS + offshore quotes (the inputs)
 *   2. CURVES & BASIS — zero curves + basis chart + basis table
 *   3. IMPLIED PPK    — implied policy path + scenario overrides
 *
 * Within PPK the former Implied/Scenario sub-tabs are shown side-by-
 * side so the user can adjust the scenario while keeping the implied
 * reference visible.
 */

import type { JSX } from "react";
import { useMemo, useState } from "react";
import { zeroRate } from "../core/interpolation";
import type {
  DFNode,
  ImpliedPPK,
  OISQuote,
  OffshoreQuote,
  QuoteSide,
} from "../core/types";
import { Chart } from "./Chart";
import { C, tableCell, tableHeader } from "./theme";

interface Props {
  oisQuotes: readonly OISQuote[];
  offQuotes: readonly OffshoreQuote[];
  side: QuoteSide;
  onOisChange: (index: number, field: "bid" | "ask", value: number) => void;
  onOffChange: (index: number, rate: number) => void;

  oisNodes: readonly DFNode[];
  offNodes: readonly DFNode[];

  implied: readonly ImpliedPPK[];
  spotTlref: number;
}

export function RatesTab(props: Props): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      <Section title="Market Data" accent={C.bl}>
        <MarketDataBlock
          oisQuotes={props.oisQuotes}
          offQuotes={props.offQuotes}
          side={props.side}
          onOisChange={props.onOisChange}
          onOffChange={props.onOffChange}
        />
      </Section>

      <Section title="Curves & Basis" accent={C.ois}>
        <CurvesBlock oisNodes={props.oisNodes} offNodes={props.offNodes} />
      </Section>

      <Section title="Implied PPK" accent={C.am}>
        <PpkBlock implied={props.implied} spotTlref={props.spotTlref} />
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section shell
// ---------------------------------------------------------------------------

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "10px",
          paddingBottom: "6px",
          borderBottom: `1px solid ${C.bd}`,
        }}
      >
        <span
          style={{
            width: "3px",
            height: "14px",
            background: accent,
            borderRadius: "2px",
          }}
        />
        <span
          style={{
            fontSize: "10.5px",
            fontWeight: 700,
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: C.tx,
          }}
        >
          {title}
        </span>
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Market Data block (formerly MarketDataTab)
// ---------------------------------------------------------------------------

function RateInput({
  value,
  onChange,
  color,
  width = "58px",
}: {
  value: number;
  onChange: (v: number) => void;
  color?: string;
  width?: string;
}): JSX.Element {
  return (
    <input
      type="number"
      step="0.25"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      style={{
        width,
        background: C.bg,
        border: `1px solid ${C.bd}`,
        borderRadius: "3px",
        color: color || C.bl,
        padding: "3px 4px",
        fontSize: "11.5px",
        fontFamily: "monospace",
        textAlign: "right",
        outline: "none",
      }}
    />
  );
}

function MarketDataBlock({
  oisQuotes,
  offQuotes,
  side,
  onOisChange,
  onOffChange,
}: {
  oisQuotes: readonly OISQuote[];
  offQuotes: readonly OffshoreQuote[];
  side: QuoteSide;
  onOisChange: (index: number, field: "bid" | "ask", value: number) => void;
  onOffChange: (index: number, rate: number) => void;
}): JSX.Element {
  return (
    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 380px" }}>
        <div
          style={{
            fontSize: "12px",
            color: C.ois,
            fontWeight: 600,
            marginBottom: "6px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>Onshore OIS (TYSO · Act/365)</span>
          <span
            style={{
              fontSize: "9.5px",
              fontWeight: 700,
              letterSpacing: "0.5px",
              color: C.bl,
              background: `${C.bl}22`,
              border: `1px solid ${C.bl}44`,
              padding: "1px 6px",
              borderRadius: "3px",
              textTransform: "uppercase",
            }}
          >
            curve: {side}
          </span>
        </div>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {(
                [
                  ["Tenor", undefined],
                  ["Bid", "bid"],
                  ["Ask", "ask"],
                  ["Used", undefined],
                ] as ReadonlyArray<[string, QuoteSide | undefined]>
              ).map(([h, col]) => {
                const active = col !== undefined && side === col;
                return (
                  <th
                    key={h}
                    style={{
                      ...tableHeader,
                      textAlign: h === "Tenor" ? "left" : "right",
                      background: active ? `${C.bl}22` : tableHeader.background,
                      color: active ? C.bl : tableHeader.color,
                    }}
                  >
                    {h}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {oisQuotes.map((q, i) => {
              const used =
                side === "bid"
                  ? q.bid
                  : side === "ask"
                    ? q.ask
                    : (q.bid + q.ask) / 2;
              const bidCell = {
                ...tableCell,
                textAlign: "right" as const,
                background: side === "bid" ? `${C.bl}14` : undefined,
              };
              const askCell = {
                ...tableCell,
                textAlign: "right" as const,
                background: side === "ask" ? `${C.bl}14` : undefined,
              };
              return (
                <tr
                  key={q.tenor}
                  style={{
                    background: i % 2 ? `${C.sa}44` : "transparent",
                  }}
                >
                  <td style={{ ...tableCell, fontWeight: 600 }}>{q.tenor}</td>
                  <td style={bidCell}>
                    <RateInput
                      value={q.bid}
                      onChange={(v) => onOisChange(i, "bid", v)}
                    />
                  </td>
                  <td style={askCell}>
                    <RateInput
                      value={q.ask}
                      onChange={(v) => onOisChange(i, "ask", v)}
                    />
                  </td>
                  <td
                    style={{
                      ...tableCell,
                      textAlign: "right",
                      color: C.ois,
                      fontWeight: 600,
                    }}
                  >
                    {used.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ flex: "1 1 340px" }}>
        <div
          style={{
            fontSize: "12px",
            color: C.off,
            fontWeight: 600,
            marginBottom: "6px",
          }}
        >
          Offshore TRY (TRYI · Act/360){" "}
          <span style={{ color: C.tm, fontWeight: 400, fontSize: "10px" }}>
            implied deposit rates
          </span>
        </div>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Tenor", "Ticker", "Days", "Rate", "DF"].map((h) => (
                <th
                  key={h}
                  style={{
                    ...tableHeader,
                    textAlign: ["Tenor", "Ticker"].includes(h)
                      ? "left"
                      : "right",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {offQuotes.map((q, i) => {
              const editable = q.days > 0;
              return (
                <tr
                  key={q.tenor}
                  style={{
                    background: i % 2 ? `${C.sa}44` : "transparent",
                  }}
                >
                  <td style={{ ...tableCell, fontWeight: 600 }}>{q.tenor}</td>
                  <td
                    style={{
                      ...tableCell,
                      color: C.tm,
                      fontSize: "10px",
                    }}
                  >
                    {q.ticker}
                  </td>
                  <td
                    style={{
                      ...tableCell,
                      textAlign: "right",
                      color: C.tm,
                    }}
                  >
                    {q.days}
                  </td>
                  <td style={{ ...tableCell, textAlign: "right" }}>
                    {editable ? (
                      <RateInput
                        value={q.rate}
                        onChange={(v) => onOffChange(i, v)}
                        color={C.off}
                      />
                    ) : (
                      <span style={{ color: C.off, fontWeight: 600 }}>
                        {q.rate.toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      ...tableCell,
                      textAlign: "right",
                      color: C.tm,
                    }}
                  >
                    {q.df.toFixed(5)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Curves & Basis block (formerly CurvesTab)
// ---------------------------------------------------------------------------

function CurvesBlock({
  oisNodes,
  offNodes,
}: {
  oisNodes: readonly DFNode[];
  offNodes: readonly DFNode[];
}): JSX.Element {
  const { oisPts, offPts, basis } = useMemo(() => {
    const oisP = oisNodes
      .filter((n) => n.days > 0 && n.days <= 1600)
      .map((n) => ({ x: n.days, y: zeroRate(oisNodes, n.days, 365) }));
    const offP = offNodes
      .filter((n) => n.days > 0 && n.days <= 1600)
      .map((n) => ({ x: n.days, y: zeroRate(offNodes, n.days, 360) }));
    // Basis: compare the DF-derived zero-coupon returns at each OIS
    // node. OIS is quoted Act/365, offshore Act/360; both zero rates
    // are computed from the same log-linear DF interpolation so the
    // basis only reflects credit/FX wedge, not day-count noise.
    const b = oisNodes
      .filter((n) => n.days >= 7 && n.days <= 1600)
      .map((n) => {
        const o = zeroRate(oisNodes, n.days, 365);
        const x = zeroRate(offNodes, n.days, 360);
        return {
          days: n.days,
          tenor: n.tenor,
          ois: o,
          off: x,
          basis: (x - o) * 100,
        };
      });
    return { oisPts: oisP, offPts: offP, basis: b };
  }, [oisNodes, offNodes]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "14px",
        }}
      >
        <div style={{ flex: "1 1 300px", minWidth: "270px" }}>
          <Chart
            title="Zero Curves: OIS (Act/365) vs Offshore (Act/360)"
            yLabel="%"
            lines={[
              { pts: oisPts, color: C.ois, label: "OIS (Act/365)" },
              { pts: offPts, color: C.off, label: "Offshore (Act/360)" },
            ]}
          />
        </div>
        <div style={{ flex: "1 1 300px", minWidth: "270px" }}>
          <Chart
            title="Offshore − OIS Basis (bp)"
            yLabel="bp"
            ySuffix=" bp"
            lines={[
              {
                pts: basis.map((b) => ({ x: b.days, y: b.basis })),
                color: C.off,
                label: "Basis",
              },
            ]}
            dots={basis.map((b) => ({ x: b.days, y: b.basis, color: C.off }))}
            zeroLine
          />
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Tenor", "Days", "OIS (365)", "Offshore (360)", "Basis"].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      ...tableHeader,
                      textAlign: h === "Tenor" ? "left" : "right",
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {basis.map((b, i) => (
              <tr
                key={b.tenor + b.days}
                style={{ background: i % 2 ? `${C.sa}44` : "transparent" }}
              >
                <td style={{ ...tableCell, fontWeight: 600 }}>{b.tenor}</td>
                <td
                  style={{
                    ...tableCell,
                    textAlign: "right",
                    color: C.tm,
                  }}
                >
                  {b.days}
                </td>
                <td
                  style={{
                    ...tableCell,
                    textAlign: "right",
                    color: C.ois,
                  }}
                >
                  {b.ois.toFixed(2)}%
                </td>
                <td
                  style={{
                    ...tableCell,
                    textAlign: "right",
                    color: C.off,
                  }}
                >
                  {b.off.toFixed(2)}%
                </td>
                <td style={{ ...tableCell, textAlign: "right" }}>
                  <span style={{ color: C.off, fontWeight: 600 }}>
                    {b.basis > 0 ? "+" : ""}
                    {b.basis.toFixed(0)} bp
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Implied PPK block (formerly PpkTab) — Implied + Scenario side-by-side
// ---------------------------------------------------------------------------

function PpkBlock({
  implied,
  spotTlref,
}: {
  implied: readonly ImpliedPPK[];
  spotTlref: number;
}): JSX.Element {
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const rows = useMemo(() => {
    let level = spotTlref;
    return implied.map((p, i) => {
      const prevImplied = i > 0 ? implied[i - 1].impliedRatePct : spotTlref;
      const impliedDelta = (p.impliedRatePct - prevImplied) * 100;
      const userDelta =
        overrides[p.date] !== undefined
          ? overrides[p.date]
          : Math.round(impliedDelta);
      level += userDelta / 100;
      return {
        date: p.date,
        impliedPct: p.impliedRatePct,
        impliedDelta,
        userDelta,
        scenarioLevel: level,
      };
    });
  }, [implied, spotTlref, overrides]);

  const totalBp = rows.reduce((s, r) => s + r.userDelta, 0);
  const terminal =
    rows.length > 0 ? rows[rows.length - 1].scenarioLevel : spotTlref;

  const deltaColor = (d: number): string =>
    d < 0 ? C.ois : d > 0 ? C.rd : C.tm;

  return (
    <div>
      <div
        style={{
          marginBottom: "12px",
          fontSize: "12px",
          color: C.tm,
          display: "flex",
          gap: "20px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div>
          <span>Spot TLREF: </span>
          <span style={{ color: C.cy, fontWeight: 600 }}>
            {spotTlref.toFixed(2)}%
          </span>
        </div>
        <div>
          <span>Scenario total: </span>
          <span style={{ color: deltaColor(totalBp), fontWeight: 600 }}>
            {totalBp > 0 ? "+" : ""}
            {totalBp} bp
          </span>
        </div>
        <div>
          <span>Terminal: </span>
          <span style={{ color: C.bl, fontWeight: 600 }}>
            {terminal.toFixed(2)}%
          </span>
        </div>
        <button
          onClick={() => setOverrides({})}
          style={{
            padding: "2px 10px",
            fontSize: "10px",
            border: `1px solid ${C.bd}`,
            background: "transparent",
            color: C.tm,
            borderRadius: "3px",
            cursor: "pointer",
          }}
        >
          reset scenario
        </button>
      </div>

      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 360px" }}>
          <div
            style={{
              fontSize: "11px",
              color: C.tm,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "6px",
            }}
          >
            Implied Path
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  {["PPK Date", "Period", "Implied", "Δ vs prev", "DF"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          ...tableHeader,
                          textAlign: h === "PPK Date" ? "left" : "right",
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {implied.map((p, i) => {
                  const prev = i > 0 ? implied[i - 1] : null;
                  const diffBp = prev
                    ? (p.impliedRatePct - prev.impliedRatePct) * 100
                    : 0;
                  return (
                    <tr
                      key={p.date}
                      style={{
                        background: i % 2 ? `${C.sa}44` : "transparent",
                      }}
                    >
                      <td style={{ ...tableCell, fontWeight: 500 }}>
                        {p.date}
                      </td>
                      <td
                        style={{
                          ...tableCell,
                          textAlign: "right",
                          color: C.tm,
                        }}
                      >
                        {p.periodDays}d
                      </td>
                      <td style={{ ...tableCell, textAlign: "right" }}>
                        <span style={{ color: C.bl, fontWeight: 600 }}>
                          {p.impliedRatePct.toFixed(2)}%
                        </span>
                      </td>
                      <td style={{ ...tableCell, textAlign: "right" }}>
                        {prev ? (
                          <span
                            style={{
                              color:
                                diffBp > 5
                                  ? C.rd
                                  : diffBp < -5
                                    ? C.ois
                                    : C.tm,
                              fontWeight: 600,
                            }}
                          >
                            {(diffBp > 0 ? "+" : "") + diffBp.toFixed(0)} bp
                          </span>
                        ) : (
                          <span style={{ color: C.tm }}>—</span>
                        )}
                      </td>
                      <td
                        style={{
                          ...tableCell,
                          textAlign: "right",
                          color: C.tm,
                        }}
                      >
                        {p.df.toFixed(6)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ flex: "1 1 420px" }}>
          <div
            style={{
              fontSize: "11px",
              color: C.tm,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "6px",
            }}
          >
            Scenario Overrides
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  {[
                    "PPK Date",
                    "Impl. Δ",
                    "Override Δ",
                    "Scenario level",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        ...tableHeader,
                        textAlign: h === "PPK Date" ? "left" : "right",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.date}
                    style={{
                      background: i % 2 ? `${C.sa}44` : "transparent",
                    }}
                  >
                    <td style={{ ...tableCell, fontWeight: 500 }}>{r.date}</td>
                    <td style={{ ...tableCell, textAlign: "right" }}>
                      <span
                        style={{
                          color: deltaColor(r.impliedDelta),
                          fontSize: "10.5px",
                        }}
                      >
                        {r.impliedDelta > 0 ? "+" : ""}
                        {r.impliedDelta.toFixed(0)}
                      </span>
                    </td>
                    <td
                      style={{
                        ...tableCell,
                        textAlign: "right",
                        padding: "3px 8px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          justifyContent: "flex-end",
                        }}
                      >
                        <input
                          type="range"
                          min={-500}
                          max={500}
                          step={25}
                          value={r.userDelta}
                          onChange={(e) =>
                            setOverrides((o) => ({
                              ...o,
                              [r.date]: parseInt(e.target.value, 10),
                            }))
                          }
                          style={{
                            width: "100px",
                            accentColor:
                              r.userDelta < 0
                                ? C.ois
                                : r.userDelta > 0
                                  ? C.rd
                                  : C.tm,
                          }}
                        />
                        <span
                          style={{
                            color: deltaColor(r.userDelta),
                            fontWeight: 600,
                            minWidth: "36px",
                            textAlign: "right",
                          }}
                        >
                          {r.userDelta > 0 ? "+" : ""}
                          {r.userDelta}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...tableCell, textAlign: "right" }}>
                      <span style={{ color: C.bl, fontWeight: 600 }}>
                        {r.scenarioLevel.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
