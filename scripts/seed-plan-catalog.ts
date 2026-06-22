/**
 * seed-plan-catalog.ts — Insert canonical plan_catalog rows.
 *
 * Usage:
 *   npx tsx scripts/seed-plan-catalog.ts
 *
 * Idempotent: uses ON CONFLICT (plan_key) DO UPDATE so re-runs
 * refresh pricing without duplicating rows.
 */

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

const PLANS = [
  // ── Self-Managed Tiers — DECLINING per-unit rate by community tier
  //    (William-ratified 2026-06-21). The per-unit rate FALLS as the community
  //    grows; Small is a flat $129/mo floor (the only minimum). Mid/Large are
  //    pure per-unit — at each tier's entry the per-unit bill naturally exceeds
  //    the floor (41×$3.75=$153.75; 101×$3.50=$353.50), so they carry NO
  //    separate minimum. Enterprise Concierge (251+) is custom / manual billing.
  //
  //    For per_door (per-unit) tiers, `monthly_amount_cents` holds the per-UNIT
  //    rate (375 / 350 ¢) — exactly mirroring how the PM per-door tiers store the
  //    per-DOOR rate there; the app's pricing-service computes units × that rate.
  {
    plan_key: "small_community",
    account_type: "self_managed",
    display_name: "Small Community",
    status: "active",
    pricing_model: "flat_per_association",
    unit_min: 1,
    unit_max: 40,
    currency: "USD",
    billing_frequency_supported: JSON.stringify(["monthly", "annual"]),
    monthly_amount_cents: 12900, // $129/mo flat (the floor / only minimum)
    minimum_amount_cents: 12900, // $129/mo floor
    annual_effective_monthly_cents: 11610, // ~10% off → $116.10/mo equivalent
    annual_billed_amount_cents: 139320, // $1,393.20/yr (12 × $116.10)
    stripe_price_id: "price_1TkqUKAoad3tIYtu3cRGnKA9", // LIVE — $129 flat
    stripe_product_id: "prod_UkLAYuRGJoCriv",
    recommended_in_signup: 0,
    version: 2,
    effective_from: new Date().toISOString(),
    effective_to: null,
    metadata: null,
  },
  {
    plan_key: "mid_community",
    account_type: "self_managed",
    display_name: "Mid Community",
    status: "active",
    pricing_model: "per_door",
    unit_min: 41,
    unit_max: 100,
    currency: "USD",
    billing_frequency_supported: JSON.stringify(["monthly", "annual"]),
    monthly_amount_cents: 375, // $3.75/unit/mo (per-unit rate)
    minimum_amount_cents: null, // no separate minimum (41 × $3.75 = $153.75 > $129 floor)
    annual_effective_monthly_cents: null, // per-unit annual computed at billing time (~10% off)
    annual_billed_amount_cents: null,
    stripe_price_id: "price_1TkqULAoad3tIYtu3fU7JTxb", // LIVE — $3.75/unit metered
    stripe_product_id: "prod_UkLAExI87koG5n",
    recommended_in_signup: 1, // "Most chosen" — center-stage tier
    version: 2,
    effective_from: new Date().toISOString(),
    effective_to: null,
    metadata: null,
  },
  {
    plan_key: "large_community",
    account_type: "self_managed",
    display_name: "Large Community",
    status: "active",
    pricing_model: "per_door",
    unit_min: 101,
    unit_max: 250,
    currency: "USD",
    billing_frequency_supported: JSON.stringify(["monthly", "annual"]),
    monthly_amount_cents: 350, // $3.50/unit/mo (per-unit rate)
    minimum_amount_cents: null, // no separate minimum (101 × $3.50 = $353.50 > $129 floor)
    annual_effective_monthly_cents: null,
    annual_billed_amount_cents: null,
    stripe_price_id: "price_1TkqUMAoad3tIYtub6TWZvdx", // LIVE — $3.50/unit metered
    stripe_product_id: "prod_UkLArcTqDSRFTD",
    recommended_in_signup: 0,
    version: 2,
    effective_from: new Date().toISOString(),
    effective_to: null,
    metadata: null,
  },
  {
    plan_key: "enterprise_concierge",
    account_type: "self_managed",
    display_name: "Enterprise Concierge",
    status: "active",
    pricing_model: "enterprise_manual",
    unit_min: 251,
    unit_max: null,
    currency: "USD",
    billing_frequency_supported: JSON.stringify(["monthly", "annual"]),
    monthly_amount_cents: null, // custom / negotiable — manual billing
    minimum_amount_cents: null,
    annual_effective_monthly_cents: null,
    annual_billed_amount_cents: null,
    stripe_price_id: null, // manual / enterprise — no self-serve price
    stripe_product_id: "prod_UkLAYN8Uh5Nf4f",
    recommended_in_signup: 0,
    version: 2,
    effective_from: new Date().toISOString(),
    effective_to: null,
    metadata: null,
  },

  // ── PM Tiers — DECLINING per-door rate by tier (volume discount;
  //    William-ratified 2026-06-21). Tier resolved by PORTFOLIO total doors;
  //    tier MEMBERSHIP gates features, sets the monthly minimum, AND sets a
  //    DECLINING per-door rate that falls as the portfolio grows:
  //      Starter $4.50/door · Growth $4.25/door · Scale $4.00/door · Ent custom.
  //    Each minimum = per-door rate × the tier's ENTRY door count (continuous
  //    ladder): Growth ≈ 501×$4.25 ≈ $2,125; Scale ≈ 2,001×$4.00 ≈ $8,000.
  //    Starter keeps a small-account floor of $500.
  {
    plan_key: "pm_starter",
    account_type: "property_manager",
    display_name: "PM Starter",
    status: "active",
    pricing_model: "per_door",
    unit_min: 1,
    unit_max: 500,
    currency: "USD",
    billing_frequency_supported: JSON.stringify(["monthly"]),
    monthly_amount_cents: 450, // $4.50/door
    minimum_amount_cents: 50000, // $500/mo minimum (small-account floor)
    annual_effective_monthly_cents: null,
    annual_billed_amount_cents: null,
    stripe_price_id: "price_1Tkpt4Aoad3tIYtusCTuDL63", // LIVE — PM Starter
    stripe_product_id: "prod_UkKYLxHm8res10",
    recommended_in_signup: 0,
    version: 3,
    effective_from: new Date().toISOString(),
    effective_to: null,
    metadata: null,
  },
  {
    plan_key: "pm_growth",
    account_type: "property_manager",
    display_name: "PM Growth",
    status: "active",
    pricing_model: "per_door",
    unit_min: 501,
    unit_max: 2000,
    currency: "USD",
    billing_frequency_supported: JSON.stringify(["monthly"]),
    monthly_amount_cents: 425, // $4.25/door
    minimum_amount_cents: 212500, // $2,125/mo minimum (= 501 × $4.25, rounded)
    annual_effective_monthly_cents: null,
    annual_billed_amount_cents: null,
    stripe_price_id: "price_1Tkpt5Aoad3tIYtu5clAM5pV", // LIVE — PM Growth
    stripe_product_id: "prod_UkKYCEf1KQulZB",
    recommended_in_signup: 1, // center-stage tier
    version: 3,
    effective_from: new Date().toISOString(),
    effective_to: null,
    metadata: null,
  },
  {
    plan_key: "pm_scale",
    account_type: "property_manager",
    display_name: "PM Scale",
    status: "active",
    pricing_model: "per_door",
    unit_min: 2001,
    unit_max: 5000,
    currency: "USD",
    billing_frequency_supported: JSON.stringify(["monthly"]),
    monthly_amount_cents: 400, // $4.00/door
    minimum_amount_cents: 800000, // $8,000/mo minimum (= 2,001 × $4.00, rounded)
    annual_effective_monthly_cents: null,
    annual_billed_amount_cents: null,
    stripe_price_id: "price_1Tkpt6Aoad3tIYtup5EBImuB", // LIVE — PM Scale
    stripe_product_id: "prod_UkKYDKxhK26oyL",
    recommended_in_signup: 0,
    version: 3,
    effective_from: new Date().toISOString(),
    effective_to: null,
    metadata: null,
  },
  {
    plan_key: "pm_enterprise",
    account_type: "property_manager",
    display_name: "PM Enterprise Concierge",
    status: "active",
    pricing_model: "enterprise_manual",
    unit_min: 5001,
    unit_max: null,
    currency: "USD",
    billing_frequency_supported: JSON.stringify(["monthly"]),
    monthly_amount_cents: null, // custom — manual billing (~from $4/door)
    minimum_amount_cents: 1800000, // from $18,000/mo (reference; billed manually)
    annual_effective_monthly_cents: null,
    annual_billed_amount_cents: null,
    stripe_price_id: null, // manual / enterprise — no self-serve price
    stripe_product_id: "prod_UkKY33jlwIF8ML",
    recommended_in_signup: 0,
    version: 3,
    effective_from: new Date().toISOString(),
    effective_to: null,
    metadata: null,
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const plan of PLANS) {
      await client.query(
        `INSERT INTO plan_catalog (
          plan_key, account_type, display_name, status, pricing_model,
          unit_min, unit_max, currency, billing_frequency_supported,
          monthly_amount_cents, minimum_amount_cents,
          annual_effective_monthly_cents, annual_billed_amount_cents,
          stripe_price_id, stripe_product_id,
          recommended_in_signup, version, effective_from, effective_to, metadata
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11,
          $12, $13,
          $14, $15,
          $16, $17, $18, $19, $20
        )
        ON CONFLICT (plan_key) DO UPDATE SET
          account_type = EXCLUDED.account_type,
          display_name = EXCLUDED.display_name,
          status = EXCLUDED.status,
          pricing_model = EXCLUDED.pricing_model,
          unit_min = EXCLUDED.unit_min,
          unit_max = EXCLUDED.unit_max,
          currency = EXCLUDED.currency,
          billing_frequency_supported = EXCLUDED.billing_frequency_supported,
          monthly_amount_cents = EXCLUDED.monthly_amount_cents,
          minimum_amount_cents = EXCLUDED.minimum_amount_cents,
          annual_effective_monthly_cents = EXCLUDED.annual_effective_monthly_cents,
          annual_billed_amount_cents = EXCLUDED.annual_billed_amount_cents,
          stripe_price_id = EXCLUDED.stripe_price_id,
          stripe_product_id = EXCLUDED.stripe_product_id,
          recommended_in_signup = EXCLUDED.recommended_in_signup,
          version = EXCLUDED.version,
          effective_from = EXCLUDED.effective_from,
          effective_to = EXCLUDED.effective_to,
          metadata = EXCLUDED.metadata,
          updated_at = now()`,
        [
          plan.plan_key, plan.account_type, plan.display_name, plan.status, plan.pricing_model,
          plan.unit_min, plan.unit_max, plan.currency, plan.billing_frequency_supported,
          plan.monthly_amount_cents, plan.minimum_amount_cents,
          plan.annual_effective_monthly_cents, plan.annual_billed_amount_cents,
          plan.stripe_price_id, plan.stripe_product_id,
          plan.recommended_in_signup, plan.version, plan.effective_from, plan.effective_to, plan.metadata,
        ],
      );
      console.log(`  ✓ ${plan.plan_key} (${plan.display_name})`);
    }

    // Retire the superseded per-complex PM rows (archive-not-delete: status flip,
    // never DELETE — preserves any historical references). Idempotent.
    const RETIRED_PM_KEYS = ["pm_tier_1", "pm_tier_2", "pm_tier_3"];
    const retired = await client.query(
      `UPDATE plan_catalog
         SET status = 'retired', effective_to = now(), updated_at = now()
       WHERE plan_key = ANY($1::text[]) AND status <> 'retired'`,
      [RETIRED_PM_KEYS],
    );
    if (retired.rowCount && retired.rowCount > 0) {
      console.log(`  ⌁ retired ${retired.rowCount} superseded per-complex PM row(s)`);
    }

    await client.query("COMMIT");
    console.log(`\nSeeded ${PLANS.length} plan_catalog rows.`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
