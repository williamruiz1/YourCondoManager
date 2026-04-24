-- Migration: 0010 — Assessment schema extensions (Wave 6)
-- Spec: docs/projects/platform-overhaul/decisions/4.3-recurring-assessment-rules-engine.md
--   Q5 — loan-style detail fields on special_assessments.
--   Q7 — canonical rule model columns (unit scope, grace days, end date) on
--        recurring_charge_schedules; unit_scope_mode on special_assessments.
--
-- This migration is purely additive. No columns are dropped or renamed.
-- Legacy enums (fee_frequency, recurring_charge_frequency) are intentionally
-- retained for this wave — they are retired in Wave 7.

-- ---------------------------------------------------------------------------
-- 1. New enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "assessment_allocation_method" AS ENUM (
    'per-unit-equal',
    'per-sq-ft',
    'per-ownership-share',
    'custom'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "assessment_frequency" AS ENUM (
    'monthly',
    'quarterly',
    'annually',
    'semi-annually',
    'one-time'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "assessment_unit_scope_mode" AS ENUM (
    'all-units',
    'inclusion-list',
    'exclusion-list',
    'unit-type-filter'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- 2. special_assessments — Q5 loan-style detail + Q7 unit scope mode
-- ---------------------------------------------------------------------------
ALTER TABLE "special_assessments"
  ADD COLUMN IF NOT EXISTS "interest_rate_percent" real,
  ADD COLUMN IF NOT EXISTS "term_months" integer,
  ADD COLUMN IF NOT EXISTS "allocation_method" "assessment_allocation_method" NOT NULL DEFAULT 'per-unit-equal',
  ADD COLUMN IF NOT EXISTS "allocation_custom_json" jsonb,
  ADD COLUMN IF NOT EXISTS "payment_options_json" jsonb,
  ADD COLUMN IF NOT EXISTS "unit_scope_mode" "assessment_unit_scope_mode" NOT NULL DEFAULT 'all-units';

-- Backfill unit_scope_mode based on the existing excluded_unit_ids_json.
-- Rows with an empty array remain 'all-units' (the default). Rows with any
-- excluded unit flip to 'exclusion-list' to preserve existing semantics.
UPDATE "special_assessments"
SET "unit_scope_mode" = 'exclusion-list'
WHERE "excluded_unit_ids_json" IS NOT NULL
  AND "excluded_unit_ids_json" <> '[]'::jsonb
  AND "unit_scope_mode" = 'all-units';

-- ---------------------------------------------------------------------------
-- 3. recurring_charge_schedules — Q7 canonical rule model
-- ---------------------------------------------------------------------------
ALTER TABLE "recurring_charge_schedules"
  ADD COLUMN IF NOT EXISTS "unit_scope_mode" "assessment_unit_scope_mode" NOT NULL DEFAULT 'all-units',
  ADD COLUMN IF NOT EXISTS "included_unit_ids_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "unit_type_filter" text,
  ADD COLUMN IF NOT EXISTS "grace_days" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "end_date" timestamp;

-- Backfill unit_scope_mode / included_unit_ids_json from the legacy unit_id
-- column:
--   unit_id IS NULL    -> mode = 'all-units',    included_unit_ids_json = []
--   unit_id IS NOT NULL -> mode = 'inclusion-list', included_unit_ids_json = [unit_id]
UPDATE "recurring_charge_schedules"
SET "unit_scope_mode" = 'inclusion-list',
    "included_unit_ids_json" = jsonb_build_array("unit_id")
WHERE "unit_id" IS NOT NULL
  AND "unit_scope_mode" = 'all-units';
