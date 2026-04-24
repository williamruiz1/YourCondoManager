-- Phase 8a — collapse `portal_access_role` enum from
--   ["owner", "tenant", "readonly", "board-member"]
-- down to
--   ["owner", "board-member"]
--
-- References:
--   - docs/projects/platform-overhaul/decisions/2.1-role-model-audit.md Q3
--   - docs/projects/platform-overhaul/decisions/2.2-owner-portal-access-boundaries.md Q1
--   - docs/projects/platform-overhaul/decisions/3.3-role-gating-corrections.md Q1
--   - docs/projects/platform-overhaul/implementation-artifacts/phase-8-call-site-audit.md
--
-- Prod-data audit (2026-04-24) found 12 `owner`, 4 `tenant`, 1 `board-member`,
-- and 0 `readonly` rows. The 4 `tenant` rows are collapsed to `owner` per
-- 3.3 Q1. The `readonly` UPDATE is defensive — prod has zero rows today but a
-- new row could land before the migration runs.
--
-- Tenant-vs-owner occupancy semantics move to `persons.residentType` /
-- separate provisioning metadata (Phase 8a is scoped to enum collapse only —
-- no new columns are added here).
--
-- Postgres does not support `ALTER TYPE ... DROP VALUE`, so we use the
-- standard rename-and-recreate pattern:
--   (a) defensive backfill from retired values to `owner`,
--   (b) drop the column default that references the old enum,
--   (c) rename the old enum type out of the way,
--   (d) create the new enum with just the surviving values,
--   (e) recast the column via `USING role::text::portal_access_role`,
--   (f) drop the now-orphan old enum type,
--   (g) restore the column default.

-- (a) Defensive backfill.
UPDATE portal_access SET role = 'owner' WHERE role = 'tenant';
UPDATE portal_access SET role = 'owner' WHERE role = 'readonly';

-- (b) Drop the default that references the old enum type.
ALTER TABLE portal_access ALTER COLUMN role DROP DEFAULT;

-- (c) Rename the old enum out of the way.
ALTER TYPE portal_access_role RENAME TO portal_access_role_old;

-- (d) Create the new enum with just the surviving values.
CREATE TYPE portal_access_role AS ENUM ('owner', 'board-member');

-- (e) Recast the column to the new enum type.
ALTER TABLE portal_access
  ALTER COLUMN role TYPE portal_access_role
  USING role::text::portal_access_role;

-- (f) Drop the retired enum type.
DROP TYPE portal_access_role_old;

-- (g) Restore the column default.
ALTER TABLE portal_access ALTER COLUMN role SET DEFAULT 'owner';
