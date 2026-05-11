-- Migration 0026 — owner_ledger_entries → bank_transactions reconciliation link
--
-- Bridges Plaid-synced bank transactions to pending owner-payment-intent
-- ledger entries (referenceType='plaid-pay-intent'). On successful match:
--   bank_transaction_id  -> bank_transactions.id (FK)
--   settled_at           -> match timestamp
--
-- Nullable on both — pending entries (or non-bank-paid entries) leave both NULL.
--
-- Lineage:
--   - 2026-05-11 — Issue #448 Plaid bank-tx → ledger reconciliation. Author: [020]
--     per [014] dispatch (queue line 23038, 22:39 CEST).

ALTER TABLE "owner_ledger_entries"
  ADD COLUMN IF NOT EXISTS "bank_transaction_id" varchar
    REFERENCES "bank_transactions"("id") ON DELETE SET NULL;

ALTER TABLE "owner_ledger_entries"
  ADD COLUMN IF NOT EXISTS "settled_at" timestamp;

-- Index supports the unmatched-credit / pending-intent scan in
-- reconcileBankTransactions(): filter by association_id + reference_type
-- where settled_at IS NULL.
CREATE INDEX IF NOT EXISTS "owner_ledger_entries_association_settled_idx"
  ON "owner_ledger_entries" ("association_id", "settled_at")
  WHERE "settled_at" IS NULL;
