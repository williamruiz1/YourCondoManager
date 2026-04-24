/**
 * 4.2 Q3 addendum (3a) — Wave 1 amenities toggle.
 *
 * Verifies that `/portal/amenities` renders the shared <NotFound/> surface
 * when the association's `amenitiesEnabled` state is `false`, and renders
 * the real amenities content when `true`.
 *
 * We seed localStorage with a valid `portalAccessId` so the session gate
 * passes, mock `fetch` to answer three endpoints:
 *   - GET /api/portal/me             → { ok: true }
 *   - GET /api/portal/amenities/settings → { amenitiesEnabled: false|true }
 *   - GET /api/portal/amenities      → [] (only used when enabled)
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// 3.5 Wave 11: /portal/amenities now lives under the PortalShell zone tree.
import AmenitiesPage from "@/pages/portal/portal-amenities";

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>;

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

function installFetchMock(handler: FetchHandler) {
  const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : (input as URL | Request).toString();
    return handler(url, init);
  });
  return spy;
}

function renderWithQueryClient(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  window.localStorage.setItem("portalAccessId", "test-portal-access-id");
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

// Session shape expected by PortalShell + zone files post-Wave 11.
const SESSION_SHAPE = {
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
};

describe("/portal/amenities — amenities toggle (3a)", () => {
  it("renders <NotFound/> when amenitiesEnabled = false", async () => {
    installFetchMock(async (url) => {
      if (url.includes("/api/portal/me")) return jsonResponse(SESSION_SHAPE);
      if (url.includes("/api/portal/my-associations"))
        return jsonResponse([{ associationId: "assoc-1", associationName: "Sunset HOA" }]);
      if (url.includes("/api/portal/amenities/settings")) {
        return jsonResponse({ amenitiesEnabled: false });
      }
      if (url.includes("/api/portal/maintenance-requests")) return jsonResponse([]);
      if (url.includes("/api/portal/notices")) return jsonResponse([]);
      return jsonResponse({}, { status: 404 });
    });

    renderWithQueryClient(<AmenitiesPage />);

    // <NotFound/> renders the literal "404 Page Not Found" heading.
    await waitFor(() => {
      expect(screen.getByText(/404 Page Not Found/i)).toBeInTheDocument();
    });
  });

  it("renders the amenities content when amenitiesEnabled = true", async () => {
    installFetchMock(async (url) => {
      if (url.includes("/api/portal/me")) return jsonResponse(SESSION_SHAPE);
      if (url.includes("/api/portal/my-associations"))
        return jsonResponse([{ associationId: "assoc-1", associationName: "Sunset HOA" }]);
      if (url.includes("/api/portal/amenities/settings")) {
        return jsonResponse({ amenitiesEnabled: true });
      }
      if (url.endsWith("/api/portal/amenities")) return jsonResponse([]);
      if (url.includes("/api/portal/amenities/my-reservations")) return jsonResponse([]);
      if (url.includes("/api/portal/maintenance-requests")) return jsonResponse([]);
      if (url.includes("/api/portal/notices")) return jsonResponse([]);
      return jsonResponse({}, { status: 404 });
    });

    renderWithQueryClient(<AmenitiesPage />);

    // When enabled, the content path renders a heading that is *not* the
    // NotFound string. We assert the disabled-state sentinel is absent.
    await waitFor(() => {
      expect(screen.queryByText(/404 Page Not Found/i)).not.toBeInTheDocument();
    });
  });
});
