// zone: Governance
// persona: Manager, Board Officer, Assisted Board, PM Assistant
//
// Wave 22 — hand-rolled SVG donut chart for election participation.
// Replaces the prior `recharts` <PieChart>+<Pie>+<Cell> usage so we can drop
// the 108 KB gzip vendor-recharts vendor chunk entirely. Zero deps beyond React.
//
// Visual parity goals (matched to Wave 16b recharts rendering):
//   - 160 × 160 default canvas
//   - inner radius 45px / outer radius 65px (donut hole)
//   - 2deg padding angle between segments
//   - default colors: cast=#22c55e, remaining=#e5e7eb
//   - hover tooltip showing the segment value

import { useMemo, useState } from "react";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface ElectionResultsDonutChartProps {
  /**
   * Segments to render. Order is preserved (clockwise starting at 12 o'clock).
   * Zero-value segments are still emitted as path elements so segment counts match.
   */
  data: DonutSegment[];
  /** Total chart height (and width — donut is square). Defaults to 160. */
  height?: number;
  /** Inner radius in px (relative to a 160px canvas). Defaults to 45. */
  innerRadius?: number;
  /** Outer radius in px (relative to a 160px canvas). Defaults to 65. */
  outerRadius?: number;
  /** Padding angle (degrees) between segments. Defaults to 2. */
  paddingAngle?: number;
  /** Accessible label for screen readers / tests. */
  ariaLabel?: string;
  testId?: string;
}

const CANVAS = 160; // viewBox is fixed at 0 0 160 160

export function ElectionResultsDonutChart({
  data,
  height = 160,
  innerRadius = 45,
  outerRadius = 65,
  paddingAngle = 2,
  ariaLabel = "Election participation",
  testId = "election-results-donut-chart",
}: ElectionResultsDonutChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const total = useMemo(
    () => data.reduce((acc, s) => acc + Math.max(0, s.value), 0),
    [data],
  );

  const cx = CANVAS / 2;
  const cy = CANVAS / 2;

  // Compute angle ranges per segment.
  // Total degrees available = 360 - paddingAngle * (#nonZeroSegments).
  // We always render every segment as its own <path> for stable test counts;
  // zero-value segments collapse to a 0deg slice (no visible mark, but a path exists).
  const segments = useMemo(() => {
    const nonZeroCount = data.filter((s) => s.value > 0).length;
    const padTotal = paddingAngle * Math.max(0, nonZeroCount);
    const drawable = Math.max(0, 360 - padTotal);

    let start = -90; // start at 12 o'clock
    return data.map((s) => {
      const isVisible = total > 0 && s.value > 0;
      const sweep = isVisible ? (s.value / total) * drawable : 0;
      const seg = { ...s, startAngle: start, endAngle: start + sweep, sweep };
      // advance: visible segments consume sweep + padding, zero segments consume nothing
      if (isVisible) start = start + sweep + paddingAngle;
      return seg;
    });
  }, [data, total, paddingAngle]);

  return (
    <div
      className="relative inline-block"
      style={{ width: height, height }}
      data-testid={testId}
    >
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${CANVAS} ${CANVAS}`}
        width={height}
        height={height}
      >
        <title>{ariaLabel}</title>
        <desc>
          Donut chart with {data.length} segment(s); total value {total}.
        </desc>

        {segments.map((seg, i) => {
          const path = donutSlicePath({
            cx,
            cy,
            innerRadius,
            outerRadius,
            startAngle: seg.startAngle,
            endAngle: seg.endAngle,
          });
          const isHover = hover === i;
          return (
            <path
              key={`seg-${i}`}
              d={path}
              fill={seg.color}
              opacity={isHover ? 0.85 : 1}
              data-testid={`election-results-donut-segment-${i}`}
              data-label={seg.label}
              data-value={seg.value}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((cur) => (cur === i ? null : cur))}
            >
              <title>{`${seg.label}: ${seg.value}`}</title>
            </path>
          );
        })}
      </svg>

      {hover !== null && segments[hover] ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 rounded border border-border bg-popover px-2 py-1 text-xs shadow"
          data-testid="election-results-donut-tooltip"
        >
          <span className="font-medium">{segments[hover].label}: </span>
          {segments[hover].value}
        </div>
      ) : null}
    </div>
  );
}

interface SlicePathArgs {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  /** degrees, 0 = 3 o'clock in SVG terms; we pass in -90 = 12 o'clock */
  startAngle: number;
  endAngle: number;
}

/**
 * Build an SVG path for an annular sector ("donut slice").
 * If the sweep is 0, returns an empty path (renders as nothing).
 * If the sweep is >= 360, draws a full ring as two near-circles.
 */
function donutSlicePath({
  cx,
  cy,
  innerRadius,
  outerRadius,
  startAngle,
  endAngle,
}: SlicePathArgs): string {
  const sweep = endAngle - startAngle;
  if (sweep <= 0) return "";

  if (sweep >= 359.999) {
    // Full ring — two arcs going the long way around.
    const halfStart = startAngle;
    const halfMid = startAngle + 180;
    const halfEnd = startAngle + 359.999;
    const oS = polar(cx, cy, outerRadius, halfStart);
    const oM = polar(cx, cy, outerRadius, halfMid);
    const oE = polar(cx, cy, outerRadius, halfEnd);
    const iS = polar(cx, cy, innerRadius, halfStart);
    const iM = polar(cx, cy, innerRadius, halfMid);
    const iE = polar(cx, cy, innerRadius, halfEnd);
    return [
      `M ${oS.x} ${oS.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${oM.x} ${oM.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${oE.x} ${oE.y}`,
      `L ${iE.x} ${iE.y}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${iM.x} ${iM.y}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${iS.x} ${iS.y}`,
      "Z",
    ].join(" ");
  }

  const largeArc = sweep > 180 ? 1 : 0;
  const oStart = polar(cx, cy, outerRadius, startAngle);
  const oEnd = polar(cx, cy, outerRadius, endAngle);
  const iStart = polar(cx, cy, innerRadius, startAngle);
  const iEnd = polar(cx, cy, innerRadius, endAngle);

  return [
    `M ${oStart.x} ${oStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${oEnd.x} ${oEnd.y}`,
    `L ${iEnd.x} ${iEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${iStart.x} ${iStart.y}`,
    "Z",
  ].join(" ");
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export default ElectionResultsDonutChart;
