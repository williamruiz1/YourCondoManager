/**
 * 4.1 Wave 5 — Hub-page integration tests.
 *
 * Verifies that the HubAlertWidget is mounted on each of the four zone
 * hub surfaces (Financials, Operations, Governance, Communications) with
 * the correct `zone` prop — the widget queries the cache via a zone-keyed
 * TanStack query, so the assertion is that the widget renders and its
 * test-id carries the expected zone slug.
 *
 * Phase 11 (3.2 Q3): the Governance and Communications hubs now live in
 * dedicated files under `client/src/pages/hubs/` (matching Financials and
 * Operations). The legacy `/app/governance` and `/app/communications`
 * page content has relocated to `/app/governance/overview` and
 * `/app/communications/overview` respectively. The HubAlertWidget mounts
 * on the new hub pages — not the relocated overview pages — so this test
 * targets the four hub files in `client/src/pages/hubs/`.
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

import FinancialsHub from "../client/src/pages/hubs/financials-hub";
import OperationsHub from "../client/src/pages/hubs/operations-hub";
import GovernanceHub from "../client/src/pages/hubs/governance-hub";
import CommunicationsHub from "../client/src/pages/hubs/communications-hub";

function renderWithClient(node: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, refetchInterval: false },
    },
  });
  const { hook } = memoryLocation({ path: "/app" });
  return render(
    <QueryClientProvider client={client}>
      <Router hook={hook}>{node}</Router>
    </QueryClientProvider>,
  );
}

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
});

describe("Zone hub pages — HubAlertWidget mount", () => {
  it("Financials hub mounts HubAlertWidget with zone='Financials'", () => {
    renderWithClient(<FinancialsHub />);
    const widget = screen.getByTestId("hub-alert-widget-financials");
    expect(widget).toBeInTheDocument();
    expect(widget).toHaveAttribute("data-hub-zone", "Financials");
  });

  it("Operations hub mounts HubAlertWidget with zone='Operations'", () => {
    renderWithClient(<OperationsHub />);
    const widget = screen.getByTestId("hub-alert-widget-operations");
    expect(widget).toBeInTheDocument();
    expect(widget).toHaveAttribute("data-hub-zone", "Operations");
  });

  it("Governance hub mounts HubAlertWidget with zone='Governance'", () => {
    renderWithClient(<GovernanceHub />);
    const widget = screen.getByTestId("hub-alert-widget-governance");
    expect(widget).toBeInTheDocument();
    expect(widget).toHaveAttribute("data-hub-zone", "Governance");
  });

  it("Communications hub mounts HubAlertWidget with zone='Communications'", () => {
    renderWithClient(<CommunicationsHub />);
    const widget = screen.getByTestId("hub-alert-widget-communications");
    expect(widget).toBeInTheDocument();
    expect(widget).toHaveAttribute("data-hub-zone", "Communications");
  });
});

describe("Zone hub pages — sub-page navigation grid (Phase 11 — 3.2 Q1-Q3)", () => {
  it("Financials hub renders a sub-page links grid", () => {
    renderWithClient(<FinancialsHub />);
    expect(screen.getByTestId("financials-hub-links")).toBeInTheDocument();
  });

  it("Operations hub renders a sub-page links grid", () => {
    renderWithClient(<OperationsHub />);
    expect(screen.getByTestId("operations-hub-links")).toBeInTheDocument();
  });

  it("Governance hub renders a sub-page links grid (overview link present)", () => {
    renderWithClient(<GovernanceHub />);
    expect(screen.getByTestId("governance-hub-links")).toBeInTheDocument();
    // 3.2 Q3 — the relocated /app/governance/overview link must appear.
    expect(screen.getByTestId("link-governance-hub-overview")).toBeInTheDocument();
  });

  it("Communications hub renders a sub-page links grid (overview + inbox links)", () => {
    renderWithClient(<CommunicationsHub />);
    expect(screen.getByTestId("communications-hub-links")).toBeInTheDocument();
    expect(screen.getByTestId("link-communications-hub-overview")).toBeInTheDocument();
    expect(screen.getByTestId("link-communications-hub-inbox")).toBeInTheDocument();
  });
});
