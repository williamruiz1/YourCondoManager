-- Migration 0031 — deletion_requests: GDPR/CCPA right-to-erasure flow
--
-- WS4 of the YCM Security Maturity roadmap (founder-os#1522). Owners submit
-- a deletion request via the portal; a platform-admin approves it; the
-- approval triggers PII anonymization on the user's records (name,
-- email, phone, address scrubbed) while financial records are retained
-- per the 7-year policy.
--
-- Status machine:
--   pending   — owner submitted; admin has not acted
--   approved  — admin approved + anonymization ran successfully
--   cancelled — owner withdrew the request before admin acted (future UI)
--
-- Note on migration number: the dispatch body (#1522) prescribed 0028,
-- but migrations 0027 / 0028 / 0029 / 0030 are all already taken on main
-- (onboarding_progress / onboarding_reminder_tracking / consent_records /
-- ai_assistant_interactions). 0031 is the next free slot.
--
-- Lineage:
--   - 2026-05-20 — Issue #1522 WS4. Depends on #342 (WS3 consent)
--     which shipped via migration 0029_consent_records.sql on 2026-05-19.

CREATE TABLE IF NOT EXISTS "deletion_requests" (
  "id"             varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"        text NOT NULL,
  "user_email"     text NOT NULL,
  "status"         text NOT NULL DEFAULT 'pending',
  "requested_at"   timestamp NOT NULL DEFAULT NOW(),
  "approved_at"    timestamp,
  "approved_by"    text,
  "cancelled_at"   timestamp,
  CONSTRAINT "deletion_requests_status_check"
    CHECK ("status" IN ('pending', 'approved', 'cancelled'))
);

-- Pending-request lookup per user. Used by the portal-side
-- "Request account deletion" endpoint to enforce one-pending-per-user
-- (POST returns 409 if another pending request exists).
CREATE INDEX IF NOT EXISTS "deletion_requests_user_id_status_idx"
  ON "deletion_requests" ("user_id", "status");

-- Admin-dashboard listing — pending requests sorted by request date.
CREATE INDEX IF NOT EXISTS "deletion_requests_status_requested_at_idx"
  ON "deletion_requests" ("status", "requested_at");

-- Grace-period sweep — approved-but-old requests for the 48h-pre-expiry flag.
-- (Sweep mechanism deferred to follow-on per dispatch §Scope; index lands
-- now so the sweep can run later without an additional migration.)
CREATE INDEX IF NOT EXISTS "deletion_requests_approved_at_idx"
  ON "deletion_requests" ("approved_at")
  WHERE "approved_at" IS NOT NULL;
