// Wave 37 — Storybook coverage for <SignupOnboardingChecklist>.
//
// Spec: docs/projects/platform-overhaul/decisions/4.4-signup-and-checkout-flow.md (Q2)
//
// The checklist auto-hides when every item is done — that branch
// is exercised by the AllDone story (which renders nothing). The
// AllPending and SomeDone stories cover the visible permutations.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { SignupOnboardingChecklist } from "./signup-onboarding-checklist";
import {
  allDoneChecklist,
  allPendingChecklist,
  someDoneChecklist,
  type SignupChecklistFixture,
} from "./__fixtures__/onboarding";

const QUERY_KEY = ["/api/onboarding/signup-checklist"] as const;

function withSeededClient(
  fixture: SignupChecklistFixture,
): (Story: () => ReactNode) => JSX.Element {
  return function SeededClientDecorator(Story) {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, refetchOnWindowFocus: false },
      },
    });
    client.setQueryData(QUERY_KEY, fixture);
    return (
      <QueryClientProvider client={client}>
        <div className="max-w-2xl">
          <Story />
        </div>
      </QueryClientProvider>
    );
  };
}

const meta: Meta<typeof SignupOnboardingChecklist> = {
  title: "Shared/SignupOnboardingChecklist",
  component: SignupOnboardingChecklist,
};

export default meta;

type Story = StoryObj<typeof SignupOnboardingChecklist>;

export const AllPending: Story = {
  decorators: [withSeededClient(allPendingChecklist)],
};

export const SomeDone: Story = {
  decorators: [withSeededClient(someDoneChecklist)],
};

export const AllDone: Story = {
  // Component returns null when every item is complete. The story still
  // exists so designers / engineers can verify the auto-hide branch.
  decorators: [withSeededClient(allDoneChecklist)],
};
