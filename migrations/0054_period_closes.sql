-- Migration 0054 — period_closes: treasurer month-close attestation table
-- (YCM#220 / production-readiness P2-5).
--
-- A treasurer closes the books monthly: confirm bank transactions are matched,
-- flag stragglers, and lock the period with an audited attestation. Before this
-- table, reconciliation was transaction-by-transaction and "is June fully
-- reconciled?" had no answer in the product.
--
-- ONE row per (association_id, period_month). `period_month` is 'YYYY-MM'
-- (e.g. '2026-06'). `status` toggles 'closed' → 'reopened' — re-opening is an
-- explicit, audit-logged action. The matched/unmatched counts are a SNAPSHOT
-- captured at close time (the live reconciliation report remains the source of
-- truth for current state). "Is June closed?" = a status='closed' row for
-- (assoc, '2026-06').
--
-- ATTESTATION ONLY — this table does NOT lock ledger writes retroactively.
-- Full period-locking of postings is a larger design question, explicitly OUT
-- of scope; the attestation record is the deliverable. The forensic
-- close/reopen history lives in audit_logs.
--
-- Naming: YCM uses association_id VARCHAR referencing associations(id).
-- Migration number: 0051 (disbursement_dual_approval) is the last journal
-- entry; 0054 is the next free slot.

CREATE TABLE IF NOT EXISTS "period_closes" (
  "id"                          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "association_id"              varchar NOT NULL REFERENCES "associations"("id"),
  "period_month"                text NOT NULL,
  "status"                      text NOT NULL DEFAULT 'closed',
  "matched_count"               integer NOT NULL DEFAULT 0,
  "unmatched_bank_tx_count"     integer NOT NULL DEFAULT 0,
  "unmatched_ledger_entry_count" integer NOT NULL DEFAULT 0,
  "closed_by_user_id"           text NOT NULL,
  "closed_by_email"             text NOT NULL,
  "closed_at"                   timestamp NOT NULL DEFAULT NOW(),
  "reopened_by_user_id"         text,
  "reopened_by_email"           text,
  "reopened_at"                 timestamp,
  "notes"                       text,
  CONSTRAINT "period_closes_assoc_month_uniq"
    UNIQUE ("association_id", "period_month")
);

-- Lookup index: the reconciliation UI queries by (association_id, period_month)
-- to answer "is this month closed?".
CREATE INDEX IF NOT EXISTS "period_closes_assoc_idx"
  ON "period_closes" ("association_id", "period_month");
