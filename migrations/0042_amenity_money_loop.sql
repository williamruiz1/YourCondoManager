-- Migration 0042 — amenity rental money loop (YCM Financial Core Phase 3)
--
-- Audit anchor: audits/AUDIT-financial-reporting-orchestration.md Gap F1 (Phase 3).
-- Build anchor: audits/YCM-financial-build-plan-2026-06-20.md Phase 3 — amenity
--               money loop ("a clubhouse booking charges a fee, holds + refunds a
--               deposit, and posts to the GL as a real liability").
--
-- FORWARD-ONLY / PARALLEL / ADDITIVE (per BLINDSPOT F4):
--   * ADD COLUMN only. Creates no table; touches no existing column or row; does
--     no destructive DDL; backfills no live data.
--   * Every new column DEFAULTs to 0, so existing amenities stay free and
--     existing reservations carry no fee/deposit — the live booking path is
--     unchanged. Nothing posts to the GL automatically: amenity postings are
--     DERIVED from these columns by server/services/gl/amenity-posting-service.ts
--     and gated behind GL_ENABLED (default OFF). The GL is NOT source-of-truth.
--   * Money is stored in INTEGER CENTS so GL Σdebits == Σcredits is exact.
--
-- Idempotent: every ADD COLUMN uses IF NOT EXISTS so re-running against an
-- already-migrated DB is a no-op.

-- ── amenities — what a booking CAN charge ─────────────────────────────────────
-- usage_fee_cents : the usage fee billed when this amenity is booked (income).
-- deposit_cents   : the refundable deposit held on booking (a liability).
ALTER TABLE amenities
  ADD COLUMN IF NOT EXISTS usage_fee_cents integer NOT NULL DEFAULT 0;
ALTER TABLE amenities
  ADD COLUMN IF NOT EXISTS deposit_cents integer NOT NULL DEFAULT 0;

-- ── amenity_reservations — the money STATE of a booking (GL source facts) ──────
-- fee_charged_cents       : usage fee billed for this booking.
-- deposit_held_cents      : refundable deposit held (a liability until resolved).
-- deposit_refunded_cents  : portion of the held deposit refunded on checkout.
-- deposit_forfeited_cents : portion of the held deposit forfeited → income.
ALTER TABLE amenity_reservations
  ADD COLUMN IF NOT EXISTS fee_charged_cents integer NOT NULL DEFAULT 0;
ALTER TABLE amenity_reservations
  ADD COLUMN IF NOT EXISTS deposit_held_cents integer NOT NULL DEFAULT 0;
ALTER TABLE amenity_reservations
  ADD COLUMN IF NOT EXISTS deposit_refunded_cents integer NOT NULL DEFAULT 0;
ALTER TABLE amenity_reservations
  ADD COLUMN IF NOT EXISTS deposit_forfeited_cents integer NOT NULL DEFAULT 0;

-- Note: the 2300 "Amenity Deposits Held" liability + 4445 "Amenity Rental Income"
-- GL accounts are seeded per-association at posting time by the chart-of-accounts
-- seeder (server/services/gl/posting.ts CHART_OF_ACCOUNTS), not by this DDL —
-- consistent with how the Phase-1 dues GL seeds its chart. No row writes here.
