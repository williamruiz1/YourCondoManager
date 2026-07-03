-- Migration 0041 — PM per-door billing model
--
-- Migrates the Property-Manager billing layer from the per-complex model to the
-- canonical $4/door FLAT model (pricing-model-v3 §2 + §9).
--
-- Two additive, idempotent changes:
--   1. Extends the `pricing_model` enum with the `per_door` variant.
--   2. Adds a `minimum_amount_cents` column to `plan_catalog` so the per-tier
--      monthly minimum ($500 / $2,000 / $5,000 / $12,500) can be encoded on the
--      plan row.
--
-- Idempotent + additive ONLY: `ALTER TYPE ... ADD VALUE IF NOT EXISTS` (PG 9.6+,
-- guaranteed by the deployment target) and `ADD COLUMN IF NOT EXISTS`. No
-- destructive DDL, no data backfill, no enum value removal (Postgres cannot
-- drop enum values anyway — the old `per_complex` value is retained for lineage
-- and any historical rows; the seed flips the PM rows to `per_door`).

-- 1. Extend the pricing_model enum with per_door.
ALTER TYPE pricing_model ADD VALUE IF NOT EXISTS 'per_door';--> statement-breakpoint

-- 2. Per-tier monthly minimum (in cents). NULL for tiers/plans with no minimum.
ALTER TABLE "plan_catalog" ADD COLUMN IF NOT EXISTS "minimum_amount_cents" integer;
