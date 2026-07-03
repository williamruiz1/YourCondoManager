# Financial-Route Role-Capability Matrix

**Status:** Audited — P1-7 (Issue #214)
**Last updated:** 2026-06-26 (Plaid bank-feed role-gate + CSRF posture added)

This document maps every financial-mutation API route to the `AdminRole` values
that may invoke it. It is generated from the source of truth in
`server/routes/admin-payments.ts`, `server/routes/admin-reconciliation.ts`, and
`server/routes.ts`.

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
| `/api/admin/payments/record` | POST | `platform-admin`, `board-officer` |
| `/api/admin/payments/record-bulk` | POST | `platform-admin`, `board-officer` |
| `/api/admin/payments/recent` | GET | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager`, `viewer` |

`viewer` and `assisted-board` cannot post payments — they only read history.
`manager` and `pm-assistant` cannot post payments either; only
`platform-admin` and `board-officer` (the treasurer-equivalent) may write.

### Admin reconciliation (`/api/admin/reconciliation/*`)

Source: `server/routes/admin-reconciliation.ts`

| Endpoint | Method | Allowed roles (write) | Allowed roles (read) |
|---|---|---|---|
| `/api/admin/reconciliation/report` | GET | — | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager`, `viewer` |
| `/api/admin/reconciliation/auto-match` | POST | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` | — |
| `/api/admin/reconciliation/manual-queue` | GET | — | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` |
| `/api/admin/reconciliation/match` | POST | `platform-admin`, `board-officer`, `assisted-board`, `pm-assistant`, `manager` | — |
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
