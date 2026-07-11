-- Migration 0059 — Architectural Review Committee (ARC) workflow
--
-- founder-os dispatch #9481: owner architectural-change-request lifecycle —
-- intake → committee routing → decision capture → records → appeal path. The
-- agent moves a request through the WORKFLOW steps (intake, routing, recording
-- an appeal) — those are L2 plumbing. The APPROVE/DENY decision stays a HUMAN
-- committee decision, and a DENIAL is member-affecting (L4): the service layer
-- refuses any decision from a non-human actor, so an agent alone can never
-- actuate a denial. The DB stores WHO decided + the reasoning; the human gate
-- is enforced in server/services/arc-service.ts (belt-and-suspenders on top of
-- the route's requireAdmin + committee-role guard).
--
-- NET-NEW / ADDITIVE:
--   * Creates ONE new table (arc_requests) + one new enum + one index. Touches
--     NO existing table, column, or row. No destructive DDL, no backfill.
--   * Posts to NO money path (owner ledger, GL, payout rail) and to no existing
--     governance record. It is a self-contained review workflow.
--
-- Idempotent: guarded with IF NOT EXISTS / DO-block so re-running is a no-op.

-- ── enum: arc_request_status ──────────────────────────────────────────────────
-- submitted → under-review → approved | denied
-- denied → appealed → appeal-approved | appeal-denied
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'arc_request_status') THEN
    CREATE TYPE "arc_request_status" AS ENUM (
      'submitted',
      'under-review',
      'approved',
      'denied',
      'appealed',
      'appeal-approved',
      'appeal-denied'
    );
  END IF;
END $$;--> statement-breakpoint

-- ── table: arc_requests ───────────────────────────────────────────────────────
-- submitted_by_type          — 'owner' | 'admin' | 'agent' (who filed the intake).
-- decided_by_admin_user_id   — the HUMAN committee member who recorded the
--                              approve/deny decision (null until decided). The
--                              service refuses to record a decision whose actor
--                              is not a human — an agent alone cannot deny.
CREATE TABLE IF NOT EXISTS "arc_requests" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "association_id" varchar NOT NULL REFERENCES "associations"("id"),
  "unit_id" varchar REFERENCES "units"("id"),
  "title" text NOT NULL,
  "category" text,
  "description" text NOT NULL,
  "attachments" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" "arc_request_status" NOT NULL DEFAULT 'submitted',
  "submitted_by_type" text NOT NULL DEFAULT 'owner',
  "submitted_by_email" text NOT NULL,
  "submitted_by_person_id" varchar,
  "submitted_by_admin_user_id" varchar REFERENCES "admin_users"("id"),
  "routed_by_admin_user_id" varchar REFERENCES "admin_users"("id"),
  "routed_by_email" text,
  "routed_at" timestamp,
  "committee_note" text,
  "decided_by_admin_user_id" varchar REFERENCES "admin_users"("id"),
  "decided_by_email" text,
  "decided_at" timestamp,
  "decision_reason" text,
  "appeal_reason" text,
  "appealed_by_email" text,
  "appealed_at" timestamp,
  "appeal_decided_by_admin_user_id" varchar REFERENCES "admin_users"("id"),
  "appeal_decided_by_email" text,
  "appeal_decided_at" timestamp,
  "appeal_decision_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Tenant-scoped list index: ARC requests by association + status + recency.
CREATE INDEX IF NOT EXISTS "arc_requests_assoc_status_created_idx"
  ON "arc_requests" ("association_id", "status", "created_at");
