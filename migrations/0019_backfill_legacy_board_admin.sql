-- 2.1 Q11 / Phase 14 cleanup: 1 legacy `board-admin` row remained in prod
-- after the 6-persona rename. Map to canonical role based on the user's
-- primary association management type. This is a one-time data backfill.
--
-- Audit (2026-04-24, prod):
--   role           | n
--   ---------------+---
--   platform-admin | 3
--   manager        | 1
--   board-admin    | 1   ← migrated by this script
--
-- Migration 0006 already split the bulk of the legacy `board-admin` rows
-- (self-managed → board-officer, PM-managed/orphan → assisted-board) at
-- the time of the 6-persona rename. The 1 row counted above is a residual
-- (likely inserted between the audit and the 0006 deploy, or surfaced via
-- a subsequent restore). This migration repeats the same split criterion
-- for any remaining `board-admin` rows.
--
-- This migration is forward-only: it does not re-introduce `board-admin`.
-- The enum still permits `board-admin` as a value (legacy from 0000); a
-- separate enum-collapse migration is queued as a follow-up.

-- Step 1: backfill admins whose primary association is self-managed → board-officer
UPDATE admin_users SET role = 'board-officer'
WHERE role = 'board-admin'
  AND id IN (
    SELECT au.id FROM admin_users au
    JOIN admin_association_scopes aas ON aas.admin_user_id = au.id
    JOIN tenant_configs tc ON tc.association_id = aas.association_id
    WHERE tc.management_type = 'self-managed'
    GROUP BY au.id
    HAVING COUNT(*) > 0
  );

-- Step 2: backfill remaining `board-admin` rows (PM-managed or unscoped) → assisted-board
UPDATE admin_users SET role = 'assisted-board'
WHERE role = 'board-admin';

-- Sanity check: no rows should still carry 'board-admin' after this migration.
-- (Drizzle migrations don't support assertions; rely on the post-deploy check.)
