/**
 * Market Data tab: editable OIS bid/ask + offshore TRYI rate quotes.
 * Changes propagate to the parent state in App.tsx and trigger re-
 * bootstrap of the curve + re-pricing of bonds.
 */

import type { JSX } from "react";
import type { OISQuote, OffshoreQuote, QuoteSide } from "../core/types";
import { C, tableCell, tableHeader } from "./theme";

interface Props {
  oisQuotes: readonly OISQuote[];
  offQuotes: readonly OffshoreQuote[];
  side: QuoteSide;
  onOisChange: (index: number, field: "bid" | "ask", value: number) => void;
  onOffChange: (index: number, rate: number) => void;
}

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

export function MarketDataTab({
  oisQuotes,
  offQuotes,
  side,
  onOisChange,
  onOffChange,
}: Props): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        gap: "16px",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: "1 1 380px" }}>
        <div
          style={{
            fontSize: "12px",
            color: C.ois,
            fontWeight: 600,
            marginBottom: "6px",
          }}
        >
          Onshore OIS (TYSO · Act/365)
        </div>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Tenor", "Bid", "Ask", "Used"].map((h) => (
                <th
                  key={h}
                  style={{
                    ...tableHeader,
                    textAlign: h === "Tenor" ? "left" : "right",
                  }}
                >
                  {h}
                </th>
              ))}
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
              return (
                <tr
                  key={q.tenor}
                  style={{
                    background: i % 2 ? `${C.sa}44` : "transparent",
                  }}
                >
                  <td style={{ ...tableCell, fontWeight: 600 }}>{q.tenor}</td>
                  <td style={{ ...tableCell, textAlign: "right" }}>
                    <RateInput
                      value={q.bid}
                      onChange={(v) => onOisChange(i, "bid", v)}
                    />
                  </td>
                  <td style={{ ...tableCell, textAlign: "right" }}>
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
                    textAlign:
                      ["Tenor", "Ticker"].includes(h) ? "left" : "right",
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
