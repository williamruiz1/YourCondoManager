// Wave 37 — Storybook coverage for <HomeAlertsPanel>.
//
// Spec: docs/projects/platform-overhaul/decisions/4.1-cross-association-alert-engine.md
//
// Loading + empty + filled — three of the four panel states (the
// error state is covered separately by <ErrorState> stories).

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { HomeAlertsPanel } from "./home-alerts-panel";
import { buildPayload, homeAlerts } from "./__fixtures__/alerts";
import type { AlertItem } from "@/hooks/useCrossAssociationAlerts";

// Hook builds: ["alerts","cross-association",{ zone, limit, readState }]
// HomeAlertsPanel always passes limit=10, readState="unread", no zone.
const HOME_KEY = [
  "alerts",
  "cross-association",
  { zone: undefined, limit: 10, readState: "unread" },
] as const;

function withSeededClient(
  alerts: AlertItem[] | "loading",
): (Story: () => ReactNode) => JSX.Element {
  return function SeededClientDecorator(Story) {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, refetchOnWindowFocus: false },
      },
    });
    if (alerts !== "loading") {
      client.setQueryData(HOME_KEY, buildPayload(alerts));
    }
    return (
      <QueryClientProvider client={client}>
        <div className="max-w-2xl">
          <Story />
        </div>
      </QueryClientProvider>
    );
  };
}

const meta: Meta<typeof HomeAlertsPanel> = {
  title: "Shared/HomeAlertsPanel",
  component: HomeAlertsPanel,
};

export default meta;

type Story = StoryObj<typeof HomeAlertsPanel>;

export const Loading: Story = {
  decorators: [withSeededClient("loading")],
};

export const Empty: Story = {
  decorators: [withSeededClient([])],
};

export const Filled: Story = {
  decorators: [withSeededClient(homeAlerts)],
};
