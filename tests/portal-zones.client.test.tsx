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
    "/api/portal/financial-dashboard": {
      balance: 0,
      totalCharges: 0,
      totalPayments: 0,
      // 2026-05-25 — per-unit hierarchical breakdown (additive).
      byUnit: [],
      grandTotal: 0,
    },
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

describe("Portal Finances — per-unit hierarchical breakdown (2026-05-25)", () => {
  it("renders one collapsible card per unit with category split and entry detail", async () => {
    installFetchStub({
      "/api/portal/financial-dashboard": {
        balance: 5618.61,
        totalCharges: 5618.61,
        totalPayments: 0,
        grandTotal: 5618.61,
        byUnit: [
          {
            unitId: "u-1417F",
            unitLabel: "1417-F",
            unitNumber: "F",
            building: "1417",
            total: 1525.42,
            byCategory: { assessment: 1525.42, charge: 0, "late-fee": 0, payment: 0, credit: 0, adjustment: 0 },
            entries: [
              {
                id: "e1",
                entryType: "assessment",
                amount: 1525.42,
                postedAt: "2026-05-08T00:00:00.000Z",
                description: "Imported balance — driveway assessment as of 2026-05-08 (overdue)",
              },
            ],
          },
          {
            unitId: "u-1421B",
            unitLabel: "1421-B",
            unitNumber: "B",
            building: "1421",
            total: 2121.77,
            byCategory: { assessment: 2121.77, charge: 0, "late-fee": 0, payment: 0, credit: 0, adjustment: 0 },
            entries: [
              {
                id: "e2",
                entryType: "assessment",
                amount: 2121.77,
                postedAt: "2026-05-08T00:00:00.000Z",
                description: "Imported balance — driveway assessment as of 2026-05-08 (overdue)",
              },
            ],
          },
          {
            unitId: "u-1421C",
            unitLabel: "1421-C",
            unitNumber: "C",
            building: "1421",
            total: 1971.42,
            byCategory: { assessment: 1971.42, charge: 0, "late-fee": 0, payment: 0, credit: 0, adjustment: 0 },
            entries: [
              {
                id: "e3",
                entryType: "assessment",
                amount: 1971.42,
                postedAt: "2026-05-08T00:00:00.000Z",
                description: "Imported balance — driveway assessment as of 2026-05-08 (overdue)",
              },
            ],
          },
        ],
      },
    });
    renderAt("/portal/finances", <PortalFinancesPage />);
    await waitFor(() => expect(screen.getByTestId("portal-finances-heading")).toBeInTheDocument());

    // Per-unit section is rendered with one card per unit (financial-dashboard
    // resolves on a subsequent tick after the page mounts).
    await waitFor(() => expect(screen.getByTestId("portal-finances-by-unit")).toBeInTheDocument());
    expect(screen.getByTestId("portal-finances-unit-u-1417F-label")).toHaveTextContent("1417-F");
    expect(screen.getByTestId("portal-finances-unit-u-1421B-label")).toHaveTextContent("1421-B");
    expect(screen.getByTestId("portal-finances-unit-u-1421C-label")).toHaveTextContent("1421-C");

    // Each unit shows its own total.
    expect(screen.getByTestId("portal-finances-unit-u-1417F-total")).toHaveTextContent("1,525.42");
    expect(screen.getByTestId("portal-finances-unit-u-1421B-total")).toHaveTextContent("2,121.77");
    expect(screen.getByTestId("portal-finances-unit-u-1421C-total")).toHaveTextContent("1,971.42");

    // Grand total is surfaced at the section header.
    expect(screen.getByTestId("portal-finances-by-unit-grand-total")).toHaveTextContent("5,618.61");

    // Category split visible even for $0 categories (e.g. HOA dues = charge).
    // Per the coordinator update we do NOT surface late-fees yet.
    expect(screen.getByTestId("portal-finances-unit-u-1417F-category-charge")).toBeInTheDocument();
    expect(screen.queryByTestId("portal-finances-unit-u-1417F-category-late-fee")).not.toBeInTheDocument();
  });

  it("falls back gracefully when the server omits byUnit (legacy clients)", async () => {
    installFetchStub({
      "/api/portal/financial-dashboard": { balance: 0, totalCharges: 0, totalPayments: 0 },
    });
    renderAt("/portal/finances", <PortalFinancesPage />);
    await waitFor(() => expect(screen.getByTestId("portal-finances-heading")).toBeInTheDocument());
    // The by-unit section should be absent when there are no units to show.
    expect(screen.queryByTestId("portal-finances-by-unit")).not.toBeInTheDocument();
  });
});

describe("Portal Finances — plan-aware Amount Due This Period (2026-05-25 live)", () => {
  // William verbatim: "if it's on the quarterly plan, then it shouldn't show
  // due until that quarter is up". The server is the source of truth for
  // whether `amountDueThisPeriod` is populated; the client renders the hero
  // card based on its presence. These tests cover the three branches.

  it("NO PLAN: amount-due hero is hidden; total balance is the primary CTA", async () => {
    installFetchStub({
      "/api/portal/financial-dashboard": {
        balance: 5618.61,
        totalCharges: 5618.61,
        totalPayments: 0,
        amountDueThisPeriod: null,
        byUnit: [],
      },
    });
    renderAt("/portal/finances", <PortalFinancesPage />);
    await waitFor(() => expect(screen.getByTestId("portal-finances-heading")).toBeInTheDocument());
    // Wait for the dashboard query to resolve and the balance to render.
    await waitFor(() =>
      expect(screen.getByTestId("portal-finances-balance")).toHaveTextContent("5,618.61"),
    );
    expect(screen.queryByTestId("portal-finances-amount-due-hero")).not.toBeInTheDocument();
  });

  it("MONTHLY PLAN: amount-due hero is visible with the installment", async () => {
    installFetchStub({
      "/api/portal/financial-dashboard": {
        balance: 5618.61,
        totalCharges: 5618.61,
        totalPayments: 0,
        amountDueThisPeriod: {
          amount: 250,
          periodLabel: "May 2026",
          periodEnd: "2026-05-31T23:59:59.999Z",
          frequency: "monthly",
          reason: "due",
        },
        byUnit: [],
      },
    });
    renderAt("/portal/finances", <PortalFinancesPage />);
    await waitFor(() => expect(screen.getByTestId("portal-finances-heading")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId("portal-finances-amount-due-hero")).toBeInTheDocument());
    expect(screen.getByTestId("portal-finances-amount-due")).toHaveTextContent("250");
    expect(screen.getByTestId("portal-finances-amount-due-context")).toHaveTextContent(/May 2026/);
    // Total balance is also rendered (as the secondary card).
    expect(screen.getByTestId("portal-finances-balance")).toHaveTextContent("5,618.61");
  });

  it("QUARTERLY PLAN MID-QUARTER: amount-due hero is HIDDEN (server returns null)", async () => {
    installFetchStub({
      "/api/portal/financial-dashboard": {
        balance: 5618.61,
        totalCharges: 5618.61,
        totalPayments: 0,
        // The server's resolver returns null when on a quarterly plan and
        // current date is outside the grace window. The UI must respect
        // that — do NOT show the "amount due" CTA between quarters.
        amountDueThisPeriod: null,
        // The plan IS active but the resolver said "not due right now."
        paymentPlan: {
          id: "pp-1",
          installmentAmount: 750,
          installmentFrequency: "quarterly",
          status: "active",
        },
        byUnit: [],
      },
    });
    renderAt("/portal/finances", <PortalFinancesPage />);
    await waitFor(() => expect(screen.getByTestId("portal-finances-heading")).toBeInTheDocument());
    // Wait for the dashboard to resolve so the assertion isn't trivially
    // true while the query is still loading.
    await waitFor(() =>
      expect(screen.getByTestId("portal-finances-balance")).toHaveTextContent("5,618.61"),
    );
    expect(screen.queryByTestId("portal-finances-amount-due-hero")).not.toBeInTheDocument();
    expect(screen.queryByTestId("portal-finances-amount-due")).not.toBeInTheDocument();
  });

  it("visible 'View full ledger' link is rendered above the fold", async () => {
    installFetchStub({
      "/api/portal/financial-dashboard": {
        balance: 100,
        totalCharges: 100,
        totalPayments: 0,
        byUnit: [],
      },
    });
    renderAt("/portal/finances", <PortalFinancesPage />);
    await waitFor(() => expect(screen.getByTestId("portal-finances-heading")).toBeInTheDocument());
    const ledgerLink = screen.getByTestId("portal-finances-hero-ledger-link");
    expect(ledgerLink).toBeInTheDocument();
    expect(ledgerLink).toHaveAttribute("href", "/portal/finances/ledger");
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
