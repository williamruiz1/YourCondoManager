-- Migration: Expand admin_user_role enum with new persona values
-- Context: YCM Platform Overhaul — 6-persona model replaces 4-persona model
-- board-admin splits into board-officer (self-managed) and assisted-board (PM-managed)
-- pm-assistant is a new role for PM junior staff (no existing rows)
--
-- Strategy: expand-then-contract
-- This migration ADDS new values and MIGRATES data.
-- Commit 2 (code rename) will remove the old 'board-admin' value after all code references are updated.

-- Step 1: Add new enum values (idempotent)
ALTER TYPE admin_user_role ADD VALUE IF NOT EXISTS 'board-officer';
ALTER TYPE admin_user_role ADD VALUE IF NOT EXISTS 'assisted-board';
ALTER TYPE admin_user_role ADD VALUE IF NOT EXISTS 'pm-assistant';

-- Step 2: Conditional migration — split board-admin by association managementType
-- Board-admin users are single-association per 0.2; each has exactly one admin_association_scopes row.
-- Self-managed associations → board-officer
-- PM-managed (property_manager or any non-self-managed) → assisted-board
UPDATE admin_users au
SET role = CASE
  WHEN tc.management_type = 'self-managed' THEN 'board-officer'
  ELSE 'assisted-board'
END
FROM admin_association_scopes aas
JOIN tenant_configs tc ON tc.association_id = aas.association_id
WHERE au.id = aas.admin_user_id
  AND au.role = 'board-admin';

-- Step 3: Catch any board-admin users not linked to an association (orphan rows)
-- Default to assisted-board (safer — more restrictive than board-officer)
UPDATE admin_users
SET role = 'assisted-board'
WHERE role = 'board-admin';

-- Step 4: Migrate permission_change_logs historical records
-- These are audit records — migrate for consistency but no functional impact
UPDATE permission_change_logs
SET old_role = 'assisted-board'
WHERE old_role = 'board-admin';

UPDATE permission_change_logs
SET new_role = 'assisted-board'
WHERE new_role = 'board-admin';
