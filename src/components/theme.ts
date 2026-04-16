/**
 * Shared color palette + style primitives used across all tabs.
 *
 * Matches the inline palette in ois_pricer/frontend/tlref-ois-pricer.jsx
 * (the `C = {...}` object) so ports between the Python prototype and
 * this TypeScript repo keep a consistent visual language. Colors are
 * chosen for a dark, GitHub-ish terminal look readable on long trading
 * sessions.
 */

export const C = {
  bg: "#060A14",   // page background
  sf: "#0D1117",   // surface (panels)
  sa: "#161B22",   // alt row stripe
  bd: "#21262D",   // borders
  tx: "#E6EDF3",   // primary text
  tm: "#8B949E",   // muted text
  ois: "#3FB950",  // onshore OIS (green)
  off: "#F0883E",  // offshore (orange)
  bl: "#58A6FF",   // accent blue
  am: "#D29922",   // amber (zcb, warnings)
  rd: "#F85149",   // negative / wide spread
  cy: "#39D2C0",   // cyan (floating rate)
} as const;

export type ColorKey = keyof typeof C;

// --- Common style fragments -------------------------------------------------

export const mono: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
};

export const tableCell: React.CSSProperties = {
  padding: "5px 8px",
  borderBottom: `1px solid ${C.bd}`,
  fontSize: "11.5px",
  fontFamily: "'JetBrains Mono', monospace",
  whiteSpace: "nowrap",
};

export const tableHeader: React.CSSProperties = {
  ...tableCell,
  color: C.tm,
  fontWeight: 600,
  fontSize: "9.5px",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  position: "sticky",
  top: 0,
  background: C.sf,
  zIndex: 2,
};

export const panel: React.CSSProperties = {
  background: C.sf,
  border: `1px solid ${C.bd}`,
  borderRadius: "6px",
};
