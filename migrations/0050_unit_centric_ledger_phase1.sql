-- Migration 0050 — Unit-Centric Ledger + Unique Payment Reference (Phase 1 / P0-1 + P0-3)
--
-- Roadmap anchor: artifacts/ycm/hoa-remediation-roadmap.html — Phase 1.
-- Companion migration PLAN (the live-data move + backfill, NOT run here):
--   docs/phase1-unit-centric-migration-plan.md
--
-- ADDITIVE / FORWARD-ONLY / BACKWARD-COMPATIBLE (Cherry Hill Court is a LIVE
-- customer with real books):
--   * Adds NULLABLE columns + a partial-unique index ONLY. Touches no existing
--     row's value; deletes nothing; rewrites no unit_id / person_id.
--   * The person-centric statement path keeps working unchanged; the unit path
--     is additive and only preferred when the UNIT_CENTRIC_LEDGER flag is on.
--   * Does NOT relax owner_ledger_entries.person_id NOT NULL here — that is a
--     separate, staged, flag-gated step in the migration PLAN (§Phase C), so
--     this migration alone is trivially reversible and cannot break readers.
--   * Idempotent: every statement uses IF NOT EXISTS / guarded DO blocks, so
--     re-running against an already-migrated DB is a no-op.
--
-- Backfill of unit_account_ref + primary_contact_person_id is intentionally NOT
-- performed in this DDL. It is a data step, staged + verified per the PLAN doc,
-- and run by an explicit backfill script — never silently inside a schema DDL
-- against live books.

-- ── P0-3: unique per-unit payment reference on units ──────────────────────────
ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "unit_account_ref" text;--> statement-breakpoint

-- ── P0-1: designated primary contact for the unit payer roster ────────────────
ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "primary_contact_person_id" varchar;--> statement-breakpoint

-- FK for the primary-contact designation (added as a named constraint so it can
-- be dropped cleanly on rollback). Guarded so re-running is a no-op. ON DELETE
-- SET NULL: if the designated primary person is deleted, the unit falls back to
-- the earliest-active-owner default rather than orphaning a dangling id.
DO $$ BEGIN
  ALTER TABLE "units"
    ADD CONSTRAINT "units_primary_contact_person_fk"
    FOREIGN KEY ("primary_contact_person_id") REFERENCES "persons"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

-- P0-3: a unit_account_ref must be unique WITHIN an association. Postgres treats
-- NULLs as DISTINCT, so every un-backfilled unit (NULL ref) is exempt and cannot
-- collide — the index is effectively partial over the backfilled rows. This is
-- what makes the "add column now, backfill later" sequence safe.
CREATE UNIQUE INDEX IF NOT EXISTS "units_assoc_account_ref_uq"
  ON "units" ("association_id", "unit_account_ref");--> statement-breakpoint

-- Unit-scoped statement read index (P0-1): unit-scoped statement + aging reads
-- group owner_ledger_entries by (association_id, unit_id, posted_at). Additive
-- index only — no column change.
CREATE INDEX IF NOT EXISTS "owner_ledger_entries_assoc_unit_posted_idx"
  ON "owner_ledger_entries" ("association_id", "unit_id", "posted_at");--> statement-breakpoint

-- ── ROLLBACK (for reference — NOT executed here) ──────────────────────────────
-- DROP INDEX IF EXISTS "owner_ledger_entries_assoc_unit_posted_idx";
-- DROP INDEX IF EXISTS "units_assoc_account_ref_uq";
-- ALTER TABLE "units" DROP CONSTRAINT IF EXISTS "units_primary_contact_person_fk";
-- ALTER TABLE "units" DROP COLUMN IF EXISTS "primary_contact_person_id";
-- ALTER TABLE "units" DROP COLUMN IF EXISTS "unit_account_ref";
