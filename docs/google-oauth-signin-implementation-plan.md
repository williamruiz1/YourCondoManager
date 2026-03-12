# Google OAuth Sign-In Implementation Plan

## Goal
Enable Google OAuth 2.0 sign-in using a backend-managed session architecture with durable PostgreSQL-backed sessions, account linking, and resilient login recovery.

## Scope
- Backend owns OAuth client flow and callback exchange.
- Browser auth is server-session based (no frontend bearer token as primary login contract).
- Internal users are linked to Google accounts by stable provider account ID, with email used as migration/link fallback.
- Post-login bootstrap ensures first-time users land in initialized workspace/tenant context.

## Phase Plan

### Phase 1: Identity + Session Foundations
- Add internal user identity table and external account-link table:
  - `auth_users` (internal ID, email, profile fields, active flags, timestamps)
  - `auth_external_accounts` (provider, providerAccountId, userId, raw profile metadata, timestamps)
- Add durable session store using `express-session` + `connect-pg-simple` with PostgreSQL.
- Define environment config:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_CALLBACK_URL`
  - `SESSION_SECRET`
  - cookie security controls (`secure`, `sameSite`, domain settings by env)

### Phase 2: Google OAuth Backend Flow
- Add Passport Google strategy (`passport-google-oauth20`).
- Add routes:
  - `GET /api/auth/google` (primary)
  - `GET /api/auth/google/callback` (primary)
  - compatibility aliases at `/auth/google` and `/auth/google/callback`
- Implement callback resolution order:
  1. find by `(provider=google, providerAccountId)`
  2. else find internal user by email
  3. if email match exists, link external account to existing user
  4. else create internal user from Google profile + link account
- Serialize only internal user ID into session; deserialize to full user on request.

### Phase 3: Frontend Login UX + Recovery
- Add login launcher UI that initiates backend OAuth (`/api/auth/google`).
- Support popup/new-tab completion mode for constrained hosting/browser contexts.
- Add callback completion handshake (`postMessage` + reload main app auth state).
- Add optional short-lived session-recovery payload:
  - stored client-side after successful callback
  - validated by backend endpoint
  - used only when normal session check fails

### Phase 4: Auth Guards + Bootstrap + Logout
- Introduce auth middleware for protected routes based on Passport session state.
- Add hydration fallback if session exists but request user context is incomplete.
- Add first-login bootstrap:
  - create default workspace/tenant membership when none exists
  - assign owner-level access
- Add logout endpoint that:
  - logs out Passport
  - destroys server session
  - clears cookie
  - signals frontend to clear recovery payload

### Phase 5: Migration and Cutover
- Transitional dual-auth period:
  - keep existing API-key admin auth for controlled period
  - introduce session-auth path and map internal user role/scope to existing admin role model
- Add verification checklist:
  - login success/failure
  - callback and account link logic
  - session persistence across refresh/restart
  - protected route enforcement
  - logout correctness
  - recovery fallback behavior
- Cut over to session-first auth and remove legacy key-based browser auth when validated.

## Acceptance Criteria
- User can sign in via Google and receive durable authenticated session.
- Existing matching users are linked by email without duplicate user creation.
- New users are auto-provisioned to usable workspace context.
- Protected API routes enforce authenticated session identity.
- Logout reliably clears server/client auth artifacts.
- Hosted environment browser edge cases are covered via popup/new-tab and recovery flow.
