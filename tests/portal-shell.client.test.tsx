/**
 * Wave 11 — 3.5 Owner Portal Restructure.
 *
 * Verifies PortalShell behavior:
 *  - (a) renders zone content under a portal session;
 *  - (b) surfaces the login container when `portalAccessId` is missing;
 *  - (c) renders the portal breadcrumb for the current route.
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

import { PortalShell, resolvePortalBreadcrumb } from "../client/src/pages/portal/portal-shell";

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, refetchInterval: false },
    },
  });
}

function renderWithRouter(path: string, node: React.ReactElement) {
  const { hook } = memoryLocation({ path });
  return render(
    <QueryClientProvider client={makeClient()}>
      <Router hook={hook}>{node}</Router>
    </QueryClientProvider>,
  );
}

function stubPortalApi(sessionShape: Record<string, unknown> | null = null, override: Record<string, unknown> = {}) {
  const session =
    sessionShape ??
    ({
      id: "portal-1",
      email: "owner@example.com",
      associationId: "assoc-1",
      role: "owner",
      hasBoardAccess: false,
      effectiveRole: "owner",
      boardRoleId: null,
      unitNumber: "101",
      building: "A",
      firstName: "Sam",
      lastName: "Owner",
      phone: null,
      mailingAddress: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      contactPreference: null,
      smsOptIn: null,
    } as Record<string, unknown>);

  const defaults: Record<string, unknown> = {
    "/api/portal/me": session,
    "/api/portal/my-associations": [{ associationId: "assoc-1", associationName: "Sunset HOA" }],
    "/api/portal/maintenance-requests": [],
    "/api/portal/notices": [],
    ...override,
  };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const key = Object.keys(defaults).find((k) => url === k || url.startsWith(`${k}?`));
      const body = key ? defaults[key] : {};
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("PortalShell — session gate (Q4 shell-owned)", () => {
  it("surfaces the OwnerPortalLoginContainer when portalAccessId is not in storage", () => {
    renderWithRouter(
      "/portal",
      <PortalShell>
        <div data-testid="zone-child">zone content</div>
      </PortalShell>,
    );

    // Login container renders a form with "Send Code" / email input; the
    // portal shell itself should NOT render.
    expect(screen.queryByTestId("portal-shell")).not.toBeInTheDocument();
    expect(screen.queryByTestId("zone-child")).not.toBeInTheDocument();
  });

  it("renders portal content when portalAccessId is present and /api/portal/me resolves", async () => {
    window.localStorage.setItem("portalAccessId", "access-1");
    stubPortalApi();

    renderWithRouter(
      "/portal",
      <PortalShell>
        <div data-testid="zone-child">zone content</div>
      </PortalShell>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("portal-shell")).toBeInTheDocument();
    });
    expect(screen.getByTestId("zone-child")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("portal-header-title")).toHaveTextContent("Sunset HOA — Owner Portal");
    });
  });
});

describe("PortalShell — breadcrumb wiring (1.3)", () => {
  it("resolvePortalBreadcrumb returns ≤3 segments for every supported route", () => {
    const routes = [
      "/portal",
      "/portal/finances",
      "/portal/finances/payment-methods",
      "/portal/finances/ledger",
      "/portal/finances/assessments/abc",
      "/portal/requests",
      "/portal/requests/xyz",
      "/portal/community",
      "/portal/amenities",
      "/portal/notices",
      "/portal/documents",
    ];
    for (const r of routes) {
      const trail = resolvePortalBreadcrumb(r);
      expect(trail.length).toBeGreaterThan(0);
      expect(trail.length).toBeLessThanOrEqual(3);
      // Leaf is non-linked per 1.3 Q3.
      expect(trail[trail.length - 1].href).toBeUndefined();
    }
  });

  it("returns empty trail for unknown routes", () => {
    expect(resolvePortalBreadcrumb("/portal/does-not-exist")).toEqual([]);
  });
});
