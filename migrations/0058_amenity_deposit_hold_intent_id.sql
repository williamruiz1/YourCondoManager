-- Migration 0058 — amenity deposit-hold PaymentIntent id (founder-os#10752 / A-STRIPE-003).
--
-- The amenity deposit-resolution path (refund/forfeit) locates the deposit-hold
-- PaymentIntent via the eventually-consistent Stripe Search API. A resolution
-- issued shortly after the hold — or any same-session resolution — can return no
-- hit, so the money op is skipped while the deposit stays authorized.
--
-- Fix: persist the deposit-hold PaymentIntent id on the reservation at hold time
-- and look it up DIRECTLY (strongly consistent). This column stores that id.
--
-- NET-NEW / ADDITIVE / ZERO existing-table exposure: adds ONE nullable column to
-- `amenity_reservations`. Touches no other table, no destructive DDL, no backfill.
-- Legacy reservations stay NULL and fall back to Stripe Search (gateway handles it).
-- Idempotent: guarded with IF NOT EXISTS so re-running is a no-op.

ALTER TABLE "amenity_reservations" ADD COLUMN IF NOT EXISTS "deposit_hold_intent_id" varchar;--> statement-breakpoint
