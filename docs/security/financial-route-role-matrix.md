# Financial-Route Role-Capability Matrix

**Status:** Audited — P1-7 (Issue #214)
**Last updated:** 2026-07-03 (drift re-audit, dispatch #8537 — money-out routes
added: disbursements, refund, autopay, stripe-connect; role-set source-of-truth
extracted + drift-guard test added)

This document maps every financial-mutation API route to the `AdminRole` values
that may invoke it. The write-role sets are now the canonical, side-effect-free
source of truth in `server/routes/financial-role-constants.ts`, imported by the
route files and **locked against drift** by
`server/routes/__tests__/financial-role-constants.test.ts` (a widening — e.g.
adding `viewer` to any money-mutation set — turns CI red). Enforcement is
verified end-to-end by `server/routes/__tests__/financial-security.test.ts`.

## 2026-07-03 drift re-audit verdict (dispatch #8537)

**Zero enforcement gaps.** Every financial-mutation route (POST/PUT/PATCH/DELETE
across `/api/financial/*`, `/api/admin/{payments,reconciliation,disbursements}/*`,
`/api/financial/{autopay,stripe-connect}/*`, and `/api/plaid/*`) applies
`requireAdmin` + `requireAdminRole([...])` before any DB write, with tenant
isolation via `assertAssociationScope`. The re-audit confirmed the gating is
correct and appropriately tiered by money-sensitivity (see below); the only drift
was documentation (this doc lagged routes added after 2026-06-26) — now closed.

**Out-of-financial-scope observation (filed separately, not fixed here):**
`POST /api/admin/deletion-requests/:id/approve` (`server/routes.ts`) carries
`requireAdmin` **only** — no role gate. This is a GDPR-anonymization governance
op, not a financial mutation; the handler comment documents the deliberate
deferral pending a `requirePlatformAdmin` middleware. Tracked for a separate PR
(tightening it needs its own regression test).

## Money-sensitivity tiering

Write gates tighten as money-sensitivity rises (fewer roles = tighter):

| Surface | Constant | Roles |
|---|---|---|
| Post a payment (money IN, ledger-authoritative) | `RECORD_ROLES` | `platform-admin`, `board-officer` (treasurer-equivalent) — **tightest** |
| Refund (money OUT) | `REFUND_ROLES` | `platform-admin`, `board-officer`, `manager` |
| Disburse (money OUT) | `DISBURSEMENT_WRITE_ROLES` | `platform-admin`, `board-officer`, `manager` |
| Reconciliation match writes | `RECON_WRITE_ROLES` | the 5 operator personas (excl. `viewer`) |
| General financial config (assessments, fees, budgets, …) | 5-role set | the 5 operator personas (excl. `viewer`) |

`viewer` is excluded from **every** money-mutation set. A plain board member
(`assisted-board`), PM (`pm-assistant`), or `viewer` **cannot post a payment** —
only the treasurer-equivalent (`board-officer`) + platform staff.

---

## AdminRole enum

Defined in `shared/schema.ts` (line 169):

| Role | Description |
|---|---|
| `platform-admin` | Full platform access — YCM staff |
| `board-officer` | Treasurer-equivalent for self-managed boards (write access) |
| `assisted-board` | Board member with limited write — approval but not direct mutation |
| `pm-assistant` | Property-management assistant |
| `manager` | Property manager |
| `viewer` | Read-only — no financial mutations |

---

## Portal access model

Owner-facing portal requests do **not** use `AdminRole`. They use:

| Context | Auth middleware | Board write |
|---|---|---|
| Portal (owner) | `requirePortal` | N/A — owners cannot mutate ledger entries |
| Portal (board) | `requirePortal` + `requireBoardAccess` | Blocked by `requireBoardAccessReadOnly` (always 403) |

The portal board workspace is intentionally **read-only** at the portal layer
(`server/portal-role-collapse.ts`). Financial mutations flow exclusively through
the admin surface.

---

## Financial-write route matrix

### Admin manual payment recording (`/api/admin/payments/*`)

Source: `server/routes/admin-payments.ts`

| Endpoint | Method | Allowed roles |
|---|---|---|
| `/api/admin/payments/record` | POST | `platform-admin`, `board-officer` (`RECORD_ROLES`) |
| `/api/admin/payments/record-bulk` | POST | `platform-admin`, `board-officer` (`RECORD_ROLES`) |
| `/api/admin/payments/refund` | POST | `platform-admin`, `board-officer`, `manager` (`REFUND_ROLES`) |
| `/api/admin/payments/recent` | GET | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager`, `viewer` |

`viewer` and `assisted-board` cannot post payments — they only read history.
`manager` and `pm-assistant` cannot post payments either; only
`platform-admin` and `board-officer` (the treasurer-equivalent) may write.
Refunds move money OUT and additionally admit `manager` (`REFUND_ROLES`).

### Admin disbursements (`/api/admin/disbursements/*`)

Source: `server/routes/admin-disbursements.ts` — all writes apply `requireAdmin`
+ `requireAdminRole(DISBURSEMENT_WRITE_ROLES)`. Money-OUT; segregation of duties
operates within the write set (maker + checker are two different members).

| Endpoint | Method | Allowed roles (write) |
|---|---|---|
| `/api/admin/disbursements` | POST | `platform-admin`, `board-officer`, `manager` |
| `/api/admin/disbursements/:id/submit` | POST | `platform-admin`, `board-officer`, `manager` |
| `/api/admin/disbursements/:id/approve` | POST | `platform-admin`, `board-officer`, `manager` |
| `/api/admin/disbursements/:id/reject` | POST | `platform-admin`, `board-officer`, `manager` |
| `/api/admin/disbursements/:id/pay` | POST | `platform-admin`, `board-officer`, `manager` |

Read (`DISBURSEMENT_READ_ROLES`) is wider (incl. `pm-assistant`, `viewer`) so the
approval queue can be audited without write access.

### Autopay (`/api/financial/autopay/*` + `/api/portal/autopay/*`)

Source: `server/routes/autopay.ts`.

| Endpoint | Method | Allowed roles |
|---|---|---|
| `/api/financial/autopay/enrollments` | POST | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/autopay/enrollments/:id` | PATCH | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/autopay/run` | POST | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/portal/autopay/enroll` | POST | owner (`requirePortal`) — enrolls their OWN unit's autopay |
| `/api/portal/autopay/enrollments/:id` | PATCH | owner (`requirePortal`) — their OWN enrollment |

Portal autopay is owner-scoped (an owner manages autopay for their own unit) —
never an `AdminRole` surface.

### Stripe Connect onboarding (`/api/financial/stripe-connect/*`)

Source: `server/routes/stripe-connect.ts`.

| Endpoint | Method | Allowed roles |
|---|---|---|
| `/api/financial/stripe-connect/onboarding-link` | POST | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` (`ADMIN_ROLES_WRITE`) |
| `/api/webhooks/stripe-connect/*` | POST | unauthenticated — Stripe-signature verified |

### Admin reconciliation (`/api/admin/reconciliation/*`)

Source: `server/routes/admin-reconciliation.ts`

| Endpoint | Method | Allowed roles (write) | Allowed roles (read) |
|---|---|---|---|
Writes apply `requireAdminRole(RECON_WRITE_ROLES)` (5 operator personas,
excl. `viewer`).

| `/api/admin/reconciliation/report` | GET | — | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager`, `viewer` |
| `/api/admin/reconciliation/mark-non-owner-income` | POST | `RECON_WRITE_ROLES` | — |
| `/api/admin/reconciliation/auto-match` | POST | `RECON_WRITE_ROLES` | — |
| `/api/admin/reconciliation/manual-queue` | GET | — | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/admin/reconciliation/match` | POST | `RECON_WRITE_ROLES` | — |
| `/api/admin/reconciliation/suggestions/create` | POST | `RECON_WRITE_ROLES` | — |
| `/api/admin/reconciliation/audit-log` | GET | — | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |

### Owner-ledger entries (`/api/financial/owner-ledger/*`)

Source: `server/routes.ts`

| Endpoint | Method | Allowed roles |
|---|---|---|
| `/api/financial/owner-ledger/entries` | POST | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/owner-ledger/import` | POST | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |

### Core financial mutations (`/api/financial/*`)

Source: `server/routes.ts` — all endpoints below apply
`requireAdmin` + `requireAdminRole([...])`.

| Endpoint prefix | Allowed mutation roles |
|---|---|
| `/api/financial/assessments` | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/fee-schedules` | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/late-fee-rules` | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/payment-plans` | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/recurring-charges/*` | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/accounts` | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/budgets` | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/invoices` | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/approvals` | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/delinquency-*` | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/collections-handoffs` | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/alerts/*` | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/categories` | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/budget-versions` · `/budget-lines` | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/utilities` | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/payment-methods` · `/payment-gateway/validate` | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/owner-payment-links` · `/payment-instructions/send` | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/expense-attachments` | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/reminder-rules/*` · `/retries/run` | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/reconciliation/{imports,periods,transactions}` | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/financial/partial-payment-rules` | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |

**`viewer` role cannot mutate any financial data.** `viewer` is limited to read
(`GET`) endpoints that explicitly include it in their `requireAdminRole` call.

### Plaid bank-feed (`/api/plaid/*`)

Source: `server/routes.ts` — write routes apply `requireAdmin` +
`requireAdminRole(PLAID_WRITE_ROLES)` (added by Issue #214 follow-up). These
establish bank connections and post/alter ledger reconciliation matches, so they
are financial-mutation surfaces. **Before the #214 follow-up these carried
`requireAdmin` ONLY** — meaning the view-only `viewer` persona could trigger a
bank sync or reconcile against the owner ledger. That gap is now closed.

`PLAID_WRITE_ROLES` = the five operator personas EXCLUDING `viewer` (the same
boundary as `RECON_WRITE_ROLES` in `server/routes/admin-reconciliation.ts`).

| Endpoint | Method | Allowed roles |
|---|---|---|
| `/api/plaid/create-link-token` | POST | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/plaid/exchange-token` | POST | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/plaid/sync` | POST | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/plaid/reconcile` | POST | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/plaid/reconcile/manual` | POST | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/plaid/connections/:id` | DELETE | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/plaid/has-connection` | GET | any admin (read) |
| `/api/plaid/accounts` | GET | any admin (read) |
| `/api/plaid/transactions` | GET | any admin (read) |
| `/api/plaid/reconcile/pending` | GET | any admin (read) |

Every Plaid write route also calls `assertAssociationScope(req, associationId)`
(DELETE resolves the association from the connection row first), so tenant
isolation holds.

The `/api/webhooks/plaid` route is intentionally unauthenticated — it is
cryptographically verified via the Plaid-Verification JWT and rejects (401) any
unverified caller (see `PlaidProvider.verifyWebhook`).

---

## Tenant isolation

All write endpoints call `assertAssociationScope(req, associationId)` before
any DB write. This helper (`server/routes.ts`) verifies that the
`associationId` in the request body/query is within the admin user's scoped
association list (`adminScopedAssociationIds`). `platform-admin` bypasses the
scope check (unrestricted access). All other roles are hard-bounded.

---

## Rate limiting

Financial mutation routes and admin mutation routes are rate-limited at the
path-prefix level. See `server/index.ts` for the current limits (60 writes/min
per IP for both `/api/financial` and `/api/admin`).

**Multi-instance caveat:** the current limiter is in-memory
(`server/rate-limit.ts`). Each Fly machine enforces its own counter. When YCM
scales to multiple machines, replace with a Redis-backed shared store.

---

## CSRF posture (investigated 2026-06-26, Issue #214 follow-up)

A "signature CSRF bug" was flagged for investigation. **Verdict: no exploitable
CSRF gap exists on financial-mutation, signature/consent, or admin routes.**

Discriminating evidence:

- **Session cookie is `SameSite=Lax`** (`server/index.ts`; default and the
  deployed value per `.env.example`). SameSite=Lax does **not** attach the
  session cookie to cross-site `POST`/`PUT`/`PATCH`/`DELETE` requests — so a
  forged cross-site form/fetch to an admin mutation route arrives
  unauthenticated → `requireAdmin` rejects it (403). Lax only attaches on
  top-level GET navigations.
- **No state-changing `GET` routes.** Every financial `GET` is a read (lists,
  reports). There is no mutating GET that Lax would expose.
- **Signature / consent flow is safe.** `POST /api/consent` is session-gated
  (Lax-protected). `POST /api/portal/consent` requires the non-cookie
  `x-portal-access-id` header (`requirePortal`), which a cross-site attacker
  cannot set — so it is CSRF-immune regardless of cookie policy.
- The cookie is `httpOnly` + `secure` (prod) and there is no permissive CORS
  allowlist, so no cross-origin credentialed XHR is permitted either.

**Defense-in-depth note (no behavior change):** the protection relies on
`SESSION_COOKIE_SAME_SITE` staying `lax` (or `strict`). If it is ever set to
`none` (e.g. for a future embedded/cross-site surface), the Lax CSRF protection
disappears and an explicit anti-CSRF token or Origin/Referer check must be added
to all mutation routes BEFORE flipping that env var. Keep `lax` unless a
documented cross-site requirement exists.
