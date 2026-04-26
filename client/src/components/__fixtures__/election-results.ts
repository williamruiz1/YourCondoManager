// Wave 37 — synthetic chart fixtures for Storybook.
// Numbers are illustrative only; do not reuse production tallies.

import type { ElectionBarDatum } from "@/components/charts/election-results-bar-chart";
import type { DonutSegment } from "@/components/charts/election-results-donut-chart";

export const defaultBarData: ElectionBarDatum[] = [
  { label: "Approve budget", votes: 42, percent: 56 },
  { label: "Reject budget", votes: 24, percent: 32 },
  { label: "Abstain", votes: 9, percent: 12 },
];

export const manyOptionsBarData: ElectionBarDatum[] = [
  { label: "Option A — landscaping", votes: 18, percent: 18 },
  { label: "Option B — paving", votes: 15, percent: 15 },
  { label: "Option C — pool deck", votes: 14, percent: 14 },
  { label: "Option D — gym refresh", votes: 12, percent: 12 },
  { label: "Option E — package room", votes: 11, percent: 11 },
  { label: "Option F — solar audit", votes: 10, percent: 10 },
  { label: "Option G — security upgrade", votes: 9, percent: 9 },
  { label: "Option H — roof inspection", votes: 7, percent: 7 },
  { label: "Option I — lobby art", votes: 4, percent: 4 },
];

export const emptyBarData: ElectionBarDatum[] = [];

export const defaultDonutData: DonutSegment[] = [
  { label: "Cast", value: 75, color: "#22c55e" },
  { label: "Remaining", value: 25, color: "#e5e7eb" },
];

export const twoOptionsDonutData: DonutSegment[] = [
  { label: "Yes", value: 48, color: "#3b82f6" },
  { label: "No", value: 27, color: "#f97316" },
];

export const manyDonutData: DonutSegment[] = [
  { label: "Approve", value: 30, color: "#22c55e" },
  { label: "Reject", value: 18, color: "#ef4444" },
  { label: "Defer", value: 12, color: "#f97316" },
  { label: "Abstain", value: 9, color: "#a855f7" },
  { label: "Not voted", value: 31, color: "#e5e7eb" },
];
