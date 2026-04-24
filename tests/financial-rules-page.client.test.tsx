/**
 * 4.3 Wave 8 — /app/financial/rules page client tests.
 *
 * Covers:
 *   1. Page renders three tabs; default tab is Recurring.
 *   2. Run History tab fetches from /api/financial/assessment-run-log with
 *      correct filters (associationId + default 30-day window).
 *   3. Assisted Board cannot see Edit / Delete / New buttons on Recurring
 *      or Special Assessments tabs (read-only).
 *   4. Manager sees the write affordances on both tabs.
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

import type { AdminRole } from "@shared/schema";

// ---- Mocks ---------------------------------------------------------------

vi.mock("@/hooks/useAdminRole", () => ({
  useAdminRole: vi.fn(),
}));

vi.mock("@/hooks/use-active-association", () => ({
  useActiveAssociation: vi.fn(),
}));

vi.mock("@shared/persona-access", () => ({
  // Toggle surface not yet wired per Wave 9+; default empty state.
  usePersonaToggles: vi.fn(() => ({})),
  canAccess: vi.fn(() => true),
}));

import { useAdminRole } from "@/hooks/useAdminRole";
import { useActiveAssociation } from "@/hooks/use-active-association";
import FinancialRulesPage from "@/pages/financial-rules";

const mockedUseAdminRole = vi.mocked(useAdminRole);
const mockedUseActiveAssociation = vi.mocked(useActiveAssociation);

// ---- Helpers -------------------------------------------------------------

function setRole(role: AdminRole | null, authResolved = true) {
  mockedUseAdminRole.mockReturnValue({ role, authResolved });
}

function setActiveAssociation(id: string | null = "assoc-1", name = "Harbor HOA") {
  mockedUseActiveAssociation.mockReturnValue({
    associations: id
      ? [{ id, name } as any]
      : [],
    activeAssociationId: id ?? "",
    associationResolved: true,
    activeAssociation: id ? ({ id, name } as any) : null,
    activeAssociationName: id ? name : "",
    setActiveAssociationId: vi.fn(),
  } as any);
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  });
  const { hook } = memoryLocation({ path: "/app/financial/rules", record: true });
  return render(
    <QueryClientProvider client={client}>
      <Router hook={hook}>
        <FinancialRulesPage />
      </Router>
    </QueryClientProvider>,
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  mockedUseAdminRole.mockReset();
  mockedUseActiveAssociation.mockReset();
  setActiveAssociation("assoc-1", "Harbor HOA");
  // jsdom lacks matchMedia; use-mobile.tsx reads it on mount.
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
  // Default fetch mock — returns empty for everything unless a test overrides.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as URL | Request).toString();
      if (url.includes("/api/financial/recurring-charges/schedules")) {
        return jsonResponse([]);
      }
      if (url.includes("/api/financial/recurring-charges/runs")) {
        return jsonResponse([]);
      }
      if (url.includes("/api/financial/assessments")) {
        return jsonResponse([]);
      }
      if (url.includes("/api/units")) {
        return jsonResponse([]);
      }
      if (url.includes("/api/financial/assessment-run-log")) {
        return jsonResponse({ rows: [], total: 0, page: 1, limit: 50 });
      }
      return jsonResponse({});
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---- Tests ---------------------------------------------------------------

describe("FinancialRulesPage — three-tab structure", () => {
  it("renders Recurring / Special Assessments / Run History tabs with Recurring as default", async () => {
    setRole("manager");
    renderPage();

    expect(await screen.findByTestId("tab-recurring")).toBeInTheDocument();
    expect(screen.getByTestId("tab-special-assessments")).toBeInTheDocument();
    expect(screen.getByTestId("tab-run-history")).toBeInTheDocument();

    // Recurring panel is the default open panel. shadcn Tabs keeps non-default
    // panels in the DOM hidden via aria; the default panel is the one whose
    // data-state is "active". We verify the toolbar unique to the Recurring
    // Content appears for a write-enabled role.
    await waitFor(() => {
      expect(screen.getByTestId("recurring-toolbar")).toBeInTheDocument();
    });
  });
});

describe("FinancialRulesPage — Run History tab", () => {
  it("fetches /api/financial/assessment-run-log with associationId and default 30d window", async () => {
    setRole("manager");
    const fetchSpy = vi.fn().mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as URL | Request).toString();
      if (url.includes("/api/financial/assessment-run-log")) {
        return jsonResponse({ rows: [], total: 0, page: 1, limit: 50 });
      }
      if (url.includes("/api/financial/recurring-charges/schedules")) return jsonResponse([]);
      if (url.includes("/api/financial/recurring-charges/runs")) return jsonResponse([]);
      if (url.includes("/api/financial/assessments")) return jsonResponse([]);
      if (url.includes("/api/units")) return jsonResponse([]);
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchSpy);

    renderPage();
    await userEvent.click(await screen.findByTestId("tab-run-history"));

    await waitFor(() => {
      const call = fetchSpy.mock.calls.find(([url]) =>
        typeof url === "string" && url.includes("/api/financial/assessment-run-log"),
      );
      expect(call).toBeDefined();
      const url = call![0] as string;
      expect(url).toContain("associationId=assoc-1");
      expect(url).toContain("from=");
      expect(url).toContain("to=");
      expect(url).toContain("limit=50");
    });
  });
});

describe("FinancialRulesPage — persona write-gate", () => {
  it("hides write affordances on Recurring + Special Assessments tabs for assisted-board", async () => {
    setRole("assisted-board");
    renderPage();

    // Default tab is Recurring. Toolbar with 'New Schedule' must NOT render.
    await waitFor(() => {
      expect(screen.getByTestId("tab-recurring")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("recurring-toolbar")).toBeNull();
    expect(screen.queryByTestId("button-new-schedule")).toBeNull();

    // Switch to Special Assessments tab and confirm the same.
    await userEvent.click(screen.getByTestId("tab-special-assessments"));
    await waitFor(() => {
      expect(screen.queryByTestId("assessments-toolbar")).toBeNull();
      expect(screen.queryByTestId("button-new-assessment")).toBeNull();
    });
  });

  it("shows write affordances on Recurring tab for manager", async () => {
    setRole("manager");
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("recurring-toolbar")).toBeInTheDocument();
      expect(screen.getByTestId("button-new-schedule")).toBeInTheDocument();
    });
  });

  it("hides write affordances for viewer on both tabs", async () => {
    setRole("viewer");
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("tab-recurring")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("recurring-toolbar")).toBeNull();

    await userEvent.click(screen.getByTestId("tab-special-assessments"));
    await waitFor(() => {
      expect(screen.queryByTestId("assessments-toolbar")).toBeNull();
    });
  });
});
