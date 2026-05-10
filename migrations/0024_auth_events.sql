-- Migration 0024 — auth_events table
--
-- Per WS12 zero-trust attestation (Issue #388 + Plaid compliance Nov 11 2026).
-- Logs every authentication event for forensic reconstruction + new-IP anomaly
-- detection.
--
-- Lineage:
--   - 2026-05-10 v1 — Worker [020] per Coordinator [014] dispatch (queue line 19197).

CREATE TABLE IF NOT EXISTS "auth_events" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar REFERENCES "auth_users"("id") ON DELETE SET NULL,
  "admin_user_id" varchar REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "event_type" text NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "outcome" text NOT NULL DEFAULT 'success',
  "failure_reason" text,
  "created_at" timestamp NOT NULL DEFAULT NOW()
);

-- Index for new-IP anomaly check: pull the last 30 days of distinct IPs for a
-- given user. The (user_id, created_at desc) ordering makes the WHERE
-- created_at >= NOW() - INTERVAL '30 days' query an efficient range scan.
CREATE INDEX IF NOT EXISTS "auth_events_user_id_created_at_idx"
  ON "auth_events" ("user_id", "created_at" DESC);

-- Index for admin-scoped queries (e.g., admin security dashboard listing recent
-- events for a specific admin user).
CREATE INDEX IF NOT EXISTS "auth_events_admin_user_id_created_at_idx"
  ON "auth_events" ("admin_user_id", "created_at" DESC);

-- Index for event-type filtering (e.g., listing only failure events).
CREATE INDEX IF NOT EXISTS "auth_events_event_type_idx"
  ON "auth_events" ("event_type");
