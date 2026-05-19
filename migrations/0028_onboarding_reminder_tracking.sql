-- Migration 0028 — onboarding_progress: per-day reminder-sent tracking
--
-- Child C of founder-os#1327 (#1617). The Day 7/10/12/13/14 reminder
-- cadence runs from the existing setInterval automation sweep. Each row
-- holds the timestamp of the last send for each day-N nudge so the sweep
-- is idempotent (a slow sweep tick can't double-send; a restart can't
-- replay yesterday's reminders).
--
-- A NULL timestamp = "this day-N reminder hasn't been sent for this
-- admin's wizard yet". The sweep WHERE clause filters on NULL.
--
-- Lineage:
--   - 2026-05-19 — Issue #1617 onboarding wizard Child C (Step 5 mass comm +
--     Day 7/10/12/13/14 reminder cadence + GA4). Sibling table holding
--     identical primary key (admin_user_id) avoids a join in the sweep.

ALTER TABLE "onboarding_progress"
  ADD COLUMN IF NOT EXISTS "day7_reminder_sent_at"  timestamp,
  ADD COLUMN IF NOT EXISTS "day10_reminder_sent_at" timestamp,
  ADD COLUMN IF NOT EXISTS "day12_reminder_sent_at" timestamp,
  ADD COLUMN IF NOT EXISTS "day13_reminder_sent_at" timestamp,
  ADD COLUMN IF NOT EXISTS "day14_reminder_sent_at" timestamp;

-- Sweep query: wizards started > N days ago, not yet completed, day-N
-- reminder unsent. Index supports the WHERE-clause scan across days 7-14.
CREATE INDEX IF NOT EXISTS "onboarding_progress_reminder_sweep_idx"
  ON "onboarding_progress" ("wizard_started_at", "wizard_completed_at")
  WHERE "wizard_completed_at" IS NULL;
