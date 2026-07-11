// Shared portal-access idle-expiry rule (A-AUTH-005).
//
// `resolvePortalAccessContext` (storage.ts) enforces a 30-day inactivity
// expiry on `lastLoginAt` in addition to `status === "active"`, but the direct
// file-upload authorization path (`authorizeUploadAccess`, uploads-access.ts)
// only checked status — so an active-but-idle-expired portal access was denied
// by normal portal routes yet could still authorize file fetches. Extracting
// the rule into one helper lets every portal surface enforce identical
// status + idle expiry.

/** A portal session is idle-expired after 30 days without a login. */
export const PORTAL_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * True when a portal access is past the 30-day inactivity window. A null/absent
 * `lastLoginAt` is treated as NOT expired (matches `resolvePortalAccessContext`,
 * which only expires when a `lastLoginAt` exists and is older than the window).
 */
export function isPortalAccessIdleExpired(
  access: { lastLoginAt?: Date | string | null },
  now: number = Date.now(),
): boolean {
  if (!access.lastLoginAt) return false;
  const elapsed = now - new Date(access.lastLoginAt).getTime();
  return elapsed > PORTAL_SESSION_MAX_AGE_MS;
}
