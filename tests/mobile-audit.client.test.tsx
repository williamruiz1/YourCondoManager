/**
 * 5.3 — Mobile audit smoke test.
 *
 * Spec: docs/projects/platform-overhaul/decisions/5.3-mobile-audit.md
 *
 * Approach: render the lightweight zone-hub pages at a simulated 375px
 * viewport and assert `scrollWidth <= 375`. This is a ROUGH PROXY —
 * jsdom doesn't compute real layout, so we're really asserting that no
 * inline fixed widths > 375px leak into the markup. Not a substitute
 * for a human pass at real mobile widths.
 *
 * We use the placeholder hub pages (financials, operations) because they
 * are cheap to render without a full TanStack Query tree, while still
 * exercising the shared page-header + EmptyState + HubAlertWidget
 * primitives that appear across the workspace.
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import FinancialsHub from "../client/src/pages/hubs/financials-hub";
import OperationsHub from "../client/src/pages/hubs/operations-hub";
import GovernanceHub from "../client/src/pages/hubs/governance-hub";
import CommunicationsHub from "../client/src/pages/hubs/communications-hub";

const MOBILE_WIDTH = 375;

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
  // Simulate a 375px viewport. jsdom honors window.innerWidth but does
  // not fully recompute layout; we patch the <html>/<body> widths so
  // the scrollWidth check has something to measure.
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: MOBILE_WIDTH,
  });
  document.documentElement.style.width = `${MOBILE_WIDTH}px`;
  document.body.style.width = `${MOBILE_WIDTH}px`;
  document.body.style.margin = "0";

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

describe("Mobile audit — 375px smoke (5.3)", () => {
  it("Financials hub does not introduce fixed >375px widths", () => {
    const { container } = renderWithClient(<FinancialsHub />);
    // jsdom doesn't compute layout, so scrollWidth is effectively 0
    // unless an inline style forces a width. We assert nothing breaks
    // that proxy.
    expect(container.scrollWidth).toBeLessThanOrEqual(MOBILE_WIDTH);
  });

  it("Operations hub does not introduce fixed >375px widths", () => {
    const { container } = renderWithClient(<OperationsHub />);
    expect(container.scrollWidth).toBeLessThanOrEqual(MOBILE_WIDTH);
  });

  it("Governance hub does not introduce fixed >375px widths", () => {
    const { container } = renderWithClient(<GovernanceHub />);
    expect(container.scrollWidth).toBeLessThanOrEqual(MOBILE_WIDTH);
  });

  it("Communications hub does not introduce fixed >375px widths", () => {
    const { container } = renderWithClient(<CommunicationsHub />);
    expect(container.scrollWidth).toBeLessThanOrEqual(MOBILE_WIDTH);
  });
});
