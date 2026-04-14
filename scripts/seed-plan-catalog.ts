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
  // ── Self-Managed Tiers ───────────────────────────────────────────────────
  {
    plan_key: "small_community",
    account_type: "self_managed",
    display_name: "Small Community",
    status: "active",
    pricing_model: "flat_per_association",
    unit_min: 1,
    unit_max: 30,
    currency: "USD",
    billing_frequency_supported: JSON.stringify(["monthly", "annual"]),
    monthly_amount_cents: 8900,
    annual_effective_monthly_cents: 7900,
    annual_billed_amount_cents: 94800,
    recommended_in_signup: 1,
    version: 1,
    effective_from: new Date().toISOString(),
    effective_to: null,
    metadata: null,
  },
  {
    plan_key: "mid_community",
    account_type: "self_managed",
    display_name: "Mid Community",
    status: "active",
    pricing_model: "flat_per_association",
    unit_min: 31,
    unit_max: 75,
    currency: "USD",
    billing_frequency_supported: JSON.stringify(["monthly", "annual"]),
    monthly_amount_cents: 13900,
    annual_effective_monthly_cents: 11900,
    annual_billed_amount_cents: 142800,
    recommended_in_signup: 0,
    version: 1,
    effective_from: new Date().toISOString(),
    effective_to: null,
    metadata: null,
  },
  {
    plan_key: "large_community",
    account_type: "self_managed",
    display_name: "Large Community",
    status: "active",
    pricing_model: "flat_per_association",
    unit_min: 76,
    unit_max: 200,
    currency: "USD",
    billing_frequency_supported: JSON.stringify(["monthly", "annual"]),
    monthly_amount_cents: 19900,
    annual_effective_monthly_cents: 16900,
    annual_billed_amount_cents: 202800,
    recommended_in_signup: 0,
    version: 1,
    effective_from: new Date().toISOString(),
    effective_to: null,
    metadata: null,
  },

  // ── PM Tiers ─────────────────────────────────────────────────────────────
  {
    plan_key: "pm_tier_1",
    account_type: "property_manager",
    display_name: "PM Tier 1",
    status: "active",
    pricing_model: "per_complex",
    unit_min: 1,
    unit_max: 30,
    currency: "USD",
    billing_frequency_supported: JSON.stringify(["monthly"]),
    monthly_amount_cents: 3000,
    annual_effective_monthly_cents: null,
    annual_billed_amount_cents: null,
    recommended_in_signup: 0,
    version: 1,
    effective_from: new Date().toISOString(),
    effective_to: null,
    metadata: null,
  },
  {
    plan_key: "pm_tier_2",
    account_type: "property_manager",
    display_name: "PM Tier 2",
    status: "active",
    pricing_model: "per_complex",
    unit_min: 31,
    unit_max: 75,
    currency: "USD",
    billing_frequency_supported: JSON.stringify(["monthly"]),
    monthly_amount_cents: 5000,
    annual_effective_monthly_cents: null,
    annual_billed_amount_cents: null,
    recommended_in_signup: 0,
    version: 1,
    effective_from: new Date().toISOString(),
    effective_to: null,
    metadata: null,
  },
  {
    plan_key: "pm_tier_3",
    account_type: "property_manager",
    display_name: "PM Tier 3 (Enterprise)",
    status: "active",
    pricing_model: "enterprise_manual",
    unit_min: 76,
    unit_max: null,
    currency: "USD",
    billing_frequency_supported: JSON.stringify(["monthly"]),
    monthly_amount_cents: null,
    annual_effective_monthly_cents: null,
    annual_billed_amount_cents: null,
    recommended_in_signup: 0,
    version: 1,
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
          monthly_amount_cents, annual_effective_monthly_cents, annual_billed_amount_cents,
          recommended_in_signup, version, effective_from, effective_to, metadata
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15, $16, $17
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
          annual_effective_monthly_cents = EXCLUDED.annual_effective_monthly_cents,
          annual_billed_amount_cents = EXCLUDED.annual_billed_amount_cents,
          recommended_in_signup = EXCLUDED.recommended_in_signup,
          version = EXCLUDED.version,
          effective_from = EXCLUDED.effective_from,
          effective_to = EXCLUDED.effective_to,
          metadata = EXCLUDED.metadata,
          updated_at = now()`,
        [
          plan.plan_key, plan.account_type, plan.display_name, plan.status, plan.pricing_model,
          plan.unit_min, plan.unit_max, plan.currency, plan.billing_frequency_supported,
          plan.monthly_amount_cents, plan.annual_effective_monthly_cents, plan.annual_billed_amount_cents,
          plan.recommended_in_signup, plan.version, plan.effective_from, plan.effective_to, plan.metadata,
        ],
      );
      console.log(`  ✓ ${plan.plan_key} (${plan.display_name})`);
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
