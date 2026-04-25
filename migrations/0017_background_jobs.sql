-- Migration: 0016 — background_jobs table (Wave 33, perf 5.4-F3)
-- Spec: docs/projects/platform-overhaul/implementation-artifacts/5.4-performance-audit.md §6 F3
--
-- Wave 33 introduces an in-process job queue so the unified rule-run endpoint
-- (`POST /api/financial/rules/:ruleId/run`) does not have to fan out N ledger
-- inserts inside a single request handler when an association has more than
-- 500 units. The queue lives in `server/job-queue.ts` (concurrency = 1 per
-- association) and persists state into this table so the status endpoint
-- can report progress / completion / failure across an arbitrary number of
-- requests.
--
-- Design notes:
--   - This table holds NO PII. The `payload` jsonb references existing rows
--     by id (ruleId, associationId) — never embeds owner / unit data.
--   - `state` is a free-form text column so we can extend it later without a
--     migration. Today the only valid values are: 'queued' | 'running' |
--     'done' | 'failed'. The column has a CHECK constraint to enforce that.
--   - `result_json` is populated on completion and mirrors the run-on-demand
--     response shape (`runLogEntries` ids + `projectedOutcomes`). It is NOT
--     used as a source of truth — the canonical record remains the rows in
--     `assessment_run_log` that the orchestrator wrote.
--   - `idempotency_key` is an optional unique identifier used by the
--     dispatch endpoint to coalesce duplicate enqueues (same rule + asOfDate)
--     into a single jobId so a refresh / double-click never spawns two runs.
--
-- Idempotent: IF NOT EXISTS keeps re-applies safe.

CREATE TABLE IF NOT EXISTS "background_jobs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "state" text NOT NULL DEFAULT 'queued',
  "idempotency_key" text,
  "enqueued_at" timestamp DEFAULT now() NOT NULL,
  "started_at" timestamp,
  "completed_at" timestamp,
  "error" text,
  "result_json" jsonb,
  CONSTRAINT background_jobs_state_check
    CHECK (state IN ('queued', 'running', 'done', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "background_jobs_idempotency_key_uq"
  ON "background_jobs" ("idempotency_key")
  WHERE "idempotency_key" IS NOT NULL AND state IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS "background_jobs_state_enqueued_at_idx"
  ON "background_jobs" ("state", "enqueued_at");
