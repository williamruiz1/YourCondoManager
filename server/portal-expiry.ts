/**
 * Shared portal-access idle-expiry check (founder-os#10757, A-AUTH-005).
 *
 * Portal access enforces a 30-day inactivity window on top of `status === "active"`.
 * This was implemented inline in `resolvePortalAccessContext` (the normal portal routes)
 * but NOT on the direct upload-authorization path (`authorizeUploadAccess`), so an active
 * portal-access row past its idle window was rejected everywhere except file fetches.
 * Both paths now share this single helper so status + idle expiry are enforced identically
 * across every portal surface, and the two cannot drift apart.
 */

/** 30 days, in milliseconds. */
export const PORTAL_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * True iff the portal access is idle-expired: a `lastLoginAt` exists AND more than
 * PORTAL_SESSION_MAX_AGE_MS has elapsed since it. A null/absent `lastLoginAt` is NOT
 * idle-expired (matches the original resolvePortalAccessContext behavior). This helper
 * does NOT check `status` — callers check `status === "active"` separately, exactly as
 * before.
 */
export function isPortalAccessIdleExpired(access: {
  lastLoginAt?: Date | string | null;
}): boolean {
  if (!access.lastLoginAt) return false;
  const elapsed = Date.now() - new Date(access.lastLoginAt).getTime();
  return elapsed > PORTAL_SESSION_MAX_AGE_MS;
}
