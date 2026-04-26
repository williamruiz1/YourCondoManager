// Wave 37 — Storybook coverage for <ElectionResultsDonutChart>.
//
// Wave 22 hand-rolled SVG chart. Three states cover the segment-count
// permutations the call sites actually feed in: the canonical "cast vs
// remaining" pair, a binary yes/no resolution, and a multi-segment
// election with five distinct outcomes.

import type { Meta, StoryObj } from "@storybook/react-vite";

import { ElectionResultsDonutChart } from "./election-results-donut-chart";
import {
  defaultDonutData,
  manyDonutData,
  twoOptionsDonutData,
} from "../__fixtures__/election-results";

const meta: Meta<typeof ElectionResultsDonutChart> = {
  title: "Shared/Charts/ElectionResultsDonutChart",
  component: ElectionResultsDonutChart,
};

export default meta;

type Story = StoryObj<typeof ElectionResultsDonutChart>;

export const Default: Story = {
  args: { data: defaultDonutData },
};

export const TwoOptions: Story = {
  args: { data: twoOptionsDonutData },
};

export const ManyOptions: Story = {
  args: { data: manyDonutData },
};
