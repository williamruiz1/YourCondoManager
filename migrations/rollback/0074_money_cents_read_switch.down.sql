-- Operational rollback for Release B. Deploy the Release A application before
-- running this file so reads return to legacy dollars. This changes nullability
-- only; it does not rewrite, delete, or synthesize any financial amount.
ALTER TABLE owner_ledger_entries
  ALTER COLUMN amount_cents DROP NOT NULL;
