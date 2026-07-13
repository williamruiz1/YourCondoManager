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
--   * Creates the records-requests base (records_requests + records_request_items
--     + 3 enums — the §47-260 substrate this migration's statutory_records FKs
--     into) AND statutory_records + its two enums. References existing tables
--     (associations, units, persons, agent_actions, admin_users, ownerships,
--     documents) by FK; touches NO existing table, column, or row. No
--     destructive DDL, no backfill.
--   * Tenant-isolated: association_id (FK associations.id) on every row.
--
-- Idempotent: guarded with IF NOT EXISTS / DO-blocks so re-running is a no-op.
--
-- ── records-requests base BACKFILL (founder-os#489 / YCM PR #489) ─────────────
-- PR #485 (per-state rules-engine, #9483) added recordsRequests /
-- recordsRequestItems + their 3 enums to shared/schema.ts WITHOUT a generated
-- migration, so `records_requests` never existed on any environment (prod probe:
-- to_regclass('public.records_requests') = NULL everywhere). This migration's
-- statutory_records.linked_records_request_id FKs that table, so `migrate()`
-- died at CREATE TABLE "statutory_records" on every fresh-DB replay → the staging
-- promotion gate went RED → all prod deploys skipped since ~01:52 EDT 2026-07-12,
-- blocking the merged board-memory feature (#9475) + money-safety fix (#10737).
-- We create the missing records-requests base HERE, before statutory_records
-- references it. Safe to fold into 0061 because 0061 has never applied on any
-- environment — there is no recorded hash to diverge from. All DDL is additive
-- and IF-NOT-EXISTS-guarded; it cannot touch existing tables/rows.

-- ── enum: records_request_status ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'records_request_status') THEN
    CREATE TYPE "records_request_status" AS ENUM (
      'received', 'dates_offered', 'examined', 'fulfilled', 'withheld', 'closed'
    );
  END IF;
END $$;--> statement-breakpoint

-- ── enum: records_record_type ────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'records_record_type') THEN
    CREATE TYPE "records_record_type" AS ENUM (
      'financial_statement', 'tax_return', 'ballot', 'proxy', 'voting_record',
      'receipts_expenditures', 'meeting_minutes', 'owner_roster',
      'organizational_docs', 'contract', 'other'
    );
  END IF;
END $$;--> statement-breakpoint

-- ── enum: records_withholding_class ──────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'records_withholding_class') THEN
    CREATE TYPE "records_withholding_class" AS ENUM (
      'none', 'mandatory', 'permissive'
    );
  END IF;
END $$;--> statement-breakpoint

-- ── table: records_requests (§47-260(b) owner records-inspection request) ─────
CREATE TABLE IF NOT EXISTS "records_requests" (
  "id"                varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "association_id"    varchar NOT NULL REFERENCES "associations"("id"),
  "ownership_id"      varchar REFERENCES "ownerships"("id"),
  "requester_name"    text NOT NULL,
  "requester_email"   text,
  "records_requested" text NOT NULL,
  "received_at"       timestamp NOT NULL,
  "response_due_at"   timestamp NOT NULL,
  "exam_date_1"       timestamp,
  "exam_date_2"       timestamp,
  "status"           "records_request_status" NOT NULL DEFAULT 'received',
  "copy_fee_cents"    integer,
  "page_count"        integer,
  "fulfilled_at"      timestamp,
  "notes"             text,
  "created_at"        timestamp NOT NULL DEFAULT now(),
  "updated_at"        timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "records_requests_association_idx"
  ON "records_requests" ("association_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "records_requests_status_idx"
  ON "records_requests" ("association_id", "status");--> statement-breakpoint

-- ── table: records_request_items (§47-260(c)/(d) per-record withholding) ──────
CREATE TABLE IF NOT EXISTS "records_request_items" (
  "id"                 varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "request_id"         varchar NOT NULL REFERENCES "records_requests"("id"),
  "association_id"     varchar NOT NULL REFERENCES "associations"("id"),
  "record_type"       "records_record_type" NOT NULL,
  "document_id"        varchar REFERENCES "documents"("id"),
  "label"              text NOT NULL,
  "withholding_class" "records_withholding_class" NOT NULL DEFAULT 'none',
  "withholding_reason" text,
  "included"           integer NOT NULL DEFAULT 1,
  "created_at"         timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "records_request_items_request_idx"
  ON "records_request_items" ("request_id");--> statement-breakpoint

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
