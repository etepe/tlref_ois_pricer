/**
 * Bonds tab: Z-spread analytics grouped by bond type (flt / fix / zcb),
 * with yield curve + Z-spread scatter charts.
 */

import type { JSX } from "react";
import { useMemo } from "react";
import { zeroRate } from "../core/interpolation";
import type { BondAnalytics, BondType, DFNode } from "../core/types";
import { Chart } from "./Chart";
import { C, tableCell, tableHeader } from "./theme";

interface Props {
  analytics: readonly BondAnalytics[];
  oisNodes: readonly DFNode[];
  offNodes: readonly DFNode[];
}

const typeColor = (t: BondType): string =>
  t === "zcb" ? C.am : t === "flt" ? C.cy : C.bl;

export function BondsTab({ analytics, oisNodes, offNodes }: Props): JSX.Element {
  // Filter tight Z-spreads (< 20%) for chart readability; keep all for table.
  const chartable = useMemo(
    () => analytics.filter((b) => Math.abs(b.zSpreadOIS) < 20),
    [analytics],
  );
  const maxAbsZ = useMemo(
    () => Math.max(...chartable.map((b) => Math.abs(b.zSpreadOIS)), 1),
    [chartable],
  );
  const oisCurve = useMemo(
    () =>
      oisNodes
        .filter((n) => n.days > 0 && n.days <= 1600)
        .map((n) => ({ x: n.days, y: zeroRate(oisNodes, n.days, 365) })),
    [oisNodes],
  );
  const offCurve = useMemo(
    () =>
      offNodes
        .filter((n) => n.days > 0 && n.days <= 1600)
        .map((n) => ({ x: n.days, y: zeroRate(offNodes, n.days, 360) })),
    [offNodes],
  );

  const groups: ReadonlyArray<{ key: BondType; label: string; color: string }> = [
    { key: "flt", label: "TLREF-Linked (Floating)", color: C.cy },
    { key: "fix", label: "Fixed Coupon", color: C.bl },
    { key: "zcb", label: "Zero Coupon", color: C.am },
  ];

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
            title="Bond Yield vs OIS & Offshore Curves"
            yLabel="%"
            lines={[
              { pts: oisCurve, color: C.ois, label: "OIS", dash: "4,3" },
              { pts: offCurve, color: C.off, label: "Offshore", dash: "4,3" },
            ]}
            dots={chartable.map((b) => ({
              x: b.dtm,
              y: b.yieldOIS,
              color: typeColor(b.bond.type),
            }))}
          />
        </div>
        <div style={{ flex: "1 1 300px", minWidth: "270px" }}>
          <Chart
            title="Z-Spread vs OIS"
            yLabel="Spread %"
            dots={chartable.map((b) => ({
              x: b.dtm,
              y: b.zSpreadOIS,
              color: typeColor(b.bond.type),
            }))}
            zeroLine
          />
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {[
                "ISIN",
                "Mat",
                "Days",
                "Cpn",
                "Last",
                "Z / OIS",
                "Z / Offshore",
                "Δ (bp)",
                "",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    ...tableHeader,
                    textAlign: ["ISIN", "Mat"].includes(h) ? "left" : "right",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const items = analytics.filter((b) => b.bond.type === g.key);
              if (items.length === 0) return null;
              return (
                <>
                  <tr key={g.key + "-h"}>
                    <td
                      colSpan={9}
                      style={{
                        padding: "8px 8px 3px",
                        borderBottom: `1px solid ${C.bd}`,
                        background: C.bg,
                      }}
                    >
                      <span
                        style={{
                          color: g.color,
                          fontSize: "11px",
                          fontWeight: 700,
                        }}
                      >
                        {g.label}
                      </span>
                      <span
                        style={{
                          color: C.tm,
                          fontSize: "10px",
                          marginLeft: "8px",
                        }}
                      >
                        {items.length}
                      </span>
                    </td>
                  </tr>
                  {items.map((b, i) => {
                    const diffBp = (b.zSpreadOIS - b.zSpreadOff) * 100;
                    return (
                      <tr
                        key={b.bond.isin + i}
                        style={{
                          background:
                            i % 2 ? `${C.sa}44` : "transparent",
                        }}
                      >
                        <td
                          style={{
                            ...tableCell,
                            fontWeight: 600,
                            fontSize: "11px",
                          }}
                        >
                          {b.bond.isin}
                        </td>
                        <td
                          style={{
                            ...tableCell,
                            color: C.tm,
                            fontSize: "10.5px",
                          }}
                        >
                          {b.bond.maturity}
                        </td>
                        <td
                          style={{
                            ...tableCell,
                            textAlign: "right",
                            color: C.tm,
                          }}
                        >
                          {b.dtm}
                        </td>
                        <td style={{ ...tableCell, textAlign: "right" }}>
                          {b.bond.coupon
                            ? b.bond.coupon.toFixed(1) + "%"
                            : "—"}
                        </td>
                        <td
                          style={{
                            ...tableCell,
                            textAlign: "right",
                            fontWeight: 500,
                          }}
                        >
                          {b.bond.lastPrice.toFixed(2)}
                        </td>
                        <td style={{ ...tableCell, textAlign: "right" }}>
                          <span
                            style={{
                              color:
                                b.zSpreadOIS > 0.5
                                  ? C.rd
                                  : b.zSpreadOIS < -0.5
                                    ? C.ois
                                    : C.tx,
                              fontWeight: 600,
                            }}
                          >
                            {(b.zSpreadOIS > 0 ? "+" : "") +
                              b.zSpreadOIS.toFixed(1)}
                            %
                          </span>
                        </td>
                        <td style={{ ...tableCell, textAlign: "right" }}>
                          <span
                            style={{
                              color:
                                b.zSpreadOff > 0.5
                                  ? C.rd
                                  : b.zSpreadOff < -0.5
                                    ? C.ois
                                    : C.tx,
                              fontWeight: 600,
                            }}
                          >
                            {(b.zSpreadOff > 0 ? "+" : "") +
                              b.zSpreadOff.toFixed(1)}
                            %
                          </span>
                        </td>
                        <td
                          style={{
                            ...tableCell,
                            textAlign: "right",
                            color:
                              diffBp > 5
                                ? C.rd
                                : diffBp < -5
                                  ? C.ois
                                  : C.tm,
                          }}
                        >
                          {(diffBp > 0 ? "+" : "") + diffBp.toFixed(0)}
                        </td>
                        <td
                          style={{
                            ...tableCell,
                            width: "55px",
                            padding: "5px 3px",
                          }}
                        >
                          <div
                            style={{
                              width: "55px",
                              height: "11px",
                              background: C.sa,
                              borderRadius: "2px",
                              overflow: "hidden",
                              display: "flex",
                              justifyContent:
                                b.zSpreadOIS > 0 ? "flex-start" : "flex-end",
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.max(
                                  (Math.abs(b.zSpreadOIS) / maxAbsZ) * 100,
                                  3,
                                )}%`,
                                height: "100%",
                                background:
                                  b.zSpreadOIS > 0 ? C.rd : C.ois,
                                borderRadius: "2px",
                                opacity: 0.6,
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
