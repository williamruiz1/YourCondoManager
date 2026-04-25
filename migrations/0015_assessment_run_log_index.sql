-- Migration: 0015 — Composite index on assessment_run_log (Wave 19, perf 5.4-F2)
-- Spec: docs/projects/platform-overhaul/implementation-artifacts/5.4-performance-audit.md §6 F2
--
-- The Wave 7 migration (0011_assessment_run_log.sql) created three single-column
-- indexes on assessment_run_log:
--   - assessment_run_log_association_idx (association_id)
--   - assessment_run_log_rule_idx        (rule_type, rule_id)
--   - assessment_run_log_started_at_idx  (run_started_at)         <-- ASC only
--
-- The hot read path is `GET /api/financial/assessment-run-log`, which paginates
-- the run history per association latest-first:
--   WHERE association_id = $1 ORDER BY run_started_at DESC LIMIT 50
--
-- Postgres can satisfy that ORDER BY DESC by walking the ASC index in reverse,
-- but the per-association predicate forces a separate filter step. A composite
-- (association_id, run_started_at DESC) is exactly the access pattern and lets
-- the planner range-scan the partition key in one pass. Both Wave-7 single-column
-- indexes are kept — they still serve global "latest run across the platform"
-- and association-only point lookups (the orchestrator's blocker scan).
--
-- Idempotent: IF NOT EXISTS keeps re-applies safe.

CREATE INDEX IF NOT EXISTS "assessment_run_log_assoc_started_idx"
  ON "assessment_run_log" ("association_id", "run_started_at" DESC);
