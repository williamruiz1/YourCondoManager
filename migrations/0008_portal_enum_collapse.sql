-- Phase 8a — Portal access role enum collapse
-- Collapses portal_access_role from {owner, tenant, readonly, board-member} to {owner}
-- Per 2.1 Q3 / 2.2 Q2 resolutions. Audit signed off in baselines/portal-enum-audit-2026-04.md.
--
-- Board access is preserved via portal_access.board_role_id (separate column, not this enum).
-- Tenant/readonly/board-member role values flatten to owner; no user-visible access loss.
--
-- Transactional, idempotent, with pre/post row count validation.

BEGIN;

-- Pre-migration counts (captured in DO block for logging)
DO $$
DECLARE
  total_before integer;
  alias_before integer;
BEGIN
  SELECT count(*) INTO total_before FROM portal_access;
  SELECT count(*) INTO alias_before FROM portal_access WHERE role::text <> 'owner';
  RAISE NOTICE 'Phase 8a pre-migration: total=% alias=%', total_before, alias_before;
END $$;

-- Flatten alias rows to owner. Idempotent (no-op if already owner-only).
UPDATE portal_access
SET role = 'owner'
WHERE role::text IN ('tenant', 'readonly', 'board-member');

-- Collapse the enum. Postgres doesn't support DROP VALUE on enums, so rename-swap pattern.
ALTER TABLE portal_access ALTER COLUMN role DROP DEFAULT;
ALTER TYPE portal_access_role RENAME TO portal_access_role_old;
CREATE TYPE portal_access_role AS ENUM ('owner');
ALTER TABLE portal_access
  ALTER COLUMN role TYPE portal_access_role
  USING role::text::portal_access_role;
ALTER TABLE portal_access ALTER COLUMN role SET DEFAULT 'owner';
DROP TYPE portal_access_role_old;

-- Post-migration validation
DO $$
DECLARE
  total_after integer;
  non_owner_after integer;
BEGIN
  SELECT count(*) INTO total_after FROM portal_access;
  SELECT count(*) INTO non_owner_after FROM portal_access WHERE role::text <> 'owner';
  RAISE NOTICE 'Phase 8a post-migration: total=% non_owner=%', total_after, non_owner_after;
  IF non_owner_after > 0 THEN
    RAISE EXCEPTION 'Phase 8a migration failed: % non-owner rows remain', non_owner_after;
  END IF;
END $$;

COMMIT;
