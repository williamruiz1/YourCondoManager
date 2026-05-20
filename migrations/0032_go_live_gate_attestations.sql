-- Migration 0032 — go_live_gate_attestations: admin-attestation table for
-- the /admin/go-live-readiness dashboard.
--
-- Each row records an admin marking a single gate (e.g. 'A.6', 'B.3') as
-- verified for a specific association. The dashboard renders auto-checks
-- live (returning pass/fail/pending per gate); for the gates that require
-- human verification (marked 👤 in the wiki checklist), admins click
-- "Mark verified" which inserts a row here. The dashboard then surfaces
-- "Verified by <email> on <date>" on those gates.
--
-- Per founder-os Issue #1340 (Cherry Hill go-live readiness BUILD). The
-- canonical gate inventory + schema spec lives at:
--   wiki/products/ycm/cherry-hill-go-live-checklist-v1.md
--
-- Note on naming: the founder-os dispatch text referenced
-- `community_id INTEGER` but YCM canonically uses `association_id VARCHAR`
-- referencing `associations(id)`. Aligning to YCM convention here per OP
-- #20 verify-against-repo-state.
--
-- Note on migration number: 0031 was the just-merged deletion_requests
-- migration (PR #161, 2026-05-20). 0032 is the next free slot.

CREATE TABLE IF NOT EXISTS "go_live_gate_attestations" (
  "id"                    varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "association_id"        varchar NOT NULL REFERENCES "associations"("id"),
  "gate_id"               text NOT NULL,
  "attested_by_user_id"   text NOT NULL,
  "attested_by_email"     text NOT NULL,
  "attested_at"           timestamp NOT NULL DEFAULT NOW(),
  "notes"                 text,
  CONSTRAINT "go_live_gate_attestations_assoc_gate_user_uniq"
    UNIQUE ("association_id", "gate_id", "attested_by_user_id")
);

-- Lookup index: dashboard queries by (association_id, gate_id) to fetch
-- the most-recent attestation per gate. Ordering by attested_at desc.
CREATE INDEX IF NOT EXISTS "go_live_gate_attestations_assoc_gate_idx"
  ON "go_live_gate_attestations" ("association_id", "gate_id", "attested_at" DESC);
