-- Migration 0046 — Stripe price/product IDs on plan_catalog
--
-- Wires the customer signup → subscribe → pay flow to real Stripe products by
-- storing each plan tier's LIVE Stripe price + product id directly on its
-- plan_catalog row. The public signup route then resolves the Stripe price from
-- plan_catalog by the unit/door-resolved tier — no hardcoded price IDs in the
-- frontend, no separate secrets-blob to keep in sync with the tier table.
--
-- Two additive, idempotent columns. No destructive DDL, no data backfill here
-- (the seed `scripts/seed-plan-catalog.ts` writes the values via ON CONFLICT
-- DO UPDATE). Forward-only.

-- Stripe Price id (price_...) the checkout/subscription uses as the line item.
ALTER TABLE "plan_catalog" ADD COLUMN IF NOT EXISTS "stripe_price_id" text;--> statement-breakpoint

-- Stripe Product id (prod_...) — reference for the price's parent product.
ALTER TABLE "plan_catalog" ADD COLUMN IF NOT EXISTS "stripe_product_id" text;
