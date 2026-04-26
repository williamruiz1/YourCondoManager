// Wave 37 — Storybook coverage for <HubAlertWidget>.
//
// Spec: docs/projects/platform-overhaul/decisions/4.1-cross-association-alert-engine.md
//
// The widget calls `useCrossAssociationAlerts` internally, so the
// stories pre-seed a `QueryClient` cache with the fixture payload
// keyed exactly the way the hook builds its key. That keeps the
// component under test untouched (no Storybook-only refactor).

import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { HubAlertWidget } from "./hub-alert-widget";
import {
  buildPayload,
  fewFinancialsAlerts,
  manyFinancialsAlerts,
} from "./__fixtures__/alerts";
import type { AlertItem } from "@/hooks/useCrossAssociationAlerts";

// Mirror of the cache key the hook constructs. Keep in sync with
// `useCrossAssociationAlerts` — Wave 5 spec Q6.
function alertsQueryKey(zone: "financials") {
  return [
    "alerts",
    "cross-association",
    { zone, limit: 3, readState: "unread" },
  ] as const;
}

function withSeededClient(alerts: AlertItem[]): (story: () => ReactNode) => JSX.Element {
  return function SeededClientDecorator(Story) {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, refetchOnWindowFocus: false },
      },
    });
    client.setQueryData(alertsQueryKey("financials"), buildPayload(alerts));
    return (
      <QueryClientProvider client={client}>
        <div className="max-w-md">
          <Story />
        </div>
      </QueryClientProvider>
    );
  };
}

const meta: Meta<typeof HubAlertWidget> = {
  title: "Shared/HubAlertWidget",
  component: HubAlertWidget,
};

export default meta;

type Story = StoryObj<typeof HubAlertWidget>;

export const AllClear: Story = {
  args: { zone: "Financials" },
  decorators: [withSeededClient([])],
};

export const Few: Story = {
  args: { zone: "Financials" },
  decorators: [withSeededClient(fewFinancialsAlerts)],
};

export const Many: Story = {
  args: { zone: "Financials" },
  decorators: [withSeededClient(manyFinancialsAlerts)],
};
