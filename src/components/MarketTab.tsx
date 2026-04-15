/**
 * Combined market view: merges the previous Curves & Basis, Implied PPK
 * and Market Data tabs into a single screen so PPK meetings, OIS tenors
 * and offshore deposits can be read side-by-side on a shared timeline.
 *
 * Layout:
 *   - Top: zero-curves chart + offshore-onshore basis chart.
 *   - Middle: a merged table where each row holds at most one PPK,
 *     one OIS and one offshore entry, paired chronologically.
 *   - Bottom (toggleable): the original PPK Scenario sub-view.
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
  oisNodes: readonly DFNode[];
  offNodes: readonly DFNode[];
  implied: readonly ImpliedPPK[];
  side: QuoteSide;
  spotTlref: number;
  onOisChange: (index: number, field: "bid" | "ask", value: number) => void;
  onOffChange: (index: number, rate: number) => void;
}

type SubTab = "tenors" | "scenario";

// ---------------------------------------------------------------------------
// Merged chronological row construction
// ---------------------------------------------------------------------------

interface OisCell {
  quote: OISQuote;
  node: DFNode | undefined;
  index: number;
}

interface OffCell {
  quote: OffshoreQuote;
  index: number;
}

interface MergedRow {
  ppk?: ImpliedPPK;
  ois?: OisCell;
  off?: OffCell;
}

type Event =
  | { kind: "ppk"; days: number; ppk: ImpliedPPK }
  | { kind: "ois"; days: number; ois: OisCell }
  | { kind: "off"; days: number; off: OffCell };

/** Two events are eligible to share a row when their day distance is <  this. */
const PAIR_THRESHOLD_DAYS = 35;

function buildMergedRows(
  implied: readonly ImpliedPPK[],
  oisQuotes: readonly OISQuote[],
  oisNodes: readonly DFNode[],
  offQuotes: readonly OffshoreQuote[],
): MergedRow[] {
  const events: Event[] = [];

  for (const p of implied) {
    events.push({ kind: "ppk", days: p.daysFromVd, ppk: p });
  }
  oisQuotes.forEach((q, idx) => {
    const node = oisNodes.find((n) => n.tenor === q.tenor);
    const days = node?.days ?? (q.days || q.months * 30);
    events.push({
      kind: "ois",
      days,
      ois: { quote: q, node, index: idx },
    });
  });
  offQuotes.forEach((q, idx) => {
    if (q.days <= 0) return; // skip ON
    events.push({
      kind: "off",
      days: q.days,
      off: { quote: q, index: idx },
    });
  });

  events.sort((a, b) => a.days - b.days);

  const used = new Array<boolean>(events.length).fill(false);
  const rows: MergedRow[] = [];

  for (let i = 0; i < events.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const base = events[i];
    const row: MergedRow = {};
    assign(row, base);

    for (let j = i + 1; j < events.length; j++) {
      if (used[j]) continue;
      if (events[j].days - base.days >= PAIR_THRESHOLD_DAYS) break;
      const e = events[j];
      if (row[e.kind] !== undefined) continue;
      assign(row, e);
      used[j] = true;
    }
    rows.push(row);
  }
  return rows;
}

function assign(row: MergedRow, e: Event): void {
  if (e.kind === "ppk") row.ppk = e.ppk;
  else if (e.kind === "ois") row.ois = e.ois;
  else row.off = e.off;
}

// ---------------------------------------------------------------------------
// MarketTab
// ---------------------------------------------------------------------------

export function MarketTab(props: Props): JSX.Element {
  const [sub, setSub] = useState<SubTab>("tenors");

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "4px",
          marginBottom: "12px",
          fontSize: "11px",
        }}
      >
        {(["tenors", "scenario"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSub(s)}
            style={{
              padding: "5px 12px",
              fontWeight: 600,
              fontSize: "10.5px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              border: `1px solid ${sub === s ? C.bl : C.bd}`,
              background: sub === s ? `${C.bl}22` : "transparent",
              color: sub === s ? C.bl : C.tm,
              borderRadius: "3px",
              cursor: "pointer",
            }}
          >
            {s === "tenors" ? "Tenors & PPK" : "PPK Scenario"}
          </button>
        ))}
      </div>

      {sub === "tenors" ? <TenorsView {...props} /> : <ScenarioView {...props} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tenors sub-view: charts + merged table
// ---------------------------------------------------------------------------

function TenorsView({
  oisQuotes,
  offQuotes,
  oisNodes,
  offNodes,
  implied,
  side,
  onOisChange,
  onOffChange,
}: Props): JSX.Element {
  const { oisPts, offPts, basis } = useMemo(() => {
    const oisP = oisNodes
      .filter((n) => n.days > 0 && n.days <= 1600)
      .map((n) => ({ x: n.days, y: zeroRate(oisNodes, n.days, 365) }));
    const offP = offNodes
      .filter((n) => n.days > 0 && n.days <= 1600)
      .map((n) => ({ x: n.days, y: zeroRate(offNodes, n.days, 360) }));
    const b = oisNodes
      .filter((n) => n.days >= 7 && n.days <= 1600)
      .map((n) => {
        const o = zeroRate(oisNodes, n.days, 365);
        const x = zeroRate(offNodes, n.days, 360);
        return { days: n.days, basis: (x - o) * 100 };
      });
    return { oisPts: oisP, offPts: offP, basis: b };
  }, [oisNodes, offNodes]);

  const rows = useMemo(
    () => buildMergedRows(implied, oisQuotes, oisNodes, offQuotes),
    [implied, oisQuotes, oisNodes, offQuotes],
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "16px",
        }}
      >
        <div style={{ flex: "1 1 320px", minWidth: "270px" }}>
          <Chart
            title="Zero Curves: OIS (Act/365) vs Offshore (Act/360)"
            yLabel="%"
            lines={[
              { pts: oisPts, color: C.ois, label: "OIS (Act/365)" },
              { pts: offPts, color: C.off, label: "Offshore (Act/360)" },
            ]}
          />
        </div>
        <div style={{ flex: "1 1 320px", minWidth: "270px" }}>
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

      <MergedTable
        rows={rows}
        side={side}
        onOisChange={onOisChange}
        onOffChange={onOffChange}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Merged PPK / OIS / Offshore table
// ---------------------------------------------------------------------------

const SECTION_DIVIDER: React.CSSProperties = {
  borderLeft: `2px solid ${C.bd}`,
};

interface MergedTableProps {
  rows: readonly MergedRow[];
  side: QuoteSide;
  onOisChange: (index: number, field: "bid" | "ask", value: number) => void;
  onOffChange: (index: number, rate: number) => void;
}

function MergedTable({
  rows,
  side,
  onOisChange,
  onOffChange,
}: MergedTableProps): JSX.Element {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th
              colSpan={3}
              style={{
                ...tableHeader,
                color: C.bl,
                textAlign: "left",
                fontSize: "10.5px",
              }}
            >
              Implied PPK
            </th>
            <th
              colSpan={5}
              style={{
                ...tableHeader,
                ...SECTION_DIVIDER,
                color: C.ois,
                textAlign: "left",
                fontSize: "10.5px",
              }}
            >
              Onshore OIS (TYSO · Act/365)
            </th>
            <th
              colSpan={4}
              style={{
                ...tableHeader,
                ...SECTION_DIVIDER,
                color: C.off,
                textAlign: "left",
                fontSize: "10.5px",
              }}
            >
              Offshore TRY (TRYI · Act/360)
            </th>
          </tr>
          <tr>
            <th style={{ ...tableHeader, textAlign: "left" }}>PPK Date</th>
            <th style={{ ...tableHeader, textAlign: "right" }}>Period</th>
            <th style={{ ...tableHeader, textAlign: "right" }}>Implied</th>

            <th style={{ ...tableHeader, ...SECTION_DIVIDER, textAlign: "left" }}>
              Tenor
            </th>
            <th style={{ ...tableHeader, textAlign: "right" }}>Days</th>
            <th style={{ ...tableHeader, textAlign: "right" }}>Bid</th>
            <th style={{ ...tableHeader, textAlign: "right" }}>Ask</th>
            <th style={{ ...tableHeader, textAlign: "right" }}>Used</th>

            <th style={{ ...tableHeader, ...SECTION_DIVIDER, textAlign: "left" }}>
              Tenor
            </th>
            <th style={{ ...tableHeader, textAlign: "right" }}>Days</th>
            <th style={{ ...tableHeader, textAlign: "right" }}>Rate</th>
            <th style={{ ...tableHeader, textAlign: "right" }}>DF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const stripe = i % 2 ? `${C.sa}44` : "transparent";
            return (
              <tr key={i} style={{ background: stripe }}>
                <PpkCells row={r} />
                <OisCells row={r} side={side} onChange={onOisChange} />
                <OffCells row={r} onChange={onOffChange} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PpkCells({ row }: { row: MergedRow }): JSX.Element {
  const p = row.ppk;
  if (!p) {
    return (
      <>
        <td style={tableCell}>&nbsp;</td>
        <td style={tableCell}>&nbsp;</td>
        <td style={tableCell}>&nbsp;</td>
      </>
    );
  }
  return (
    <>
      <td style={{ ...tableCell, fontWeight: 500 }}>{p.date}</td>
      <td style={{ ...tableCell, textAlign: "right", color: C.tm }}>
        {p.periodDays}d
      </td>
      <td style={{ ...tableCell, textAlign: "right" }}>
        <span style={{ color: C.bl, fontWeight: 600 }}>
          {p.impliedRatePct.toFixed(2)}%
        </span>
      </td>
    </>
  );
}

function OisCells({
  row,
  side,
  onChange,
}: {
  row: MergedRow;
  side: QuoteSide;
  onChange: (index: number, field: "bid" | "ask", value: number) => void;
}): JSX.Element {
  const o = row.ois;
  if (!o) {
    return (
      <>
        <td style={{ ...tableCell, ...SECTION_DIVIDER }}>&nbsp;</td>
        <td style={tableCell}>&nbsp;</td>
        <td style={tableCell}>&nbsp;</td>
        <td style={tableCell}>&nbsp;</td>
        <td style={tableCell}>&nbsp;</td>
      </>
    );
  }
  const q = o.quote;
  const days = o.node?.days ?? (q.days || q.months * 30);
  const used =
    side === "bid" ? q.bid : side === "ask" ? q.ask : (q.bid + q.ask) / 2;
  return (
    <>
      <td style={{ ...tableCell, ...SECTION_DIVIDER, fontWeight: 600, color: C.ois }}>
        {q.tenor}
      </td>
      <td style={{ ...tableCell, textAlign: "right", color: C.tm }}>{days}</td>
      <td style={{ ...tableCell, textAlign: "right" }}>
        <RateInput value={q.bid} onChange={(v) => onChange(o.index, "bid", v)} />
      </td>
      <td style={{ ...tableCell, textAlign: "right" }}>
        <RateInput value={q.ask} onChange={(v) => onChange(o.index, "ask", v)} />
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
    </>
  );
}

function OffCells({
  row,
  onChange,
}: {
  row: MergedRow;
  onChange: (index: number, rate: number) => void;
}): JSX.Element {
  const o = row.off;
  if (!o) {
    return (
      <>
        <td style={{ ...tableCell, ...SECTION_DIVIDER }}>&nbsp;</td>
        <td style={tableCell}>&nbsp;</td>
        <td style={tableCell}>&nbsp;</td>
        <td style={tableCell}>&nbsp;</td>
      </>
    );
  }
  const q = o.quote;
  return (
    <>
      <td style={{ ...tableCell, ...SECTION_DIVIDER, fontWeight: 600, color: C.off }}>
        {q.tenor}
      </td>
      <td style={{ ...tableCell, textAlign: "right", color: C.tm }}>{q.days}</td>
      <td style={{ ...tableCell, textAlign: "right" }}>
        <RateInput
          value={q.rate}
          onChange={(v) => onChange(o.index, v)}
          color={C.off}
        />
      </td>
      <td style={{ ...tableCell, textAlign: "right", color: C.tm }}>
        {q.df.toFixed(5)}
      </td>
    </>
  );
}

// ---------------------------------------------------------------------------
// RateInput primitive (was duplicated in MarketDataTab)
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

// ---------------------------------------------------------------------------
// Scenario sub-view (moved verbatim from PpkTab)
// ---------------------------------------------------------------------------

function ScenarioView({
  implied,
  spotTlref,
}: Props): JSX.Element {
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
          reset
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["PPK Date", "Implied", "Impl. Δ", "Override Δ", "Scenario level"].map(
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
            {rows.map((r, i) => (
              <tr
                key={r.date}
                style={{ background: i % 2 ? `${C.sa}44` : "transparent" }}
              >
                <td style={{ ...tableCell, fontWeight: 500 }}>{r.date}</td>
                <td
                  style={{
                    ...tableCell,
                    textAlign: "right",
                    color: C.tm,
                  }}
                >
                  {r.impliedPct.toFixed(2)}%
                </td>
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
  );
}
