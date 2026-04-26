-- Migration: Drop FK constraint on amenity_reservations.approved_by
-- Context: Wave 49 amenity gap-audit follow-up.
-- The original 0001_amenity_booking.sql defined approved_by as a varchar with
-- a foreign-key reference to persons(id). However, the admin PATCH handler
-- (PATCH /api/amenity-reservations/:id) approves/rejects reservations as an
-- admin user (admin_users.id), not as a person. The FK made it impossible to
-- write the approving admin without violating referential integrity, so the
-- column was never populated and the audit trail had a gap.
-- This migration drops the FK so the column can store admin_users.id values.
-- The column type stays varchar; data is unchanged (no rows to migrate, since
-- nothing was ever written to it).

ALTER TABLE "amenity_reservations"
  DROP CONSTRAINT IF EXISTS "amenity_reservations_approved_by_persons_id_fk";
