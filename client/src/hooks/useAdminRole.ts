/**
 * useAdminRole — thin hook wrapper around the existing auth-session query.
 *
 * Resolves OQ-1 (Option A) of ADR 0b: instead of introducing a new
 * `AuthContext.Provider`, we wrap the already-running
 * `useQuery<AuthSession>(["/api/auth/me", "session"])` from App.tsx. Because
 * react-query deduplicates subscribers by queryKey, this hook shares the
 * same cache entry as App.tsx — there is no duplicate network request and
 * no duplicate auth subscription.
 *
 * Exposes a two-field result that matches the ADR 0b `<RouteGuard>`
 * loading-state contract:
 *   - `authResolved === false` → auth query still loading → `role` is null.
 *   - `authResolved === true`, `role === null` → unauthenticated or no
 *     admin attached to the session.
 *   - `authResolved === true`, `role === <AdminRole>` → resolved admin.
 *
 * Consumers (RouteGuard, sidebar, future surfaces) read both fields and
 * derive their own UX — RouteGuard renders `null` while `!authResolved`,
 * etc. This hook does not make UX decisions itself.
 */

import { useQuery } from "@tanstack/react-query";
import type { AdminRole } from "@shared/schema";

export interface AuthSession {
  authenticated: boolean;
  user?: { email?: string | null };
  admin?: {
    id: string;
    email: string;
    role: AdminRole;
  } | null;
}

export interface UseAdminRoleResult {
  role: AdminRole | null;
  authResolved: boolean;
}

export function useAdminRole(): UseAdminRoleResult {
  // QueryKey and queryFn copied verbatim from App.tsx:921-929 so the cache
  // entry is shared. Any change here must be mirrored there (and vice
  // versa) until Phase 11 consolidates the auth subscription.
  const { data: session, isLoading } = useQuery<AuthSession | null>({
    queryKey: ["/api/auth/me", "session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  if (isLoading) {
    return { role: null, authResolved: false };
  }

  return {
    role: session?.admin?.role ?? null,
    authResolved: true,
  };
}
