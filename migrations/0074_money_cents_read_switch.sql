-- Release B of the owner-ledger money expand/contract rollout.
--
-- Preconditions: Release A backfill and the 24-hour zero-drift observation
-- have passed. This release validates both compatibility constraints and makes
-- owner_ledger_entries.amount_cents mandatory. Legacy dollar columns and the
-- compatibility triggers remain for rolling-deployment and rollback safety.
-- No historical amount or protected balance is rewritten.

SELECT ycm_assert_money_cents_compatibility();
--> statement-breakpoint

ALTER TABLE owner_ledger_entries
  VALIDATE CONSTRAINT owner_ledger_entries_amount_compat_ck;
--> statement-breakpoint

ALTER TABLE payment_webhook_events
  VALIDATE CONSTRAINT payment_webhook_events_amount_compat_ck;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM owner_ledger_entries WHERE amount_cents IS NULL) THEN
    RAISE EXCEPTION 'owner ledger amount_cents contains null values';
  END IF;
END;
$$;
--> statement-breakpoint

ALTER TABLE owner_ledger_entries
  ALTER COLUMN amount_cents SET NOT NULL;
--> statement-breakpoint

SELECT ycm_assert_money_cents_compatibility();
