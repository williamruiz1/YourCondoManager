-- AI Assistant interactions (founder-os#1318, Phase 0)
--
-- Audit-log table for every resident-chat turn. Captures prompt + response
-- + tool calls + token/cost telemetry so the cost-economics dashboard
-- (founder-os#1261) can read against a real schema in Phase 1.
--
-- Phase 0 (mock adapter) writes mock cost ($0) and rough token counts.
-- Phase 1 (LLM-conversational primitive, founder-os#1244) writes real
-- values via the same row shape.

CREATE TABLE IF NOT EXISTS ai_assistant_interactions (
    id                varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id   varchar     NOT NULL,
    association_id    varchar     NOT NULL REFERENCES associations(id),
    person_id         varchar     NOT NULL REFERENCES persons(id),
    turn_index        integer     NOT NULL,
    prompt            text        NOT NULL,
    response          text        NOT NULL,
    tool_calls        jsonb       NOT NULL DEFAULT '[]'::jsonb,
    tokens_in         integer     NOT NULL DEFAULT 0,
    tokens_out        integer     NOT NULL DEFAULT 0,
    latency_ms        integer     NOT NULL DEFAULT 0,
    cost_estimate     real        NOT NULL DEFAULT 0,
    model             text        NOT NULL DEFAULT 'mock-phase-0',
    created_at        timestamp   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_assistant_interactions_by_conversation
    ON ai_assistant_interactions (conversation_id, turn_index);

CREATE INDEX IF NOT EXISTS ai_assistant_interactions_by_owner
    ON ai_assistant_interactions (association_id, person_id, created_at);
