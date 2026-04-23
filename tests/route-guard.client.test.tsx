/**
 * RouteGuard unit tests — Phase 0b.2 (ADR 0b behavior contract).
 *
 * Validates the ADR 0b RouteGuard behavior contract scenarios:
 *   1. Loading state (authResolved === false) → render null.
 *   2. Denied without fallback → render null + navigate("/app").
 *   3. Denied with fallback → render fallback, no navigate.
 *   4. Null role (resolved, unauthenticated) → same as denied-no-fallback.
 *   5. Allowed path (manifest override) → render children, no navigate.
 *
 * Strategy:
 *   - `useAdminRole` is mocked per-test via `vi.mocked(...)` so we can
 *     supply arbitrary (role, authResolved) pairs without spinning up a
 *     real auth query.
 *   - wouter's `memoryLocation` + `Router` inject a tracked in-memory
 *     location hook so we can assert redirects without touching
 *     `window.location`.
 *   - `@shared/persona-access` is mocked so that ROUTE_MANIFEST lookups
 *     are deterministic. For scenarios 2–4 we route through the real
 *     empty-manifest behavior (canAccess → false). For scenario 5 we
 *     override canAccess to return true for a specific test route.
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

// Mock both modules BEFORE importing RouteGuard so the component picks up
// the mocked implementations.
vi.mock("@/hooks/useAdminRole", () => ({
  useAdminRole: vi.fn(),
}));

vi.mock("@shared/persona-access", () => ({
  // Default: deny-all, matching the Phase 0b.2 empty-manifest behavior.
  // Individual tests override via vi.mocked(canAccess).mockReturnValueOnce().
  canAccess: vi.fn(() => false),
}));

import { RouteGuard } from "@/components/RouteGuard";
import { useAdminRole } from "@/hooks/useAdminRole";
import { canAccess } from "@shared/persona-access";

const mockedUseAdminRole = vi.mocked(useAdminRole);
const mockedCanAccess = vi.mocked(canAccess);

/**
 * Render helper. Wraps the component in a wouter Router backed by
 * memoryLocation so navigation calls are observable via `history[]`.
 *
 * Contract mirrors the parallel `renderWithAuth` helper (tests/utils/
 * route-guard-helpers.tsx) — `{ role, authResolved?, initialPath? }` —
 * but is defined inline so tests do not block on the helper rewrite.
 */
function renderWithAuth(
  ui: React.ReactElement,
  options: {
    role: string | null;
    authResolved?: boolean;
    initialPath?: string;
  },
) {
  const { role, authResolved = true, initialPath = "/app/test" } = options;

  mockedUseAdminRole.mockReturnValue({
    role: role as never,
    authResolved,
  });

  const { hook, history, navigate } = memoryLocation({
    path: initialPath,
    record: true,
  });

  const utils = render(<Router hook={hook}>{ui}</Router>);
  return { ...utils, history, navigate };
}

beforeEach(() => {
  mockedUseAdminRole.mockReset();
  mockedCanAccess.mockReset();
  mockedCanAccess.mockReturnValue(false);
});

describe("RouteGuard (ADR 0b behavior contract)", () => {
  it("renders null while auth is loading (authResolved=false)", () => {
    const { container, history } = renderWithAuth(
      <RouteGuard route="/app/any">
        <div data-testid="protected">secret</div>
      </RouteGuard>,
      { role: null, authResolved: false, initialPath: "/app/any" },
    );

    // Children must NOT render during loading.
    expect(screen.queryByTestId("protected")).toBeNull();
    // No wrapper chrome, no fallback — literally nothing.
    expect(container.firstChild).toBeNull();
    // No redirect fired.
    expect(history).toEqual(["/app/any"]);
    // canAccess is gated by authResolved in the component body, so it
    // should NOT be invoked during the loading tick.
    expect(mockedCanAccess).not.toHaveBeenCalled();
  });

  it("denied without fallback → renders null and navigates to /app", async () => {
    // canAccess default return is false (matching Phase 0b.2 empty manifest).
    const { container, history } = renderWithAuth(
      <RouteGuard route="/app/financial/billing">
        <div data-testid="protected">secret</div>
      </RouteGuard>,
      {
        role: "manager",
        authResolved: true,
        initialPath: "/app/financial/billing",
      },
    );

    // Children are never rendered on denial.
    expect(screen.queryByTestId("protected")).toBeNull();
    // Render returns null (no fallback provided).
    expect(container.firstChild).toBeNull();
    // canAccess consulted with the live role + route.
    expect(mockedCanAccess).toHaveBeenCalledWith("manager", "/app/financial/billing");
    // Redirect effect pushes /app onto the memory history.
    await waitFor(() => {
      expect(history[history.length - 1]).toBe("/app");
    });
  });

  it("denied with fallback → renders fallback, no navigate", async () => {
    const { history } = renderWithAuth(
      <RouteGuard
        route="/app/blocked"
        fallback={<div data-testid="denied-fallback">Blocked</div>}
      >
        <div data-testid="protected">Secret</div>
      </RouteGuard>,
      { role: "viewer", authResolved: true, initialPath: "/app/blocked" },
    );

    // Fallback visible.
    expect(screen.getByTestId("denied-fallback")).toHaveTextContent("Blocked");
    // Protected children NOT rendered.
    expect(screen.queryByTestId("protected")).toBeNull();
    // No navigation should fire when fallback is provided.
    // Give React a tick to flush any pending effects, then assert no push.
    await waitFor(() => {
      expect(history).toEqual(["/app/blocked"]);
    });
  });

  it("null role (resolved, unauthenticated) → navigates to /app, no render", async () => {
    const { container, history } = renderWithAuth(
      <RouteGuard route="/app/admin/users">
        <div data-testid="protected">secret</div>
      </RouteGuard>,
      { role: null, authResolved: true, initialPath: "/app/admin/users" },
    );

    // Protected children are gated off.
    expect(screen.queryByTestId("protected")).toBeNull();
    expect(container.firstChild).toBeNull();
    // canAccess was consulted with null role per ADR 0b OQ-3 Option A.
    expect(mockedCanAccess).toHaveBeenCalledWith(null, "/app/admin/users");
    // Redirect effect fires, same as the denied-no-fallback scenario.
    await waitFor(() => {
      expect(history[history.length - 1]).toBe("/app");
    });
  });

  it("allowed path (canAccess → true) → renders children transparently, no navigate", async () => {
    // Override the canAccess mock just for this test so the happy path
    // branch of RouteGuard executes. Phase 9 exercises this heavily via
    // real manifest data; today the only way to hit the branch is to
    // override the predicate.
    mockedCanAccess.mockReturnValue(true);

    const { history } = renderWithAuth(
      <RouteGuard
        route="/app/allowed-test-route"
        fallback={<div data-testid="denied-fallback">never rendered</div>}
      >
        <div data-testid="protected">Granted</div>
      </RouteGuard>,
      {
        role: "platform-admin",
        authResolved: true,
        initialPath: "/app/allowed-test-route",
      },
    );

    // Children render.
    expect(screen.getByTestId("protected")).toHaveTextContent("Granted");
    // Fallback does NOT render on the allowed path.
    expect(screen.queryByTestId("denied-fallback")).toBeNull();
    // No navigation. Memory history holds just the initial path.
    await waitFor(() => {
      expect(history).toEqual(["/app/allowed-test-route"]);
    });
    // canAccess was consulted with the real arguments.
    expect(mockedCanAccess).toHaveBeenCalledWith(
      "platform-admin",
      "/app/allowed-test-route",
    );
  });
});
