-- Migration 0062 — YCM cross-board-cycle institutional memory (decision log).
--
-- founder-os#9475 (W1). Blocked-by #9474 (merged: the agent-action foundation).
-- A queryable decision log that survives board turnover: one immutable row per
-- board decision carrying the decision, the reasoning, the actor (denormalized
-- to TEXT so it survives after that admin leaves), the board term, the date,
-- linked attachments, and an optional link to the entity (owner/vendor/rule/
-- unit) the decision touched.
--
-- READ-ONLY (L1) by design: querying this memory NEVER actuates — it only
-- surfaces prior context. Recording a decision is an append-only write-TO the
-- log (institutional logging), never a write FROM memory to another system.
--
-- NET-NEW / ADDITIVE / ZERO existing-table exposure:
--   * Creates one new table (board_decisions) + one new enum. Touches NO
--     existing table, column, or row. No destructive DDL, no backfill.
--   * board_decisions is immutable (the app never UPDATEs/DELETEs a row).
--   * Tenant-isolated: carries association_id (FK associations.id).
--
-- Idempotent: guarded with IF NOT EXISTS / DO-blocks so re-running is a no-op.

-- ── enum: board_decision_category ────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'board_decision_category') THEN
    CREATE TYPE "board_decision_category" AS ENUM (
      'rule_application', 'vendor', 'owner', 'financial', 'governance', 'architectural', 'general'
    );
  END IF;
END $$;--> statement-breakpoint

-- ── table: board_decisions (institutional-memory decision log) ───────────────
CREATE TABLE IF NOT EXISTS "board_decisions" (
  "id"                    varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "association_id"        varchar NOT NULL REFERENCES "associations"("id"),
  "subject"               text NOT NULL,
  "decision"              text NOT NULL,
  "reasoning"             text NOT NULL,
  "category"              "board_decision_category" NOT NULL DEFAULT 'general',
  "actor_type"            text NOT NULL DEFAULT 'board',
  "actor_name"            text NOT NULL,
  "actor_role"            text,
  "recorded_by_user_id"   varchar REFERENCES "admin_users"("id"),
  "board_term"            text,
  "decided_at"            timestamp NOT NULL DEFAULT now(),
  "related_entity_type"   text,
  "related_entity_id"     varchar,
  "related_entity_label"  text,
  "source_action_id"      varchar REFERENCES "agent_actions"("id"),
  "attachments"           jsonb NOT NULL DEFAULT '[]'::jsonb,
  "tags"                  jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at"            timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "board_decisions_assoc_category_idx"
  ON "board_decisions" ("association_id", "category", "decided_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "board_decisions_assoc_entity_idx"
  ON "board_decisions" ("association_id", "related_entity_type", "related_entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "board_decisions_assoc_term_idx"
  ON "board_decisions" ("association_id", "board_term");--> statement-breakpoint
