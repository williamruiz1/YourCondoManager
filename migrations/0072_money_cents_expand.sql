-- Release A of the expand/contract money migration.
--
-- This migration is ADDITIVE. It keeps the legacy dollar columns, adds exact
-- integer-cent mirrors, and installs one database compatibility control for old
-- and new writers. No protected balance is created or changed by this release.
-- The application must not switch reads to cents until the restartable backfill,
-- reconciliation assertion, and 24-hour zero-drift observation window pass.

ALTER TABLE owner_ledger_entries
  ADD COLUMN IF NOT EXISTS amount_cents integer;
--> statement-breakpoint

ALTER TABLE payment_webhook_events
  ADD COLUMN IF NOT EXISTS amount_cents integer;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION ycm_sync_money_compat_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  amount_changed boolean;
  cents_changed boolean;
  converted_cents bigint;
BEGIN
  amount_changed := TG_OP = 'INSERT' OR NEW.amount IS DISTINCT FROM OLD.amount;
  cents_changed := TG_OP = 'INSERT' OR NEW.amount_cents IS DISTINCT FROM OLD.amount_cents;

  IF NEW.amount IS NOT NULL THEN
    converted_cents := round(NEW.amount::numeric * 100)::bigint;
    IF abs(converted_cents) > 2147483647 THEN
      RAISE EXCEPTION '% amount exceeds integer-cent range', TG_TABLE_NAME;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.amount_cents IS NULL AND NEW.amount IS NOT NULL THEN
      NEW.amount_cents := converted_cents::integer;
    ELSIF NEW.amount IS NULL AND NEW.amount_cents IS NOT NULL THEN
      NEW.amount := NEW.amount_cents::numeric / 100;
    ELSIF NEW.amount IS NOT NULL AND NEW.amount_cents IS NOT NULL
      AND NEW.amount_cents::bigint <> converted_cents THEN
      RAISE EXCEPTION '% amount/amount_cents mismatch (% dollars, % cents)',
        TG_TABLE_NAME, NEW.amount, NEW.amount_cents;
    END IF;
    RETURN NEW;
  END IF;

  IF amount_changed AND cents_changed THEN
    IF (NEW.amount IS NULL) <> (NEW.amount_cents IS NULL) THEN
      RAISE EXCEPTION '% amount/amount_cents nullability mismatch', TG_TABLE_NAME;
    END IF;
    IF NEW.amount IS NOT NULL AND NEW.amount_cents::bigint <> converted_cents THEN
      RAISE EXCEPTION '% amount/amount_cents mismatch (% dollars, % cents)',
        TG_TABLE_NAME, NEW.amount, NEW.amount_cents;
    END IF;
  ELSIF amount_changed THEN
    NEW.amount_cents := CASE
      WHEN NEW.amount IS NULL THEN NULL
      ELSE converted_cents::integer
    END;
  ELSIF cents_changed THEN
    NEW.amount := CASE
      WHEN NEW.amount_cents IS NULL THEN NULL
      ELSE NEW.amount_cents::numeric / 100
    END;
  ELSIF NEW.amount_cents IS NULL AND NEW.amount IS NOT NULL THEN
    -- Any ordinary update to a legacy row safely hydrates its cents mirror.
    NEW.amount_cents := converted_cents::integer;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS owner_ledger_entries_money_compat_trg ON owner_ledger_entries;
CREATE TRIGGER owner_ledger_entries_money_compat_trg
BEFORE INSERT OR UPDATE OF amount, amount_cents ON owner_ledger_entries
FOR EACH ROW EXECUTE FUNCTION ycm_sync_money_compat_columns();
--> statement-breakpoint

DROP TRIGGER IF EXISTS payment_webhook_events_money_compat_trg ON payment_webhook_events;
CREATE TRIGGER payment_webhook_events_money_compat_trg
BEFORE INSERT OR UPDATE OF amount, amount_cents ON payment_webhook_events
FOR EACH ROW EXECUTE FUNCTION ycm_sync_money_compat_columns();
--> statement-breakpoint

ALTER TABLE owner_ledger_entries
  DROP CONSTRAINT IF EXISTS owner_ledger_entries_amount_compat_ck;
ALTER TABLE owner_ledger_entries
  ADD CONSTRAINT owner_ledger_entries_amount_compat_ck
  CHECK (amount_cents IS NULL OR amount_cents::bigint = round(amount::numeric * 100)::bigint)
  NOT VALID;
--> statement-breakpoint

ALTER TABLE payment_webhook_events
  DROP CONSTRAINT IF EXISTS payment_webhook_events_amount_compat_ck;
ALTER TABLE payment_webhook_events
  ADD CONSTRAINT payment_webhook_events_amount_compat_ck
  CHECK (
    (amount IS NULL AND amount_cents IS NULL)
    OR (amount IS NOT NULL AND amount_cents::bigint = round(amount::numeric * 100)::bigint)
  ) NOT VALID;
--> statement-breakpoint

-- Restartable, concurrent-safe backfill primitives. Operations calls each
-- function repeatedly until it returns 0; SKIP LOCKED permits safe retry.
CREATE OR REPLACE FUNCTION ycm_backfill_owner_ledger_amount_cents(p_batch_size integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE updated_count integer;
BEGIN
  WITH candidates AS (
    SELECT id
      FROM owner_ledger_entries
     WHERE amount_cents IS NULL
     ORDER BY id
     LIMIT greatest(p_batch_size, 1)
     FOR UPDATE SKIP LOCKED
  )
  UPDATE owner_ledger_entries target
     SET amount_cents = round(target.amount::numeric * 100)::integer
    FROM candidates
   WHERE target.id = candidates.id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION ycm_backfill_payment_webhook_amount_cents(p_batch_size integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE updated_count integer;
BEGIN
  WITH candidates AS (
    SELECT id
      FROM payment_webhook_events
     WHERE amount IS NOT NULL AND amount_cents IS NULL
     ORDER BY id
     LIMIT greatest(p_batch_size, 1)
     FOR UPDATE SKIP LOCKED
  )
  UPDATE payment_webhook_events target
     SET amount_cents = round(target.amount::numeric * 100)::integer
    FROM candidates
   WHERE target.id = candidates.id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE VIEW money_cents_compatibility_drift AS
SELECT
  'owner_ledger_entries'::text AS source,
  association_id,
  count(*)::bigint AS row_count,
  count(*) FILTER (WHERE amount_cents IS NULL)::bigint AS missing_cents_count,
  count(*) FILTER (
    WHERE amount_cents IS NOT NULL
      AND amount_cents::bigint <> round(amount::numeric * 100)::bigint
  )::bigint AS mismatch_count,
  round(sum(amount::numeric) * 100)::bigint AS legacy_total_cents,
  sum(amount_cents)::bigint AS integer_total_cents,
  CASE WHEN count(*) FILTER (WHERE amount_cents IS NULL) = 0
    THEN sum(amount_cents)::bigint - round(sum(amount::numeric) * 100)::bigint
    ELSE NULL
  END AS drift_cents
FROM owner_ledger_entries
GROUP BY association_id
UNION ALL
SELECT
  'payment_webhook_events'::text AS source,
  association_id,
  count(*)::bigint AS row_count,
  count(*) FILTER (WHERE amount IS NOT NULL AND amount_cents IS NULL)::bigint AS missing_cents_count,
  count(*) FILTER (
    WHERE (amount IS NULL) <> (amount_cents IS NULL)
       OR (amount IS NOT NULL AND amount_cents::bigint <> round(amount::numeric * 100)::bigint)
  )::bigint AS mismatch_count,
  round(sum(amount::numeric) * 100)::bigint AS legacy_total_cents,
  sum(amount_cents)::bigint AS integer_total_cents,
  CASE WHEN count(*) FILTER (WHERE amount IS NOT NULL AND amount_cents IS NULL) = 0
    THEN coalesce(sum(amount_cents), 0)::bigint - coalesce(round(sum(amount::numeric) * 100), 0)::bigint
    ELSE NULL
  END AS drift_cents
FROM payment_webhook_events
GROUP BY association_id;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION ycm_assert_money_cents_compatibility()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE bad record;
BEGIN
  FOR bad IN
    SELECT * FROM money_cents_compatibility_drift
     WHERE missing_cents_count <> 0 OR mismatch_count <> 0 OR drift_cents <> 0
  LOOP
    RAISE EXCEPTION 'money cents compatibility failed: source=% association=% missing=% mismatch=% drift=%',
      bad.source, bad.association_id, bad.missing_cents_count, bad.mismatch_count, bad.drift_cents;
  END LOOP;
END;
$$;

