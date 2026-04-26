-- Migration: 0018 — Hub visibility rename, HV-3 (drop old enum values).
-- Spec: docs/projects/platform-overhaul/decisions/1.5-hub-visibility-rename.md
--   HV-3 — drop the legacy role-coupled vocabulary
--   (`resident | owner | board | admin`) from `hub_visibility_level`. The
--   `public` literal is preserved verbatim (public-API safe).
--
-- Production audit (Phase 8a.0, 2026-04-24):
--   * `hub_map_issues.visibility_level` ........... 0 rows
--   * `community_announcements.visibility_level` .. 5 rows, all NULL
--   No on-the-wire data on the old vocab; no data migration is required.
--
-- Soak: HV-2 shipped 2026-04-25; HV-3 ships 2026-04-26 (1 day) — early-ship
-- authorized by the founder despite the recommended 2-week soak window
-- because the prod-data audit shows the soak was a defense against in-flight
-- writes during the rename, and there are no such writes to defend against.
--
-- Pattern (Postgres has no `ALTER TYPE … DROP VALUE`):
--   1. Defensive backfill on both columns in case any pre-cutover write
--      raced past HV-2 with the old vocab.
--   2. Drop the column default that pins the enum to old vocab.
--   3. Rename the existing type to `_old`, recreate it with only the
--      5 new values, and re-cast the column.
--   4. Restore the column default in new vocab (`board-only`).
--   5. Add a CHECK constraint to `community_announcements.visibility_level`
--      (text, not enum-bound) so it is restricted to new vocab going forward.
--   6. Drop the old type.

-- 1. Defensive backfill (idempotent: zero rows expected per the audit).
UPDATE "hub_map_issues" SET "visibility_level" = 'residents' WHERE "visibility_level" = 'resident';
--> statement-breakpoint
UPDATE "hub_map_issues" SET "visibility_level" = 'unit-owners' WHERE "visibility_level" = 'owner';
--> statement-breakpoint
UPDATE "hub_map_issues" SET "visibility_level" = 'board-only' WHERE "visibility_level" = 'board';
--> statement-breakpoint
UPDATE "hub_map_issues" SET "visibility_level" = 'operator-only' WHERE "visibility_level" = 'admin';
--> statement-breakpoint

UPDATE "community_announcements" SET "visibility_level" = 'residents' WHERE "visibility_level" = 'resident';
--> statement-breakpoint
UPDATE "community_announcements" SET "visibility_level" = 'unit-owners' WHERE "visibility_level" = 'owner';
--> statement-breakpoint
UPDATE "community_announcements" SET "visibility_level" = 'board-only' WHERE "visibility_level" = 'board';
--> statement-breakpoint
UPDATE "community_announcements" SET "visibility_level" = 'operator-only' WHERE "visibility_level" = 'admin';
--> statement-breakpoint

-- 2. Drop the column default — the default value `'board'` references the
--    old enum value and would block the type recast.
ALTER TABLE "hub_map_issues" ALTER COLUMN "visibility_level" DROP DEFAULT;
--> statement-breakpoint

-- 3. Rename the existing type and recreate it with only new vocab.
ALTER TYPE "hub_visibility_level" RENAME TO "hub_visibility_level_old";
--> statement-breakpoint
CREATE TYPE "hub_visibility_level" AS ENUM ('public', 'residents', 'unit-owners', 'board-only', 'operator-only');
--> statement-breakpoint

-- 4. Re-cast the column to the new type and restore the default in new vocab.
ALTER TABLE "hub_map_issues"
  ALTER COLUMN "visibility_level" TYPE "hub_visibility_level"
  USING "visibility_level"::text::"hub_visibility_level";
--> statement-breakpoint
ALTER TABLE "hub_map_issues" ALTER COLUMN "visibility_level" SET DEFAULT 'board-only';
--> statement-breakpoint

-- 5. `community_announcements.visibility_level` is plain text (NOT enum-bound)
--    and nullable. Constrain it to the new vocab via CHECK.
ALTER TABLE "community_announcements"
  ADD CONSTRAINT "community_announcements_visibility_level_check"
  CHECK ("visibility_level" IS NULL OR "visibility_level" IN ('public', 'residents', 'unit-owners', 'board-only', 'operator-only'));
--> statement-breakpoint

-- 6. Drop the now-unused legacy type.
DROP TYPE "hub_visibility_level_old";
