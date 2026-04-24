/**
 * 4.1 Wave 4 — Central inbox page tests.
 *
 * Covers:
 *   1. Filter tabs render (All, Unread, Archived) with Unread selected by
 *      default (spec brief: "Default to Unread").
 *   2. Switching to Archived shows only dismissed items (client-side
 *      filter on `readState: "all"` data, per spec).
 *   3. "Restore" button on a dismissed row POSTs to /api/alerts/:id/restore.
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import CommunicationsInboxPage from "../client/src/pages/communications-inbox";
import type {
  AlertItem,
  AlertReadStateEntry,
  CrossAssociationAlertsPayload,
} from "../client/src/hooks/useCrossAssociationAlerts";

// ---- Fixtures -------------------------------------------------------------

function fixtureAlert(overrides: Partial<AlertItem> = {}): AlertItem {
  return {
    alertId: "overdue-work-order:work_orders:wo-unread",
    associationId: "assoc-1",
    associationName: "Harbor View HOA",
    zone: "operations",
    featureDomain: "operations.work-orders",
    ruleType: "overdue-work-order",
    recordType: "work_orders",
    recordId: "wo-unread",
    severity: "high",
    title: "Overdue work order: Fix leak",
    description: "12 days overdue.",
    createdAt: new Date("2026-04-10T00:00:00Z").toISOString(),
    resolutionHref: "/app/work-orders/wo-unread",
    sourceRecord: null,
    ...overrides,
  };
}

const UNREAD_KEY = [
  "alerts",
  "cross-association",
  { zone: undefined, limit: 200, readState: "unread" },
] as const;

const ALL_KEY = [
  "alerts",
  "cross-association",
  { zone: undefined, limit: 200, readState: "all" },
] as const;

function makeClient(opts: {
  unread?: CrossAssociationAlertsPayload;
  all?: CrossAssociationAlertsPayload;
}) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, refetchInterval: false },
    },
  });
  if (opts.unread) client.setQueryData(UNREAD_KEY, opts.unread);
  if (opts.all) client.setQueryData(ALL_KEY, opts.all);
  return client;
}

function renderWith(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <CommunicationsInboxPage />
    </QueryClientProvider>,
  );
}

// A blanket fetch stub so the inbox's mutations + any lazy query fetches
// don't reach the network in tests.
beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ alerts: [], readStateBy: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );

  // jsdom lacks matchMedia — `useIsMobile` (used by BreadcrumbNav) calls
  // it in an effect. Install a desktop-reporting stub so the desktop
  // breadcrumb branch renders without throwing.
  if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
});

// ---------------------------------------------------------------------------
// 1. Filter tabs + default tab
// ---------------------------------------------------------------------------

describe("CommunicationsInboxPage — filter tabs", () => {
  it("renders All / Unread / Archived tabs with Unread as the default", () => {
    const client = makeClient({
      unread: { alerts: [], readStateBy: {} },
    });

    renderWith(client);

    expect(screen.getByTestId("inbox-tab-all")).toBeInTheDocument();
    expect(screen.getByTestId("inbox-tab-unread")).toBeInTheDocument();
    expect(screen.getByTestId("inbox-tab-archived")).toBeInTheDocument();

    // Radix Tabs marks the active trigger with `data-state="active"`.
    expect(screen.getByTestId("inbox-tab-unread")).toHaveAttribute("data-state", "active");
    expect(screen.getByTestId("inbox-tab-all")).toHaveAttribute("data-state", "inactive");
    expect(screen.getByTestId("inbox-tab-archived")).toHaveAttribute("data-state", "inactive");
  });
});

// ---------------------------------------------------------------------------
// 2. Archived tab filters to dismissed items
// ---------------------------------------------------------------------------

describe("CommunicationsInboxPage — Archived tab filters to dismissed items", () => {
  it("shows only alerts with dismissedAt != null when the Archived tab is active", async () => {
    const dismissedAlert = fixtureAlert({
      alertId: "overdue-work-order:work_orders:wo-archived",
      recordId: "wo-archived",
      title: "Archived leak",
    });
    const activeAlert = fixtureAlert({
      alertId: "overdue-work-order:work_orders:wo-active",
      recordId: "wo-active",
      title: "Still open leak",
    });

    const readStateBy: Record<string, AlertReadStateEntry> = {
      "overdue-work-order:work_orders:wo-archived": {
        readAt: null,
        dismissedAt: new Date("2026-04-20T00:00:00Z").toISOString(),
      },
      // Active alert has no read-state entry at all (implicit unread).
    };

    const client = makeClient({
      unread: { alerts: [activeAlert], readStateBy: {} },
      all: { alerts: [dismissedAlert, activeAlert], readStateBy },
    });

    renderWith(client);

    // Switch to Archived.
    // Radix Tabs listens on `mouseDown` (not `click`) to switch tabs.
    fireEvent.mouseDown(screen.getByTestId("inbox-tab-archived"));

    await waitFor(() => {
      expect(screen.getByTestId("inbox-tab-archived")).toHaveAttribute("data-state", "active");
    });

    // Archived alert renders; active alert does not.
    expect(
      screen.getByTestId("inbox-alert-item-overdue-work-order:work_orders:wo-archived"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("inbox-alert-item-overdue-work-order:work_orders:wo-active"),
    ).not.toBeInTheDocument();
  });

  it("shows the archived empty state when no dismissed items match", async () => {
    const activeAlert = fixtureAlert({
      alertId: "overdue-work-order:work_orders:wo-only-active",
      recordId: "wo-only-active",
    });
    const client = makeClient({
      unread: { alerts: [activeAlert], readStateBy: {} },
      all: { alerts: [activeAlert], readStateBy: {} },
    });

    renderWith(client);
    // Radix Tabs listens on `mouseDown` (not `click`) to switch tabs.
    fireEvent.mouseDown(screen.getByTestId("inbox-tab-archived"));

    await waitFor(() => {
      expect(screen.getByTestId("inbox-empty-archived")).toBeInTheDocument();
    });
    expect(screen.getByText(/no archived alerts/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Restore button calls POST /restore
// ---------------------------------------------------------------------------

describe("CommunicationsInboxPage — Restore mutation", () => {
  it("clicking Restore on a dismissed row POSTs to /api/alerts/:id/restore", async () => {
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

    const dismissedAlert = fixtureAlert({
      alertId: "overdue-work-order:work_orders:wo-restore-me",
      recordId: "wo-restore-me",
      title: "Restore me",
    });
    const readStateBy: Record<string, AlertReadStateEntry> = {
      "overdue-work-order:work_orders:wo-restore-me": {
        readAt: null,
        dismissedAt: new Date("2026-04-18T00:00:00Z").toISOString(),
      },
    };
    const client = makeClient({
      all: { alerts: [dismissedAlert], readStateBy },
    });

    renderWith(client);

    // Switch to Archived so the dismissed row renders.
    // Radix Tabs listens on `mouseDown` (not `click`) to switch tabs.
    fireEvent.mouseDown(screen.getByTestId("inbox-tab-archived"));

    const row = await screen.findByTestId(
      "inbox-alert-item-overdue-work-order:work_orders:wo-restore-me",
    );
    const restoreButton = within(row).getByTestId(
      "inbox-alert-restore-overdue-work-order:work_orders:wo-restore-me",
    );
    fireEvent.click(restoreButton);

    await waitFor(() => {
      expect(postCalls.length).toBeGreaterThan(0);
    });

    expect(
      postCalls.some(
        (c) =>
          c.endsWith("/restore") &&
          c.includes("overdue-work-order%3Awork_orders%3Awo-restore-me"),
      ),
    ).toBe(true);
  });

  it("Archived rows render Restore (not Dismiss) — Unread rows render Dismiss", async () => {
    const dismissedAlert = fixtureAlert({
      alertId: "overdue-work-order:work_orders:wo-dismissed",
      recordId: "wo-dismissed",
    });
    const activeAlert = fixtureAlert({
      alertId: "overdue-work-order:work_orders:wo-live",
      recordId: "wo-live",
    });
    const readStateBy: Record<string, AlertReadStateEntry> = {
      "overdue-work-order:work_orders:wo-dismissed": {
        readAt: null,
        dismissedAt: new Date().toISOString(),
      },
    };

    const client = makeClient({
      unread: { alerts: [activeAlert], readStateBy: {} },
      all: { alerts: [dismissedAlert, activeAlert], readStateBy },
    });

    renderWith(client);

    // Unread tab (default) — active alert has Dismiss, no Restore.
    const unreadRow = await screen.findByTestId(
      "inbox-alert-item-overdue-work-order:work_orders:wo-live",
    );
    expect(
      within(unreadRow).getByTestId("inbox-alert-dismiss-overdue-work-order:work_orders:wo-live"),
    ).toBeInTheDocument();
    expect(
      within(unreadRow).queryByTestId("inbox-alert-restore-overdue-work-order:work_orders:wo-live"),
    ).not.toBeInTheDocument();

    // Switch to Archived — dismissed alert has Restore, not Dismiss.
    // Radix Tabs listens on `mouseDown` (not `click`) to switch tabs.
    fireEvent.mouseDown(screen.getByTestId("inbox-tab-archived"));
    const archivedRow = await screen.findByTestId(
      "inbox-alert-item-overdue-work-order:work_orders:wo-dismissed",
    );
    expect(
      within(archivedRow).getByTestId(
        "inbox-alert-restore-overdue-work-order:work_orders:wo-dismissed",
      ),
    ).toBeInTheDocument();
    expect(
      within(archivedRow).queryByTestId(
        "inbox-alert-dismiss-overdue-work-order:work_orders:wo-dismissed",
      ),
    ).not.toBeInTheDocument();
  });
});
