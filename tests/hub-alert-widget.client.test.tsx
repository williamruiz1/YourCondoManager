/**
 * 4.1 Wave 5 — HubAlertWidget render tests.
 *
 * Covers:
 *   1. Renders count badge with correct N and zone label.
 *   2. Empty state "all clear" when N=0 (count badge reads "Zone (clear)").
 *   3. Mini-list shows up to 3 alerts even if the server returns more.
 *   4. Each mini-list item is a wouter <Link> pointing at the alert's
 *      `resolutionHref`.
 *   5. Does NOT poll — the hook is instantiated with refetchInterval=false
 *      so only the initial fetch fires within the observation window.
 *   6. Accessibility: count badge has the required aria-label and list
 *      items are reachable via anchor tags.
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { HubAlertWidget } from "../client/src/components/hub-alert-widget";
import type {
  AlertItem,
  CrossAssociationAlertsPayload,
} from "../client/src/hooks/useCrossAssociationAlerts";

function buildQueryKey(zone: string) {
  return [
    "alerts",
    "cross-association",
    { zone, limit: 3, readState: "unread" },
  ] as const;
}

function fixtureAlert(overrides: Partial<AlertItem> = {}): AlertItem {
  return {
    alertId: "overdue-work-order:work_orders:wo-1",
    associationId: "assoc-1",
    associationName: "Harbor View HOA",
    zone: "operations",
    featureDomain: "operations.work-orders",
    ruleType: "overdue-work-order",
    recordType: "work_orders",
    recordId: "wo-1",
    severity: "high",
    title: "Overdue work order: Fix leak",
    description: "Scheduled for 2026-04-10 — 12 days overdue.",
    createdAt: new Date("2026-04-01T00:00:00Z").toISOString(),
    resolutionHref: "/app/operations/work-orders/wo-1",
    sourceRecord: null,
    ...overrides,
  };
}

function withSeededClient(
  zone: "financials" | "operations" | "governance" | "communications",
  payload: CrossAssociationAlertsPayload,
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, refetchInterval: false },
    },
  });
  client.setQueryData(buildQueryKey(zone), payload);
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  // Default fetch mock — any test that seeds the cache should never hit it.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ alerts: [], readStateBy: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("HubAlertWidget — count badge", () => {
  it("renders 'Zone (N alerts)' with the correct N", () => {
    const Wrapper = withSeededClient("operations", {
      alerts: [
        fixtureAlert({ alertId: "a-1" }),
        fixtureAlert({ alertId: "a-2" }),
        fixtureAlert({ alertId: "a-3" }),
      ],
      readStateBy: {},
    });

    render(
      <Wrapper>
        <HubAlertWidget zone="Operations" />
      </Wrapper>,
    );

    const badge = screen.getByTestId("hub-alert-widget-badge-operations");
    expect(badge).toHaveTextContent(/Operations \(3 alerts\)/);
    // Accessibility: aria-label announces count with expand hint.
    expect(badge).toHaveAttribute("aria-label", "3 alerts, expand for details");
  });

  it("singularizes the badge when N=1", () => {
    const Wrapper = withSeededClient("financials", {
      alerts: [fixtureAlert({ zone: "financials", alertId: "a-1" })],
      readStateBy: {},
    });
    render(
      <Wrapper>
        <HubAlertWidget zone="Financials" />
      </Wrapper>,
    );
    const badge = screen.getByTestId("hub-alert-widget-badge-financials");
    expect(badge).toHaveTextContent(/Financials \(1 alert\)/);
    expect(badge).toHaveAttribute("aria-label", "1 alerts, expand for details");
  });
});

describe("HubAlertWidget — empty state", () => {
  it("renders 'Zone (clear)' badge and 'No alerts for Zone — all clear.' when N=0", () => {
    const Wrapper = withSeededClient("governance", {
      alerts: [],
      readStateBy: {},
    });

    render(
      <Wrapper>
        <HubAlertWidget zone="Governance" />
      </Wrapper>,
    );

    // Badge shows "(clear)" and aria-label indicates zero.
    const badge = screen.getByTestId("hub-alert-widget-badge-governance");
    expect(badge).toHaveTextContent(/Governance \(clear\)/);
    expect(badge).toHaveAttribute("aria-label", "0 alerts, all clear");

    // Positive empty-state copy.
    const empty = screen.getByTestId("hub-alert-widget-empty-governance");
    expect(empty).toBeInTheDocument();
    expect(empty).toHaveTextContent("No alerts for Governance — all clear.");
  });
});

describe("HubAlertWidget — mini-list (top 3)", () => {
  it("renders up to 3 alerts as links to each alert's resolutionHref", () => {
    const Wrapper = withSeededClient("operations", {
      alerts: [
        fixtureAlert({
          alertId: "overdue-work-order:work_orders:wo-1",
          resolutionHref: "/app/operations/work-orders/wo-1",
          title: "Fix leak",
        }),
        fixtureAlert({
          alertId: "overdue-work-order:work_orders:wo-2",
          resolutionHref: "/app/operations/work-orders/wo-2",
          title: "HVAC inspection",
        }),
        fixtureAlert({
          alertId: "due-maintenance:maintenance_instances:m-1",
          ruleType: "due-maintenance",
          recordType: "maintenance_instances",
          recordId: "m-1",
          resolutionHref: "/app/maintenance-schedules/m-1",
          title: "Quarterly roof check",
        }),
      ],
      readStateBy: {},
    });

    render(
      <Wrapper>
        <HubAlertWidget zone="Operations" />
      </Wrapper>,
    );

    const list = screen.getByTestId("hub-alert-widget-list-operations");
    const items = within(list).getAllByRole("link");
    expect(items).toHaveLength(3);

    // Each item is an <a> with href=resolutionHref (wouter <Link> renders <a>).
    expect(items[0]).toHaveAttribute("href", "/app/operations/work-orders/wo-1");
    expect(items[1]).toHaveAttribute("href", "/app/operations/work-orders/wo-2");
    expect(items[2]).toHaveAttribute("href", "/app/maintenance-schedules/m-1");
  });

  it("slices to 3 even if server returns more (defensive)", () => {
    const extra: AlertItem[] = Array.from({ length: 6 }, (_v, i) =>
      fixtureAlert({
        alertId: `wo-extra-${i}`,
        resolutionHref: `/app/operations/work-orders/extra-${i}`,
        title: `Extra ${i}`,
      }),
    );
    const Wrapper = withSeededClient("operations", {
      alerts: extra,
      readStateBy: {},
    });
    render(
      <Wrapper>
        <HubAlertWidget zone="Operations" />
      </Wrapper>,
    );
    const list = screen.getByTestId("hub-alert-widget-list-operations");
    const items = within(list).getAllByRole("link");
    expect(items).toHaveLength(3);
  });
});

describe("HubAlertWidget — no polling (rides the cache)", () => {
  it("does NOT schedule a periodic refetch — only the initial fetch fires", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ alerts: [], readStateBy: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    // Use a fresh client (no seeded cache) so the initial fetch does fire
    // and any polling would be observable as additional calls.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    vi.useFakeTimers();

    render(
      <Wrapper>
        <HubAlertWidget zone="Financials" />
      </Wrapper>,
    );

    // Let the initial query settle.
    await vi.runOnlyPendingTimersAsync();
    const initialCount = fetchSpy.mock.calls.length;
    expect(initialCount).toBeGreaterThanOrEqual(1);

    // Advance well past the 120s Home/inbox cadence — hub widgets must not
    // re-query because refetchInterval is disabled for this surface.
    await vi.advanceTimersByTimeAsync(300_000);

    expect(fetchSpy.mock.calls.length).toBe(initialCount);
  });
});

describe("HubAlertWidget — loading + error states", () => {
  it("renders a skeleton while the initial query is loading", () => {
    // Empty query client; the query will start in loading state.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    render(
      <Wrapper>
        <HubAlertWidget zone="Communications" />
      </Wrapper>,
    );
    expect(
      screen.getByTestId("hub-alert-widget-loading-communications"),
    ).toBeInTheDocument();
  });

  it("renders an error message when the query fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("oops", { status: 500 })),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    render(
      <Wrapper>
        <HubAlertWidget zone="Financials" />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("hub-alert-widget-error-financials"),
      ).toBeInTheDocument(),
    );
  });
});
