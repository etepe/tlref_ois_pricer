/**
 * Curves & Basis tab: onshore OIS zero curve vs offshore TRYI zero
 * curve, plus the offshore-onshore basis (bp).
 */

import type { JSX } from "react";
import { useMemo } from "react";
import { zeroRate } from "../core/interpolation";
import type { DFNode } from "../core/types";
import { Chart } from "./Chart";
import { C, tableCell, tableHeader } from "./theme";

interface Props {
  oisNodes: readonly DFNode[];
  offNodes: readonly DFNode[];
}

export function CurvesTab({ oisNodes, offNodes }: Props): JSX.Element {
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
        return { days: n.days, tenor: n.tenor, ois: o, off: x, basis: (x - o) * 100 };
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
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            maxWidth: "680px",
          }}
        >
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
