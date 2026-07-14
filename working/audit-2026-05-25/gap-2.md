## Audit finding — Plaid bank-feed sync + reconcile have no scheduler; both are admin-button only

**Audit:** YCM HOA-billing pipeline audit, Pass B (2026-05-25)

**Production evidence:**
- DB query: 1 active bank_connection for Cherry Hill (`e83552d2-649a-4863-b8a1-087431c949c5`, Chase, status=active), `last_synced_at: null` despite created 2026-05-25 17:19:49Z.
- `SELECT count(*) FROM bank_transactions` → **0** (zero transactions ever synced).
- Plaid webhook hits `/api/webhooks/plaid` (production log shows 2 hits during William's test). Code comment at `server/routes.ts:17994`: *"TRANSACTIONS / SYNC_UPDATES_AVAILABLE is informational — a periodic sync job or admin-triggered POST /api/plaid/sync will consume it."* — **the "periodic sync job" does not exist.**
- Production logs show NO `[plaid][sync]` or `reconcil` lines in the automation sweep.

**What's wired:**
- Sync endpoint: `server/routes.ts:17803-17899` `POST /api/plaid/sync` (admin-gated, manual).
- Reconcile endpoints: `server/routes.ts:17904-17961` (`/api/plaid/reconcile`, `/reconcile/pending`, `/reconcile/manual`).
- Auto-match algo: `server/services/plaid-reconciliation.ts:67-157` `reconcileBankTransactions` — exact-cents amount match, ±3-day date window, tenant-isolated, only matches `referenceType='plaid-pay-intent'` with `settledAt IS NULL`.
- Manual-match: `server/services/plaid-reconciliation.ts:192-261` — ±$1 tolerance, sign check, tenant scope.
- Webhook receiver: `server/routes.ts:17966-18002` — handles ITEM/ERROR and USER_PERMISSION_REVOKED, but TRANSACTIONS/SYNC_UPDATES_AVAILABLE is logged + dropped.

**The gap:**
The Plaid sync + auto-reconcile services are NEVER called from the 5-min automation sweep in `server/index.ts:215-265 runAutomationSweep`. They only fire when an admin clicks a button. For William's "no manual identification" goal, sync must be either webhook-driven (when TRANSACTIONS/SYNC_UPDATES_AVAILABLE fires) or scheduled (e.g., every sweep tick or hourly).

**Recommended dispatch:**
1. In the Plaid webhook handler (`server/routes.ts:17966-18002`), when `webhookCode === "SYNC_UPDATES_AVAILABLE"`, asynchronously call `bankFeedProvider.getTransactions` + upsert to `bank_transactions` + `reconcileBankTransactions(associationId)` for the affected association.
2. Add a `runBankFeedSweep()` task to `runAutomationSweep` that iterates active `bank_connections` and runs sync + reconcile (idempotent; the conflict-do-nothing insert + `isNull(settledAt)` filter make this safe to re-run every sweep).
3. Surface "last_synced_at" prominently in the admin bank-connections page so a stale connection is visible.

**Authorization:** read-only audit. No code changes made.
