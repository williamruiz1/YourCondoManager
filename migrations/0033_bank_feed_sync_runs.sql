-- Migration 0033 — bank_feed_sync_runs: per-run audit log for the automated
-- Plaid sync + reconcile engine (founder-os#2478).
--
-- Bridges the historical gap where the 5-min automation sweep had no
-- bank-feed step, the Plaid webhook handler dropped SYNC_UPDATES_AVAILABLE
-- with a TODO comment, and `bank_connections.last_synced_at` stayed NULL.
--
-- Every sync run (sweep / webhook / manual) writes exactly one row here.
-- Successful runs additionally bump bank_connections.last_synced_at.
--
-- Lineage:
--   - 2026-05-25 — founder-os#2478 P1 structural: wire Plaid sync + reconcile
--     into automation sweep + webhook trigger + idempotency lock.

CREATE TABLE IF NOT EXISTS "bank_feed_sync_runs" (
  "id"                       varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "connection_id"            varchar NOT NULL REFERENCES "bank_connections"("id"),
  "association_id"           varchar NOT NULL REFERENCES "associations"("id"),
  "trigger"                  text NOT NULL,            -- 'sweep' | 'webhook' | 'manual'
  "started_at"               timestamp NOT NULL DEFAULT NOW(),
  "finished_at"              timestamp,
  "transactions_imported"    integer NOT NULL DEFAULT 0,
  "matches_made"             integer NOT NULL DEFAULT 0,
  "unmatched_count"          integer NOT NULL DEFAULT 0,
  "error"                    text
);

-- Per-connection lookups: "show me the last N runs for connection X".
CREATE INDEX IF NOT EXISTS "bank_feed_sync_runs_by_connection"
  ON "bank_feed_sync_runs" ("connection_id", "started_at");

-- Per-association lookups: "show me the sync history for association Y".
CREATE INDEX IF NOT EXISTS "bank_feed_sync_runs_by_association"
  ON "bank_feed_sync_runs" ("association_id", "started_at");
