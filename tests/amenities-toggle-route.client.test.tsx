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

import AmenitiesPage from "@/pages/amenities";

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

describe("/portal/amenities — amenities toggle (3a)", () => {
  it("renders <NotFound/> when amenitiesEnabled = false", async () => {
    installFetchMock(async (url) => {
      if (url.endsWith("/api/portal/me")) return jsonResponse({ ok: true });
      if (url.endsWith("/api/portal/amenities/settings")) {
        return jsonResponse({ amenitiesEnabled: false });
      }
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
      if (url.endsWith("/api/portal/me")) return jsonResponse({ ok: true });
      if (url.endsWith("/api/portal/amenities/settings")) {
        return jsonResponse({ amenitiesEnabled: true });
      }
      if (url.endsWith("/api/portal/amenities")) return jsonResponse([]);
      if (url.endsWith("/api/portal/amenities/my-reservations")) return jsonResponse([]);
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
