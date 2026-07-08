-- Migration 0055 — YCM Chief-of-Staff agent queue + four-level permission ladder
--                   + agent-action audit log.
--
-- founder-os#9474 (W1 foundation). Ratified 2026-07-04; research #833 §5.1/§7.2/§9.
-- The queue IS the chief-of-staff surface — every agent-proposed action routes
-- through it. The permission LADDER is server-authoritative (level assigned from
-- the action-TYPE, never trusted from the agent); the gate refuses to execute an
-- L3/L4 action without a recorded human approval.
--
-- NET-NEW / ADDITIVE / ZERO existing-table exposure:
--   * Creates three new tables (agent_actions, agent_action_audit_log,
--     agent_action_toggles) + two new enums. Touches NO existing table, column,
--     or row. No destructive DDL, no backfill.
--   * agent_action_audit_log is append-only (the app never UPDATEs/DELETEs it).
--   * Tenant-isolated: every table carries association_id (FK associations.id).
--
-- Idempotent: guarded with IF NOT EXISTS / DO-blocks so re-running is a no-op.

-- ── enum: agent_action_level ──────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_action_level') THEN
    CREATE TYPE "agent_action_level" AS ENUM ('L1', 'L2', 'L3', 'L4');
  END IF;
END $$;--> statement-breakpoint

-- ── enum: agent_action_status ─────────────────────────────────────────────────
-- draft → queued → (approved | rejected) → (executed | failed)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_action_status') THEN
    CREATE TYPE "agent_action_status" AS ENUM (
      'draft', 'queued', 'approved', 'rejected', 'executed', 'failed'
    );
  END IF;
END $$;--> statement-breakpoint

-- ── table: agent_actions (the chief-of-staff queue) ──────────────────────────
CREATE TABLE IF NOT EXISTS "agent_actions" (
  "id"                  varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "association_id"      varchar NOT NULL REFERENCES "associations"("id"),
  "action_type"         text NOT NULL,
  "level"               "agent_action_level" NOT NULL,
  "status"              "agent_action_status" NOT NULL DEFAULT 'queued',
  "target_entity_type"  text,
  "target_entity_id"    varchar,
  "payload"             jsonb,
  "reasoning"           text NOT NULL,
  "severity"            text NOT NULL DEFAULT 'medium',
  "statutory_deadline"  timestamp,
  "created_by_agent"    text NOT NULL,
  "approved_by_user_id" varchar REFERENCES "admin_users"("id"),
  "approved_by_email"   text,
  "approved_at"         timestamp,
  "rejected_by_user_id" varchar REFERENCES "admin_users"("id"),
  "rejected_by_email"   text,
  "rejected_at"         timestamp,
  "rejection_reason"    text,
  "executed_at"         timestamp,
  "created_at"          timestamp NOT NULL DEFAULT now(),
  "updated_at"          timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "agent_actions_assoc_status_idx"
  ON "agent_actions" ("association_id", "status", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_actions_assoc_deadline_idx"
  ON "agent_actions" ("association_id", "statutory_deadline");--> statement-breakpoint

-- ── table: agent_action_audit_log (append-only, immutable) ───────────────────
CREATE TABLE IF NOT EXISTS "agent_action_audit_log" (
  "id"             varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "association_id" varchar NOT NULL REFERENCES "associations"("id"),
  "action_id"      varchar NOT NULL REFERENCES "agent_actions"("id"),
  "event"          text NOT NULL,
  "actor_type"     text NOT NULL,
  "actor_id"       text,
  "actor_email"    text,
  "detail"         text,
  "snapshot"       jsonb,
  "created_at"     timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "agent_action_audit_action_idx"
  ON "agent_action_audit_log" ("action_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_action_audit_assoc_idx"
  ON "agent_action_audit_log" ("association_id", "created_at");--> statement-breakpoint

-- ── table: agent_action_toggles (per-association L2 autonomy) ─────────────────
CREATE TABLE IF NOT EXISTS "agent_action_toggles" (
  "id"             varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "association_id" varchar NOT NULL REFERENCES "associations"("id"),
  "action_type"    text NOT NULL,
  "auto_approve"   integer NOT NULL DEFAULT 0,
  "created_at"     timestamp NOT NULL DEFAULT now(),
  "updated_at"     timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "agent_action_toggles_assoc_type_uq"
  ON "agent_action_toggles" ("association_id", "action_type");
