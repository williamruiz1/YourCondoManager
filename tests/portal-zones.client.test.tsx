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
import userEvent from "@testing-library/user-event";
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

  // YCM pressing-items owner-portal hard gate (2026-07-14, William voice
  // ruling): pressing items (unmatched bank transactions, other owners'
  // delinquency status, vendor insurance, compliance deadlines) are
  // board/treasurer business and must NEVER render on the owner portal —
  // regardless of the viewer's board seat. Covers both a plain owner AND an
  // owner-board-member/Treasurer session, since the ruling is "regardless
  // of role."
  it.each([
    ["a plain owner", { hasBoardAccess: false, effectiveRole: "owner", role: "owner" }],
    [
      "an owner who is also the Treasurer",
      { hasBoardAccess: true, effectiveRole: "owner-board-member", role: "owner" },
    ],
  ])("PortalHome never renders the pressing-items surface, even for %s", async (_label, meOverrides) => {
    installFetchStub({
      "/api/portal/me": {
        id: "portal-1",
        email: "owner@example.com",
        associationId: "assoc-1",
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
        boardRoleId: meOverrides.hasBoardAccess ? "br-1" : null,
        ...meOverrides,
      },
    });
    renderAt("/portal", <PortalHomePage />);
    await waitFor(() => expect(screen.getByTestId("portal-home-heading")).toBeInTheDocument());
    expect(screen.queryByTestId("portal-home-pressing-items")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pressing-items-widget")).not.toBeInTheDocument();
    expect(screen.queryByText(/needs matching/i)).not.toBeInTheDocument();
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
  it("renders the transposed per-unit table (units as columns) with dues/assessment split", async () => {
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
        // 2026-07-03 — the by-unit section now renders from the endpoint's
        // additive `perUnit` array (transposed table, PR #382); `byUnit`
        // alone no longer shows the section.
        perUnit: [
          {
            unitId: "u-1417F",
            unitLabel: "1417-F",
            dueNowDues: 0,
            dueNowAssessment: 0,
            dueNowTotal: 0,
            balanceDues: 0,
            balanceAssessment: 1525.42,
            balanceTotal: 1525.42,
          },
          {
            unitId: "u-1421B",
            unitLabel: "1421-B",
            dueNowDues: 0,
            dueNowAssessment: 0,
            dueNowTotal: 0,
            balanceDues: 0,
            balanceAssessment: 2121.77,
            balanceTotal: 2121.77,
          },
          {
            unitId: "u-1421C",
            unitLabel: "1421-C",
            dueNowDues: 0,
            dueNowAssessment: 0,
            dueNowTotal: 0,
            balanceDues: 0,
            balanceAssessment: 1971.42,
            balanceTotal: 1971.42,
          },
        ],
      },
    });
    renderAt("/portal/finances", <PortalFinancesPage />);
    await waitFor(() => expect(screen.getByTestId("portal-finances-heading")).toBeInTheDocument());

    // 2026-07-14 redesign — the by-unit table moved to the Breakdown tab.
    await userEvent.click(screen.getByTestId("portal-finances-tab-breakdown"));

    // Per-unit section renders as the transposed table (financial-dashboard
    // resolves on a subsequent tick after the page mounts).
    await waitFor(() => expect(screen.getByTestId("portal-finances-by-unit")).toBeInTheDocument());
    expect(screen.getByTestId("portal-finances-by-unit-transpose")).toBeInTheDocument();

    // One column per unit, labeled, plus the "All units" total column.
    expect(screen.getByTestId("portal-finances-transpose-col-u-1417F")).toHaveTextContent("1417-F");
    expect(screen.getByTestId("portal-finances-transpose-col-u-1421B")).toHaveTextContent("1421-B");
    expect(screen.getByTestId("portal-finances-transpose-col-u-1421C")).toHaveTextContent("1421-C");
    expect(screen.getByTestId("portal-finances-transpose-col-all")).toHaveTextContent("All units");

    // Each unit's Total balance cell (balance row index 2 = the Total row).
    expect(screen.getByTestId("portal-finances-transpose-cell-u-1417F-balance-2")).toHaveTextContent("1,525.42");
    expect(screen.getByTestId("portal-finances-transpose-cell-u-1421B-balance-2")).toHaveTextContent("2,121.77");
    expect(screen.getByTestId("portal-finances-transpose-cell-u-1421C-balance-2")).toHaveTextContent("1,971.42");
    expect(screen.getByTestId("portal-finances-transpose-cell-all-balance-2")).toHaveTextContent("5,618.61");

    // Dues-vs-assessment split rows are present per unit (HOA Dues row 0,
    // Special Assessment row 1) — $0 dues still renders its cell.
    expect(screen.getByTestId("portal-finances-transpose-cell-u-1417F-balance-0")).toHaveTextContent("$0.00");
    expect(screen.getByTestId("portal-finances-transpose-cell-u-1417F-balance-1")).toHaveTextContent("1,525.42");

    // Grand total is surfaced at the section header.
    expect(screen.getByTestId("portal-finances-by-unit-grand-total")).toHaveTextContent("5,618.61");
  });

  it("falls back gracefully when the server omits byUnit (legacy clients)", async () => {
    installFetchStub({
      "/api/portal/financial-dashboard": { balance: 0, totalCharges: 0, totalPayments: 0 },
    });
    renderAt("/portal/finances", <PortalFinancesPage />);
    await waitFor(() => expect(screen.getByTestId("portal-finances-heading")).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("portal-finances-tab-breakdown"));
    // The by-unit section should be absent when there are no units to show.
    await waitFor(() => expect(screen.getByTestId("portal-finances-tabpanel-breakdown")).toBeInTheDocument());
    expect(screen.queryByTestId("portal-finances-by-unit")).not.toBeInTheDocument();
  });
});

describe("Portal Finances — 'Pay this period' + assessment PLAN redesign (2026-07-09)", () => {
  // William, repeatedly: LEAD with what's actually due THIS period (this
  // month's dues + this month's assessment installment), calm/brand — never a
  // big red lump balance. The full special assessment is shown as a payment
  // PLAN (total · paid · remaining "over time" · progress · next), and RED is
  // reserved for genuinely past-due only.

  const ROOF_PLAN = {
    assessmentId: "a-roof",
    assessmentName: "Roof & façade special assessment",
    total: 18000,
    paidToDate: 6000,
    remaining: 12000,
    installmentCount: 12,
    installmentsPaid: 4,
    installmentAmount: 1500,
    nextInstallmentAmount: 1500,
    nextInstallmentDueDate: "2999-01-31T00:00:00.000Z", // future → on track, NOT red
    nextInstallmentNumber: 5,
  };

  it("leads with a calm 'Pay this period' hero = this month's dues + installment (NOT the full assessment)", async () => {
    installFetchStub({
      "/api/portal/financial-dashboard": {
        balance: 5618.61,
        totalCharges: 5618.61,
        totalPayments: 0,
        byUnit: [{ unitId: "u-1", unitLabel: "1417-F", total: 990, byCategory: { charge: 990 } }],
        specialAssessmentUpcomingInstallments: [{ installmentAmount: 1500 }],
        assessmentPlans: [ROOF_PLAN],
      },
    });
    renderAt("/portal/finances", <PortalFinancesPage />);
    await waitFor(() => expect(screen.getByTestId("portal-finances-heading")).toBeInTheDocument());
    // The hero leads with the THIS-PERIOD total: 990 dues + 1,500 installment.
    await waitFor(() =>
      expect(screen.getByTestId("portal-finances-pay-this-period")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("portal-finances-due-now-total")).toHaveTextContent("2,490.00");
    expect(screen.getByTestId("portal-finances-due-now-dues")).toHaveTextContent("990.00");
    expect(screen.getByTestId("portal-finances-due-now-assessment")).toHaveTextContent("1,500.00");
    // The this-period figure is NOT the full $18,000 assessment lump.
    expect(screen.getByTestId("portal-finances-due-now-total")).not.toHaveTextContent("18,000");
    // The old alarming "amount due"/"total balance" hero cards are gone.
    expect(screen.queryByTestId("portal-finances-amount-due-hero")).not.toBeInTheDocument();
    expect(screen.queryByTestId("portal-finances-balance")).not.toBeInTheDocument();
  });

  it("renders the special assessment as a PLAN (total · remaining over time · progress), On track — no red", async () => {
    installFetchStub({
      "/api/portal/financial-dashboard": {
        balance: 12000,
        totalCharges: 6000,
        totalPayments: 6000,
        byUnit: [],
        assessmentPlans: [ROOF_PLAN],
        // 2026-07-14 redesign — the Assessments tab renders from
        // `assessmentPlansByUnit` (grouped by unit), not the flat
        // `assessmentPlans` list.
        assessmentPlansByUnit: [{ unitId: "u-1", unitLabel: "1417-F", plans: [ROOF_PLAN] }],
      },
    });
    renderAt("/portal/finances", <PortalFinancesPage />);
    await waitFor(() => expect(screen.getByTestId("portal-finances-heading")).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("portal-finances-tab-assessments"));
    await waitFor(() =>
      expect(screen.getByTestId("portal-finances-assessment-plan-a-roof")).toBeInTheDocument(),
    );
    const plan = screen.getByTestId("portal-finances-assessment-plan-a-roof");
    // Remaining "over time" is the plan remaining ($12,000), separate from the
    // this-period amount — shown as the plan's remaining, never a "due now".
    expect(
      screen.getByTestId("portal-finances-assessment-plan-a-roof-remaining"),
    ).toHaveTextContent("12,000.00");
    expect(plan).toHaveTextContent("33% paid");
    expect(plan).toHaveTextContent("4 of 12 installments paid");
    expect(plan).toHaveTextContent(/On track/i);
    // No alarming "past due" red state for an on-schedule plan.
    expect(plan).not.toHaveTextContent(/Past due/i);
    // The unit label is the group heading (per-unit card grouping).
    expect(screen.getByTestId("portal-finances-assessments-unit-u-1")).toHaveTextContent("1417-F");
  });

  it("2026-07-14 redesign: pins 'Total remaining' (grand total) above the tabs — not due now, always visible", async () => {
    installFetchStub({
      "/api/portal/financial-dashboard": {
        balance: 12000,
        totalCharges: 0,
        totalPayments: 0,
        byUnit: [],
        grandTotal: 12000,
        assessmentPlans: [ROOF_PLAN],
        assessmentPlansByUnit: [{ unitId: "u-1", unitLabel: "1417-F", plans: [ROOF_PLAN] }],
      },
    });
    renderAt("/portal/finances", <PortalFinancesPage />);
    // The pinned card always renders, but its amount only reflects
    // `grandTotal` once the dashboard fetch resolves — wait for the actual
    // value, not just the card's (immediate, pre-fetch) presence.
    await waitFor(() =>
      expect(screen.getByTestId("portal-finances-pinned-remaining-amount")).toHaveTextContent("12,000.00"),
    );
    expect(screen.getByTestId("portal-finances-pinned-remaining")).toHaveTextContent(/across all open assessments/i);
  });

  it("PAID IN FULL: shows the calm caught-up state, no red 'due' hero", async () => {
    installFetchStub({
      "/api/portal/financial-dashboard": {
        balance: 0,
        totalCharges: 100,
        totalPayments: 100,
        byUnit: [],
        assessmentPlans: [],
      },
    });
    renderAt("/portal/finances", <PortalFinancesPage />);
    await waitFor(() =>
      expect(screen.getByTestId("portal-finances-paid-in-full")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("portal-finances-pay-this-period")).not.toBeInTheDocument();
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

describe("Portal Finances — non-array API bodies must not crash the page (#380)", () => {
  // Regression for #380: several portal cards call `.length` / `.map()` on a
  // useQuery result whose endpoint can return a non-array body (error object,
  // auth shell) with a 200. `x.length === 0` is `false` for `{}`, so the guard
  // falls through to `x.map(...)` → "x.map is not a function" and crashes the
  // whole subtree. The queryFns must normalize non-array bodies to `[]`.
  //
  // The budget-ratification card (the #380 report) is already covered by the
  // per-unit / amount-due tests above — they leave `/api/portal/budget-ratifications`
  // at the default `{}` body and wait for a post-dashboard-resolve signal, so a
  // budget-card crash tears down the subtree and fails them (that WAS the #380
  // symptom). These two add coverage for the sibling cards that share the bug.

  it("payment-methods + autopay cards survive non-array bodies", async () => {
    installFetchStub({
      "/api/portal/payment-methods": {},
      "/api/portal/autopay/enrollments": {},
    });
    renderAt("/portal/finances/payment-methods", <PortalFinancesPage subPath="payment-methods" />);
    // Both cards' resolved empty states only render if the queries settled to
    // `[]` — without the guard, `{}` would fall through to `.map()` and crash.
    await screen.findByText(/No saved payment methods yet/i);
    await screen.findByText(/not currently enrolled in autopay/i);
  });

  it("receipts card survives a non-array receipts body", async () => {
    installFetchStub({ "/api/portal/receipts": {} });
    renderAt("/portal/finances/receipts", <PortalFinancesPage subPath="receipts" />);
    // The resolved empty state renders only if `receipts` normalized to `[]`.
    await screen.findByText(/No receipts yet/i);
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
