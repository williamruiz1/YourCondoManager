-- Migration 0061 — records_requests / records_request_items backfill.
--
-- Root cause (discovered 2026-07-13 during the money-precision/statutory-records
-- merge sequence): PR #293 ("CT CGS §47-260 retention engine + owner
-- records-request workflow") added `recordsRequests` / `recordsRequestItems` +
-- their 3 enums to shared/schema.ts, but no corresponding migration .sql file
-- was ever committed and `db:push` was apparently never run against a real
-- database. Confirmed via live query against BOTH yourcondomanager (prod) and
-- yourcondomanager-staging: `to_regclass('public.records_requests')` returns
-- NULL on both — the table has never existed anywhere. This was silently
-- dormant (nothing in production code paths ever executed a query against it
-- in a way that surfaced) until migration `statutory_records` (PR #427) added
-- the FIRST foreign-key reference to `records_requests`, which forced Postgres
-- to resolve it and fail — blocking the entire staging->prod deploy gate for
-- every subsequent merge.
--
-- This migration MUST run BEFORE statutory_records (its FK depends on this
-- table existing) — hence numbered 0061, with statutory_records/board_decisions
-- shifted to 0062/0063 (renamed only; their content is untouched — neither had
-- ever successfully applied to any real database, confirmed via
-- drizzle.__drizzle_migrations on both prod and staging showing the last
-- applied id corresponds to migration 0060).
--
-- Pure ADDITIVE backfill: creates the 3 enums + 2 tables exactly as declared
-- in shared/schema.ts, matching PR #293's original intent. Zero destructive
-- DDL, zero existing-table exposure, zero data backfill (both tables start
-- empty — no owner records-request has ever been able to be created against
-- a table that didn't exist). Idempotent via IF NOT EXISTS.

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
    CREATE TYPE "records_withholding_class" AS ENUM ('none', 'mandatory', 'permissive');
  END IF;
END $$;--> statement-breakpoint

-- ── enum: records_request_status ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'records_request_status') THEN
    CREATE TYPE "records_request_status" AS ENUM (
      'received', 'dates_offered', 'examined', 'fulfilled', 'withheld', 'closed'
    );
  END IF;
END $$;--> statement-breakpoint

-- ── table: records_requests ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "records_requests" (
  "id"                 varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "association_id"     varchar NOT NULL REFERENCES "associations"("id"),
  "ownership_id"       varchar REFERENCES "ownerships"("id"),
  "requester_name"     text NOT NULL,
  "requester_email"    text,
  "records_requested"  text NOT NULL,
  "received_at"        timestamp NOT NULL,
  "response_due_at"    timestamp NOT NULL,
  "exam_date_1"        timestamp,
  "exam_date_2"        timestamp,
  "status"             "records_request_status" NOT NULL DEFAULT 'received',
  "copy_fee_cents"     integer,
  "page_count"         integer,
  "fulfilled_at"       timestamp,
  "notes"              text,
  "created_at"         timestamp NOT NULL DEFAULT now(),
  "updated_at"         timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "records_requests_association_idx"
  ON "records_requests" ("association_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "records_requests_status_idx"
  ON "records_requests" ("association_id", "status");--> statement-breakpoint

-- ── table: records_request_items ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "records_request_items" (
  "id"                  varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "request_id"          varchar NOT NULL REFERENCES "records_requests"("id"),
  "association_id"      varchar NOT NULL REFERENCES "associations"("id"),
  "record_type"         "records_record_type" NOT NULL,
  "document_id"         varchar REFERENCES "documents"("id"),
  "label"               text NOT NULL,
  "withholding_class"   "records_withholding_class" NOT NULL DEFAULT 'none',
  "withholding_reason"  text,
  "included"            integer NOT NULL DEFAULT 1,
  "created_at"          timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "records_request_items_request_idx"
  ON "records_request_items" ("request_id");--> statement-breakpoint
