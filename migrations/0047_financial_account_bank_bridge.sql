-- Migration 0047 — Bank-account → Chart-of-Accounts bridge
--
-- Lets a linked Plaid bank account surface in the Chart of Accounts
-- (financial_accounts, what /app/financial/foundation renders) as a
-- balance-synced asset/bank row, alongside the existing hand-entered rows.
--
-- Three additive, idempotent columns on financial_accounts + one unique index:
--   source                  — 'manual' (default; every pre-existing row) vs 'plaid'
--                             (mirrored from a linked bank). A 'plaid' row is owned
--                             by its bank connection: read-only in the COA UI.
--   linked_bank_account_id  — FK to bank_accounts.id; set only when source='plaid'.
--                             The bridge upserts keyed on this column, so re-linking
--                             or re-syncing never creates duplicates.
--   current_balance_cents   — synced balance for a linked row (cents). Null for
--                             manual rows (they don't carry a balance today).
--
-- Forward-only. No destructive DDL, no data backfill — existing rows default to
-- source='manual' and remain untouched. The unique index permits many NULLs, so
-- manual rows never collide on the conflict target.

ALTER TABLE "financial_accounts" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'manual';--> statement-breakpoint

ALTER TABLE "financial_accounts" ADD COLUMN IF NOT EXISTS "linked_bank_account_id" varchar;--> statement-breakpoint

ALTER TABLE "financial_accounts" ADD COLUMN IF NOT EXISTS "current_balance_cents" integer;--> statement-breakpoint

-- FK to bank_accounts (guarded — added only if not already present).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'financial_accounts_linked_bank_account_id_bank_accounts_id_fk'
      AND table_name = 'financial_accounts'
  ) THEN
    ALTER TABLE "financial_accounts"
      ADD CONSTRAINT "financial_accounts_linked_bank_account_id_bank_accounts_id_fk"
      FOREIGN KEY ("linked_bank_account_id") REFERENCES "bank_accounts"("id");
  END IF;
END $$;--> statement-breakpoint

-- One COA row per linked bank account — the upsert conflict target for the
-- bridge. Postgres allows many NULLs, so manual rows never collide.
CREATE UNIQUE INDEX IF NOT EXISTS "financial_accounts_linked_bank_account_uq"
  ON "financial_accounts" ("linked_bank_account_id");
