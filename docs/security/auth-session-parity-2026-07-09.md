# Auth / Session Parity Across Surfaces (YCM Redesign F2)

**Status:** Audited — Redesign F2 (dispatch founder-os#10188)
**Last updated:** 2026-07-09 (audit of `server/auth.ts` + `server/routes.ts` gates vs. current `main` @ `afe19cc`)
**Requirement-of-record (PPM):** product `1e2da109-f6f6-431c-8dc0-f61b548a1b83`, feature `c6f7944a-f62f-4628-9422-0a67d9b4c5d8` (parent tree `ff70effa-b9fa-4fd5-81b6-96c3b3a5bc19`)
**Plan (source of truth):** `wiki/plans/ycm-redesign-buildout-plan-2026-07-09.md` §F2
**Composes with:** `docs/security/financial-route-role-matrix.md` (role→route), `docs/security/zero-trust-architecture.md` (WS12), and the `auth-surface-parity-protocol` discipline (migrate the FULL consumer surface, never a subset).

> **F2 is an AUDIT + DOCUMENT deliverable.** It documents the ONE session model that spans the three consumer surfaces, enumerates every consumer-facing route class with its gate, and asserts **no class is locked out or leaking**. This audit made **no auth/gate code change** — the two gates and the tenant-isolation helper are already in place and fail-closed; F2 records and verifies that state. Any *future* auth/gate change MUST re-run the §Surface-parity enumeration below across the FULL surface before it ships.

---

## 1. The one session model (documented)

YCM has **one identity model** resolved through **two transport mechanisms**, plus **one re-establishment primitive** for native. Understanding the split is the whole point of F2 — "one session model" does **not** mean "one cookie on every surface"; it means one authenticated identity, one session store, one logout, resolved per-surface by the gate appropriate to that surface.

### 1.1 Primitives (all in `server/auth.ts`)

| Primitive | What it is | Where |
|---|---|---|
| **passport + express-session** | The cookie session. Cookie name **`sid`**. `passport.serializeUser` stores the auth-user id; `passport.deserializeUser` loads it via `storage.getAuthUserById` and rejects `isActive !== 1`. | `initializeAuth`, `configurePassport` |
| **Google OAuth (primary login)** | `passport-google-oauth20`. Establishes the cookie session. Also mints an **auth-restore** cookie on callback. | `registerAuthRoutes` → `handleGoogleOAuthCallback` |
| **auth-restore token** | HMAC-SHA256-signed, short-TTL (`AUTH_RESTORE_TTL_SECONDS`, default 15 min) token = `base64url(payload).sig`. `POST /api/auth/session/restore` verifies it and calls `req.login()` to (re)establish the `sid` cookie session. Also backs the signup magic-link (`GET /api/auth/magic/:token`). | `createAuthRestoreToken` / `verifyAuthRestoreToken` |
| **`/api/auth/me`** | The shared identity endpoint. Returns the authenticated auth-user and, if the user has a linked `adminUserId` (or a matching admin-by-email), the admin `{id,email,role}`. | `registerAuthRoutes` |
| **absolute session cap** | `enforceSessionAbsoluteAge` — sessions hard-expire after `SESSION_ABSOLUTE_MAX_AGE_MS` (default 30 days) regardless of activity → 401 `SESSION_EXPIRED reason=absolute`, clears `sid`. Rolling inactivity timeout is enforced by express-session's `cookie.maxAge`. | `enforceSessionAbsoluteAge` |
| **WS12 forensics** | `recordAuthEvent` (durable `auth_events` trail) + `checkNewIpAndAlert` (new-location email). Fire-and-forget; never blocks the flow. | zero-trust section |

### 1.2 Per-surface resolution

| Surface | UI routes | API gate | Transport | Identity resolved from |
|---|---|---|---|---|
| **Manager app** | `/app/*` | `requireAdmin` → `tryHydrateAdminFromSession` | **`sid` cookie session** (passport) | `req.user` (auth-user) → admin record (by `adminUserId`, else by email) → `req.adminRole` + `req.adminScopedAssociationIds` via `applyAdminContext` |
| **Owner portal** | `/portal/*` | `requirePortal` → `storage.resolvePortalAccessContext` | **`x-portal-access-id` header** (portal-access id, held in `localStorage` `portalAccessId`) | the portal-access row → `req.portalAssociationId` / `req.portalPersonId` / `req.portalUnitId` / `req.portalRole="owner"` (+ `portalHasBoardAccess` augmentation) |
| **Owner app (native, future)** | Capacitor over the `/portal/*` owner bundle | reuses `requirePortal` for portal data; reuses `requireAdmin`/`session/restore` for the cookie session | **same** `x-portal-access-id` (secure storage) **+** auth-restore token behind a **biometric unlock** (Face ID / Touch ID) | identical to the web portal; biometric gates *local unlock*, not a new server identity |

**The single model, stated plainly:** every surface authenticates the same person against the same backend, one `auth_events` trail, one logout (`POST /api/auth/logout` destroys the session + clears `sid`). The manager surface carries identity in the passport cookie; the owner surfaces (web portal + native) carry a portal-access id keyed to the same person/unit, with the auth-restore token as the cookie-session re-establishment primitive the native app unlocks with biometrics. The native app adds **no new server-side session type** — it is the existing session/portal-access behind a device-local biometric gate (per plan §F2 and Owner-app §O5).

### 1.3 Why two transports (and why that is still "parity")

The manager is a first-party web app where a same-origin cookie is the right, CSRF-protected transport. The portal is consumed both same-origin (web) and cross-context (the future native shell, tokenized payment links), where an explicit `x-portal-access-id` header is the portable transport. Both resolve to one identity keyed to a person; neither surface can read the other's data because each gate hydrates only its own scope (§3). A future consolidation to a single transport is possible but is **not** required for parity — parity is "no class locked out, no class leaking," which holds today (§2, §3).

---

## 2. Surface-parity enumeration (every consumer-facing route class → gate → verdict)

Census taken from `server/routes.ts` + `server/routes/*.ts` @ `afe19cc`. Verdict column asserts the class is **neither locked out** (a legitimate user can reach it) **nor leaking** (no user reaches another tenant's/owner's data).

| # | Route class | Count | Gate | Session path accepted | Locked-out? | Leaking? |
|---|---|---|---|---|---|---|
| 1 | **Manager API** `/api/*` (admin) | 479 | `requireAdmin` | `sid` cookie session → admin hydrate | No — any authenticated admin resolves | No — 403 `ADMIN_SESSION_REQUIRED` without a valid admin session |
| 2 | **Manager role-gated** (subset of #1) | 552 applications | `requireAdminRole([...])` on top of `requireAdmin` | same | No — role holders pass | No — 403 `ADMIN_ROLE_FORBIDDEN` for insufficient role |
| 3 | **Owner portal API** `/api/portal/*` | 122 | `requirePortal` | `x-portal-access-id` header → portal context | No — any valid portal-access id resolves | No — 403 without/invalid portal access |
| 4 | **Tenant-isolation (cross-cutting on #1)** | 392 calls | `assertAssociationScope` / `assertResourceScope` / `assertAssociationInputScope` | n/a (post-gate) | No | No — **fail-closed** (§3.1) |
| 5 | **Public — signup/onboarding** `/api/public/signup/*`, `/api/public/onboarding/invite/:token*`, `/api/public/demo-request` | small | intentionally unauthenticated (OTP / signed invite token / rate-limited) | n/a (pre-session; signup *establishes* the session) | No — public by design | No — token/OTP scoped; signup creates only the caller's own session |
| 6 | **Tokenized payment link** `/api/portal/payments/link/:token*` | small | the link token itself (no session) | n/a — bearer token in the URL path | No — link recipient pays without an account | No — token resolves one payment link only |
| 7 | **Auth endpoints** `/api/auth/*` (`google`, `google/callback`, `magic/:token`, `session/restore`, `me`, `logout`) | small | self-gating (OAuth / HMAC token / session presence) | establishes or reads the `sid` session | No | No — HMAC-signed, TTL-bounded, `isActive`-checked |

**Verdict: PARITY HOLDS.** Every consumer-facing route class has an explicit gate; there is **no class that is locked out** for a legitimate user and **no class that leaks** across tenants/owners. The two authenticated surfaces (#1/#2 manager, #3 portal) each accept exactly their own session path and reject the absence of it with a 403. Public/token classes (#5/#6) are unauthenticated **by design** and scoped by OTP / signed invite / link token, not by session.

### 2.1 The parity gate for future changes (the load-bearing rule)

Any future auth/gate change (a new gate, a session-model consolidation, an owner-app auth flow) MUST:
1. Re-run this enumeration across the **FULL** surface (all 7 classes), not a subset.
2. Assert every class still accepts its session path (no newly locked-out class) and no class newly leaks.
3. Ship the change to **every** consumer of the changed gate in the same migration — never migrate manager without portal (or vice-versa), and never leave the native app on a stale gate.

This is the `auth-surface-parity` discipline applied to YCM: a partial cutover (e.g. a new gate wired into `/app/*` but not `/portal/*`) is the exact silent-regression this document exists to prevent.

---

## 3. Owner-scoping holds (owner sees only their own data)

### 3.1 Manager side — `assertAssociationScope` is fail-closed

`server/routes.ts:1149`. `platform-admin` passes (cross-association by design). Every other role must have `associationId` present in `req.adminScopedAssociationIds`; an **empty** scope array is a **denial**, not an allow (M6 self-review hardening, PPM `a8dd8fbd-…`). A request that reaches the helper without an `adminRole` throws. Covered by `server/__tests__/assert-association-scope.test.ts` (green — §4).

### 3.2 Portal side — scoped to person + unit, not just association

`requirePortal` (`server/routes.ts:1272`) resolves the portal-access row into `req.portalAssociationId` / `req.portalPersonId` / `req.portalUnitId`. Portal data routes scope to these (**84** `req.portalPersonId` / `req.portalUnitId` usages across `server/routes.ts` + `server/routes/*.ts`), so an owner sees only their own person/unit records within their association — not the whole association. Board access is an explicit boolean augmentation (`portalHasBoardAccess`), never an implicit widening.

### 3.3 Financial isolation

Every financial-mutation route additionally carries `assertAssociationScope` on top of its role gate (`docs/security/financial-route-role-matrix.md`), and the `viewer` persona is excluded from write roles. Covered by `financial-security.test.ts` + `plaid-route-security.test.ts`.

---

## 4. No regression (verification evidence)

Run in an isolated worktree of `origin/main` @ `afe19cc` with symlinked `node_modules` (per the builder anti-stall note — no `npm ci` in the worktree):

- `npm run check` (**tsc**) → **exit 0, zero errors** (baseline + with this doc — a docs-only change touches no compiled surface).
- Auth/security tests → **41 passed**:
  - `server/__tests__/assert-association-scope.test.ts` (owner/tenant isolation, fail-closed)
  - `server/__tests__/financial-security.test.ts` (financial-route isolation)
  - `server/routes/__tests__/plaid-route-security.test.ts` (Plaid write-role + scope)

Current manager + portal login flows are **unchanged** (no code touched in `server/auth.ts` or the gates).

---

## 5. Acceptance-criteria trace (OP #79 — requirements = definition of done)

| # | Requirement | Where met |
|---|---|---|
| 1 | One session model documented (manager + portal + owner-app native) | §1 (primitives + per-surface table + native biometric-over-session) |
| 2 | Surface-parity gate — full-surface enumeration, no locked-out/leaking class | §2 (7 route classes, verdict PARITY HOLDS) + §2.1 (the rule for future changes) |
| 3 | Owner-scoping holds (owner sees only their unit on every scoped query) | §3 (`assertAssociationScope` fail-closed; portal person/unit scoping; financial isolation) |
| 4 | No regression — `npm run check` clean, auth tests green | §4 (tsc exit 0; 41 auth/security tests pass; no auth code changed) |

**Acceptance gate:** `npm run check` clean ✅ + auth tests green ✅ + documented single-session model covering all 3 surfaces ✅ + surface-parity enumeration (no locked-out/leaking class) ✅.
