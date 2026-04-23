/**
 * Route-guard assertion helpers for the 3.3 Q4 parity harness.
 *
 * Works with the existing canAccessWipRoute function (client/src/lib/wip-features.ts)
 * and the <RouteGuard> component from 2.3 Q9 / ADR 0b.
 *
 * Also provides `renderWithAuth()` for tests that need to render a React
 * subtree where `useAdminRole()` resolves synchronously against a seeded
 * mock session. See ADR 0b OQ-1 Option A: because `useAdminRole` reuses
 * the shared `["/api/auth/me", "session"]` query cache entry, seeding
 * `QueryClient.setQueryData(...)` makes the hook return the mock role
 * without any network round-trip.
 */
import { render, type RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import type { ReactElement } from "react";

import type { AdminRole } from "@shared/schema";
import type { AuthSession } from "@/hooks/useAdminRole";
import { canAccessWipRoute } from "@/lib/wip-features";

/**
 * Assert that a given role should be ALLOWED to access a route.
 * Currently checks against the sidebar roles arrays and route-guard logic.
 * Will be extended when <RouteGuard> component is introduced in Layer 3.
 *
 * @param route - The route path (e.g., "/app/financial/billing")
 * @param role - The admin role to check
 * @param routeConfig - Map of route → allowed roles (derived from 0.2 boundary matrix)
 */
export function assertRouteAllowed(
  route: string,
  role: AdminRole,
  routeConfig: Record<string, AdminRole[]>,
): void {
  const allowedRoles = routeConfig[route];
  if (!allowedRoles) {
    throw new Error(`Route "${route}" not found in route config. Add it to the boundary matrix.`);
  }
  if (!allowedRoles.includes(role)) {
    throw new Error(
      `Expected role "${role}" to be ALLOWED on route "${route}", but allowed roles are: [${allowedRoles.join(", ")}]`,
    );
  }
}

/**
 * Assert that a given role should be BLOCKED from a route.
 */
export function assertRouteBlocked(
  route: string,
  role: AdminRole,
  routeConfig: Record<string, AdminRole[]>,
): void {
  const allowedRoles = routeConfig[route];
  if (!allowedRoles) {
    throw new Error(`Route "${route}" not found in route config. Add it to the boundary matrix.`);
  }
  if (allowedRoles.includes(role)) {
    throw new Error(
      `Expected role "${role}" to be BLOCKED from route "${route}", but it IS in the allowed list: [${allowedRoles.join(", ")}]`,
    );
  }
}

/**
 * Assert a role is allowed on a WIP route via the existing canAccessWipRoute
 * function. Use this for routes governed by the wipRouteRoleAllowlist.
 */
export function assertWipRouteAllowed(route: string, role: AdminRole): void {
  if (!canAccessWipRoute(route, role)) {
    throw new Error(
      `Expected role "${role}" to be ALLOWED on WIP route "${route}" by canAccessWipRoute, but it was blocked.`,
    );
  }
}

/**
 * Assert a role is blocked from a WIP route via canAccessWipRoute.
 */
export function assertWipRouteBlocked(route: string, role: AdminRole): void {
  if (canAccessWipRoute(route, role)) {
    throw new Error(
      `Expected role "${role}" to be BLOCKED from WIP route "${route}" by canAccessWipRoute, but it was allowed.`,
    );
  }
}

// ---------------------------------------------------------------------------
// renderWithAuth
// ---------------------------------------------------------------------------

export interface RenderWithAuthOptions {
  /**
   * AdminRole to attach to the mock session. `null` (the default) →
   * unauthenticated session (represented as `{ authenticated: false,
   * admin: null }` when `authResolved: true`).
   */
  role?: AdminRole | null;
  /**
   * When `true` (default), the auth-session query is pre-seeded into the
   * QueryClient cache so `useAdminRole()` resolves synchronously with
   * `authResolved: true`.
   *
   * When `false`, the query is left unresolved (its queryFn returns a
   * never-resolving Promise) so `useAdminRole()` reports
   * `authResolved: false` — useful for testing loading states.
   */
  authResolved?: boolean;
  /**
   * Initial path for the in-memory router. Defaults to "/".
   */
  initialPath?: string;
}

/**
 * Render a React element inside a QueryClientProvider + in-memory wouter
 * Router with a seeded mock auth session.
 *
 * Relies on OQ-1 Option A of ADR 0b: `useAdminRole()` wraps the shared
 * `["/api/auth/me", "session"]` react-query cache entry, so seeding the
 * cache is sufficient — no AuthContext.Provider is needed.
 */
export function renderWithAuth(
  ui: ReactElement,
  options: RenderWithAuthOptions = {},
): RenderResult {
  const { role = null, authResolved = true, initialPath = "/" } = options;

  // When authResolved is false we install a never-resolving default queryFn
  // so the auth query stays in the pending + fetching state (`isLoading`
  // true) — this mirrors the real pre-response window and causes
  // `useAdminRole()` to return `{ role: null, authResolved: false }`.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        ...(authResolved
          ? {}
          : { queryFn: () => new Promise<never>(() => {}) }),
      },
    },
  });

  if (authResolved) {
    const session: AuthSession = role
      ? {
          authenticated: true,
          admin: {
            id: `test-${role}`,
            email: `${role}@test.ycm.dev`,
            role,
          },
        }
      : { authenticated: false, admin: null };
    queryClient.setQueryData(["/api/auth/me", "session"], session);
  }

  const { hook } = memoryLocation({ path: initialPath });

  return render(
    <QueryClientProvider client={queryClient}>
      <Router hook={hook}>{ui}</Router>
    </QueryClientProvider>,
  );
}
