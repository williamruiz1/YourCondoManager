# Zero Trust Architecture — YourCondoManager

**Status:** Active · v1.0
**Last reviewed:** 2026-05-10
**Owner:** William Ruiz (Security/Founder)
**Source spec:** Issue #388 (founder-os) · Plaid attestation evidence (Nov 11 2026 deadline)

---

## §1 — Principle

Zero Trust at YCM means **no implicit trust based on network location, prior request, or session age**. Every request is verified independently, server-side, on every call. There is no "trusted internal zone" and no "logged in once = trusted forever" mode.

The model:

- **Never trust, always verify** — every API call resolves the caller's identity + scope from authoritative state, not from cached client claims
- **Authentication ≠ authorization** — having a valid session proves *who* you are, not *what you can do*; the latter is checked per-resource per-request
- **Fail closed** — when scope cannot be proven, the request is denied; absence of explicit allow is a deny
- **Continuous verification** — sessions are time-bounded; anomalous access (new IP, new geography) generates alerts even within an active session

This document is the canonical evidence supporting the Plaid attestation: *"Implementation of a zero trust access architecture."*

---

## §2 — How it's enforced (controls in code today)

YCM already implements core zero trust principles. This section maps the principle to the concrete code path.

### §2.1 — Every request independently authenticated (`requireAdmin`)

Every admin API route in `server/routes.ts` registers `requireAdmin` as middleware. There is no opt-out, no "trusted" route, no path that skips this. The middleware:

1. Reads the session cookie (`sid` in production, `sid_dev` in development)
2. Loads the session row from `user_sessions` (Postgres-backed; `connect-pg-simple`)
3. Resolves `adminUserId` from the session
4. Hydrates the admin user's role and association-scope rows from authoritative state via `tryHydrateAdminFromSession`
5. **If hydration fails for any reason — expired session, missing admin row, missing role, missing scope rows** — the response is `403 ADMIN_SESSION_REQUIRED`

There is no client-trusted token, no JWT-as-credential, no "I claim to be admin X" header path. Every claim is re-resolved against the database every request.

**Evidence:** `server/routes.ts` `requireAdmin` (lines ~1024-1041), used by every `/api/admin/*` and `/api/portal-admin/*` route registration.

### §2.2 — Fail-closed tenant isolation (`assertAssociationScope`)

Multi-tenant isolation in YCM is enforced per-resource per-request. The `assertAssociationScope` helper:

1. **`platform-admin` role** — passes (cross-association by design — explicit, not implicit)
2. **Any other role with a non-empty `adminScopedAssociationIds`** — caller must have `associationId` in that list, else throws "Association is outside admin scope"
3. **Any other role with an EMPTY `adminScopedAssociationIds`** — **fails closed** (denial). An empty scope is a misconfiguration signal, NOT a global-allow signal.

Previously (pre-PR `a8dd8fbd-c008-4262-9077-a64fb4e03bb9` self-review M6), an empty scope short-circuited to "allowed" — that path is closed. The current behavior is fail-closed by design.

**Evidence:** `server/routes.ts` `assertAssociationScope` (lines ~1065-1081). Defense-in-depth comment at lines ~1070-1074 spells out the rationale.

### §2.3 — Role-based authorization checked server-side per request (`requireAdminRole`)

Authorization is **never** based on a client-supplied claim. Each privileged route registers `requireAdminRole(['platform-admin', 'admin'])` (or similar) which re-checks the caller's role from the authoritative `admin_users` row resolved in `requireAdmin`. The role lives in the database; cookies/tokens cannot escalate it.

**Evidence:** `server/routes.ts` `requireAdminRole` factory (line ~1113). Used as a per-route middleware: `app.post('/api/admin/...', requireAdmin, requireAdminRole(['platform-admin']), handler)`.

### §2.4 — OAuth tokens, not passwords

YCM authentication is via Google OAuth 2.0 only. There is no password field on the `admin_users` or `users` table; YCM never stores user passwords. This is structural — no password-spray vulnerability, no password-reuse contamination from third-party breaches, no password-rotation policy required because there are no passwords to rotate.

The OAuth flow is per `server/auth.ts` `passport-google-oauth20`. A successful OAuth callback creates a session row; subsequent requests authenticate via the session cookie + the database state.

**Evidence:** `server/auth.ts` Google strategy registration (lines ~110-200); `server/routes.ts` magic-link recovery flow (separate bounded fallback for OAuth-callback edge cases, signed + 15-minute TTL by default).

### §2.5 — Sessions are time-bounded (continuous verification)

Sessions expire to enforce continuous re-authentication. Two timeout mechanisms:

- **Inactivity timeout** — sessions expire after `SESSION_MAX_AGE_MS` (default 7 days; environment-configurable via env var). Configured at session-middleware layer in `server/index.ts`. The `rolling: true` flag means each request resets the inactivity clock; an abandoned session expires 7 days after the last request.
- **Absolute timeout** — sessions expire after a hard maximum lifetime regardless of activity. Set to **30 days**. Enforced via `auth_events`-derived session-creation timestamps + a per-request middleware that compares now() to the session's `createdAt` and forces logout when exceeded.

On expiry of either timeout, the response is `401` and the client is redirected to `/login` with a "Session expired" message. The session row is destroyed; the cookie is cleared.

**Evidence:**
- Inactivity: `server/index.ts` `sessionMaxAgeMs` (line ~75), passed to `cookie.maxAge` of the `express-session` middleware. `rolling: true` (line ~100) propagates the maxAge on each request.
- Absolute: see §3.2 below for the 30-day absolute-timeout middleware.

### §2.6 — Anomalous access detection (continuous verification)

Beyond authentication, YCM monitors for anomalous access patterns within an active session:

- **New IP detection** — every successful auth event (login or session-restore) writes a row to the `auth_events` table (`userId`, `ipAddress`, `userAgent`, `createdAt`). When an admin authenticates from an IP not seen in the last 30 days for that user, an alert email is sent to the admin's account email: *"New location login to your YCM account."*
- **Per-event audit log** — every auth event is durably logged so post-incident forensics can reconstruct who accessed what from where and when.

The new-IP signal is per-user (not per-association), because the threat model is account compromise (someone with stolen OAuth-state credentials trying to log in from elsewhere), not legitimate cross-tenant access.

**Evidence:**
- Schema: `auth_events` table — see migration `0024_auth_events.sql` and `shared/schema.ts` `authEvents` table.
- Logging: `server/auth.ts` `recordAuthEvent` helper invoked from successful Google callback + magic-link consumption + session-restore.
- New-IP alert: `server/auth.ts` `checkNewIpAndAlert` invoked post-`recordAuthEvent`; sends via existing `email-provider.ts` infrastructure.

### §2.7 — Session storage is server-side, not client-side

Sessions are stored in Postgres (`user_sessions` table managed by `connect-pg-simple`). The cookie carries only an opaque session ID — never user data, role data, or scope data. Any changes to a user's role or scope take effect on the *next request* because the row in `user_sessions` is just a key into `admin_users` + `admin_user_associations`; the actual authority data is resolved per-request from those tables.

This means: revoking an admin's access (or changing their scope) takes effect immediately for the next request. There is no token TTL window where revoked credentials still work.

**Evidence:** `server/index.ts` `PgStore` configuration (lines ~87-91); `server/storage.ts` session helpers.

### §2.8 — Network is not a trust boundary

YCM does not rely on private-network trust assumptions. All requests pass through the public internet (Replit-hosted) and are authenticated identically regardless of source. There is no admin endpoint on a "trusted internal port"; there is no IP allowlist (the architecture would require explicit allowlist code, which there is none). Cookies are `secure: true` in production (HTTPS-only) and `httpOnly: true` (no JavaScript access). `sameSite: lax` per environment default.

**Evidence:** `server/index.ts` cookie config (lines ~101-106).

---

## §3 — Session management approach

### §3.1 — Session lifecycle

| Event | Effect |
|---|---|
| OAuth callback succeeds | New session row created in `user_sessions`; cookie set with TTL `SESSION_MAX_AGE_MS` (7 days default); `auth_events` row written; new-IP check fires |
| Magic-link redemption succeeds | Same as OAuth callback (delegates through `req.login` → passport.serializeUser → express-session) |
| Authenticated request | Session TTL renewed (`rolling: true`); admin context re-hydrated from DB; absolute-timeout check runs; if either timeout exceeded → logout |
| Logout | Session row destroyed; `sid` cookie cleared; auth_restore cookie cleared |
| Inactivity timeout (7-day default) | Session row expires by Postgres TTL convention (express-session purges); cookie no longer matches a row → `requireAdmin` returns 403 → client redirects to `/login?reason=session-expired` |
| Absolute timeout (30 days) | `enforceSessionAbsoluteAge` middleware runs per request; if `session.createdAt + 30d < now()` → destroy session + 401 + redirect |
| Role/scope change in DB | Takes effect on next request (no token TTL gap) |

### §3.2 — Absolute timeout enforcement (this PR)

A new middleware `enforceSessionAbsoluteAge` (in `server/auth.ts`) runs for any authenticated request:

```
for any req with an active session:
  resolve session.createdAt from auth_events (earliest event for this session) OR session row metadata
  if now() - session.createdAt > SESSION_ABSOLUTE_MAX_AGE_MS (30 days):
    destroy session
    return 401 with {code: "SESSION_EXPIRED", reason: "absolute"}
```

Default `SESSION_ABSOLUTE_MAX_AGE_MS` is 30 days; environment-configurable.

### §3.3 — Cookie security flags

Production cookie flags (set in `server/index.ts`):

- `httpOnly: true` — JavaScript cannot access the cookie (mitigates XSS-based session theft)
- `secure: true` (or `"auto"` in production via TLS detection) — cookie only sent over HTTPS
- `sameSite: "lax"` (configurable to `"strict"` or `"none"` via env var)
- `name: "sid"` (production) / `"sid_dev"` (development) — namespaced to prevent dev/prod cross-contamination

---

## §4 — Token-based auth (no passwords)

YCM uses **Google OAuth 2.0** as the only authentication mechanism. Effects:

- **No password storage** — `users` and `admin_users` tables have no password field
- **No password recovery flow** — there is nothing to recover; users authenticate via Google
- **No password-reuse risk** — third-party breaches of other services cannot leak YCM credentials
- **No password rotation policy** — moot
- **MFA via Google account** — if a user enables MFA on their Google account, that protection inherits to YCM with no YCM-side code

The lone exception is the **auth-restore magic link**: after a successful Google OAuth callback during signup completion, an HMAC-signed token (TTL 15 minutes default) is mailed to the user as a recovery channel for the corner case where the OAuth callback succeeds but the session cookie is lost (private browsing edge case). The token:

- Carries no role or scope data — it only proves account-email ownership
- Has a strict TTL (15 minutes default; environment-configurable)
- Is single-use (the receiving handler invalidates after redemption)
- Is signed with HMAC-SHA256 over a server-side secret (`AUTH_RESTORE_SECRET` falls back to `SESSION_SECRET`)

**Evidence:** `server/auth.ts` `createAuthRestoreToken` + `verifyAuthRestoreToken` (lines 72-108).

---

## §5 — Continuous verification: anomaly detection

### §5.1 — `auth_events` table

Every successful authentication event writes a row to `auth_events`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | primary key |
| `user_id` | uuid (nullable for unauthenticated probes) | FK to `users.id` |
| `admin_user_id` | uuid (nullable) | FK to `admin_users.id` (denormalized for fast admin-scoped queries) |
| `event_type` | text | `oauth-login`, `magic-link-redeem`, `session-restore`, `logout` |
| `ip_address` | text | source IP (X-Forwarded-For first segment if behind proxy) |
| `user_agent` | text | request UA header |
| `outcome` | text | `success`, `failure` (with optional `failure_reason`) |
| `created_at` | timestamp with tz | server-stamped |

Indexed on `(user_id, created_at desc)` for efficient new-IP-since-30-days queries.

Migration: `migrations/0024_auth_events.sql`.

### §5.2 — New IP detection

On every successful login event, `checkNewIpAndAlert` runs:

```
last_seen_ips = SELECT DISTINCT ip_address FROM auth_events
                WHERE user_id = $1
                  AND created_at >= NOW() - INTERVAL '30 days'
                  AND outcome = 'success'
                  AND id != $2  -- exclude the just-inserted row
if event.ip_address NOT IN last_seen_ips AND last_seen_ips IS NOT EMPTY:
  send_email(user.email, "New location login to your YCM account",
             template with: ip, ua, timestamp, link to /admin/security/recent-events)
```

The `last_seen_ips IS NOT EMPTY` guard avoids alerting on a user's first-ever login (when no prior events exist, the new IP is not "new" in a meaningful sense — it's the establishing IP).

Email sent via existing `server/email-provider.ts` infrastructure.

### §5.3 — Future hardening (out of scope for v1)

These are deliberately deferred per `docs/specs/security-maturity-roadmap-2026-05-10.md`:

- Geolocation-based anomaly (different country) — requires geolocation service
- Device fingerprinting beyond IP+UA
- Failed-auth rate-limiting with auto-lockout (separate workstream WS9)
- Real-time SOC alerting (separate workstream)

---

## §6 — Threat model + mitigations

The threats this architecture mitigates:

| Threat | Mitigation in YCM |
|---|---|
| Stolen session cookie | `httpOnly` blocks JS access; `secure` blocks HTTP transport; absolute 30-day timeout caps the blast window |
| Compromised OAuth account | New-IP alerts notify the legitimate user; per-request DB role hydration means a revoked role takes effect on the next request |
| SQL injection escalating privileges | Parameterized queries via Drizzle ORM; per-request `assertAssociationScope` check independent of any path-derived authority |
| Cross-tenant data access via parameter tampering | Every association-scoped resource calls `assertAssociationScope(req, associationId)` on the authority resolved server-side; client-supplied `associationId` is checked against caller's scope |
| Session fixation | Session is re-established on OAuth callback via `req.login`; new session ID on auth |
| CSRF | `sameSite: lax` cookie; OAuth state parameter in callback flow |
| Password-spray attacks | Structurally not applicable (no passwords) |
| Stolen long-lived API tokens | Structurally not applicable (no API tokens issued to users; admins authenticate via OAuth → session) |

The threats this architecture does NOT yet mitigate (see §5.3 for deferral rationale):

- Sustained brute-force OAuth-callback abuse (deferred; Google handles primary brute-force; YCM-level rate-limit is WS9)
- Insider abuse with valid credentials (audit_logs + auth_events provide forensic trail; real-time prevention is out of v1 scope)
- Side-channel attacks on the session cookie (mitigated structurally by HTTPS-only + httpOnly; no further hardening planned)

---

## §7 — Verification checklist

For a security reviewer (Plaid attestation evidence path):

- [x] `server/routes.ts` `requireAdmin` middleware applied to every admin route — verifiable via `grep "requireAdmin" server/routes.ts | wc -l` (count of route registrations using it)
- [x] `server/routes.ts` `assertAssociationScope` called on every association-scoped resource handler
- [x] `server/auth.ts` Google OAuth strategy is the only auth strategy registered with passport — verifiable via `grep "passport.use" server/auth.ts`
- [x] `server/index.ts` session middleware sets `httpOnly`, `secure`, `sameSite`, with `maxAge` from `SESSION_MAX_AGE_MS` — see lines 86-107
- [x] `server/auth.ts` `enforceSessionAbsoluteAge` middleware enforces 30-day cap — see this PR
- [x] `migrations/0024_auth_events.sql` introduces `auth_events` table — see this PR
- [x] `server/auth.ts` `recordAuthEvent` writes a row on every successful auth — see this PR
- [x] `server/auth.ts` `checkNewIpAndAlert` sends email on first IP seen for a user in 30 days — see this PR
- [x] `docs/security/information-security-policy-zero-trust-section.md` — Information Security Policy extract for canonical-policy update — see this PR

---

## §8 — Cross-references

- **Plaid compliance**: this doc is the evidence for the Plaid attestation *"Implementation of a zero trust access architecture"* due 2026-11-11.
- **Spec parent**: `docs/specs/security-maturity-roadmap-2026-05-10.md` WS12.
- **Companion workstream WS9** (failed-auth monitoring + rate-limiting): separate dispatch.
- **Information Security Policy**: section authored per this doc must land in the canonical policy (DB-backed or Notion-canonical) — see `docs/security/information-security-policy-zero-trust-section.md` for the verbatim text to paste.
- **Source dispatch**: founder-os Issue #388 (P1 Plaid binding deadline).

---

## §9 — Lineage

- **2026-05-10 v1** — Authored by Worker [020] per Coordinator [014] dispatch (queue line 19197). Stage 2 review per D66 §6 (auth + session controls + new DB table). Source authority: William founder-tier (security-maturity-roadmap WS12) + Plaid compliance binding deadline.
