-- 4.3 Q6 — PM toggle registry (per-association boolean overrides)
-- Each row is a (associationId, toggleKey) pair with an enabled flag.
-- Default state for any toggle key is OFF — the absence of a row means
-- "not overridden" which every consumer resolves to disabled today.
-- Valid toggle keys are enumerated in `PM_TOGGLE_KEYS` in shared/schema.ts.

CREATE TABLE IF NOT EXISTS "pm_toggles" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "association_id" varchar NOT NULL REFERENCES "associations"("id"),
  "toggle_key" text NOT NULL,
  "enabled" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" varchar REFERENCES "admin_users"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pm_toggles_association_key_uq"
  ON "pm_toggles" ("association_id", "toggle_key");
