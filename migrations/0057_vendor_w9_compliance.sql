-- Migration 0056 — vendor compliance tracking: W-9 on-file date (founder-os#9482).
--
-- Vendor compliance (W-9 / COI / insurance-expiry) builds on existing substrate:
--   * insurance expiry     -> vendors.insurance_expires_at (already exists)
--   * COI document + file  -> the existing documents/document_tags substrate
--     (createVendorDocument tags a document with entityType="vendor"); no new
--     document store needed, just a "COI" documentType convention.
--   * W-9 status           -> THIS migration's net-new column.
--
-- NET-NEW / ADDITIVE / ZERO existing-table exposure: adds one nullable column
-- to `vendors`. Touches no other table, no destructive DDL, no backfill.
-- Idempotent: guarded with IF NOT EXISTS so re-running is a no-op.

ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "w9_received_at" timestamp;--> statement-breakpoint
