// zone: Governance
// persona: Manager, Board Officer, Assisted Board, PM Assistant
//
// Wave 22 — `recharts` (~108 KB gzip vendor chunk) was replaced with
// hand-rolled SVG charts (`./charts/*`). This wrapper preserves the original
// public API (`OptionTallyBarChart` + `ParticipationDonutChart`) so consumers
// like `client/src/pages/election-detail.tsx` remain unchanged at the call
// site, while the implementation is now zero-dependency SVG.
//
// History: this module was originally introduced in Wave 16b as a `React.lazy`
// chart wrapper to keep the recharts vendor chunk off the critical path. With
// Wave 22 the wrapper still exists (for API stability) but the lazy boundary
// is no longer necessary — the new charts are < 5 KB gzip combined.

import {
  ElectionResultsBarChart,
  type ElectionBarDatum,
} from "@/components/charts/election-results-bar-chart";
import { ElectionResultsDonutChart } from "@/components/charts/election-results-donut-chart";

const DEFAULT_CHART_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#a855f7",
  "#ec4899",
  "#0ea5e9",
] as const;

export interface OptionTallyDatum {
  label: string;
  votes: number;
  percent: number;
}

export function OptionTallyBarChart({
  data,
  colors = DEFAULT_CHART_COLORS,
}: {
  data: OptionTallyDatum[];
  colors?: readonly string[];
}) {
  // OptionTallyDatum and ElectionBarDatum are structurally identical.
  const barData: ElectionBarDatum[] = data;
  return (
    <ElectionResultsBarChart
      data={barData}
      colors={colors}
      ariaLabel="Election results by option"
    />
  );
}

export function ParticipationDonutChart({
  castCount,
  eligibleCount,
}: {
  castCount: number;
  eligibleCount: number;
}) {
  const remaining = Math.max(0, eligibleCount - castCount);
  return (
    <ElectionResultsDonutChart
      data={[
        { label: "Cast", value: castCount, color: "#22c55e" },
        { label: "Remaining", value: remaining, color: "#e5e7eb" },
      ]}
      ariaLabel="Election participation rate"
    />
  );
}
