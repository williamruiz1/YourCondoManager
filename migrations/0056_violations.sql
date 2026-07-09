-- 0056_violations.sql
--
-- founder-os#9487 — Board mode "log a violation" wizard backend.
--
-- Adds a lean `violations` table so a volunteer HOA board can record a rule
-- violation against a unit/owner (trash bins, parking, noise, pets,
-- architectural, etc.), optionally with a fine. Additive + idempotent — safe to
-- run on a live DB; creates nothing else and touches no existing table.
--
-- Fine linkage: when the wizard posts a fine, it creates a separate
-- owner-ledger `charge` entry and stores that entry's id in `ledger_entry_id`.

CREATE TYPE "violation_status" AS ENUM ('open', 'notice-sent', 'cured', 'escalated', 'closed');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "violations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"association_id" varchar NOT NULL REFERENCES "associations"("id"),
	"unit_id" varchar REFERENCES "units"("id"),
	"person_id" varchar REFERENCES "persons"("id"),
	"violation_type" text NOT NULL,
	"description" text NOT NULL,
	"observed_at" timestamp DEFAULT now() NOT NULL,
	"status" "violation_status" DEFAULT 'open' NOT NULL,
	"fine_amount" real,
	"ledger_entry_id" varchar,
	"logged_by_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "violations_association_idx" ON "violations" ("association_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "violations_unit_idx" ON "violations" ("unit_id");
