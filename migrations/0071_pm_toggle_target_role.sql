-- Expand PM-managed delegation so grants are isolated by target persona.
-- Existing rows are preserved as Assisted Board overrides. PM Assistant has
-- no rows after this migration and therefore starts fail-closed.

ALTER TABLE "pm_toggles"
  ADD COLUMN IF NOT EXISTS "target_role" text;

UPDATE "pm_toggles"
SET "target_role" = 'assisted-board'
WHERE "target_role" IS NULL;

ALTER TABLE "pm_toggles"
  ALTER COLUMN "target_role" SET DEFAULT 'assisted-board',
  ALTER COLUMN "target_role" SET NOT NULL;

ALTER TABLE "pm_toggles"
  DROP CONSTRAINT IF EXISTS "pm_toggles_target_role_check";

ALTER TABLE "pm_toggles"
  ADD CONSTRAINT "pm_toggles_target_role_check"
  CHECK ("target_role" IN ('assisted-board', 'pm-assistant'));

DROP INDEX IF EXISTS "pm_toggles_association_key_uq";

CREATE UNIQUE INDEX IF NOT EXISTS "pm_toggles_association_role_key_uq"
  ON "pm_toggles" ("association_id", "target_role", "toggle_key");
