-- Migration: Expand admin_user_role enum with new persona values
-- Context: YCM Platform Overhaul — 6-persona model replaces 4-persona model
-- board-admin splits into board-officer (self-managed) and assisted-board (PM-managed)
-- pm-assistant is a new role for PM junior staff (no existing rows)
--
-- Strategy: expand-then-contract
-- This migration ADDS new values and MIGRATES data.
-- Commit 2 (code rename) will remove the old 'board-admin' value after all code references are updated.
--
-- ── Fresh-DB bootstrap safety (YCM #384/#385) ────────────────────────────────
-- Postgres forbids USING a newly `ALTER TYPE … ADD VALUE`-d enum value in the
-- SAME transaction that added it ("unsafe use of new value … must be committed
-- before they can be used"). drizzle-orm's migrator (`migrate()`) wraps the
-- ENTIRE pending-migration set in ONE transaction, so on a clean DB the
-- ADD VALUEs below and any data UPDATE referencing them run in the same txn —
-- which aborted `npm run migrate` at this migration and blocked new-customer /
-- DR / preview provisioning from zero. Splitting into two files does NOT help
-- (drizzle still runs them in one txn). The literal in `SET role = 'assisted-board'`
-- is coerced at plan time even for zero matching rows, so it fails on a fresh
-- (empty) DB too.
--
-- Fix: the ADD VALUEs stay (idempotent, harmless). The data backfill (Steps 2–4)
-- is wrapped in a guarded `DO` block that only PLANS/executes the UPDATEs when
-- there is actually a legacy `board-admin` row to migrate. On a fresh DB the
-- guard is false, the enum-value literals are never coerced, and the block is a
-- clean no-op. On production this migration is already applied (drizzle skips it
-- by journal timestamp), so this is a fresh-DB-only safety change with identical
-- end-state behavior on any DB that actually has legacy board-admin rows.

-- Step 1: Add new enum values (idempotent)
ALTER TYPE admin_user_role ADD VALUE IF NOT EXISTS 'board-officer';
--> statement-breakpoint
ALTER TYPE admin_user_role ADD VALUE IF NOT EXISTS 'assisted-board';
--> statement-breakpoint
ALTER TYPE admin_user_role ADD VALUE IF NOT EXISTS 'pm-assistant';
--> statement-breakpoint

-- Steps 2 & 3: Migrate legacy board-admin admin_users rows.
--   Self-managed association → board-officer
--   PM-managed / orphan      → assisted-board (safer, more restrictive)
-- Guarded so the new-value literals are only coerced when there IS data to
-- migrate (never on a fresh/empty DB — see header).
-- NOTE: written as plain-literal UPDATEs (not a `CASE … THEN 'x' ELSE 'y' END`).
-- A CASE over two bare string literals resolves to `text`, and there is no
-- assignment cast from text to an enum, so `SET role = CASE …` fails with
-- "column is of type admin_user_role but expression is of type text". A plain
-- `SET role = 'board-officer'` coerces the unknown literal directly to the enum
-- (assignment context). Equivalent result: self-managed → board-officer here,
-- everything else (PM-managed + orphans) falls through to Step 3 → assisted-board.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM admin_users WHERE role = 'board-admin') THEN
    -- Step 2: self-managed board-admin (single-association per 0.2) → board-officer
    UPDATE admin_users au
    SET role = 'board-officer'
    FROM admin_association_scopes aas
    JOIN tenant_configs tc ON tc.association_id = aas.association_id
    WHERE au.id = aas.admin_user_id
      AND au.role = 'board-admin'
      AND tc.management_type = 'self-managed';

    -- Step 3: everything else still on board-admin (PM-managed + orphans) → assisted-board
    UPDATE admin_users
    SET role = 'assisted-board'
    WHERE role = 'board-admin';
  END IF;
END $$;
--> statement-breakpoint

-- Step 4: Migrate permission_change_logs historical records (audit only).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM permission_change_logs
    WHERE old_role = 'board-admin' OR new_role = 'board-admin'
  ) THEN
    UPDATE permission_change_logs
    SET old_role = 'assisted-board'
    WHERE old_role = 'board-admin';

    UPDATE permission_change_logs
    SET new_role = 'assisted-board'
    WHERE new_role = 'board-admin';
  END IF;
END $$;
