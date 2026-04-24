/**
 * 4.1 Wave 3 — HomeAlertsPanel render tests.
 *
 * Covers:
 *   1. Renders alerts grouped by zone.
 *   2. Severity badge appears per alert.
 *   3. Empty state shows "No active alerts — all clear".
 *   4. "Mark all read" button is wired to the hook's markAsRead mutation
 *      for every visible alert.
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { HomeAlertsPanel } from "../client/src/components/home-alerts-panel";
import type {
  AlertItem,
  CrossAssociationAlertsPayload,
} from "../client/src/hooks/useCrossAssociationAlerts";

const QUERY_KEY = [
  "alerts",
  "cross-association",
  { zone: undefined, limit: 10, readState: "unread" },
] as const;

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

function withSeededClient(payload: CrossAssociationAlertsPayload) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, refetchInterval: false },
    },
  });
  client.setQueryData(QUERY_KEY, payload);
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
  // A default fetch mock returns empty alerts — tests that exercise the
  // panel's cache path seed the query directly and never trigger fetch.
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

describe("HomeAlertsPanel — rendering", () => {
  it("groups alerts by zone and shows severity badges + association name", () => {
    const Wrapper = withSeededClient({
      alerts: [
        fixtureAlert({
          alertId: "overdue-work-order:work_orders:wo-1",
          zone: "operations",
          severity: "high",
          associationName: "Harbor View HOA",
        }),
        fixtureAlert({
          alertId: "active-election:elections:el-1",
          zone: "governance",
          severity: "medium",
          title: "Election closing soon",
          description: "Board election closes in 2 days.",
          ruleType: "active-election",
          recordType: "elections",
          recordId: "el-1",
          resolutionHref: "/app/governance/elections/el-1",
          associationName: "Riverside Condos",
        }),
      ],
      readStateBy: {},
    });

    render(
      <Wrapper>
        <HomeAlertsPanel />
      </Wrapper>,
    );

    // Panel renders.
    expect(screen.getByTestId("home-alerts-panel")).toBeInTheDocument();

    // Two zone groups, in 1.1 zone-taxonomy order (operations before governance).
    const opsGroup = screen.getByTestId("alerts-zone-group-operations");
    const govGroup = screen.getByTestId("alerts-zone-group-governance");
    expect(opsGroup).toBeInTheDocument();
    expect(govGroup).toBeInTheDocument();

    // Operations group contains the work-order alert.
    expect(
      within(opsGroup).getByTestId("alert-item-overdue-work-order:work_orders:wo-1"),
    ).toBeInTheDocument();
    // Severity badge for work-order alert.
    expect(
      within(opsGroup).getByTestId("alert-severity-overdue-work-order:work_orders:wo-1"),
    ).toHaveTextContent(/high/i);
    // Association name rendered.
    expect(
      within(opsGroup).getByTestId("alert-association-overdue-work-order:work_orders:wo-1"),
    ).toHaveTextContent("Harbor View HOA");

    // Governance group has the election alert.
    expect(within(govGroup).getByTestId("alert-item-active-election:elections:el-1")).toBeInTheDocument();
    expect(
      within(govGroup).getByTestId("alert-association-active-election:elections:el-1"),
    ).toHaveTextContent("Riverside Condos");

    // "Mark all read" is visible when there are alerts.
    expect(screen.getByTestId("button-alerts-mark-all-read")).toBeInTheDocument();
  });

  it("renders the empty state 'No active alerts — all clear' when no alerts", () => {
    const Wrapper = withSeededClient({ alerts: [], readStateBy: {} });
    render(
      <Wrapper>
        <HomeAlertsPanel />
      </Wrapper>,
    );
    expect(screen.getByTestId("home-alerts-empty")).toBeInTheDocument();
    expect(screen.getByText(/no active alerts — all clear/i)).toBeInTheDocument();
    // Mark-all-read button is hidden in the empty state.
    expect(screen.queryByTestId("button-alerts-mark-all-read")).not.toBeInTheDocument();
  });
});

describe("HomeAlertsPanel — mark all read wiring", () => {
  it("clicking 'Mark all read' POSTs /read for every visible alert", async () => {
    const postCalls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "POST" && typeof url === "string") {
          postCalls.push(url);
        }
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
    );

    const Wrapper = withSeededClient({
      alerts: [
        fixtureAlert({ alertId: "overdue-work-order:work_orders:wo-1" }),
        fixtureAlert({
          alertId: "active-election:elections:el-1",
          zone: "governance",
          ruleType: "active-election",
          recordType: "elections",
          recordId: "el-1",
          resolutionHref: "/app/governance/elections/el-1",
        }),
      ],
      readStateBy: {},
    });

    render(
      <Wrapper>
        <HomeAlertsPanel />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId("button-alerts-mark-all-read"));

    await waitFor(() => {
      expect(postCalls.length).toBeGreaterThanOrEqual(2);
    });

    expect(postCalls.some((c) => c.endsWith("/read") && c.includes("wo-1"))).toBe(true);
    expect(postCalls.some((c) => c.endsWith("/read") && c.includes("el-1"))).toBe(true);
  });
});
