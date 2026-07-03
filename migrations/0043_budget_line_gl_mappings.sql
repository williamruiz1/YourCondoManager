-- Migration 0043 — budget-line → GL-account mapping (YCM Financial Core Phase 2)
--
-- Audit anchor: audits/AUDIT-financial-reporting-orchestration.md (Phase 2 — derived statements).
-- Build anchor: audits/YCM-financial-build-plan-2026-06-20.md Phase 2.
--
-- (Migration 0042 is reserved by a parallel amenity build; this Phase-2 schema
--  takes the next free number, 0043.)
--
-- FORWARD-ONLY / PARALLEL / ADDITIVE (per BLINDSPOT F4):
--   * Creates ONE NEW table only. Touches no existing table, column, or row.
--   * Lets a budget_line (planned spend) carry an optional tie to a GL account
--     code + fund, so the DERIVED budget-vs-actual statement can join planned
--     amounts to GL-derived actuals by (account code, fund). The mapping is
--     OPTIONAL — budget-vs-actual still falls back to category-name matching
--     when a line is unmapped, so this is purely additive enrichment.
--   * These statements are DERIVED and NOT source-of-truth. The owner ledger
--     stays the system of record; the GL stays parallel (GL_ENABLED default OFF).
--
-- Idempotent: every CREATE uses IF NOT EXISTS so re-running is a no-op. No
-- destructive DDL (no DROP / ALTER ... DROP / TRUNCATE).

-- ── budget_line_gl_mappings — optional budget-line → GL-account bridge ─────────
CREATE TABLE IF NOT EXISTS budget_line_gl_mappings (
  id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The budget line this mapping enriches.
  budget_line_id  varchar NOT NULL REFERENCES budget_lines(id),
  -- The GL account code (e.g. "5100" Landscaping) the planned amount tracks
  -- against. Stored as the code (not a gl_accounts FK) so a mapping can be
  -- authored before the per-association chart row is seeded.
  gl_account_code text NOT NULL,
  -- The fund this budget line lives in (operating | reserve). Reuses the GL's
  -- fund enum so the segregation matches the ledger exactly.
  fund            gl_fund NOT NULL DEFAULT 'operating',
  created_at      timestamp NOT NULL DEFAULT now(),
  updated_at      timestamp NOT NULL DEFAULT now()
);

-- One mapping per budget line (a line maps to at most one GL account/fund).
CREATE UNIQUE INDEX IF NOT EXISTS budget_line_gl_mappings_line_uq
  ON budget_line_gl_mappings (budget_line_id);

-- Lookup by GL account when deriving actuals for a code/fund.
CREATE INDEX IF NOT EXISTS budget_line_gl_mappings_code_fund_idx
  ON budget_line_gl_mappings (gl_account_code, fund);
