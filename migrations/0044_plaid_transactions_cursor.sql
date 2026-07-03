-- Migration 0041 — bank_connections.transactions_cursor: resumption cursor for
-- the Plaid /transactions/sync migration (P-3, Plaid production hardening).
--
-- The bank-feed sync engine migrates from the DEPRECATED /transactions/get
-- (date-window paging) to the canonical /transactions/sync (cursor-delta).
-- Each connection persists the latest cursor here; the next sync resumes from
-- it. NULL = no sync yet → the initial sync omits the cursor (full backfill).
--
-- Fail-safe / additive: nullable column, no default needed, existing rows
-- untouched (a NULL cursor correctly drives an initial sync that backfills
-- history exactly as the old get-based path did).
--
-- Lineage:
--   - 2026-06-21 — Plaid production hardening: webhook JWT verification +
--     /transactions/sync migration + production env-flip guard.

ALTER TABLE "bank_connections"
  ADD COLUMN IF NOT EXISTS "transactions_cursor" text;
