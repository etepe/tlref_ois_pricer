/**
 * Top-level tab navigation bar. Horizontal-scrolls on narrow screens.
 */

import type { JSX } from "react";
import { C } from "./theme";

export type TabId = "bonds" | "curves" | "ppk" | "data";

export const TAB_LABELS: ReadonlyArray<[TabId, string]> = [
  ["bonds", "Bonds"],
  ["curves", "Curves & Basis"],
  ["ppk", "Implied PPK"],
  ["data", "Market Data"],
];

interface Props {
  active: TabId;
  onChange: (t: TabId) => void;
}

export function Tabs({ active, onChange }: Props): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        borderBottom: `1px solid ${C.bd}`,
        background: C.sf,
        padding: "0 16px",
        overflowX: "auto",
      }}
    >
      {TAB_LABELS.map(([id, label]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          style={{
            padding: "9px 14px",
            fontSize: "11.5px",
            fontWeight: 600,
            border: "none",
            borderBottom:
              active === id
                ? `2px solid ${C.bl}`
                : "2px solid transparent",
            background: "transparent",
            color: active === id ? C.tx : C.tm,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
