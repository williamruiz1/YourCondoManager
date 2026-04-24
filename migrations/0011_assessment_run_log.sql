-- Migration: 0011 — Assessment run log (Wave 7, 4.3 Q3)
-- Spec: docs/projects/platform-overhaul/decisions/4.3-recurring-assessment-rules-engine.md
--   Q3 — unified assessment execution orchestrator. This table is the canonical
--   audit trail written by the orchestrator (server/assessment-execution.ts)
--   for both recurring charges and special assessments.
--
-- Purely additive. Enums are created with DO-blocks so the migration is
-- idempotent against prior partial applies.

-- ---------------------------------------------------------------------------
-- 1. New enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "assessment_rule_type_enum" AS ENUM (
    'recurring',
    'special-assessment'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "assessment_run_status_enum" AS ENUM (
    'success',
    'failed',
    'retrying',
    'skipped',
    'deferred'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- 2. assessment_run_log table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "assessment_run_log" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "association_id" varchar NOT NULL REFERENCES "associations"("id"),
  "rule_type" "assessment_rule_type_enum" NOT NULL,
  "rule_id" varchar NOT NULL,
  "unit_id" varchar,
  "run_started_at" timestamp NOT NULL DEFAULT now(),
  "run_completed_at" timestamp,
  "status" "assessment_run_status_enum" NOT NULL,
  "amount" real,
  "ledger_entry_id" varchar,
  "error_code" text,
  "error_message" text,
  "retry_attempt" integer NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "assessment_run_log_association_idx"
  ON "assessment_run_log" ("association_id");

CREATE INDEX IF NOT EXISTS "assessment_run_log_rule_idx"
  ON "assessment_run_log" ("rule_type", "rule_id");

CREATE INDEX IF NOT EXISTS "assessment_run_log_started_at_idx"
  ON "assessment_run_log" ("run_started_at");
