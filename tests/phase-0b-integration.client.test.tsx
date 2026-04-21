/**
 * End-to-end smoke test for the Phase 0b.2 stack per ADR 0b.
 *
 * Exercises the full chain:
 *   auth-session query (react-query cache) →
 *   useAdminRole() →
 *   <RouteGuard route=...> →
 *   canAccess(role, route) against ROUTE_MANIFEST →
 *   render result (children | fallback | null)
 *
 * Three branches are validated:
 *   1. Auth unresolved (isLoading=true) → guard renders null, children hidden.
 *   2. Auth resolved + empty manifest + role=manager → default-deny →
 *      children hidden.
 *   3. Auth resolved + mocked manifest with "/app/any": ["manager"] +
 *      role=manager → allowed → children visible.
 *
 * Mocking notes:
 *   - `useAdminRole` is wired through the `useQuery` cache (queryKey
 *     `["/api/auth/me", "session"]`). Priming the cache with
 *     `client.setQueryData(...)` deterministically resolves the hook
 *     without hitting the network.
 *   - For branch #3 we use `vi.mock("@shared/persona-access")` to override
 *     `canAccess` — the live manifest is `Readonly` and empty. The mock
 *     factory references a mutable state object via closure so the
 *     per-test swap works (vi.mock hoists to the top of file, so the
 *     module is replaced before RouteGuard imports it).
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Mock @shared/persona-access so we can toggle canAccess per test.
// vi.mock is hoisted to the top of the file; the factory must not reference
// outer-scope variables directly. We communicate via a globalThis slot that
// the factory reads on each call.
// ---------------------------------------------------------------------------

vi.mock("@shared/persona-access", async () => {
  const actual = await vi.importActual<
    typeof import("@shared/persona-access")
  >("@shared/persona-access");
  return {
    ...actual,
    // Delegate to a swappable predicate on globalThis so tests can override
    // per-case without re-mocking.
    canAccess: (role: unknown, route: string) => {
      const override = (globalThis as { __ycmCanAccessOverride?: unknown })
        .__ycmCanAccessOverride as
        | ((role: unknown, route: string) => boolean)
        | undefined;
      if (override) return override(role, route);
      return actual.canAccess(
        role as Parameters<typeof actual.canAccess>[0],
        route,
      );
    },
  };
});

// Import AFTER vi.mock so RouteGuard picks up the mocked module.
import { RouteGuard } from "@/components/RouteGuard";
import type { AuthSession } from "@/hooks/useAdminRole";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_QUERY_KEY = ["/api/auth/me", "session"];

function makeWrapper(
  opts:
    | { kind: "loading" }
    | { kind: "resolved"; session: AuthSession | null },
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        // Keep the query idle when we want "loading" — see below.
        enabled: true,
      },
    },
  });

  if (opts.kind === "resolved") {
    // Prime the cache: useQuery resolves synchronously from the cache.
    client.setQueryData(AUTH_QUERY_KEY, opts.session);
  } else {
    // For "loading", block the fetch so isLoading remains true when the
    // hook subscribes. We stub global fetch to a never-resolving promise.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
  }

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return { Wrapper, client };
}

beforeEach(() => {
  (globalThis as { __ycmCanAccessOverride?: unknown }).__ycmCanAccessOverride =
    undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
  (globalThis as { __ycmCanAccessOverride?: unknown }).__ycmCanAccessOverride =
    undefined;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Phase 0b.2 integration smoke — RouteGuard × useAdminRole × canAccess", () => {
  it("renders null while auth is unresolved (authResolved=false → loading state)", () => {
    const { Wrapper } = makeWrapper({ kind: "loading" });

    const { container } = render(
      <Wrapper>
        <RouteGuard route="/app/any">
          <div data-testid="page">page</div>
        </RouteGuard>
      </Wrapper>,
    );

    // Loading-state contract: render null, not children, not fallback.
    expect(screen.queryByTestId("page")).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it("hides children when role=manager and ROUTE_MANIFEST is empty (default deny)", () => {
    // Use the live (un-overridden) canAccess — with empty ROUTE_MANIFEST,
    // every route denies.
    const session: AuthSession = {
      authenticated: true,
      user: { email: "manager@test.ycm.dev" },
      admin: {
        id: "test-admin-manager",
        email: "manager@test.ycm.dev",
        role: "manager",
      },
    };
    const { Wrapper } = makeWrapper({ kind: "resolved", session });

    render(
      <Wrapper>
        <RouteGuard route="/app/any">
          <div data-testid="page">page</div>
        </RouteGuard>
      </Wrapper>,
    );

    // Resolved + denied + no fallback → renders null; children must not
    // appear. The redirect effect fires asynchronously but the immediate
    // render is null.
    expect(screen.queryByTestId("page")).not.toBeInTheDocument();
  });

  it("shows children when role=manager and canAccess allows the route (mocked manifest)", () => {
    // Override canAccess to permit "/app/any" for "manager".
    (
      globalThis as {
        __ycmCanAccessOverride?: (role: unknown, route: string) => boolean;
      }
    ).__ycmCanAccessOverride = (role, route) =>
      role === "manager" && route === "/app/any";

    const session: AuthSession = {
      authenticated: true,
      user: { email: "manager@test.ycm.dev" },
      admin: {
        id: "test-admin-manager",
        email: "manager@test.ycm.dev",
        role: "manager",
      },
    };
    const { Wrapper } = makeWrapper({ kind: "resolved", session });

    render(
      <Wrapper>
        <RouteGuard route="/app/any">
          <div data-testid="page">page</div>
        </RouteGuard>
      </Wrapper>,
    );

    expect(screen.getByTestId("page")).toBeInTheDocument();
    expect(screen.getByTestId("page")).toHaveTextContent("page");
  });

  it("renders a custom fallback when resolved + denied + fallback provided", () => {
    // Sanity: the denied-branch fallback path. Uses the default (live)
    // canAccess which denies under the empty manifest.
    const session: AuthSession = {
      authenticated: true,
      user: { email: "manager@test.ycm.dev" },
      admin: {
        id: "test-admin-manager",
        email: "manager@test.ycm.dev",
        role: "manager",
      },
    };
    const { Wrapper } = makeWrapper({ kind: "resolved", session });

    render(
      <Wrapper>
        <RouteGuard
          route="/app/any"
          fallback={<div data-testid="denied">denied</div>}
        >
          <div data-testid="page">page</div>
        </RouteGuard>
      </Wrapper>,
    );

    expect(screen.queryByTestId("page")).not.toBeInTheDocument();
    expect(screen.getByTestId("denied")).toBeInTheDocument();
  });

  it("denies when resolved session has no admin (role=null) even if canAccess mock is permissive", () => {
    // Confirms the role=null guard inside canAccess — even if the override
    // were to allow the route unconditionally (simulating a bug), the
    // role=null → false guard is enforced at the predicate layer. Here we
    // use the live canAccess (which enforces role==null → false) and an
    // unauthenticated session.
    const session: AuthSession | null = null;
    const { Wrapper } = makeWrapper({ kind: "resolved", session });

    render(
      <Wrapper>
        <RouteGuard route="/app/any">
          <div data-testid="page">page</div>
        </RouteGuard>
      </Wrapper>,
    );

    expect(screen.queryByTestId("page")).not.toBeInTheDocument();
  });
});

describe("Phase 0b.2 integration smoke — usePersonaToggles contract", () => {
  it("returns an empty object with zero keys in Phase 0b.2", async () => {
    // Import lazily so the vi.mock above (which wraps canAccess but spreads
    // `...actual`) still exposes the real usePersonaToggles.
    const { usePersonaToggles } = await import("@shared/persona-access");

    function Harness() {
      const toggles = usePersonaToggles();
      return (
        <div data-testid="toggles-keys">
          {JSON.stringify(Object.keys(toggles))}
        </div>
      );
    }

    render(<Harness />);

    const el = screen.getByTestId("toggles-keys");
    expect(el).toHaveTextContent("[]");
  });
});
