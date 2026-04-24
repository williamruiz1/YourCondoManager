/**
 * Wave 11 — 3.5 Owner Portal Restructure.
 *
 * Per-zone smoke tests — verify each zone file mounts under a portal
 * session via `PortalShell`, renders its first-person heading per 1.1
 * Q5, and wires the shell nav.
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

import PortalHomePage from "../client/src/pages/portal/portal-home";
import PortalFinancesPage from "../client/src/pages/portal/portal-finances";
import PortalRequestsPage from "../client/src/pages/portal/portal-requests";
import PortalCommunityPage from "../client/src/pages/portal/portal-community";
import PortalAmenitiesPage from "../client/src/pages/portal/portal-amenities";
import PortalDocumentsPage from "../client/src/pages/portal/portal-documents";
import PortalNoticesPage from "../client/src/pages/portal/portal-notices";

function renderAt(path: string, node: React.ReactElement) {
  const { hook } = memoryLocation({ path });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Router hook={hook}>{node}</Router>
    </QueryClientProvider>,
  );
}

type Handler = (url: string) => unknown;

function installFetchStub(overrides: Record<string, unknown> = {}, handlers: Record<string, Handler> = {}) {
  const defaults: Record<string, unknown> = {
    "/api/portal/me": {
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
    },
    "/api/portal/my-associations": [
      { associationId: "assoc-1", associationName: "Sunset HOA" },
    ],
    "/api/portal/maintenance-requests": [],
    "/api/portal/notices": [],
    "/api/portal/my-units": [{ unitId: "u-1", building: "A", unitNumber: "101", balance: 0 }],
    "/api/portal/financial-dashboard": { balance: 0, totalCharges: 0, totalPayments: 0 },
    "/api/portal/elections": [],
    "/api/portal/elections/active": [],
    "/api/portal/amenities/settings": { amenitiesEnabled: true },
    "/api/portal/payment-methods": [],
    "/api/portal/autopay/enrollments": [],
    "/api/portal/ledger": [],
    "/api/portal/documents": [],
    "/api/portal/communications": [],
    "/api/portal/amenities": [],
    "/api/portal/amenities/my-reservations": [],
    ...overrides,
  };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const handlerKey = Object.keys(handlers).find((k) => url === k || url.startsWith(`${k}?`) || url.startsWith(`${k}/`));
      if (handlerKey) {
        return new Response(JSON.stringify(handlers[handlerKey](url) ?? {}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      const key = Object.keys(defaults).find((k) => url === k || url.startsWith(`${k}?`) || url.startsWith(`${k}/`));
      const body = key !== undefined ? defaults[key] : {};
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("portalAccessId", "access-1");
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("Portal zone files — render under session + heading per 1.1 Q5", () => {
  it("PortalHome mounts at /portal and renders the Home heading", async () => {
    installFetchStub();
    renderAt("/portal", <PortalHomePage />);
    await waitFor(() => expect(screen.getByTestId("portal-home-heading")).toBeInTheDocument());
    expect(screen.getByTestId("portal-home")).toBeInTheDocument();
    // Four-zone sidebar (1.1 Q5).
    expect(screen.getByTestId("portal-nav-home")).toBeInTheDocument();
    expect(screen.getByTestId("portal-nav-my-finances")).toBeInTheDocument();
    expect(screen.getByTestId("portal-nav-my-requests")).toBeInTheDocument();
    expect(screen.getByTestId("portal-nav-my-community")).toBeInTheDocument();
  });

  it("PortalFinances mounts at /portal/finances with the My Finances heading", async () => {
    installFetchStub();
    renderAt("/portal/finances", <PortalFinancesPage />);
    await waitFor(() => expect(screen.getByTestId("portal-finances-heading")).toBeInTheDocument());
    expect(screen.getByTestId("portal-finances-heading")).toHaveTextContent("My Finances");
  });

  it("PortalFinances payment methods sub-page renders heading", async () => {
    installFetchStub();
    renderAt("/portal/finances/payment-methods", <PortalFinancesPage subPath="payment-methods" />);
    await waitFor(() =>
      expect(screen.getByTestId("portal-finances-payment-methods-heading")).toBeInTheDocument(),
    );
  });

  it("PortalFinances ledger sub-page renders heading", async () => {
    installFetchStub();
    renderAt("/portal/finances/ledger", <PortalFinancesPage subPath="ledger" />);
    await waitFor(() => expect(screen.getByTestId("portal-finances-ledger-heading")).toBeInTheDocument());
  });

  it("PortalRequests hub mounts and renders My Requests heading", async () => {
    installFetchStub();
    renderAt("/portal/requests", <PortalRequestsPage />);
    await waitFor(() => expect(screen.getByTestId("portal-requests-heading")).toBeInTheDocument());
  });

  it("PortalRequests detail sub-page renders a back link when request is missing", async () => {
    installFetchStub();
    renderAt("/portal/requests/missing-id", <PortalRequestsPage requestId="missing-id" />);
    await waitFor(() => expect(screen.getByTestId("portal-requests-detail-missing")).toBeInTheDocument());
  });

  it("PortalCommunity mounts at /portal/community with the My Community heading", async () => {
    installFetchStub();
    renderAt("/portal/community", <PortalCommunityPage />);
    await waitFor(() => expect(screen.getByTestId("portal-community-heading")).toBeInTheDocument());
    // 4.2 Q4 zone-wrapper link-out card with the hub link button.
    expect(screen.getByTestId("portal-community-hub-button")).toBeInTheDocument();
  });

  it("PortalAmenities mounts when amenities are enabled", async () => {
    installFetchStub();
    renderAt("/portal/amenities", <PortalAmenitiesPage />);
    await waitFor(() => expect(screen.getByTestId("portal-amenities-heading")).toBeInTheDocument());
  });

  it("PortalDocuments renders the association documents heading", async () => {
    installFetchStub();
    renderAt("/portal/documents", <PortalDocumentsPage />);
    await waitFor(() => expect(screen.getByTestId("portal-documents-heading")).toBeInTheDocument());
  });

  it("PortalNotices renders the Notices & votes heading", async () => {
    installFetchStub();
    renderAt("/portal/notices", <PortalNoticesPage />);
    await waitFor(() => expect(screen.getByTestId("portal-notices-heading")).toBeInTheDocument());
  });
});

describe("Portal zones — session gate behavior (Q4 shell-owned)", () => {
  it("redirects to login container when portalAccessId is missing at any /portal/* route", async () => {
    window.localStorage.removeItem("portalAccessId");
    installFetchStub();
    renderAt("/portal/finances", <PortalFinancesPage />);
    // PortalShell renders the login container in place of the shell.
    expect(screen.queryByTestId("portal-finances-heading")).not.toBeInTheDocument();
    expect(screen.queryByTestId("portal-shell")).not.toBeInTheDocument();
  });
});
