-- 0066_convenience_fee_structure.sql
--
-- CT-legal convenience-fee structure (founder-os
-- wiki/research/chc-processing-fee-legality-2026-07-14.md §6), 2026-07-14.
--
-- WHY: a card-payment processing fee must be charged AND KEPT BY THE
-- PLATFORM (YCM as an independent third-party processor), never set,
-- collected, or received by the association. Adds:
--   1. Two columns on payment_transactions (platform_fee_cents,
--      checkout_method) — additive, default 0 / NULL, byte-identical for
--      every existing row and every read path that doesn't know about them.
--   2. association_fee_settings — per-association fee config, one row per
--      association, card_fee_enabled defaults to 0 (OFF) so the feature is
--      fully inert until an association's row is explicitly turned on
--      (mirrors server/services/multi-party-connect/flag.ts's
--      default-off-is-byte-identical philosophy).
--   3. platform_processing_fees — the platform-revenue record. STRUCTURALLY
--      SEPARATE from owner_ledger_entries: the association's ledger never
--      contains a fee row, and this table never contains an assessment row.
--
-- Purely additive — no DROP/ALTER TYPE/RENAME against any existing money
-- table (owner_ledger_entries, payment_transactions). Safe under
-- scripts/check-money-migrations.cjs without a [money-migration-reviewed]
-- marker.

ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "platform_fee_cents" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "checkout_method" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "association_fee_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL REFERENCES "associations"("id"),
	"card_fee_enabled" integer DEFAULT 0 NOT NULL,
	"card_fee_percent_bps" integer DEFAULT 290 NOT NULL,
	"card_fee_fixed_cents" integer DEFAULT 30 NOT NULL,
	"ach_fee_cents" integer DEFAULT 0 NOT NULL,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "association_fee_settings_association_uq" ON "association_fee_settings" ("association_id");
--> statement-breakpoint
CREATE TYPE "platform_processing_fee_type" AS ENUM ('card_processing', 'ach');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_processing_fees" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL REFERENCES "associations"("id"),
	"payment_transaction_id" varchar REFERENCES "payment_transactions"("id"),
	"unit_id" varchar REFERENCES "units"("id"),
	"person_id" varchar REFERENCES "persons"("id"),
	"fee_type" "platform_processing_fee_type" DEFAULT 'card_processing' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"stripe_payment_intent_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_processing_fees_payment_intent_uq" ON "platform_processing_fees" ("stripe_payment_intent_id") WHERE "stripe_payment_intent_id" is not null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_processing_fees_association_idx" ON "platform_processing_fees" ("association_id","created_at");
