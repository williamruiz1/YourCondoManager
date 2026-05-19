-- Migration 0029 — consent_records: GDPR/CCPA-compliant consent capture
--
-- WS3 of the YCM Security Maturity roadmap (founder-os#342). On every
-- first-login at the current policy version we insert one row with the
-- user's identity + the version they agreed to + IP + UA. Bumping
-- CURRENT_POLICY_VERSION in shared/policy-version.ts triggers re-consent
-- automatically because the lookup checks (user_id, policy_version).
--
-- Note on migration number: the spec body says 0025; main has moved past
-- that (last applied migration is 0028_onboarding_reminder_tracking from
-- the #1617 wizard reminder cadence). 0029 is the next free slot. The
-- schema content is unchanged from the spec.
--
-- Lineage:
--   - 2026-05-19 — Issue #342 (WS3 consent audit trail). Builds the
--     audit-trail floor that WS4 (deletion requests, #1522) depends on
--     for UX consistency.

CREATE TABLE IF NOT EXISTS "consent_records" (
  "id"             varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"        text NOT NULL,
  "user_email"     text NOT NULL,
  "policy_version" text NOT NULL,
  "consented_at"   timestamp NOT NULL DEFAULT NOW(),
  "ip_address"     text,
  "user_agent"     text
);

-- Per-user lookup. The hasConsented check is (user_id, policy_version)
-- so the composite index covers it.
CREATE INDEX IF NOT EXISTS "consent_records_user_id_idx"
  ON "consent_records" ("user_id");

-- Re-consent freshness lookup: "has this user consented to THIS version?"
CREATE INDEX IF NOT EXISTS "consent_records_user_version_idx"
  ON "consent_records" ("user_id", "policy_version");
