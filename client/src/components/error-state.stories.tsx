// Wave 37 — Storybook coverage for the shared <ErrorState>.
//
// Spec: docs/projects/platform-overhaul/decisions/5.2-error-states.md
//
// Three states track the prop matrix the call sites actually use:
// default copy with no retry, retry-enabled, and the technical-details
// disclosure for engineering triage.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { ErrorState } from "./error-state";

const meta: Meta<typeof ErrorState> = {
  title: "Shared/ErrorState",
  component: ErrorState,
};

export default meta;

type Story = StoryObj<typeof ErrorState>;

export const Default: Story = {
  args: {},
};

export const WithRetry: Story = {
  args: {
    title: "Couldn't load alerts",
    description: "We hit an unexpected error. Try again or reload the page.",
    retry: fn(),
  },
};

export const WithDetails: Story = {
  args: {
    title: "Couldn't load alerts",
    description: "We hit an unexpected error. Try again or reload the page.",
    retry: fn(),
    details:
      "TypeError: Failed to fetch\n  at queryFn (queryClient.ts:42)\n  at HomeAlertsPanel (home-alerts-panel.tsx:90)",
  },
};
