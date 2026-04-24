-- Migration: 0012 — Hub visibility rename, HV-1 (additive)
-- Spec: docs/projects/platform-overhaul/decisions/1.5-hub-visibility-rename.md
--   HV-1 — additive enum-value introduction. Zero behavior change.
--   Deployable immediately. Feature flag HUB_VISIBILITY_RENAME stays OFF.
--
-- Adds 5 new values to hub_visibility_level. "public" already exists and is
-- a no-op (ADD VALUE IF NOT EXISTS). Old values remain legal throughout
-- HV-1 + HV-2; HV-3 recreates the type without them.
--
-- Mapping (old → new):
--   public   → public        (preserved verbatim — public-API safe)
--   resident → residents
--   owner    → unit-owners
--   board    → board-only
--   admin    → operator-only
--
-- Transaction note: `ALTER TYPE … ADD VALUE` is allowed inside a transaction
-- block on Postgres 12+ (the repo's minimum). Earlier versions required it
-- to be run outside a transaction, but we do not support those. The
-- drizzle migration runner wraps each file in a transaction; the statements
-- below are safe in that mode because every modern pg version accepts
-- `ADD VALUE` mid-transaction and the new values are only referenced by
-- later migrations (HV-2), not by the same transaction.

ALTER TYPE "hub_visibility_level" ADD VALUE IF NOT EXISTS 'public';
--> statement-breakpoint
ALTER TYPE "hub_visibility_level" ADD VALUE IF NOT EXISTS 'residents';
--> statement-breakpoint
ALTER TYPE "hub_visibility_level" ADD VALUE IF NOT EXISTS 'unit-owners';
--> statement-breakpoint
ALTER TYPE "hub_visibility_level" ADD VALUE IF NOT EXISTS 'board-only';
--> statement-breakpoint
ALTER TYPE "hub_visibility_level" ADD VALUE IF NOT EXISTS 'operator-only';
