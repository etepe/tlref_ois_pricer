/**
 * Lightweight SVG chart used across all tabs.
 *
 * Supports multiple line series + a scatter overlay of dots. Kept
 * intentionally minimal (no tooltip, no legend interaction) — the goal
 * is a readable small-multiples look, not a full charting library.
 * Ported from ois_pricer/frontend/tlref-ois-pricer.jsx::Chart.
 */

import type { JSX } from "react";
import { C } from "./theme";

export interface ChartPoint {
  x: number;
  y: number;
}

export interface ChartLine {
  pts: ChartPoint[];
  color: string;
  label: string;
  dash?: string;
  width?: number;
  opacity?: number;
}

export interface ChartDot extends ChartPoint {
  color?: string;
}

interface Props {
  lines?: ChartLine[];
  dots?: ChartDot[];
  title: string;
  yLabel: string;
  width?: number;
  height?: number;
  /** If true, draws a dashed zero line — used for spread/basis charts. */
  zeroLine?: boolean;
  /** Y-axis number format suffix (default "%"). */
  ySuffix?: string;
}

export function Chart({
  lines = [],
  dots = [],
  title,
  yLabel,
  width = 640,
  height = 210,
  zeroLine = false,
  ySuffix = "%",
}: Props): JSX.Element | null {
  const P = { l: 52, r: 16, t: 28, b: 32 };
  const allPts: ChartPoint[] = [...dots, ...lines.flatMap((l) => l.pts)];
  if (allPts.length === 0) return null;

  const allY = allPts.map((p) => p.y).filter(Number.isFinite);
  const allX = allPts.map((p) => p.x);
  const xMax = Math.max(...allX, 400);
  let yMin = Math.min(...allY);
  let yMax = Math.max(...allY);
  if (zeroLine) {
    yMin = Math.min(yMin, 0);
    yMax = Math.max(yMax, 0);
  }
  const yPad = (yMax - yMin) * 0.15 || 2;
  yMin -= yPad;
  yMax += yPad;

  const sx = (x: number): number =>
    ((x / xMax) * (width - P.l - P.r)) + P.l;
  const sy = (y: number): number =>
    height - P.b - ((y - yMin) / (yMax - yMin)) * (height - P.t - P.b);

  // Y ticks — ~5 ticks, integer step in pct units when span > 5.
  const yTicks: number[] = [];
  const yStep = Math.max(Math.ceil((yMax - yMin) / 5), 1);
  for (let v = Math.ceil(yMin); v <= yMax; v += yStep) yTicks.push(v);

  // X ticks — multiples of 90 days.
  const xTicks: number[] = [];
  const xStep = Math.max(Math.round(xMax / 5 / 90) * 90, 90);
  for (let v = xStep; v <= xMax; v += xStep) xTicks.push(v);

  return (
    <div
      style={{
        background: C.sf,
        border: `1px solid ${C.bd}`,
        borderRadius: "6px",
        padding: "4px",
        marginBottom: "12px",
      }}
    >
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block" }}
      >
        <text
          x={width / 2}
          y={16}
          textAnchor="middle"
          fill={C.tm}
          fontSize="10"
          fontFamily="'DM Sans', sans-serif"
          fontWeight="600"
        >
          {title}
        </text>

        {yTicks.map((v) => (
          <g key={`y${v}`}>
            <line
              x1={P.l}
              x2={width - P.r}
              y1={sy(v)}
              y2={sy(v)}
              stroke={C.bd}
              strokeWidth="0.5"
            />
            <text
              x={P.l - 6}
              y={sy(v) + 3}
              textAnchor="end"
              fill={C.tm}
              fontSize="9"
              fontFamily="monospace"
            >
              {v.toFixed(v % 1 ? 1 : 0)}
              {ySuffix}
            </text>
          </g>
        ))}

        {xTicks.map((v) => (
          <g key={`x${v}`}>
            <line
              x1={sx(v)}
              x2={sx(v)}
              y1={P.t}
              y2={height - P.b}
              stroke={C.bd}
              strokeWidth="0.5"
            />
            <text
              x={sx(v)}
              y={height - P.b + 14}
              textAnchor="middle"
              fill={C.tm}
              fontSize="9"
              fontFamily="monospace"
            >
              {v}d
            </text>
          </g>
        ))}

        <line x1={P.l} x2={P.l} y1={P.t} y2={height - P.b} stroke={C.bd} />
        <line
          x1={P.l}
          x2={width - P.r}
          y1={height - P.b}
          y2={height - P.b}
          stroke={C.bd}
        />
        {zeroLine && (
          <line
            x1={P.l}
            x2={width - P.r}
            y1={sy(0)}
            y2={sy(0)}
            stroke={C.tm}
            strokeWidth="0.5"
            strokeDasharray="3,3"
          />
        )}

        {lines.map((l, i) => (
          <path
            key={`l${i}`}
            d={[...l.pts]
              .sort((a, b) => a.x - b.x)
              .map(
                (p, j) =>
                  `${j ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`,
              )
              .join(" ")}
            fill="none"
            stroke={l.color}
            strokeWidth={l.width || 2}
            strokeDasharray={l.dash || "none"}
            opacity={l.opacity ?? 0.85}
          />
        ))}

        {dots.map((d, i) =>
          Number.isFinite(sy(d.y)) ? (
            <circle
              key={`d${i}`}
              cx={sx(d.x)}
              cy={sy(d.y)}
              r="4"
              fill={d.color || C.bl}
              opacity="0.85"
              stroke={C.bg}
              strokeWidth="1"
            />
          ) : null,
        )}

        <text
          x={12}
          y={height / 2}
          textAnchor="middle"
          fill={C.tm}
          fontSize="9"
          transform={`rotate(-90,12,${height / 2})`}
        >
          {yLabel}
        </text>

        {lines.length > 0 && (
          <g transform={`translate(${P.l + 8},${P.t + 4})`}>
            {lines.map((l, i) => (
              <g key={`lg${i}`} transform={`translate(${i * 90},0)`}>
                <line
                  x1="0"
                  x2="14"
                  y1="4"
                  y2="4"
                  stroke={l.color}
                  strokeWidth="2"
                  strokeDasharray={l.dash || "none"}
                />
                <text x="18" y="7" fill={C.tm} fontSize="8">
                  {l.label}
                </text>
              </g>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
