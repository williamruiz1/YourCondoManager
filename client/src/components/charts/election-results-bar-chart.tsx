// zone: Governance
// persona: Manager, Board Officer, Assisted Board, PM Assistant
//
// Wave 22 — hand-rolled SVG horizontal bar chart for election option tallies.
// Replaces the prior `recharts` <BarChart>+<Bar>+<Cell>+<Tooltip> usage so we
// can drop the 108 KB gzip vendor-recharts vendor chunk entirely. This module
// has zero runtime dependencies beyond React.
//
// Visual parity goals (matched to Wave 16b recharts rendering):
//   - horizontal bars, one per option
//   - per-bar fill from a small color palette (cycled by index)
//   - rounded right end on each bar (radius 4px)
//   - 120px reserved for the category label gutter on the left
//   - hover tooltip showing "<n> votes (<pct>%)"
//   - container height scales with row count: max(200, rows * 50)

import { useMemo, useState } from "react";

const DEFAULT_CHART_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#a855f7",
  "#ec4899",
  "#0ea5e9",
] as const;

const LABEL_GUTTER = 120; // px reserved on the left for category labels
const RIGHT_PAD = 30; // px; matches recharts `margin.right`
const TOP_PAD = 5;
const BOTTOM_PAD = 24; // room for x-axis tick labels
const BAR_VPAD = 8; // vertical gap between bars
const BAR_RADIUS = 4;

export interface ElectionBarDatum {
  label: string;
  votes: number;
  percent: number;
}

export interface ElectionResultsBarChartProps {
  data: ElectionBarDatum[];
  colors?: readonly string[];
  /** Total chart height in px. Defaults to max(200, rows*50). */
  height?: number;
  /** Optional hard maxValue override; otherwise the largest datum.votes is used (or 1 to avoid div/0). */
  maxValue?: number;
  /** Width of the rendered SVG. Falls back to 100% via `width="100%"`. */
  width?: number | string;
  /** Accessible label for screen readers / tests. */
  ariaLabel?: string;
  testId?: string;
}

export function ElectionResultsBarChart({
  data,
  colors = DEFAULT_CHART_COLORS,
  height,
  maxValue,
  width = "100%",
  ariaLabel = "Election option tallies",
  testId = "election-results-bar-chart",
}: ElectionResultsBarChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const computedHeight = height ?? Math.max(200, data.length * 50);
  const innerWidth = 600; // viewBox width; SVG scales to container via `width="100%"`
  const innerHeight = computedHeight;
  const plotLeft = LABEL_GUTTER;
  const plotRight = innerWidth - RIGHT_PAD;
  const plotTop = TOP_PAD;
  const plotBottom = innerHeight - BOTTOM_PAD;
  const plotWidth = Math.max(1, plotRight - plotLeft);
  const plotHeight = Math.max(1, plotBottom - plotTop);

  const computedMax = useMemo(() => {
    if (typeof maxValue === "number" && maxValue > 0) return maxValue;
    const max = data.reduce((acc, d) => (d.votes > acc ? d.votes : acc), 0);
    return max > 0 ? max : 1;
  }, [data, maxValue]);

  const bandHeight = data.length > 0 ? plotHeight / data.length : plotHeight;
  const barHeight = Math.max(2, bandHeight - BAR_VPAD * 2);

  // X-axis: 5 evenly spaced ticks 0..max
  const tickCount = 5;
  const ticks = useMemo(() => {
    const step = computedMax / (tickCount - 1);
    return Array.from({ length: tickCount }, (_, i) => Math.round(i * step));
  }, [computedMax]);

  return (
    <div
      className="relative w-full"
      style={{ height: computedHeight }}
      data-testid={testId}
    >
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${innerWidth} ${innerHeight}`}
        preserveAspectRatio="none"
        width={width}
        height={computedHeight}
      >
        <title>{ariaLabel}</title>
        <desc>
          Horizontal bar chart of {data.length} election option(s); the longest bar
          represents {computedMax} vote(s).
        </desc>

        {/* X-axis baseline */}
        <line
          x1={plotLeft}
          y1={plotBottom}
          x2={plotRight}
          y2={plotBottom}
          stroke="#e5e7eb"
          strokeWidth={1}
        />

        {/* X-axis ticks + labels */}
        {ticks.map((t, i) => {
          const x = plotLeft + (t / computedMax) * plotWidth;
          return (
            <g key={`tick-${i}`}>
              <line
                x1={x}
                y1={plotBottom}
                x2={x}
                y2={plotBottom + 4}
                stroke="#9ca3af"
                strokeWidth={1}
              />
              <text
                x={x}
                y={plotBottom + 16}
                textAnchor="middle"
                fontSize={11}
                fill="#6b7280"
              >
                {t}
              </text>
            </g>
          );
        })}

        {/* Bars + category labels */}
        {data.map((d, i) => {
          const yCenter = plotTop + bandHeight * i + bandHeight / 2;
          const yTop = yCenter - barHeight / 2;
          const w = (d.votes / computedMax) * plotWidth;
          const fill = colors[i % colors.length];
          const isHover = hover === i;
          return (
            <g
              key={`bar-${i}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((cur) => (cur === i ? null : cur))}
              style={{ cursor: "default" }}
              data-testid={`election-results-bar-row-${i}`}
            >
              {/* Category label */}
              <text
                x={plotLeft - 8}
                y={yCenter + 4}
                textAnchor="end"
                fontSize={12}
                fill="#374151"
              >
                {truncate(d.label, 20)}
              </text>
              {/* Bar */}
              <rect
                x={plotLeft}
                y={yTop}
                width={Math.max(0, w)}
                height={barHeight}
                fill={fill}
                rx={BAR_RADIUS}
                ry={BAR_RADIUS}
                opacity={isHover ? 0.85 : 1}
                data-testid={`election-results-bar-${i}`}
              >
                <title>{`${d.label}: ${d.votes} votes (${d.percent}%)`}</title>
              </rect>
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip overlay (HTML, not SVG, for crisp text) */}
      {hover !== null && data[hover] ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 rounded border border-border bg-popover px-2 py-1 text-xs shadow"
          data-testid="election-results-bar-tooltip"
        >
          <span className="font-medium">{data[hover].label}: </span>
          {data[hover].votes} votes ({data[hover].percent}%)
        </div>
      ) : null}
    </div>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export default ElectionResultsBarChart;
