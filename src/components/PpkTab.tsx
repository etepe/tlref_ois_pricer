/**
 * PPK tab with two sub-tabs:
 *   - Implied: market-implied policy rate between consecutive meetings
 *     (derived from the bootstrapped DF curve).
 *   - Scenario: user overrides per-meeting cuts and watches the
 *     implied forward path + terminal TLREF change. Purely analytical;
 *     does NOT feed back into bootstrap.
 *
 * The scenario sub-tab is useful for answering "what PPK path would
 * the market need to imply to reach X% by meeting Y?" without needing
 * to re-solve the curve.
 */

import type { JSX } from "react";
import { useMemo, useState } from "react";
import type { ImpliedPPK } from "../core/types";
import { C, tableCell, tableHeader } from "./theme";

type SubTab = "implied" | "scenario";

interface Props {
  implied: readonly ImpliedPPK[];
  /** Spot TLREF rate (in %) used as the scenario anchor. */
  spotTlref: number;
}

export function PpkTab({ implied, spotTlref }: Props): JSX.Element {
  const [sub, setSub] = useState<SubTab>("implied");

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
        {(["implied", "scenario"] as const).map((s) => (
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
            {s}
          </button>
        ))}
      </div>

      {sub === "implied" ? (
        <ImpliedSub implied={implied} />
      ) : (
        <ScenarioSub implied={implied} spotTlref={spotTlref} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Implied sub-tab
// ---------------------------------------------------------------------------

function ImpliedSub({
  implied,
}: {
  implied: readonly ImpliedPPK[];
}): JSX.Element {
  return (
    <div>
      <div style={{ marginBottom: "10px", fontSize: "12px", color: C.tm }}>
        OIS-implied policy rate between consecutive PPK meetings.
        Forward rate for period [prev, meeting] on Act/365.
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["PPK Date", "Period", "Implied", "Δ vs prev", "DF"].map((h) => (
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
            {implied.map((p, i) => {
              const prev = i > 0 ? implied[i - 1] : null;
              const diffBp = prev
                ? (p.impliedRatePct - prev.impliedRatePct) * 100
                : 0;
              return (
                <tr
                  key={p.date}
                  style={{ background: i % 2 ? `${C.sa}44` : "transparent" }}
                >
                  <td style={{ ...tableCell, fontWeight: 500 }}>{p.date}</td>
                  <td
                    style={{ ...tableCell, textAlign: "right", color: C.tm }}
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
                            diffBp > 5 ? C.rd : diffBp < -5 ? C.ois : C.tm,
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
  );
}

// ---------------------------------------------------------------------------
// Scenario sub-tab
// ---------------------------------------------------------------------------

function ScenarioSub({
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
  const terminal = rows.length > 0 ? rows[rows.length - 1].scenarioLevel : spotTlref;

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
