-- Migration 0063 — ledger payment-identity idempotency key + unique constraint
-- (founder-os#10737, audit findings A-WEBHOOK-001 [critical] / A-WEBHOOK-002 [high]).
--
-- WHY: three independent code paths each write a NEGATIVE owner_ledger_entries
-- "payment" row for a succeeded Stripe payment, each with its OWN idempotency
-- namespace keyed on something OTHER than the underlying payment_intent
-- (a webhook-event row id / a paymentTransactions row id / a charge id). A
-- single payment observed via more than one Stripe event (e.g.
-- checkout.session.completed AND payment_intent.succeeded for the SAME PI) or
-- more than one endpoint (the per-HOA payment webhook AND the platform Connect
-- webhook for the SAME charge) passed every existing dedup check independently
-- and posted TWO (or three) ledger credits for the same money. There was also
-- no unique DB constraint at all on owner_ledger_entries — the only guard was
-- a SELECT-then-INSERT, so a concurrent duplicate delivery could double-insert
-- even for the SAME reference (A-WEBHOOK-002).
--
-- FIX: add a nullable `payment_identity_key` column (the canonical Stripe
-- payment_intent id, populated ONLY for 'payment' credit writes made through
-- the new shared writer, server/services/ledger-payment-identity.ts) plus a
-- PARTIAL UNIQUE index on (association_id, entry_type, payment_identity_key)
-- WHERE payment_identity_key IS NOT NULL. Application code now writes via
-- `INSERT ... ON CONFLICT (...) WHERE ... DO NOTHING`, so uniqueness is
-- enforced by Postgres, not a check-then-insert race — this closes both
-- A-WEBHOOK-001 (cross-namespace collision) and A-WEBHOOK-002 (concurrency).
--
-- SAFETY (all steps are ADDITIVE — no existing column is altered/dropped, no
-- ledger ROW is ever updated/deleted, no `amount`/`entry_type`/`posted_at` is
-- ever touched):
--   1. ADD COLUMN (nullable, no default) — every existing row gets NULL.
--   2. BEST-EFFORT BACKFILL — populate the new column ONLY where we can
--      reconstruct the payment_intent id from EXISTING, already-correct
--      sibling data (a plain FK join — never invented/guessed):
--        - 'payment-webhook' rows  <- payment_webhook_events.gateway_reference
--        - 'autopay_payment_transaction' rows <- payment_transactions.provider_intent_id
--        - 'stripe_charge' rows: no historical PI id was ever captured on this
--          write path pre-fix, so these are intentionally left NULL (no
--          retroactive protection for old stripe_charge rows; every NEW
--          stripe_charge write going forward DOES get the key, from the live
--          charge object's payment_intent field).
--   3. HISTORICAL DEDUPE GUARD (required per MONEY-SAFETY note — the unique
--      index below CANNOT be created if the backfill produced any duplicate
--      key within the SAME (association_id, entry_type) — which is EXACTLY
--      the scenario this migration is closing, so duplicates may exist).
--      For each (association_id, entry_type, payment_identity_key) group with
--      more than one row, KEEP the key on the EARLIEST row (by posted_at, then
--      id) and NULL OUT the key on every later row in that group. This ONLY
--      clears the new metadata column on the redundant row(s) — it does NOT
--      delete a row, does NOT change any amount, and does NOT silently
--      "fix" a historical double-credit. If this step neutralizes any group,
--      that is a SIGNAL of a real historical duplicate credit and must be
--      reviewed by William separately (see the companion read-only audit
--      query in the PR description) — this migration only makes the new
--      constraint installable, it never corrects the books.
--   4. CREATE UNIQUE INDEX ... WHERE payment_identity_key IS NOT NULL — the
--      actual constraint. Reversible: `DROP INDEX
--      owner_ledger_entries_payment_identity_uq;` (does not touch data).
--
-- This is a schema change on a LIVE financial table (owner_ledger_entries,
-- Cherry Hill's real ledger) — per the dispatch MONEY-SAFETY note, the
-- ADDITIVE column + index are deploy-eligible once tests pass (they cannot
-- change how any EXISTING row's money was recorded), but William should
-- review the backfill/dedupe step's OUTPUT (via the audit query) before/soon
-- after prod deploy, since a neutralized duplicate group is evidence a real
-- double-credit may already exist in the live books.

-- 1. Additive column.
ALTER TABLE owner_ledger_entries ADD COLUMN IF NOT EXISTS payment_identity_key text;

-- 2a. Backfill from the per-HOA payment-webhook path.
UPDATE owner_ledger_entries e
SET payment_identity_key = w.gateway_reference
FROM payment_webhook_events w
WHERE e.reference_type = 'payment-webhook'
  AND e.reference_id = w.id
  AND w.gateway_reference IS NOT NULL
  AND w.gateway_reference <> ''
  AND e.payment_identity_key IS NULL;

-- 2b. Backfill from the autopay path.
UPDATE owner_ledger_entries e
SET payment_identity_key = t.provider_intent_id
FROM payment_transactions t
WHERE e.reference_type = 'autopay_payment_transaction'
  AND e.reference_id = t.id
  AND t.provider_intent_id IS NOT NULL
  AND t.provider_intent_id <> ''
  AND e.payment_identity_key IS NULL;

-- 3. Historical dedupe guard: null out the key on every row EXCEPT the
--    earliest within each (association_id, entry_type, payment_identity_key)
--    group. Metadata-only — never touches amount/entry_type/posted_at, never
--    deletes a row.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY association_id, entry_type, payment_identity_key
           ORDER BY posted_at ASC, id ASC
         ) AS rn
  FROM owner_ledger_entries
  WHERE payment_identity_key IS NOT NULL
)
UPDATE owner_ledger_entries e
SET payment_identity_key = NULL
FROM ranked r
WHERE e.id = r.id
  AND r.rn > 1;

-- 4. The constraint. Partial so pre-existing / never-backfilled rows (NULL
--    key) are never compared against each other.
CREATE UNIQUE INDEX IF NOT EXISTS owner_ledger_entries_payment_identity_uq
  ON owner_ledger_entries (association_id, entry_type, payment_identity_key)
  WHERE payment_identity_key IS NOT NULL;
