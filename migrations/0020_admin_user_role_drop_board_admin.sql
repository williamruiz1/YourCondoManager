-- Wave 40 — drop the legacy 'board-admin' value from `admin_user_role`.
--
-- Spec: docs/projects/platform-overhaul/decisions/2.1-role-model-audit.md
--   Q5 follow-up — enum-side cleanup. Wave 38 (PR #70) backfilled the 1 prod
--   row that still carried `'board-admin'` (per the prod audit) and retired
--   `normalizeAdminRole`. Application code no longer emits or accepts the
--   legacy value. The Postgres enum type itself was never DROP VALUE'd
--   (it was created in `0000_silent_mentor.sql` and not removed in
--   `0006_role_rename_board_admin.sql`); this migration removes it from
--   the enum so the schema source-of-truth aligns with the runtime TS
--   `adminUserRoleEnum` (`shared/schema.ts`) and prevents any future
--   write of the legacy value via direct SQL.
--
-- Pattern (Postgres has no `ALTER TYPE … DROP VALUE`):
--   1. Defensive backfill — no-op in prod (Wave 38 already migrated the
--      single residual row), but catches any rows snuck in via direct SQL
--      since. Mirror the same split-criterion `0019` used: self-managed →
--      `board-officer`, residual → `assisted-board`. Step 1 below is the
--      simpler residual-only fallback (the self-managed path is identical
--      to `0019` and would be redundant on a zero-row population).
--   2. Drop the column default that pins the enum to the old type.
--   3. Rename the existing type out of the way, recreate it with the six
--      canonical values, and re-cast both columns that reference it
--      (`admin_users.role`, `permission_change_logs.old_role`,
--      `permission_change_logs.new_role`).
--   4. Restore the column default (`'viewer'`, per `0000_silent_mentor.sql`
--      line 118).
--   5. Drop the now-unused legacy type.
--
-- References:
--   * `migrations/0014_portal_role_collapse.sql` — same pattern for
--     `portal_access_role`.
--   * `migrations/0018_hub_visibility_rename_drop_old.sql` — same pattern
--     for `hub_visibility_level`.
--
-- Forward-only: this migration does not re-introduce `'board-admin'`.

-- 1. Defensive backfill (idempotent: zero rows expected per Wave 38 audit).
UPDATE "admin_users" SET "role" = 'assisted-board' WHERE "role" = 'board-admin';
--> statement-breakpoint
UPDATE "permission_change_logs" SET "old_role" = 'assisted-board' WHERE "old_role" = 'board-admin';
--> statement-breakpoint
UPDATE "permission_change_logs" SET "new_role" = 'assisted-board' WHERE "new_role" = 'board-admin';
--> statement-breakpoint

-- 2. Drop the default that references the old enum type.
ALTER TABLE "admin_users" ALTER COLUMN "role" DROP DEFAULT;
--> statement-breakpoint

-- 3. Rename the old enum out of the way and recreate with the six canonical
--    values (matches `shared/schema.ts:166` `adminUserRoleEnum`).
ALTER TYPE "admin_user_role" RENAME TO "admin_user_role_old";
--> statement-breakpoint
CREATE TYPE "admin_user_role" AS ENUM (
  'platform-admin',
  'board-officer',
  'assisted-board',
  'pm-assistant',
  'manager',
  'viewer'
);
--> statement-breakpoint

-- 4. Recast the columns that reference the type and restore the default.
ALTER TABLE "admin_users"
  ALTER COLUMN "role" TYPE "admin_user_role"
  USING "role"::text::"admin_user_role";
--> statement-breakpoint
ALTER TABLE "admin_users" ALTER COLUMN "role" SET DEFAULT 'viewer';
--> statement-breakpoint
ALTER TABLE "permission_change_logs"
  ALTER COLUMN "old_role" TYPE "admin_user_role"
  USING "old_role"::text::"admin_user_role";
--> statement-breakpoint
ALTER TABLE "permission_change_logs"
  ALTER COLUMN "new_role" TYPE "admin_user_role"
  USING "new_role"::text::"admin_user_role";
--> statement-breakpoint

-- 5. Drop the retired enum type.
DROP TYPE "admin_user_role_old";
