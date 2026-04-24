-- Migration: Add amenities_enabled column to associations
-- Context: 4.2 Q3 addendum (3a) — per-association amenities feature toggle.
-- Defaults to 1 (enabled) so existing associations preserve current behavior.
-- When 0, the owner-portal amenities entry is hidden, /portal/amenities 404s,
-- and amenity-reservation APIs return 404.

ALTER TABLE associations
  ADD COLUMN IF NOT EXISTS amenities_enabled integer NOT NULL DEFAULT 1;
