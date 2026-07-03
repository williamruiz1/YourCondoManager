-- Migration 0050 — Disbursement dual-approval (maker-checker) money-OUT control
--
-- HOA Remediation Phase 2 (artifacts/ycm/hoa-remediation-roadmap.html §Phase 2):
-- segregation of duties on disbursements — the #1 HOA embezzlement control. A
-- disbursement records a money-OUT request (payment to a vendor / vendor invoice)
-- that MUST be approved by a DIFFERENT admin than the one who created it
-- (maker ≠ checker) before it can be marked payable / paid.
--
-- NET-NEW / ADDITIVE / ZERO live-book exposure:
--   * Creates ONE new table (disbursements) + one new enum + one index. Touches
--     NO existing table, column, or row. Does no destructive DDL, no backfill.
--   * The disbursement lifecycle posts to NO existing money path — it does not
--     write the owner ledger, the GL, or any payout rail. It is an approval-gate
--     record that PRECEDES any real payment. Marking a disbursement "paid" here
--     records the approved-payment fact only.
--   * Amount is stored in INTEGER CENTS so money math is exact.
--
-- Idempotent: guarded with IF NOT EXISTS / DO-block so re-running is a no-op.

-- ── enum: disbursement_status ─────────────────────────────────────────────────
-- draft → pending-approval → approved → paid   (or → rejected)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disbursement_status') THEN
    CREATE TYPE "disbursement_status" AS ENUM (
      'draft',
      'pending-approval',
      'approved',
      'paid',
      'rejected'
    );
  END IF;
END $$;--> statement-breakpoint

-- ── table: disbursements ──────────────────────────────────────────────────────
-- created_by_admin_user_id  — the MAKER (accountable originator; notNull).
-- approved_by_admin_user_id — the CHECKER (a DIFFERENT admin; null until decided).
-- Maker ≠ checker is enforced SERVER-SIDE in the service layer (a person cannot
-- approve their own request), NOT in the DB — the DB stores the two identities;
-- the service refuses to write approved_by = created_by.
CREATE TABLE IF NOT EXISTS "disbursements" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "association_id" varchar NOT NULL REFERENCES "associations"("id"),
  "vendor_id" varchar REFERENCES "vendors"("id"),
  "vendor_name" text NOT NULL,
  "vendor_invoice_id" varchar REFERENCES "vendor_invoices"("id"),
  "amount_cents" integer NOT NULL,
  "memo" text,
  "status" "disbursement_status" NOT NULL DEFAULT 'draft',
  "created_by_admin_user_id" varchar NOT NULL REFERENCES "admin_users"("id"),
  "created_by_email" text NOT NULL,
  "approved_by_admin_user_id" varchar REFERENCES "admin_users"("id"),
  "approved_by_email" text,
  "approved_at" timestamp,
  "rejected_by_admin_user_id" varchar REFERENCES "admin_users"("id"),
  "rejected_by_email" text,
  "rejected_at" timestamp,
  "rejection_reason" text,
  "paid_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Tenant-scoped list index: disbursements by association + status + recency.
CREATE INDEX IF NOT EXISTS "disbursements_assoc_status_created_idx"
  ON "disbursements" ("association_id", "status", "created_at");
