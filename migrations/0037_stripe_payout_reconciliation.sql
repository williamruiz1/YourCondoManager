-- Migration 0037 — Stripe Connect payout reconciliation (founder-os#970 / dispatch #3).
--
-- Canonical spec: wiki/products/ycm/stripe-connect-spec.md §4 (reconciliation
-- flow payout → HOA books) + §7.3.
--
-- When Stripe sends a daily payout to a HOA's bank, the platform `payout.paid`
-- webhook explodes the batch back into one ledger entry per owner who paid that
-- day so the HOA's books match the bank deposit exactly (zero variance). These
-- two ADDITIVE tables persist the payout↔charge↔ledger linkage that powers:
--   1. the admin reconciliation report (per HOA → per payout → owner breakdown)
--   2. the AR-aging reconciled/unreconciled filter
--
-- The core `owner_ledger_entries` table is intentionally NOT modified — a
-- payment ledger entry is "reconciled" iff a stripe_payout_items row references
-- it (derived via join). Migration is purely additive (CREATE TABLE IF NOT
-- EXISTS + indexes); no destructive changes, fully reversible.
--
-- Note on migration number: 0036 was pressing_items (PR #185). 0037 is the
-- next free slot.

CREATE TABLE IF NOT EXISTS "stripe_payouts" (
  "id"                    varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "association_id"        varchar NOT NULL REFERENCES "associations"("id"),
  "connected_account_id"  text,
  "payout_id"             text NOT NULL,
  "key_mode"              text,
  "status"                text NOT NULL DEFAULT 'paid',
  "amount_cents"          integer NOT NULL DEFAULT 0,
  "gross_amount_cents"    integer NOT NULL DEFAULT 0,
  "fee_amount_cents"      integer NOT NULL DEFAULT 0,
  "currency"              text NOT NULL DEFAULT 'usd',
  "charge_count"          integer NOT NULL DEFAULT 0,
  "arrival_date"          timestamp,
  "reconciled_at"         timestamp,
  "raw_payload_json"      jsonb,
  "created_at"            timestamp NOT NULL DEFAULT NOW(),
  "updated_at"            timestamp NOT NULL DEFAULT NOW()
);

-- One payout per (connected account, payout id). The webhook upserts on this
-- key so retries are idempotent at the header level.
CREATE UNIQUE INDEX IF NOT EXISTS "stripe_payouts_account_payout_uq"
  ON "stripe_payouts" ("connected_account_id", "payout_id");

-- Report lookup: payouts for a HOA, newest arrival first.
CREATE INDEX IF NOT EXISTS "stripe_payouts_association_idx"
  ON "stripe_payouts" ("association_id", "arrival_date");

CREATE TABLE IF NOT EXISTS "stripe_payout_items" (
  "id"                    varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "payout_recon_id"       varchar NOT NULL REFERENCES "stripe_payouts"("id"),
  "association_id"        varchar NOT NULL REFERENCES "associations"("id"),
  "charge_id"             text NOT NULL,
  "payment_intent_id"     text,
  "owner_ledger_entry_id" varchar REFERENCES "owner_ledger_entries"("id"),
  "owner_id"              varchar,
  "unit_id"               varchar,
  "owner_name"            text,
  "unit_label"            text,
  "charge_type"           text,
  "gross_amount_cents"    integer NOT NULL DEFAULT 0,
  "fee_amount_cents"      integer NOT NULL DEFAULT 0,
  "net_amount_cents"      integer NOT NULL DEFAULT 0,
  "created_at"            timestamp NOT NULL DEFAULT NOW()
);

-- One charge per payout. The webhook upserts on this key so retries don't
-- create duplicate per-owner breakdown rows.
CREATE UNIQUE INDEX IF NOT EXISTS "stripe_payout_items_payout_charge_uq"
  ON "stripe_payout_items" ("payout_recon_id", "charge_id");

-- Reverse lookups: "is this charge reconciled?" + "which payout settled this
-- ledger entry?" (AR-aging reconciled/unreconciled filter).
CREATE INDEX IF NOT EXISTS "stripe_payout_items_charge_idx"
  ON "stripe_payout_items" ("charge_id");
CREATE INDEX IF NOT EXISTS "stripe_payout_items_ledger_idx"
  ON "stripe_payout_items" ("owner_ledger_entry_id");
