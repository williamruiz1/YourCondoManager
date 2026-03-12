# Google OAuth Rollback Plan

## Objective
Provide a low-risk rollback path if Google OAuth sign-in causes production issues after deployment.

## Immediate Containment Steps
1. Disable OAuth entry points by removing or blanking:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_CALLBACK_URL`
2. Restart the backend process.
3. Confirm:
   - `/api/auth/google` returns `503 Google OAuth is not configured`
   - admin workflows remain operable via existing API-key fallback during migration

## Session Safety During Rollback
1. Keep `SESSION_SECRET` unchanged to avoid mass session invalidation unless required for security.
2. If session behavior is unstable, temporarily force cookie compatibility:
   - `SESSION_COOKIE_SAME_SITE=lax`
   - `SESSION_COOKIE_SECURE=false` (non-production troubleshooting only)
3. Restart backend and verify `/api/auth/me` behavior for active users.

## Browser-Side Cleanup
1. Ensure frontend sign-out path (`POST /api/auth/logout`) still works.
2. If needed, instruct users to clear locally stored fallback payload:
   - `localStorage.removeItem("authRestorePayload")`

## Data Rollback Scope
No destructive rollback is required for auth schema additions:
- `auth_users`
- `auth_external_accounts`
- `user_sessions`

These tables can remain in place while OAuth routes are disabled via env configuration.

## Verification Checklist After Rollback
1. OAuth disabled response confirmed.
2. Admin roadmap and critical admin routes operational.
3. Session-backed route checks stable (no unexpected 500/looping auth failures).
4. Error rate and login failure telemetry return to baseline.

## Re-enable Procedure
1. Restore valid Google OAuth env values.
2. Restart backend.
3. Verify:
   - Google login launch
   - callback completion
   - `/api/auth/me` authenticated response
   - logout + restore behavior
