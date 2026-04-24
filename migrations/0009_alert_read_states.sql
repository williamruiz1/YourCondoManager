-- Migration: Add alert_read_states table for the cross-association alert engine.
-- Context: 4.1 Q7 — global read-state with deterministic alert IDs.
-- Spec: docs/projects/platform-overhaul/decisions/4.1-cross-association-alert-engine.md
--
-- This table stores per-(alertId, adminUserId) read / dismissed timestamps.
-- `alertId` is a deterministic string of the form
--   `${ruleType}:${recordType}:${recordId}`
-- (e.g. "overdue-work-order:work_orders:abc-123"). The alert records
-- themselves are computed on the fly by server/alerts/ resolvers from the
-- canonical source tables — there is no alert_records table; read-state is
-- the only persisted alert data.
--
-- Wave 2 scope: table ships; no mutation endpoints yet. Wave 3 adds
-- read / dismiss mutations once the Home panel UI lands.

CREATE TABLE IF NOT EXISTS "alert_read_states" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "alert_id" text NOT NULL,
  "admin_user_id" varchar NOT NULL,
  "read_at" timestamp,
  "dismissed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "alert_read_states_admin_user_id_admin_users_id_fk"
    FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "alert_read_states_alert_admin_uq"
  ON "alert_read_states" ("alert_id", "admin_user_id");
