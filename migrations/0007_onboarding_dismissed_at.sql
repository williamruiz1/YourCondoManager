-- Migration: Add onboarding_dismissed_at column to admin_users
-- Context: 4.4 Q2 AC 5 — the post-signup onboarding banner on Home must
-- persist its dismissal per-admin-user so it does not re-appear after
-- the Manager explicitly closes it.
--
-- Column is nullable: NULL = banner may render (subject to completion checks);
-- any timestamp = banner is hidden from that moment forward.

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS onboarding_dismissed_at timestamp NULL;
