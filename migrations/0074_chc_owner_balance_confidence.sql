-- 0067_chc_owner_balance_confidence.sql
--
-- Owner-balance confidence metadata (founder-os#11196 / research #832 §5),
-- 2026-07-14.
--
-- WHY: seed CHC's 18-unit owner balances with per-unit, per-category
-- CONFIDENCE TIERS + audit provenance + the documented 1419/Tillman dispute,
-- surfaced in the owner portal as a "preliminary — under review" state.
--
-- This table is PURELY ADDITIVE DISPLAY METADATA. It NEVER touches the balance
-- of record: the money-of-record lives in "owner_ledger_entries" (signed sum),
-- and that table is not altered here. "owner_balance_confidence" only annotates
-- a unit's balance, per category, with a tier + provenance + an optional
-- documented dispute amount. The owner portal LEFT-JOINs it when rendering the
-- balance card; when a row is absent the card renders exactly as before (fully
-- backward-compatible, fail-open).
--
-- The dispute amount is BOARD-ONLY by default (dispute_visible_to_board_only):
-- the owner-facing API strips it; only board/admin surfaces see it.
--
-- Purely additive — no DROP/ALTER against any existing money table
-- (owner_ledger_entries, payment_transactions). Safe under
-- scripts/check-money-migrations.cjs without a [money-migration-reviewed]
-- marker.

CREATE TYPE "balance_category" AS ENUM ('assessment', 'dues');
--> statement-breakpoint
CREATE TYPE "balance_confidence_tier" AS ENUM ('high', 'medium', 'low', 'disputed');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "owner_balance_confidence" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL REFERENCES "associations"("id"),
	"unit_id" varchar NOT NULL REFERENCES "units"("id"),
	"category" "balance_category" NOT NULL,
	"tier" "balance_confidence_tier" NOT NULL,
	"balance_as_assessed" real,
	"dispute_amount" real,
	"dispute_visible_to_board_only" integer DEFAULT 1 NOT NULL,
	"source_artifact_id" text,
	"prepared_by" text,
	"as_of_date" timestamp,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "owner_balance_confidence_unit_category_uq" ON "owner_balance_confidence" ("unit_id","category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "owner_balance_confidence_assoc_idx" ON "owner_balance_confidence" ("association_id");
