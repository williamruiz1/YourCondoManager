-- 0067_fee_matrix_topology_fix.sql
--
-- Follow-up to 0066 (CT convenience-fee structure), 2026-07-14. Two
-- corrections from William (voice):
--
--   1. STRIPE TOPOLOGY FIX: Cherry Hill Court Condominiums has an ACTIVE
--      Stripe Connect sub-merchant (verified live in prod:
--      payment_gateway_connections.provider_account_id = acct_1TnzDnArorHrelxs,
--      status active) — 0066's "single Stripe account" assumption was wrong.
--      Adds `settlement_method` (how the fee's money actually moved —
--      'connect_application_fee' via Stripe's application_fee_amount, or
--      'accounting_only') and `idempotency_key` (a generic dedup key
--      replacing stripe_payment_intent_id as the unique target, so a
--      non-Stripe manual fee can dedupe too) to platform_processing_fees.
--
--   2. CASH/CHECK MANUAL-PROCESSING FEE: William's policy — a cash/check
--      payment carries a flat platform manual-processing fee (the
--      treasurer's manual handling work is a real platform cost), same
--      separation principle as the card fee. Adds `manual_fee_enabled` /
--      `manual_fee_cents` to association_fee_settings, `manual_processing`
--      to the fee-type enum, and `status`/`collected_at` to
--      platform_processing_fees (a manual fee is 'owed' until the
--      treasurer collects it with the owner's next payment or directly;
--      a card fee is 'collected' immediately — same Stripe charge).
--
-- Purely additive — no DROP/ALTER TYPE/RENAME against any existing money
-- table. platform_processing_fees has ZERO rows in production as of this
-- migration (verified live), so swapping the unique-index target from
-- stripe_payment_intent_id to idempotency_key is a no-op backfill-wise.
-- Safe under scripts/check-money-migrations.cjs without a
-- [money-migration-reviewed] marker.

ALTER TABLE "association_fee_settings" ADD COLUMN IF NOT EXISTS "manual_fee_enabled" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "association_fee_settings" ADD COLUMN IF NOT EXISTS "manual_fee_cents" integer DEFAULT 500 NOT NULL;
--> statement-breakpoint

ALTER TABLE "platform_processing_fee_type" ADD VALUE IF NOT EXISTS 'manual_processing';
--> statement-breakpoint

DO $$ BEGIN
 CREATE TYPE "platform_processing_fee_status" AS ENUM ('owed', 'collected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

ALTER TABLE "platform_processing_fees" ADD COLUMN IF NOT EXISTS "status" "platform_processing_fee_status" DEFAULT 'collected' NOT NULL;
--> statement-breakpoint
ALTER TABLE "platform_processing_fees" ADD COLUMN IF NOT EXISTS "collected_at" timestamp;
--> statement-breakpoint
ALTER TABLE "platform_processing_fees" ADD COLUMN IF NOT EXISTS "settlement_method" text DEFAULT 'accounting_only' NOT NULL;
--> statement-breakpoint
ALTER TABLE "platform_processing_fees" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
--> statement-breakpoint

-- Backfill (no-op today — table has 0 rows in production, verified live —
-- but correct to run in case a later environment already has card-fee rows
-- from the 0066 window before this migration lands).
UPDATE "platform_processing_fees" SET "idempotency_key" = "stripe_payment_intent_id" WHERE "idempotency_key" IS NULL AND "stripe_payment_intent_id" IS NOT NULL;
--> statement-breakpoint

DROP INDEX IF EXISTS "platform_processing_fees_payment_intent_uq";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_processing_fees_idempotency_key_uq" ON "platform_processing_fees" ("idempotency_key") WHERE "idempotency_key" is not null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_processing_fees_status_idx" ON "platform_processing_fees" ("association_id","person_id","status");
