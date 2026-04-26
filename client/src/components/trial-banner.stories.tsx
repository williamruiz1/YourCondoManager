// Wave 37 — Storybook coverage for <TrialBanner>.
//
// Spec: docs/projects/platform-overhaul/decisions/4.4-signup-and-checkout-flow.md (Q5)
//
// Three states track the time-window permutations. The banner is
// session-dismissible — Storybook stories run in isolated iframes
// so dismissal in one story does not bleed into the others.
//
// Note: the production component is named <TrialBanner>; the spec's
// suggested filename "home-trial-banner.stories.tsx" is replaced with
// the matching name so the import path follows the component file.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { TrialBanner } from "./trial-banner";

const meta: Meta<typeof TrialBanner> = {
  title: "Shared/TrialBanner",
  component: TrialBanner,
};

export default meta;

type Story = StoryObj<typeof TrialBanner>;

// Days are computed from "now" so the banner always shows a positive
// remaining-days count for the visible stories. Synthetic values only.
function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export const Trialing: Story = {
  args: {
    trialEndsAt: isoDaysFromNow(12),
    plan: "Starter",
    onUpgrade: fn(),
  },
};

export const GraceWindow: Story = {
  args: {
    trialEndsAt: isoDaysFromNow(0),
    plan: "Starter",
    onUpgrade: fn(),
  },
};

export const Canceled: Story = {
  // The component returns `null` when the trial already ended — story is
  // here so designers can confirm the hidden state, and so the test
  // smoke-renders the null branch.
  args: {
    trialEndsAt: isoDaysFromNow(-3),
    plan: "Starter",
    onUpgrade: fn(),
  },
};
