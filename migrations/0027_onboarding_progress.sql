-- Migration 0027 — onboarding_progress: self-managed Day 0-14 wizard state machine
--
-- One row per admin_user_id who enters the self-managed onboarding wizard.
-- Persists the 7-step state machine across logout/login so a treasurer can
-- pause mid-onboarding and resume on any device.
--
--   current_step           1..7 (matches the spec's step ordering)
--   steps_completed        jsonb array of step numbers marked done
--   steps_skipped          jsonb array of step numbers explicitly deferred
--   association_id         NULL until step 1 binds the admin user to their first association
--   wizard_started_at      timestamp of first /app/onboarding load
--   wizard_target_completion_at  start + 14 days; drives reminder cadence
--   wizard_completed_at    NULL until all required steps complete OR user clicks finish
--   last_activity_at       updated on every step transition for reminder-suppression checks
--
-- Steps mapped per founder-os#1327 spec §Scope:
--   1 Welcome + community details   (required)
--   2 Connect bank (Plaid)           (skippable)
--   3 Upload owner roster (CSV)      (skippable)
--   4 Setup recurring assessments    (skippable)
--   5 Compose mass communication     (skippable)
--   6 Invite board members           (skippable)
--   7 Trial-conversion preview       (required to mark complete; supports "I'll convert at Day 14")
--
-- Lineage:
--   - 2026-05-18 — Issue #1327 self-managed onboarding wizard BUILD (Child A: shell + Steps 1/6/7).
--     Wizard surface is /app/onboarding; spec at wiki/products/ycm/strategy/06-ONBOARDING-FLOWS.md Flow 1.

CREATE TABLE IF NOT EXISTS "onboarding_progress" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "admin_user_id" varchar NOT NULL REFERENCES "admin_users"("id") ON DELETE CASCADE,
  "association_id" varchar REFERENCES "associations"("id") ON DELETE SET NULL,
  "current_step" integer NOT NULL DEFAULT 1,
  "steps_completed" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "steps_skipped" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "wizard_started_at" timestamp NOT NULL DEFAULT NOW(),
  "wizard_target_completion_at" timestamp NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  "wizard_completed_at" timestamp,
  "last_activity_at" timestamp NOT NULL DEFAULT NOW(),
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW()
);

-- One wizard row per admin user. Re-entry hits the same row, never duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_progress_admin_user_uq"
  ON "onboarding_progress" ("admin_user_id");

-- Reminder-cadence sweep: scheduled job pulls incomplete wizards where
-- last_activity_at is older than the reminder threshold and dispatches Day 7/10/12/13/14
-- nudges. Index supports the WHERE-clause scan.
CREATE INDEX IF NOT EXISTS "onboarding_progress_incomplete_idx"
  ON "onboarding_progress" ("wizard_completed_at", "last_activity_at")
  WHERE "wizard_completed_at" IS NULL;
