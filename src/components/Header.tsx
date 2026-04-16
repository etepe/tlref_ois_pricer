/**
 * App header: brand, trade/value date readout, bid/mid/ask toggle.
 *
 * Trade date is intentionally read-only per the project spec — the
 * default `2026-04-13` matches the market data snapshot shipped in
 * src/data/. Changing the trade date would require refreshed quotes,
 * so it's surfaced as a display value only.
 */

import type { JSX } from "react";
import type { QuoteSide } from "../core/types";
import { C } from "./theme";

interface Props {
  tradeDate: string;
  valueDate: string;
  side: QuoteSide;
  onSideChange: (s: QuoteSide) => void;
}

export function Header({
  tradeDate,
  valueDate,
  side,
  onSideChange,
}: Props): JSX.Element {
  return (
    <div
      style={{
        background: C.sf,
        borderBottom: `1px solid ${C.bd}`,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: "4px",
            height: "28px",
            background: C.bl,
            borderRadius: "2px",
          }}
        />
        <div>
          <div style={{ fontSize: "15px", fontWeight: 700 }}>TLREF Pricer</div>
          <div style={{ fontSize: "10px", color: C.tm, fontFamily: "monospace" }}>
            <span style={{ color: C.ois }}>Onshore OIS</span>
            {" · "}
            <span style={{ color: C.off }}>Offshore TRYI</span>
            {" · Bond Z-Spread · Implied PPK"}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          flexWrap: "wrap",
          fontFamily: "monospace",
          fontSize: "11px",
        }}
      >
        <span style={{ color: C.tm }}>
          Trade: <span style={{ color: C.tx }}>{tradeDate}</span>
        </span>
        <span style={{ color: C.tm }}>
          VD: <span style={{ color: C.cy }}>{valueDate}</span>
        </span>
        <div
          style={{
            display: "flex",
            gap: "2px",
            background: C.bg,
            borderRadius: "4px",
            padding: "2px",
          }}
        >
          {(["bid", "mid", "ask"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onSideChange(s)}
              style={{
                padding: "3px 10px",
                fontSize: "10px",
                fontWeight: 600,
                textTransform: "uppercase",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                background: side === s ? C.bl : "transparent",
                color: side === s ? C.bg : C.tm,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
