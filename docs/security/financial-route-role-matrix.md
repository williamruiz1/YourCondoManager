# Financial-Route Role-Capability Matrix

**Status:** Audited — P1-7 (Issue #214)
**Last updated:** 2026-07-03 (full re-audit of all 113 mutation routes vs. current `main` — dispatch founder-os#8537)
**Prior audit:** 2026-06-26 (Plaid bank-feed role-gate + CSRF posture)

This document maps every financial-mutation API route to the `AdminRole` values
that may invoke it. It is generated from the source of truth in
`server/routes.ts`, `server/routes/admin-payments.ts`,
`server/routes/admin-reconciliation.ts`, `server/routes/autopay.ts`, and
`server/routes/stripe-connect.ts`.

> **2026-07-03 re-audit result (headline):** every financial-mutation route on the
> admin surface (54 role-gated routes) is correctly gated to the write-role set AND
> calls `assertAssociationScope` for tenant isolation. **Zero RBAC gaps, zero
> tenant-isolation gaps.** Two *webhook signature-verification* fail-open gaps
> (`/api/webhooks/payments`, `/api/webhooks/platform/stripe`) are a distinct vuln
> class (machine-to-machine signature auth, not role gating) and are tracked
> separately — see **§Known gaps (filed separately)** below.

---

## AdminRole enum

Defined in `shared/schema.ts` (default = `viewer`):

| Role | Description | Financial write |
|---|---|---|
| `platform-admin` | Full platform access — YCM staff | ✅ |
| `board-officer` | Treasurer-equivalent for self-managed boards | ✅ |
| `assisted-board` | Board member with limited write | ✅ (except payments) |
| `pm-assistant` | Property-management assistant | ✅ (except payments) |
| `manager` | Property manager | ✅ (except payments) |
| `viewer` | Read-only | ❌ never mutates any financial data |

**Canonical write sets** (verified in source):

| Constant | Location | Roles |
|---|---|---|
| **WRITE-5** (the operator set, viewer excluded) | inline in `server/routes.ts` financial routes; `ADMIN_ROLES_WRITE` (`stripe-connect.ts:93`); `RECON_WRITE_ROLES` (`admin-reconciliation.ts:66`); `PLAID_WRITE_ROLES` (`routes.ts:1237`) | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| **RECORD_ROLES** (treasurer-only, tightest) | `admin-payments.ts:66` | `platform-admin`, `board-officer` |
| **platform-admin only** | `payment-events/:id/status`; `platform/billing/configure` | `platform-admin` |

## Middleware primitives (ground truth)

| Primitive | Location | Enforces |
|---|---|---|
| `requireAdmin` | `server/routes.ts` | Any authenticated admin session (NOT role-gated — `viewer` passes) |
| `requireAdminRole([roles])` | `server/routes.ts` | 403 unless `req.adminRole ∈ roles` — **the role gate** |
| `assertAssociationScope(req, id)` | `server/routes.ts` | Tenant fence, **fail-closed** (platform-admin bypasses; empty scope → deny). Called in-handler before every write. |
| `requirePortal` | `server/routes.ts` | Owner/portal session (header `x-portal-access-id`) |
| `requireBoardAccessReadOnly` | `server/portal-role-collapse.ts` | **Unconditionally 403** — any route carrying it is fully mutation-locked |

---

## Financial-write route matrix (verified 2026-07-03)

### A. Admin manual payments (`/api/admin/payments/*`) — `admin-payments.ts`

| Endpoint | Method | Gate | Scope |
|---|---|---|---|
| `/api/admin/payments/record` | POST | **RECORD_ROLES** (`platform-admin`, `board-officer`) | ✅ |
| `/api/admin/payments/record-bulk` | POST | **RECORD_ROLES** | ✅ |
| `/api/admin/payments/recent` | GET | all 6 roles (read) | ✅ |

Tightest gate in the codebase — only the treasurer-equivalent may post payments.

### B. Admin reconciliation (`/api/admin/reconciliation/*`) — `admin-reconciliation.ts`

`/auto-match`, `/match`, `/suggestions/create` (POST) → **WRITE-5** + scope. Reads → 5-operator read set.

### C. Core `/api/financial/*` mutations — `server/routes.ts` (inline)

All POST/PATCH/DELETE below apply `requireAdmin` + `requireAdminRole(WRITE-5)` + `assertAssociationScope`. **`viewer` cannot mutate any of them.**

| Route family | Verdict |
|---|---|
| `alerts/generate`·`alerts/:id/dismiss` | WRITE-5 + scope ✅ |
| `fee-schedules[/:id]` · `assessments[/:id]` · `late-fee-rules[/:id]` · `late-fees/calculate` | WRITE-5 + scope ✅ |
| `delinquency-thresholds[/:id]` · `delinquency-escalations[/:id]`·`/run` · `delinquency-settings` · `delinquency-notices/generate` | WRITE-5 + scope ✅ |
| `collections-handoffs[/:id]` · `retries/run` | WRITE-5 + scope ✅ |
| `payment-plans[/:id]` · `recurring-charges/schedules[/:id]`·`runs/:id/retry` | WRITE-5 + scope ✅ |
| `approvals[/:id]` · `reminder-rules[/:id]`·`/:id/run` | WRITE-5 + scope ✅ |
| `accounts[/:id]` · `categories[/:id]` · `budgets[/:id]` · `budget-versions[/:id]` · `budget-lines[/:id]` | WRITE-5 + scope ✅ |
| `invoices[/:id]` · `utilities[/:id]` · `expense-attachments` | WRITE-5 + scope ✅ |
| `payment-methods[/:id]` · `payment-gateway/validate` · `owner-payment-links` · `payment-instructions/send` | WRITE-5 + scope ✅ |
| `partial-payment-rules` (PUT) | WRITE-5 + scope ✅ |
| `owner-ledger/entries` · `owner-ledger/import` | WRITE-5 + scope ✅ |
| `reconciliation/imports`·`/auto-match`·`/periods[/:id]`·`/transactions/:id/match` | WRITE-5 + scope ✅ |

### D. Autopay (`/api/financial/autopay/*`, `/api/portal/autopay/*`) — `autopay.ts`

Admin enroll/patch/run (`enrollments[/:id]`, `run`) → WRITE-5 + scope ✅. Portal enroll/patch → `requirePortal` + owner-ownership (`enrollment.personId !== req.portalPersonId → 403`) ✅.

### E. Stripe-Connect onboarding (`/api/financial/stripe-connect/*`) — `stripe-connect.ts`

Write routes → `ADMIN_ROLES_WRITE` (WRITE-5) + scope ✅. Webhook `/api/webhooks/stripe-connect/*` → **fail-closed** signature verification (403 if no signature) ✅.

### F. Plaid bank-feed (`/api/plaid/*`) — `server/routes.ts`

**Verified on `main` 2026-07-03:** all 6 write routes carry `requireAdmin` + `requireAdminRole(PLAID_WRITE_ROLES=WRITE-5)` + `assertAssociationScope`:

| Endpoint | Method | Gate |
|---|---|---|
| `create-link-token` · `exchange-token` · `sync` · `reconcile` · `reconcile/manual` | POST | WRITE-5 + scope ✅ |
| `connections/:id` | DELETE | WRITE-5 + scope (association resolved from the connection row) ✅ |
| `has-connection` · `accounts` · `transactions` · `reconcile/pending` | GET | any admin (read) ✅ |

`/api/webhooks/plaid` is intentionally unauthenticated but **cryptographically verified** via `bankFeedProvider.verifyWebhook` (401 on unverified) ✅.

### G. Admin billing / payment-events (`/api/admin/*`)

| Endpoint | Gate |
|---|---|
| `payment-events/:id/status` (PATCH) | **`platform-admin` only** (tightest) ✅ |
| `billing/portal-session` (POST) | `platform-admin`, `manager`, `board-officer`, `pm-assistant` (SaaS billing) ✅ |
| `platform/billing/configure` (POST) | `platform-admin` only ✅ |

### H. Owner portal (`/api/portal/*`) — owner self-service, owner-scoped

`pay`, `payment`, `payment-methods[/:id]`, `plaid/*`, `payments/link/:token/checkout-session` → `requirePortal`, scoped to `req.portalPersonId`/`portalAssociationId`; a method/enrollment owned by another person → 403. The token checkout-session route is public-but-token-guarded (404 on invalid token). ✅

### I. Portal-BOARD mutations — correctly READ-ONLY (no regression)

Every `/api/portal/board/*` POST/PATCH carries `requireBoardAccess, requireBoardAccessReadOnly`; `requireBoardAccessReadOnly` **unconditionally 403s**. Verified: `board/owner-ledger/entries` (POST), `board/vendor-invoices[/:id]` (POST/PATCH) are all mutation-locked at the portal layer. Financial mutations flow exclusively through the admin surface. ✅

---

## Tenant isolation

All 54 admin financial-write routes call `assertAssociationScope(req, associationId)` (or `assertResourceScope` for resource-by-`:id`) before any DB write. `platform-admin` bypasses; every other role is hard-bounded to `adminScopedAssociationIds`; empty scope → deny (fail-closed). Portal routes enforce owner ownership by `personId`. **No tenant-isolation gaps found.**

---

## Rate limiting & CSRF

Unchanged from the 2026-06-26 audit and re-confirmed:
- Financial + admin mutation routes rate-limited at the path-prefix level (`server/index.ts`; in-memory per-machine — replace with Redis when multi-instance).
- Session cookie is `SameSite=Lax` + `httpOnly` + `secure` (prod); no state-changing GETs; signature/consent flow header-gated. **No exploitable CSRF gap** on financial-mutation, signature/consent, or admin routes. Protection depends on `SESSION_COOKIE_SAME_SITE` staying `lax`/`strict` — add explicit anti-CSRF tokens BEFORE ever setting it to `none`.

---

## §Known gaps (filed separately — distinct vuln class, NOT RBAC)

The 2026-07-03 re-audit surfaced two **webhook signature-verification fail-open** gaps. These are a *different class* from this doc's role-gating scope (machine-to-machine signature auth, not `AdminRole` gating) and their correct fix (fail-closed) is a **production-behavior change** that requires first verifying prod has the webhook secrets configured + migrating any internal no-signature caller — otherwise it breaks live payment/billing ingestion. Tracked as a separate P1 security Issue (see founder-os#8537 thread):

| Route | Gap | Fix (requires ops precondition) |
|---|---|---|
| `POST /api/webhooks/payments` | Falls through to `storage.processPaymentWebhookEvent` unauthenticated when **no signature headers present AND `PAYMENT_WEBHOOK_SHARED_SECRET` unset**; the HMAC path also skips verification when an association has no active signing-secret row → a forged `status:"succeeded"` event could mutate the owner ledger. | Track whether ANY verification path validated; if none did, `403` before processing. Precondition: confirm the internal caller sends `x-payment-webhook-secret` (or migrate it to HMAC) before deploy. |
| `POST /api/webhooks/platform/stripe` | Verifies only inside `if (stripeSignature && webhookSecret)`; if the header is absent or `PLATFORM_STRIPE_WEBHOOK_SECRET` is unset (or parse fails), falls through to `provisionWorkspace`/subscription-status flips on a forged event. **Also deviates from the documented security policy** (`docs/policies/information-security-policy-v1.md:113` — "verified via `PLATFORM_STRIPE_WEBHOOK_SECRET` on every Stripe-originated request"). | Return `403` when signature or secret is missing / parse fails — mirror the fail-closed `/api/webhooks/stripe-connect/*` pattern. Precondition: confirm `PLATFORM_STRIPE_WEBHOOK_SECRET` is set in prod Fly secrets. |

---

## Test coverage

`server/routes/__tests__/financial-security.test.ts` + `plaid-route-security.test.ts` (28 tests) exercise:
- `requireAdminRole` enforces the write-role boundary in a real Express request cycle (`/api/admin/payments/record` as the representative tightest-gate route): `viewer` → 403, `board-officer`/`platform-admin` → 201.
- `assertAssociationScope` denies cross-association writes (tenant isolation), fail-closed on empty scope.
- The READ vs WRITE role-capability matrix contract (all WRITE roles allowed, all READ-only roles denied).

The suite verifies the *middleware contract* (the gate itself) rather than re-testing all 113 routes individually — every financial route uses the same verified `requireAdminRole` + `assertAssociationScope` primitives, so contract-level coverage is the correct altitude.
