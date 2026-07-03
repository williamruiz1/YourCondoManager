-- Migration 0041 — fund-aware double-entry general ledger (YCM Financial Core Phase 1)
--
-- Audit anchor: audits/AUDIT-financial-reporting-orchestration.md Gap F1.
-- Build anchor: audits/YCM-financial-build-plan-2026-06-20.md Phase 1.
--
-- FORWARD-ONLY / PARALLEL / ADDITIVE (per BLINDSPOT F4):
--   * Creates NEW tables only. Touches no existing table, column, or row.
--   * `owner_ledger_entries` stays the system of record. This GL is built
--     ALONGSIDE it and is NOT authoritative — gated behind GL_ENABLED (default
--     OFF) and may not become source-of-truth until the reconcile-to-cent gate
--     (script/verify-gl-reconcile.ts) passes.
--   * Money is stored in INTEGER CENTS so Σdebits == Σcredits is exact.
--
-- Idempotent: every CREATE uses IF NOT EXISTS / guarded DO blocks so re-running
-- against an already-migrated DB is a no-op.

-- ── Enums ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE gl_account_type AS ENUM ('asset', 'liability', 'equity', 'income', 'expense');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE gl_fund AS ENUM ('operating', 'reserve');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE gl_side AS ENUM ('debit', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── gl_accounts — chart of accounts ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gl_accounts (
  id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id  varchar NOT NULL REFERENCES associations(id),
  account_code    text NOT NULL,
  name            text NOT NULL,
  account_type    gl_account_type NOT NULL,
  fund            gl_fund NOT NULL DEFAULT 'operating',
  normal_balance  gl_side NOT NULL,
  is_active       integer NOT NULL DEFAULT 1,
  created_at      timestamp NOT NULL DEFAULT now(),
  updated_at      timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS gl_accounts_assoc_code_fund_uq
  ON gl_accounts (association_id, account_code, fund);
CREATE INDEX IF NOT EXISTS gl_accounts_assoc_idx
  ON gl_accounts (association_id);

-- ── gl_entries — the journal (one row per debit-or-credit leg) ─────────────────
CREATE TABLE IF NOT EXISTS gl_entries (
  id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id  varchar NOT NULL REFERENCES associations(id),
  journal_id      varchar NOT NULL,
  gl_account_id   varchar NOT NULL REFERENCES gl_accounts(id),
  fund            gl_fund NOT NULL DEFAULT 'operating',
  side            gl_side NOT NULL,
  amount_cents    integer NOT NULL,
  posted_at       timestamp NOT NULL,
  description     text,
  source_type     text,
  source_id       text,
  created_at      timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gl_entries_assoc_idx   ON gl_entries (association_id);
CREATE INDEX IF NOT EXISTS gl_entries_journal_idx ON gl_entries (journal_id);
CREATE INDEX IF NOT EXISTS gl_entries_account_idx ON gl_entries (gl_account_id);

-- Idempotency guard: a given (source, account, side) posts at most once, so the
-- posting service can re-run safely without double-posting a source fact.
-- (source_type/source_id NULL rows — e.g. opening balances — are treated as
-- distinct by Postgres NULL semantics, which is the intended behavior.)
CREATE UNIQUE INDEX IF NOT EXISTS gl_entries_source_leg_uq
  ON gl_entries (source_type, source_id, gl_account_id, side);
