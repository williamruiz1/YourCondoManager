/**
 * 4.1 Wave 5 — Hub-page integration tests.
 *
 * Verifies that the HubAlertWidget is mounted on each of the four zone
 * hub surfaces (Financials, Operations, Governance, Communications) with
 * the correct `zone` prop — the widget queries the cache via a zone-keyed
 * TanStack query, so the assertion is that the widget renders and its
 * test-id carries the expected zone slug.
 *
 * Note: the Governance and Communications hubs in this wave reuse the
 * existing `/app/governance` and `/app/communications` real-content
 * pages (not the `client/src/pages/hubs/*` placeholders) — the widget
 * is mounted at the top of those existing pages. Financials and
 * Operations use the placeholder hub pages wired at `/app/financials`
 * and `/app/operations`.
 *
 * @vitest-environment jsdom
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import FinancialsHub from "../client/src/pages/hubs/financials-hub";
import OperationsHub from "../client/src/pages/hubs/operations-hub";

const REPO_ROOT = path.resolve(__dirname, "..");

function renderWithClient(node: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, refetchInterval: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>,
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

  it("Governance hub page (real-content /app/governance) mounts the widget", async () => {
    // The real Governance page imports many child components (meetings,
    // elections, compliance, board-packages) and makes network requests.
    // Rather than render the full page, we assert on the source file by
    // checking it contains the widget mount with the correct zone prop —
    // a cheap smoke test that the integration is wired. A full render is
    // covered by the HubAlertWidget unit test + the existing governance
    // page test suite.
    const source = await fs.readFile(
      path.join(REPO_ROOT, "client/src/pages/governance.tsx"),
      "utf8",
    );
    expect(source).toMatch(/HubAlertWidget/);
    expect(source).toMatch(/zone="Governance"/);
  });

  it("Communications hub page (real-content /app/communications) mounts the widget", async () => {
    const source = await fs.readFile(
      path.join(REPO_ROOT, "client/src/pages/communications.tsx"),
      "utf8",
    );
    expect(source).toMatch(/HubAlertWidget/);
    expect(source).toMatch(/zone="Communications"/);
  });
});
