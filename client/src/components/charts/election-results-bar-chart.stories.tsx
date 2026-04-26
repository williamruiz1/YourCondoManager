// Wave 37 — Storybook coverage for <ElectionResultsBarChart>.
//
// Wave 22 hand-rolled SVG chart. Three states track the practical
// permutations: typical 2–3 option ballot, a heavy ballot with many
// options that exercises label truncation + height auto-scale, and
// the empty-data path.

import type { Meta, StoryObj } from "@storybook/react-vite";

import { ElectionResultsBarChart } from "./election-results-bar-chart";
import {
  defaultBarData,
  emptyBarData,
  manyOptionsBarData,
} from "../__fixtures__/election-results";

const meta: Meta<typeof ElectionResultsBarChart> = {
  title: "Shared/Charts/ElectionResultsBarChart",
  component: ElectionResultsBarChart,
};

export default meta;

type Story = StoryObj<typeof ElectionResultsBarChart>;

export const Default: Story = {
  args: { data: defaultBarData },
};

export const ManyOptions: Story = {
  args: { data: manyOptionsBarData },
};

export const EmptyData: Story = {
  args: { data: emptyBarData },
};
