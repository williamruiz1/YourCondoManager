-- 0052_agent_queue.sql — agent Chief-of-Staff queue foundation (founder-os#9474)
-- + owner-FAQ triage consumer (#9476). Additive: two new tables + two enums.
-- Reversible (drop the two tables + two enums). Tenant-isolated by association_id.

DO $$ BEGIN
  CREATE TYPE agent_action_level AS ENUM ('L1', 'L2', 'L3', 'L4');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE agent_action_status AS ENUM ('draft', 'queued', 'approved', 'executed', 'audited');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS agent_actions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id varchar NOT NULL REFERENCES associations(id),
  action_type text NOT NULL,
  level agent_action_level NOT NULL,
  status agent_action_status NOT NULL DEFAULT 'queued',
  target_entity text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasoning text NOT NULL,
  source_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_agent text NOT NULL,
  statutory_deadline integer NOT NULL DEFAULT 0,
  approved_by_user_id varchar,
  approved_at timestamp,
  approval_kind text,
  executed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_actions_association_idx ON agent_actions (association_id);
CREATE INDEX IF NOT EXISTS agent_actions_status_idx ON agent_actions (association_id, status);

CREATE TABLE IF NOT EXISTS agent_action_audit_log (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id varchar NOT NULL REFERENCES agent_actions(id),
  association_id varchar NOT NULL REFERENCES associations(id),
  event text NOT NULL,
  actor text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_action_audit_log_action_idx ON agent_action_audit_log (action_id);
