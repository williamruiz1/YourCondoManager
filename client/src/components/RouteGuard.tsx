/**
 * RouteGuard — Phase 0b.2 stub per ADR 0b.
 *
 * Wraps any `/app/*` route page. Reads the current admin role from the
 * auth-session subscription via `useAdminRole()` (OQ-1 Option A), then
 * consults `canAccess(role, route)` against `ROUTE_MANIFEST`.
 *
 * Contract (locked by ADR 0b — downstream phases depend on this surface):
 *   - `route`: canonical route path key from ROUTE_MANIFEST.
 *   - `children`: page content rendered when access is allowed.
 *   - `fallback?`: optional custom fallback when access is denied. If
 *     omitted, the guard navigates to `/app`.
 *   - Does NOT accept a `role` prop. Role is read internally.
 *   - Does NOT accept a `roles` array prop. Access derives from the
 *     manifest via `canAccess()`.
 *
 * Loading-state contract (3.3 Q3 + ADR 0b Loading-state section):
 *   - While `authResolved === false`, render `null`. Not children. Not
 *     fallback. Not a spinner. This is deliberate; the shell already
 *     provides any loading shimmer. Avoids flicker / protected-content
 *     flash.
 *   - When `authResolved === true` and access is denied, render
 *     `fallback` if provided, else navigate to `/app` via `wouter`'s
 *     `useLocation`. The render returns `null` during the redirect tick.
 *   - When `authResolved === true` and access is allowed, render
 *     `children` unchanged — no wrapper element, no layout chrome, no
 *     extra props. The guard is transparent.
 *
 * No Suspense integration (OQ-5 Option A). Return type is
 * `JSX.Element | null`.
 *
 * Phase 0b.2 note: because `ROUTE_MANIFEST` is empty in the stub,
 * `canAccess` returns `false` for every `(role, route)` pair today. This
 * means wrapping a page in `<RouteGuard>` today would render `null` /
 * redirect for every authenticated role. Zone PRs (Phases 12–16) only
 * start wrapping routes AFTER Phase 9 populates the manifest, so nothing
 * ships broken.
 */

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAdminRole } from "@/hooks/useAdminRole";
import { canAccess } from "@shared/persona-access";

export interface RouteGuardProps {
  /**
   * Canonical route path from the 3.2 route table. MUST be a key present
   * in `ROUTE_MANIFEST`. Examples: "/app", "/app/financial/billing",
   * "/app/admin/users".
   */
  route: string;

  /**
   * Page content to render when access is resolved AND allowed.
   */
  children: ReactNode;

  /**
   * Optional custom fallback rendered when access is resolved AND denied.
   * If omitted, the guard navigates to `/app`.
   */
  fallback?: ReactNode;
}

export function RouteGuard({
  route,
  children,
  fallback,
}: RouteGuardProps): JSX.Element | null {
  const { role, authResolved } = useAdminRole();
  const [, navigate] = useLocation();

  const allowed = authResolved ? canAccess(role, route) : false;

  // Redirect effect: only fire when auth has resolved, access is denied,
  // and no explicit fallback was provided. The hook must run on every
  // render (React rules of hooks) — the gating lives inside the effect.
  useEffect(() => {
    if (authResolved && !allowed && !fallback) {
      navigate("/app");
    }
  }, [authResolved, allowed, fallback, navigate]);

  // Loading state: render null. No flicker, no flash of protected content.
  if (!authResolved) return null;

  // Resolved + denied: fallback or null (the redirect effect handles the
  // navigation when fallback is absent).
  if (!allowed) {
    return fallback ? <>{fallback}</> : null;
  }

  // Resolved + allowed: transparent render.
  return <>{children}</>;
}
