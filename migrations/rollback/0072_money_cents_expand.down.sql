-- Rollback for additive Release A. Run only after the application is confirmed
-- to use the legacy dollar columns. No historical amount is rewritten.
DROP VIEW IF EXISTS money_cents_compatibility_drift;
DROP FUNCTION IF EXISTS ycm_assert_money_cents_compatibility();
DROP FUNCTION IF EXISTS ycm_backfill_owner_ledger_amount_cents(integer);
DROP FUNCTION IF EXISTS ycm_backfill_payment_webhook_amount_cents(integer);
DROP TRIGGER IF EXISTS owner_ledger_entries_money_compat_trg ON owner_ledger_entries;
DROP TRIGGER IF EXISTS payment_webhook_events_money_compat_trg ON payment_webhook_events;
ALTER TABLE owner_ledger_entries DROP CONSTRAINT IF EXISTS owner_ledger_entries_amount_compat_ck;
ALTER TABLE payment_webhook_events DROP CONSTRAINT IF EXISTS payment_webhook_events_amount_compat_ck;
ALTER TABLE owner_ledger_entries DROP COLUMN IF EXISTS amount_cents;
ALTER TABLE payment_webhook_events DROP COLUMN IF EXISTS amount_cents;
DROP FUNCTION IF EXISTS ycm_sync_money_compat_columns();

