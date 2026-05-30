# Reconciliation Source-of-Truth Decision

**Issue:** P0-4 — Consolidate reconciliation source-of-truth  
**Date:** 2026-05-30  
**Status:** Implemented

---

## Decision

**Plaid is the canonical reconciliation path for any HOA that has an active bank connection.**

CSV import is explicitly scoped to HOAs that have *no* Plaid connection (e.g., banks not supported by Plaid, or legacy periods predating the connection).

This is a UX/workflow consolidation, not a data migration. Both pipelines continue to function; the decision governs which one treasurers are directed to by the UI.

---

## Background

The gap audit (2026-05-25, gap-3.md) identified two parallel reconciliation systems with different data tables and match algorithms:

| | Plaid pipeline | CSV pipeline |
|---|---|---|
| **Tables** | `bank_transactions`, `owner_ledger_entries` | `bank_statement_imports`, `bank_statement_transactions` |
| **Match service** | `plaid-reconciliation.ts` (auto + manual) | Inline in `routes.ts` `/api/financial/reconciliation/auto-match` |
| **Match window** | ±3 days, exact-cents | ±5 days, ±$0.01 |
| **Trigger** | POST `/api/plaid/reconcile` | POST `/api/financial/reconciliation/auto-match` |
| **Admin surface** | Payment Methods (`/app/financial/bank-connections`) | Reconciliation (`/app/financial/reconciliation`) |

A treasurer with Plaid connected had three valid paths to reconcile a Zelle deposit, with no UX guidance on which to use — a correctness and trust risk.

---

## What was built

### Backend

- New lightweight endpoint `GET /api/plaid/has-connection?associationId=` returns `{hasConnection: boolean}`.
- No schema changes. No new tables. No migration.
- The existing matching algorithms in `plaid-reconciliation.ts` and the CSV auto-match route are **unchanged** — this task explicitly excluded re-implementing matching logic (PRs #187, #226 already shipped that).

### Frontend

**`financial-reconciliation.tsx` (Reconciliation page):**
- Queries the new endpoint at session-open (5-minute stale-while-revalidate, so essentially free).
- **Plaid-connected HOA:** renders a blue informational banner directing the treasurer to the Payment Methods page as the canonical path; the CSV workflow remains visible below as a clearly-labeled fallback (for importing prior-period statements, etc.).
- **No Plaid connection:** renders an amber banner explaining CSV is the current path and offering a link to connect a bank account.
- No content is removed. The CSV workflow is de-emphasized contextually, not hidden — this is reversible.

**`financial-bank-connections.tsx` (Payment Methods page):**
- Summary text updated to state this is the canonical reconciliation surface for Plaid-connected HOAs.

---

## Rationale for defaults chosen

1. **Plaid is canonical** because it is live, continuous (auto-sync), and the auto-reconcile service (`plaid-reconciliation.ts`) was specifically built for HOA-scope bank-tx matching with strict tenant isolation and idempotency guarantees. The CSV pipeline lacks these properties.

2. **CSV is not removed** because: (a) some banks are not Plaid-supported; (b) importing historical statements before a Plaid connection was set up is a legitimate use case; (c) removal would be a larger, harder-to-reverse change.

3. **No gating (hard disable)** of CSV for Plaid-connected HOAs — the banner approach is less brittle and allows a treasurer to fall back to CSV if Plaid sync is delayed or experiencing issues.

---

## William-blocker flag

**None required for this implementation.** The canonical choice (Plaid over CSV) is consistent with the P0-4 issue acceptance criteria and the audit recommendation. The decision is documented and reversible:

- If William wants harder gating (disable CSV for Plaid HOAs), that can be added by rendering the CSV card inside an `{!hasPlaidConnection && ...}` guard in `financial-reconciliation.tsx`. The hook is already in place.
- If William wants to invert the decision (CSV canonical, Plaid supplemental), the banner copy and link direction are the only things to change.

---

## Files changed

| File | Change |
|---|---|
| `server/routes.ts` | Added `GET /api/plaid/has-connection` endpoint |
| `client/src/pages/financial-reconciliation.tsx` | Plaid-connection query + canonical-path banner |
| `client/src/pages/financial-bank-connections.tsx` | Summary text updated to indicate canonical status |
| `docs/specs/reconciliation-source-of-truth-2026-05-30.md` | This decision doc |
