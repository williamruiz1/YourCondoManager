\set ON_ERROR_STOP on

DO $$
BEGIN
  IF (SELECT ycm_backfill_owner_ledger_amount_cents(2)) <> 2 THEN
    RAISE EXCEPTION 'first owner-ledger batch was not bounded to 2';
  END IF;
  IF (SELECT ycm_backfill_owner_ledger_amount_cents(2)) <> 1 THEN
    RAISE EXCEPTION 'second owner-ledger batch did not resume at remaining row';
  END IF;
  IF (SELECT ycm_backfill_owner_ledger_amount_cents(2)) <> 0 THEN
    RAISE EXCEPTION 'completed owner-ledger backfill did not return 0';
  END IF;
  IF (SELECT ycm_backfill_payment_webhook_amount_cents(2)) <> 1 THEN
    RAISE EXCEPTION 'webhook backfill did not preserve null event and hydrate amount';
  END IF;
END;
$$;

SELECT ycm_assert_money_cents_compatibility();

-- Old writer: dollars only; trigger must populate cents.
INSERT INTO owner_ledger_entries (id, association_id, amount)
VALUES ('legacy-write', 'a1', 10.25);

-- New writer: cents only; BEFORE trigger must satisfy legacy NOT NULL dollars.
INSERT INTO owner_ledger_entries (id, association_id, amount_cents)
VALUES ('cents-write', 'a1', -999);

DO $$
BEGIN
  IF (SELECT amount_cents FROM owner_ledger_entries WHERE id = 'legacy-write') <> 1025 THEN
    RAISE EXCEPTION 'legacy write did not dual-write cents';
  END IF;
  IF (SELECT round(amount::numeric, 2) FROM owner_ledger_entries WHERE id = 'cents-write') <> -9.99 THEN
    RAISE EXCEPTION 'cents write did not dual-write dollars';
  END IF;
  IF (SELECT amount_cents FROM owner_ledger_entries WHERE id = 'l1') <> 132619 THEN
    RAISE EXCEPTION 'float artifact was not recovered to intended cents';
  END IF;
  IF (SELECT count(*) FROM money_cents_compatibility_drift
       WHERE missing_cents_count <> 0 OR mismatch_count <> 0 OR drift_cents <> 0) <> 0 THEN
    RAISE EXCEPTION 'drift view is not clean';
  END IF;
END;
$$;

-- Mismatched dual values must fail closed without aborting the verification file.
DO $$
BEGIN
  BEGIN
    INSERT INTO owner_ledger_entries (id, association_id, amount, amount_cents)
    VALUES ('bad-write', 'a1', 1.00, 101);
    RAISE EXCEPTION 'mismatched dual write unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'mismatched dual write unexpectedly succeeded' THEN
      RAISE;
    END IF;
  END;
END;
$$;

SELECT ycm_assert_money_cents_compatibility();
