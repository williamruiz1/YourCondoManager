/**
 * migrate-pm-stripe-products-to-per-door.ts
 *
 * Migrates the Property-Manager Stripe product layer from the per-complex model
 * to the canonical $4/door FLAT model (pricing-model-v3 §2 + §9).
 *
 * What it does (idempotent, safe to re-run):
 *   1. ARCHIVES the 2 old PM-per-complex products (sets active:false). NEVER
 *      deletes. Looked up by the known product IDs from §9.1.
 *   2. CREATES the new PM $4/door products + prices with the per-tier monthly
 *      minimums (Starter / Growth / Scale) + PM Enterprise (manual billing).
 *      Looked up by name/metadata BEFORE creating — re-runs reuse existing.
 *   3. PRINTS the resulting product + price IDs.
 *
 * Hard safety constraints (enforced in code):
 *   - Archive, never delete.
 *   - NEVER modifies, cancels, lists, or migrates any customer SUBSCRIPTION.
 *     This script touches ONLY products + prices.
 *   - LIVE-mode (sk_live_…) execution is GATED behind --allow-live. Without it,
 *     a live key aborts. Default expectation is TEST mode (sk_test_…).
 *   - --dry-run prints the plan without any Stripe writes.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_… npx tsx scripts/migrate-pm-stripe-products-to-per-door.ts
 *   STRIPE_SECRET_KEY=sk_test_… npx tsx scripts/migrate-pm-stripe-products-to-per-door.ts --dry-run
 *   STRIPE_SECRET_KEY=sk_live_… npx tsx scripts/migrate-pm-stripe-products-to-per-door.ts --allow-live   # PRODUCTION
 *
 * Or: npm run migrate:pm-stripe-per-door
 */

const STRIPE_API = "https://api.stripe.com/v1";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const ALLOW_LIVE = args.has("--allow-live");

const SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim();
if (!SECRET_KEY) {
  console.error(
    "STRIPE_SECRET_KEY is required.\n" +
      "  TEST:  STRIPE_SECRET_KEY=sk_test_… npx tsx scripts/migrate-pm-stripe-products-to-per-door.ts\n" +
      "  LIVE:  STRIPE_SECRET_KEY=sk_live_… npx tsx scripts/migrate-pm-stripe-products-to-per-door.ts --allow-live",
  );
  process.exit(1);
}

const IS_LIVE = SECRET_KEY.startsWith("sk_live_") || SECRET_KEY.startsWith("rk_live_");
if (IS_LIVE && !ALLOW_LIVE) {
  console.error(
    "\n⛔ REFUSING to run against a LIVE Stripe key without --allow-live.\n" +
      "   This migration archives + creates PRODUCTION products. Re-run with\n" +
      "   --allow-live only when you intend to mutate the live YCM Stripe account.\n",
  );
  process.exit(2);
}

// ── §9.1 — old PM-per-complex products to ARCHIVE (never delete) ──────────────
// Only the two PM-per-complex products. Self-Managed products are OUT OF SCOPE.
const OLD_PM_PRODUCTS_TO_ARCHIVE = [
  { id: "prod_UUtQ3kJc462z84", name: "PM Starter ($30/complex)" },
  { id: "prod_UUtQra4XDbd12e", name: "PM Growth ($50/complex)" },
];

// ── §9.2 — new PM $4/door products to CREATE ──────────────────────────────────
type NewPmTier = {
  /** Stable lookup key, written to product metadata for idempotent re-runs. */
  planKey: string;
  name: string;
  doorMin: number;
  doorMax: number | null;
  perDoorCents: number | null; // null = enterprise / manual
  minimumCents: number;
  manual: boolean;
};

const NEW_PM_TIERS: NewPmTier[] = [
  { planKey: "pm_starter", name: "PM Starter", doorMin: 1, doorMax: 500, perDoorCents: 400, minimumCents: 50000, manual: false },
  { planKey: "pm_growth", name: "PM Growth", doorMin: 501, doorMax: 2000, perDoorCents: 400, minimumCents: 200000, manual: false },
  { planKey: "pm_scale", name: "PM Scale", doorMin: 2001, doorMax: 5000, perDoorCents: 400, minimumCents: 500000, manual: false },
  { planKey: "pm_enterprise", name: "PM Enterprise Concierge", doorMin: 5001, doorMax: null, perDoorCents: null, minimumCents: 1250000, manual: true },
];

const METADATA_NAMESPACE = "ycm_pm_per_door_v3";

// ── Minimal Stripe REST helper (form-encoded) ─────────────────────────────────
async function stripe<T = any>(
  method: "GET" | "POST",
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${SECRET_KEY}`,
  };
  let url = `${STRIPE_API}${path}`;
  let body: string | undefined;
  if (params) {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) usp.set(k, String(v));
    }
    if (method === "GET") {
      url += `?${usp.toString()}`;
    } else {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = usp.toString();
    }
  }
  const resp = await fetch(url, { method, headers, body });
  const data = (await resp.json().catch(() => ({}))) as any;
  if (!resp.ok) {
    const msg = data?.error?.message ?? `Stripe ${resp.status}`;
    throw new Error(`Stripe API error (${method} ${path}): ${msg}`);
  }
  return data as T;
}

// ── Archive (never delete) ────────────────────────────────────────────────────
async function archiveOldProducts() {
  console.log("\n── Archiving old PM-per-complex products (active:false; NEVER deleted) ──");
  for (const old of OLD_PM_PRODUCTS_TO_ARCHIVE) {
    let existing: any = null;
    try {
      existing = await stripe("GET", `/products/${old.id}`);
    } catch (e) {
      console.log(`  ⚠ ${old.id} (${old.name}) — not found in THIS account/mode; skipping (ok in TEST).`);
      continue;
    }
    if (existing.active === false) {
      console.log(`  ✓ ${old.id} (${old.name}) — already archived (active:false); no-op.`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  [dry-run] would archive ${old.id} (${old.name}) → active:false`);
      continue;
    }
    const updated = await stripe("POST", `/products/${old.id}`, { active: "false" });
    console.log(`  ✓ archived ${updated.id} (${old.name}) → active:${updated.active}`);
  }
}

// ── Idempotent lookup of a product we previously created ──────────────────────
async function findExistingNewProduct(planKey: string): Promise<any | null> {
  // Search by our metadata namespace + planKey. Fall back to scanning active
  // products by name if the account predates Stripe Search availability.
  try {
    const q = `metadata['${METADATA_NAMESPACE}_plan_key']:'${planKey}'`;
    const res = await stripe("GET", "/products/search", { query: q, limit: 1 });
    if (res.data && res.data.length > 0) return res.data[0];
  } catch {
    // Search API may be unavailable on some accounts; fall through to list scan.
  }
  let startingAfter: string | undefined;
  for (let page = 0; page < 20; page++) {
    const res: any = await stripe("GET", "/products", {
      limit: 100,
      starting_after: startingAfter,
    });
    const hit = (res.data ?? []).find(
      (p: any) => p?.metadata?.[`${METADATA_NAMESPACE}_plan_key`] === planKey,
    );
    if (hit) return hit;
    if (!res.has_more) break;
    startingAfter = res.data[res.data.length - 1]?.id;
  }
  return null;
}

async function findExistingPerDoorPrice(productId: string): Promise<any | null> {
  const res: any = await stripe("GET", "/prices", {
    product: productId,
    active: "true",
    limit: 100,
  });
  return (res.data ?? []).find(
    (p: any) => p?.metadata?.[`${METADATA_NAMESPACE}_kind`] === "per_door",
  ) ?? null;
}

// ── Find or create the per-tier Billing Meter ($4/door metered prices must be
//    backed by a meter as of Stripe API 2025-03-31.basil). Idempotent by
//    event_name. The meter aggregates the SUM of reported door-count usage. ────
async function findOrCreateMeter(tier: NewPmTier): Promise<{ id: string; created: boolean } | null> {
  const eventName = `ycm_pm_doors_${tier.planKey}`;

  // List active meters and match by event_name.
  let startingAfter: string | undefined;
  for (let page = 0; page < 20; page++) {
    const res: any = await stripe("GET", "/billing/meters", {
      status: "active",
      limit: 100,
      starting_after: startingAfter,
    });
    const hit = (res.data ?? []).find((m: any) => m?.event_name === eventName);
    if (hit) return { id: hit.id, created: false };
    if (!res.has_more) break;
    startingAfter = res.data[res.data.length - 1]?.id;
  }

  if (DRY_RUN) {
    console.log(`    [dry-run] would create meter event_name=${eventName} (sum of doors)`);
    return { id: "(dry-run-meter)", created: true };
  }

  const meter: any = await stripe("POST", "/billing/meters", {
    display_name: `${tier.name} — doors managed`,
    event_name: eventName,
    "default_aggregation[formula]": "sum",
    "value_settings[event_payload_key]": "value",
    "customer_mapping[type]": "by_id",
    "customer_mapping[event_payload_key]": "stripe_customer_id",
  });
  console.log(`    ✓ created meter ${meter.id} (event_name=${eventName})`);
  return { id: meter.id, created: true };
}

// ── Create new $4/door products + prices ──────────────────────────────────────
type CreatedTier = { planKey: string; productId: string; priceId: string | null; note: string };

async function createNewProducts(): Promise<CreatedTier[]> {
  console.log("\n── Creating new PM $4/door products + prices ──");
  const created: CreatedTier[] = [];

  for (const tier of NEW_PM_TIERS) {
    const productMetadata: Record<string, string> = {
      [`${METADATA_NAMESPACE}_plan_key`]: tier.planKey,
      pricing_model: tier.manual ? "enterprise_manual" : "per_door",
      door_min: String(tier.doorMin),
      door_max: tier.doorMax === null ? "inf" : String(tier.doorMax),
      per_door_cents: tier.perDoorCents === null ? "custom" : String(tier.perDoorCents),
      minimum_amount_cents: String(tier.minimumCents),
    };

    // 1. Find or create the product (idempotent by metadata plan_key).
    let product = await findExistingNewProduct(tier.planKey);
    if (product) {
      console.log(`  ✓ product exists: ${product.id} (${tier.name}) — reusing.`);
    } else if (DRY_RUN) {
      console.log(`  [dry-run] would create product "${tier.name}" (${tier.planKey})`);
      created.push({ planKey: tier.planKey, productId: "(dry-run)", priceId: tier.manual ? null : "(dry-run)", note: "dry-run" });
      continue;
    } else {
      const params: Record<string, string> = {
        name: tier.name,
        description:
          tier.manual
            ? `PM Enterprise — custom from $4/door + concierge, manual billing (door range ${tier.doorMin}+).`
            : `PM ${tier.name.replace("PM ", "")} — $4.00/door/mo flat, $${(tier.minimumCents / 100).toLocaleString()}/mo minimum (door range ${tier.doorMin}–${tier.doorMax}).`,
      };
      for (const [k, v] of Object.entries(productMetadata)) params[`metadata[${k}]`] = v;
      product = await stripe("POST", "/products", params);
      console.log(`  ✓ created product ${product.id} (${tier.name})`);
    }

    // 2. Enterprise = manual billing; no auto price.
    if (tier.manual) {
      created.push({
        planKey: tier.planKey,
        productId: product.id,
        priceId: null,
        note: "manual billing — no price (custom)",
      });
      continue;
    }

    // 3. Find or create the $4/door metered price (backed by a Billing Meter).
    let price = await findExistingPerDoorPrice(product.id);
    if (price) {
      console.log(`    ✓ price exists: ${price.id} ($4/door metered) — reusing.`);
    } else if (DRY_RUN) {
      await findOrCreateMeter(tier);
      console.log(`    [dry-run] would create $4/door metered price on ${product.id}`);
      price = { id: "(dry-run)" };
    } else {
      const meter = await findOrCreateMeter(tier);
      price = await stripe("POST", "/prices", {
        product: product.id,
        currency: "usd",
        unit_amount: tier.perDoorCents!, // 400 = $4.00/door
        billing_scheme: "per_unit",
        "recurring[interval]": "month",
        "recurring[usage_type]": "metered",
        "recurring[meter]": meter!.id,
        // The monthly minimum floor is enforced in the app's pricing-service
        // (max(doors × $4, minimum)); recorded here as metadata for reference.
        [`metadata[${METADATA_NAMESPACE}_kind]`]: "per_door",
        "metadata[minimum_amount_cents]": String(tier.minimumCents),
        "metadata[per_door_cents]": String(tier.perDoorCents),
        nickname: `${tier.name} — $4/door/mo`,
      });
      console.log(`    ✓ created price ${price.id} ($4.00/door metered, min $${(tier.minimumCents / 100).toLocaleString()})`);
    }

    created.push({
      planKey: tier.planKey,
      productId: product.id,
      priceId: price.id,
      note: `$4/door metered · min $${(tier.minimumCents / 100).toLocaleString()}/mo`,
    });
  }

  return created;
}

async function main() {
  const mode = IS_LIVE ? "LIVE ⚠️" : "TEST";
  console.log(`\n═══ PM Stripe per-door migration ═══`);
  console.log(`Mode: ${mode}${DRY_RUN ? " (DRY RUN — no writes)" : ""}`);
  console.log(`Safety: archive-not-delete · ZERO subscription mutations · idempotent`);

  await archiveOldProducts();
  const created = await createNewProducts();

  console.log("\n── New PM product / price IDs ──");
  for (const c of created) {
    console.log(
      `  ${c.planKey.padEnd(14)} product=${c.productId}  price=${c.priceId ?? "(manual)"}  [${c.note}]`,
    );
  }
  console.log("\n✅ Migration complete. No customer subscriptions were touched.\n");
}

main().catch((err) => {
  console.error("\n❌ Migration failed:", err.message);
  process.exit(1);
});
