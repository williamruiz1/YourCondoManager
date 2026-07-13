-- Migration 0061 — Statutory records production.
--
-- founder-os#9483 (ratified 2026-07-04). The unifying ISSUANCE layer over the
-- statutory-document generators: intake a resale certificate (CGS §47-270,
-- #8013 generator), estoppel packet, or records-request (§47-260) response,
-- PIN its statutory deadline into the shared chief-of-staff agent-action queue
-- so the countdown is always visible, and GATE issuance at L3 (a recorded PM
-- sign) via the existing permission ladder.
--
-- NET-NEW / ADDITIVE / ZERO existing-table exposure:
--   * Creates one new table (statutory_records) + two new enums. References
--     existing tables (associations, units, persons, agent_actions,
--     records_requests, admin_users) by FK; touches NO existing table, column,
--     or row. No destructive DDL, no backfill.
--   * Tenant-isolated: association_id (FK associations.id) on the row.
--
-- Idempotent: guarded with IF NOT EXISTS / DO-blocks so re-running is a no-op.

-- ── enum: statutory_record_type ──────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'statutory_record_type') THEN
    CREATE TYPE "statutory_record_type" AS ENUM (
      'resale_certificate', 'estoppel_certificate', 'records_request'
    );
  END IF;
END $$;--> statement-breakpoint

-- ── enum: statutory_record_status ────────────────────────────────────────────
-- generated → (signed | rejected) → issued
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'statutory_record_status') THEN
    CREATE TYPE "statutory_record_status" AS ENUM (
      'generated', 'signed', 'issued', 'rejected'
    );
  END IF;
END $$;--> statement-breakpoint

-- ── table: statutory_records ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "statutory_records" (
  "id"                        varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "association_id"            varchar NOT NULL REFERENCES "associations"("id"),
  "record_type"              "statutory_record_type" NOT NULL,
  "status"                   "statutory_record_status" NOT NULL DEFAULT 'generated',
  "requester_name"           text NOT NULL,
  "requester_email"          text,
  "unit_id"                  varchar REFERENCES "units"("id"),
  "person_id"                varchar REFERENCES "persons"("id"),
  "received_at"              timestamp NOT NULL,
  "expedited"                integer NOT NULL DEFAULT 0,
  "deadline_at"              timestamp NOT NULL,
  "sla_business_days"        integer NOT NULL,
  "statute_citation"         text NOT NULL,
  "document_payload"         jsonb NOT NULL,
  "generated_at"             timestamp NOT NULL DEFAULT now(),
  "agent_action_id"          varchar REFERENCES "agent_actions"("id"),
  "linked_records_request_id" varchar REFERENCES "records_requests"("id"),
  "signed_by_user_id"        varchar REFERENCES "admin_users"("id"),
  "signed_by_email"          text,
  "signed_at"                timestamp,
  "issued_at"                timestamp,
  "rejected_reason"          text,
  "created_at"               timestamp NOT NULL DEFAULT now(),
  "updated_at"               timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "statutory_records_assoc_status_idx"
  ON "statutory_records" ("association_id", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "statutory_records_assoc_deadline_idx"
  ON "statutory_records" ("association_id", "deadline_at");--> statement-breakpoint
