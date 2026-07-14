-- scripts/audit-duplicate-payment-credits.sql — READ-ONLY audit query
-- (founder-os#10737, A-WEBHOOK-001/002 companion).
--
-- Run this against production BEFORE and/or AFTER deploying
-- migrations/0062_ledger_payment_identity.sql to see whether the historical
-- backfill+dedupe step in that migration found evidence of a REAL pre-existing
-- double-credit (i.e. the exact bug A-WEBHOOK-001/002 describes already
-- happened on Cherry Hill's live books before this fix shipped).
--
-- This is READ-ONLY. It does not modify any row. If it returns rows, that is
-- a signal for William to review manually (and, if confirmed, correct via an
-- explicit, reviewed adjustment entry — never a silent migration).
--
-- Usage:
--   flyctl ssh console -a yourcondomanager -C \
--     "psql \$DATABASE_URL -f scripts/audit-duplicate-payment-credits.sql"
-- or paste directly into a psql session against DATABASE_URL.

-- 1. Groups where the SAME payment_intent id would have collided across the
--    three write paths (payment-webhook / autopay_payment_transaction /
--    stripe_charge) — reconstructed from the sibling tables that already
--    stored the Stripe identifiers BEFORE this migration existed. A group
--    with count > 1 here is direct evidence of a historical double-credit.
WITH reconstructed AS (
  SELECT
    e.id,
    e.association_id,
    e.unit_id,
    e.entry_type,
    e.amount,
    e.posted_at,
    e.reference_type,
    e.reference_id,
    COALESCE(
      CASE WHEN e.reference_type = 'payment-webhook' THEN w.gateway_reference END,
      CASE WHEN e.reference_type = 'autopay_payment_transaction' THEN t.provider_intent_id END
    ) AS reconstructed_payment_intent
  FROM owner_ledger_entries e
  LEFT JOIN payment_webhook_events w
    ON e.reference_type = 'payment-webhook' AND e.reference_id = w.id
  LEFT JOIN payment_transactions t
    ON e.reference_type = 'autopay_payment_transaction' AND e.reference_id = t.id
  WHERE e.entry_type = 'payment'
)
SELECT
  association_id,
  reconstructed_payment_intent,
  count(*) AS credit_count,
  sum(amount) AS total_amount,
  array_agg(id ORDER BY posted_at) AS ledger_entry_ids,
  array_agg(reference_type ORDER BY posted_at) AS reference_types,
  array_agg(posted_at ORDER BY posted_at) AS posted_ats
FROM reconstructed
WHERE reconstructed_payment_intent IS NOT NULL
GROUP BY association_id, reconstructed_payment_intent
HAVING count(*) > 1
ORDER BY credit_count DESC, association_id;

-- 2. Sanity check — how many rows the migration's backfill actually populated
--    vs. left NULL (stripe_charge rows have no historical PI captured, so a
--    meaningful fraction of NULLs there is expected, not a bug).
SELECT
  reference_type,
  count(*) AS total_rows,
  count(payment_identity_key) AS backfilled_rows,
  count(*) - count(payment_identity_key) AS null_rows
FROM owner_ledger_entries
WHERE entry_type = 'payment'
GROUP BY reference_type
ORDER BY reference_type;
