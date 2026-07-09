# Session Model Across Surfaces — YourCondoManager

**Status:** Canonical (F2 — YCM Redesign build-out, founder-os#10188)
**Established:** 2026-07-09
**Owner:** YCM GM
**Scope:** The single, documented session/auth model spanning every consumer-facing surface: the **Manager app** (`/app/*`), the **Owner portal** (`/portal/*`), and the **future Owner app** (native, token/biometric unlock).
**Sibling doc:** `docs/security/zero-trust-architecture.md` — this file is the cross-surface *session-model* companion to that file's per-control detail. Read both together; this one does NOT duplicate the zero-trust control descriptions, it maps them onto the three surfaces.

> **Why this exists (F2 acceptance criterion 1):** the auth model was documented per-control in the zero-trust doc, but no single artifact stated the *one session model* that spans all three consumer surfaces, nor enumerated every consumer-facing route class to prove no class is locked out or leaking. This file is that artifact. It is the source of truth for "how does a user stay signed in across manager / portal / native, and which session path does each route accept."

---

## §1 — The one session model (BLUF)

YCM runs **one server-side session infrastructure** (`express-session` + `connect-pg-simple`, table `user_sessions`) serving **two complementary authentication credentials**, one per audience:

| Credential | Audience | How it's carried | Server guard | Where it's minted |
|---|---|---|---|---|
| **Passport session** (cookie `sid` / `sid_dev`) | **Managers / board / platform admins** | HTTP-only session cookie, parent-domain scoped (`.yourcondomanager.org`) | `requireAdmin` (→ `tryHydrateAdminFromSession`) | Google OAuth (`/api/auth/google/callback`), magic-link, session-restore |
| **Portal access id** (`x-portal-access-id`) | **Owners** (portal today + native app tomorrow) | Request header (web: `localStorage`; native: Keychain/biometric-unlocked secure store) | `requirePortal` (→ `resolvePortalAccessContext`) | Owner OTP login (`/api/portal/request-login` → `/api/portal/verify-login`) |

Both credentials ride the **same** `express-session` middleware, the **same** server-side `user_sessions` store, and the **same** absolute-timeout enforcement (`enforceSessionAbsoluteAge`). The difference is only in *which credential a given route class accepts* — enumerated in §3.

This is deliberate and correct: managers authenticate with an identity provider (Google), while owners authenticate with a low-friction OTP that resolves to a per-owner, per-unit **portal access** record. The native Owner app reuses the owner credential unchanged — it stores the portal access id in the OS secure enclave and gates its retrieval behind a biometric unlock, then sends it as the same `x-portal-access-id` header. **No third credential is introduced for native.**

---

## §2 — Per-surface detail

### §2.1 — Manager app (`/app/*`)

- **Client:** React SPA under `/app/*`, route-guarded by `RouteGuard` + `ROUTE_MANIFEST` (`client/src/components/RouteGuard.tsx`) reading the admin role from `/api/auth/me`.
- **Credential:** the passport session cookie (`sid` in prod, `sid_dev` in dev). Set at OAuth callback; carried automatically by the browser (HTTP-only, `SameSite=Lax`, `Secure` in prod, parent-domain scoped per Issue #447 so `app.` + apex share it).
- **Server guard:** every `/api/*` admin data route carries `requireAdmin`. Role is then checked per-request via `requireAdminRole([...])`, and tenant isolation via `assertAssociationScope` (fail-closed; `platform-admin` bypasses by design — see §4).
- **Session lifecycle:** rolling `maxAge` (inactivity, default 7d) + absolute cap (`enforceSessionAbsoluteAge`, default 30d) — both in `docs/security/zero-trust-architecture.md` §3.

### §2.2 — Owner portal (`/portal/*`)

- **Client:** React SPA under `/portal/*` (`client/src/pages/portal/portal-shell.tsx`). Reads `portalAccessId` from `localStorage`, sends it as `x-portal-access-id` on every portal request via `usePortalContext().portalFetch`.
- **Credential:** the portal access id, minted by owner OTP login (`owner-portal-login-container.tsx` → `/api/portal/verify-login` returns `{ portalAccessId }`). It is a stable, per-owner-per-unit access-record id, not a bearer JWT — it resolves server-side to a live `portal_access` row (revocable by managers via `/api/portal/access`).
- **Server guard:** every owner-data route carries `requirePortal`, which resolves the access id to `{ associationId, personId, unitId, role, boardAccess }` **server-side** and attaches it to the request. The client never supplies its own scope.
- **Owner scoping:** see §4 — every scoped query derives `associationId` + `personId` from the resolved context, never from client input.

### §2.3 — Future Owner app (native)

- **Credential:** the **same** portal access id as the web portal. On login the native app receives the portal access id from `/api/portal/verify-login` and stores it in the platform secure store (iOS Keychain / Android Keystone), gated behind a biometric/device unlock.
- **Transport:** the native app sends the identical `x-portal-access-id` header. It hits the **same** `/api/portal/*` routes behind the **same** `requirePortal` guard — no native-only endpoint, no native-only credential, no parity fork.
- **Design guarantee:** because native reuses the owner credential path 1:1, anything that passes the surface-parity gate (§3) for the web portal is automatically valid for native. This is the load-bearing reason F2 documents native *now* even though it ships later: it locks the contract so a future native build cannot silently introduce a parallel, unguarded session path.

---

## §3 — Surface-parity enumeration (F2 acceptance criterion 2)

**The gate:** every consumer-facing route class must accept its session path, and **no class may be locked out or leak**. Each `/api/*` route registration must be classifiable into exactly one column below. A route that is neither guarded nor an explicit public-by-design entry is a **parity violation** (either a leak — data with no guard, or a lockout — a class that can't reach its data). This invariant is mechanically enforced by `tests/auth-surface-parity.test.ts`.

| Route class | Session path accepted | Guard | Consumer surface(s) | Count* |
|---|---|---|---|---|
| **Manager data** (`/api/*` admin) | Passport session cookie | `requireAdmin` (+ `requireAdminRole`) | Manager app | ~497 |
| **Owner data** (`/api/portal/*`) | Portal access id header | `requirePortal` | Owner portal + native | ~89 |
| **Manager-managed portal admin** (`/api/portal/access`, `/memberships`, `/contact-updates/admin`, …) | Passport session cookie | `requireAdmin` + `requireAdminRole` | Manager app | ~7 |
| **Vendor data** (`/api/vendor-portal/*`) | Vendor credential id header (`x-vendor-portal-credential-id`) | `requireVendorPortal` | Vendor portal (fourth consumer surface, same session infra) | ~7 |
| **Public — auth entry** (`/api/auth/*`, `/api/portal/request-login`, `/api/portal/verify-login`) | none (this IS how you authenticate) | intentionally public | all | — |
| **Public — token-bearer** (`/api/portal/payments/link/:token`, `/checkout-session`) | URL magic-link token (the token IS the credential) | token-in-URL | pay-by-link (owner, no login) | 2 |
| **Public — infra** (`/api/health`, `/api/portal/push/vapid-public-key`, `/api/webhooks/*`, `/api/public/*`) | none (public by definition) | intentionally public | infra / marketing | — |

*\*Approximate; the exact live count is asserted by the parity test, which scans the route source at test time so the numbers cannot drift silently.*

> **Note — a fourth surface exists:** the **Vendor portal** (`/api/vendor-portal/*`, guard `requireVendorPortal`, header `x-vendor-portal-credential-id`) is a fourth authenticated consumer surface riding the same session infrastructure. It is outside F2's three named surfaces (manager / owner portal / owner-app), but the parity gate covers it so the enumeration is complete and honest — a vendor-data route is neither a leak nor a lockout because `requireVendorPortal` is a recognized session path.

**Result of the enumeration:** every consumer route class maps to a session path (or an explicit public-by-design entry). No manager, owner, or vendor **data** route is unguarded (no leak), and no consumer class lacks a route to reach its own data (no lockout). Native reuses the owner column verbatim, so it inherits the same guarantee.

### The parity discipline (how future changes stay parity-safe)

Per the auth-surface-parity discipline: **any auth/gate change must migrate the FULL consumer surface, never a subset.** Concretely — if a new owner-data route is added it MUST carry `requirePortal`; if a new manager-data route is added it MUST carry `requireAdmin`; a genuinely public route MUST be added to the allowlist in `tests/auth-surface-parity.test.ts` with a one-line justification. A route that is none of these fails the parity test, which is the mechanical stop against a half-migrated cutover (a class silently locked out, or a data route silently leaking).

---

## §4 — Owner scoping holds (F2 acceptance criterion 3)

**Invariant:** an owner sees only their own unit(s), on every scoped query, across every surface.

- **Portal / native:** `requirePortal` resolves the portal access id to `{ associationId, personId, unitId }` **server-side** (`resolvePortalAccessContext`). Every owner query derives its scope from these server-attached fields (e.g. `getOwnerUnitIds(req.portalAssociationId, req.portalPersonId)` in `server/routes/payment-portal.ts`). The client cannot supply or spoof `personId` / `unitId` — they come from the resolved access record, not the request body. A second owner's access id resolves to a different `personId`, so cross-owner reads are structurally impossible.
- **Manager:** `assertAssociationScope` (fail-closed) restricts non-`platform-admin` roles to their `adminScopedAssociationIds`; an empty scope is a **denial**, not an allow (locked in by `server/__tests__/assert-association-scope.test.ts`). `platform-admin` is cross-association by design (documented in zero-trust §2.2).

Both scoping mechanisms are regression-locked by tests (manager: `assert-association-scope.test.ts`; portal: the scoping contract assertions in `auth-surface-parity.test.ts` verify `requirePortal`-guarded routes derive scope from server context, and no `/api/portal/*` data route reads unit/person scope from client input).

---

## §5 — No regression (F2 acceptance criterion 4)

F2 changes **no** runtime auth behavior. It adds:
1. this documentation of the existing single-session model, and
2. `tests/auth-surface-parity.test.ts` — a source-scanning contract test that locks the enumeration in §3.

Acceptance gate: `npm run check` (tsc) clean + existing auth tests green (`assert-association-scope`, `session-cookie-domain.server`, `billing-portal-session`, `signup-session-continuity`, portal tests) + the new parity test green. Current manager + portal login flows are unchanged (no `server/auth.ts`, `server/index.ts`, `server/routes.ts` guard logic is modified by F2).

---

## §6 — Cross-references

- `docs/security/zero-trust-architecture.md` — per-control detail (§2 controls, §3 session lifecycle, §5 anomaly detection).
- `server/auth.ts` — passport config, OAuth callback, magic-link, session-restore, absolute-timeout enforcement.
- `server/index.ts` §L128 — `express-session` + PgStore config (cookie name, domain scoping, rolling + absolute age).
- `server/routes.ts` — `requireAdmin`, `requireAdminRole`, `assertAssociationScope`, `requirePortal`.
- `server/routes/payment-portal.ts` — representative owner-scoped portal queries.
- `client/src/pages/portal/portal-shell.tsx` — portal access id carriage (`x-portal-access-id`).
- `tests/auth-surface-parity.test.ts` — the mechanical parity gate.
- `server/__tests__/assert-association-scope.test.ts` — manager tenant-isolation regression lock.

---

## §7 — Lineage

- **2026-07-09** — Authored for YCM Redesign F2 (founder-os#10188). Documents the single session model across Manager app / Owner portal / future Owner app, enumerates every consumer route class to prove no locked-out/leaking class, and locks the enumeration with `tests/auth-surface-parity.test.ts`. No runtime auth change; audit + documentation + regression-test only. Requirement-of-record: PPM feature `c6f7944a-f62f-4628-9422-0a67d9b4c5d8`.
