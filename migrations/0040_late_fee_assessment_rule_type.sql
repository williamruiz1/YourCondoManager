-- Migration 0040 — late_fee_assessment_rule_type (P1-5 / Issue #212)
--
-- Extends the `assessment_rule_type_enum` Postgres enum to include the
-- "late-fee" variant so that the unified assessment orchestrator can log
-- automated late-fee posting runs in `assessment_run_log`.
--
-- Idempotent: uses `ALTER TYPE ... ADD VALUE IF NOT EXISTS` (requires PG 9.6+
-- which is guaranteed by the deployment target).

ALTER TYPE assessment_rule_type_enum ADD VALUE IF NOT EXISTS 'late-fee';
