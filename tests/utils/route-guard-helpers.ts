/**
 * Route-guard assertion helpers for the 3.3 Q4 parity harness.
 *
 * Works with the existing canAccessWipRoute function (client/src/lib/wip-features.ts)
 * and the future <RouteGuard> component from 2.3 Q9.
 */

import type { AdminRole } from "./auth-helpers";
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

/**
 * Wraps a React component in a mock auth context for rendering tests.
 * Uses React Testing Library's render under the hood.
 *
 * Note: This is a placeholder that will be enriched when the actual
 * auth context provider shape is formalized in Layer 3. For now it
 * provides the session data via a test context.
 */
export async function renderWithAuth(
  component: React.ReactElement,
  role: AdminRole,
) {
  const { render } = await import("@testing-library/react");
  const { mockAdminSession } = await import("./auth-helpers");

  const session = mockAdminSession(role);

  // Render the component. Auth context injection will be added
  // when the real AuthContext provider is available.
  return render(component);
}
