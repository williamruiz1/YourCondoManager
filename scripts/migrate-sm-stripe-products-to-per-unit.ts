/**
 * migrate-sm-stripe-products-to-per-unit.ts
 *
 * Migrates the Self-Managed Boards Stripe product layer to the canonical
 * DECLINING per-unit model (William-ratified 2026-06-21):
 *   Small Community      $129/mo FLAT (floor)
 *   Mid Community        $3.75/unit/mo (metered)
 *   Large Community      $3.50/unit/mo (metered)
 *   Enterprise Concierge custom / negotiable — manual billing (no price)
 *
 * What it does (idempotent, safe to re-run):
 *   1. ARCHIVES the 4 old SM flat-tier products (sets active:false). NEVER
 *      deletes. Looked up by the known product IDs.
 *   2. CREATES the new SM per-unit products + prices:
 *        - Small Community  → $129/mo flat recurring price.
 *        - Mid Community    → $3.75/unit metered price (backed by a Billing Meter).
 *        - Large Community  → $3.50/unit metered price (backed by a Billing Meter).
 *        - Enterprise Concierge → product only, manual billing (NO price).
 *      Looked up by metadata BEFORE creating — re-runs reuse existing.
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
 *   STRIPE_SECRET_KEY=sk_test_… npx tsx scripts/migrate-sm-stripe-products-to-per-unit.ts
 *   STRIPE_SECRET_KEY=sk_test_… npx tsx scripts/migrate-sm-stripe-products-to-per-unit.ts --dry-run
 *   STRIPE_SECRET_KEY=sk_live_… npx tsx scripts/migrate-sm-stripe-products-to-per-unit.ts --allow-live   # PRODUCTION
 *
 * Or: npm run migrate:sm-stripe-per-unit
 */

const STRIPE_API = "https://api.stripe.com/v1";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const ALLOW_LIVE = args.has("--allow-live");

const SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim();
if (!SECRET_KEY) {
  console.error(
    "STRIPE_SECRET_KEY is required.\n" +
      "  TEST:  STRIPE_SECRET_KEY=sk_test_… npx tsx scripts/migrate-sm-stripe-products-to-per-unit.ts\n" +
      "  LIVE:  STRIPE_SECRET_KEY=sk_live_… npx tsx scripts/migrate-sm-stripe-products-to-per-unit.ts --allow-live",
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

// ── Old SM flat-tier products to ARCHIVE (never delete) ───────────────────────
// The four legacy flat Self-Managed products ($89/$149/$249/$399).
// PM products are OUT OF SCOPE here.
const OLD_SM_PRODUCTS_TO_ARCHIVE = [
  { id: "prod_UUtQawl8VfLhfi", name: "Self-Managed Starter ($89)" },
  { id: "prod_UUtQ1il9HpIZ8K", name: "Self-Managed Standard ($149)" },
  { id: "prod_UUtQyeUxKM9nAV", name: "Self-Managed Professional ($249)" },
  { id: "prod_UUtQZj1zvgXhYl", name: "Self-Managed Enterprise ($399)" },
];

// ── New SM per-unit (declining) products to CREATE ────────────────────────────
type SmPriceKind = "flat" | "per_unit" | "manual";

type NewSmTier = {
  /** Stable lookup key, written to product metadata for idempotent re-runs. */
  planKey: string;
  name: string;
  unitMin: number;
  unitMax: number | null;
  kind: SmPriceKind;
  /** Flat monthly amount (cents) for the Small flat tier; null otherwise. */
  flatCents: number | null;
  /** Per-unit rate (cents) for Mid/Large; null otherwise. */
  perUnitCents: number | null;
};

// DECLINING per-unit rate by community tier. Small is a flat $129/mo floor;
// Mid/Large are pure per-unit at a falling rate; Enterprise is manual.
const NEW_SM_TIERS: NewSmTier[] = [
  { planKey: "small_community", name: "Small Community", unitMin: 1, unitMax: 40, kind: "flat", flatCents: 12900, perUnitCents: null }, // $129/mo flat
  { planKey: "mid_community", name: "Mid Community", unitMin: 41, unitMax: 100, kind: "per_unit", flatCents: null, perUnitCents: 375 }, // $3.75/unit
  { planKey: "large_community", name: "Large Community", unitMin: 101, unitMax: 250, kind: "per_unit", flatCents: null, perUnitCents: 350 }, // $3.50/unit
  { planKey: "enterprise_concierge", name: "Enterprise Concierge", unitMin: 251, unitMax: null, kind: "manual", flatCents: null, perUnitCents: null }, // custom · manual
];

const METADATA_NAMESPACE = "ycm_sm_per_unit_v1";

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
  console.log("\n── Archiving old SM flat-tier products (active:false; NEVER deleted) ──");
  for (const old of OLD_SM_PRODUCTS_TO_ARCHIVE) {
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

async function findExistingPrice(productId: string, kind: "flat" | "per_unit"): Promise<any | null> {
  const res: any = await stripe("GET", "/prices", {
    product: productId,
    active: "true",
    limit: 100,
  });
  return (res.data ?? []).find(
    (p: any) => p?.metadata?.[`${METADATA_NAMESPACE}_kind`] === kind,
  ) ?? null;
}

// ── Find or create the per-tier Billing Meter (per-unit metered prices must be
//    backed by a meter as of Stripe API 2025-03-31.basil). Idempotent by
//    event_name. The meter aggregates the SUM of reported unit-count usage. ────
async function findOrCreateMeter(tier: NewSmTier): Promise<{ id: string; created: boolean }> {
  const eventName = `ycm_sm_units_${tier.planKey}`;

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
    console.log(`    [dry-run] would create meter event_name=${eventName} (sum of units)`);
    return { id: "(dry-run-meter)", created: true };
  }

  const meter: any = await stripe("POST", "/billing/meters", {
    display_name: `${tier.name} — units managed`,
    event_name: eventName,
    "default_aggregation[formula]": "sum",
    "value_settings[event_payload_key]": "value",
    "customer_mapping[type]": "by_id",
    "customer_mapping[event_payload_key]": "stripe_customer_id",
  });
  console.log(`    ✓ created meter ${meter.id} (event_name=${eventName})`);
  return { id: meter.id, created: true };
}

// ── Create new SM per-unit products + prices ──────────────────────────────────
type CreatedTier = { planKey: string; productId: string; priceId: string | null; note: string };

async function createNewProducts(): Promise<CreatedTier[]> {
  console.log("\n── Creating new SM declining per-unit products + prices ──");
  const created: CreatedTier[] = [];

  for (const tier of NEW_SM_TIERS) {
    const productMetadata: Record<string, string> = {
      [`${METADATA_NAMESPACE}_plan_key`]: tier.planKey,
      pricing_model:
        tier.kind === "manual" ? "enterprise_manual" : tier.kind === "flat" ? "flat_per_association" : "per_door",
      unit_min: String(tier.unitMin),
      unit_max: tier.unitMax === null ? "inf" : String(tier.unitMax),
      flat_cents: tier.flatCents === null ? "n/a" : String(tier.flatCents),
      per_unit_cents: tier.perUnitCents === null ? "n/a" : String(tier.perUnitCents),
    };

    // 1. Find or create the product (idempotent by metadata plan_key).
    let product = await findExistingNewProduct(tier.planKey);
    if (product) {
      console.log(`  ✓ product exists: ${product.id} (${tier.name}) — reusing.`);
    } else if (DRY_RUN) {
      console.log(`  [dry-run] would create product "${tier.name}" (${tier.planKey})`);
      created.push({ planKey: tier.planKey, productId: "(dry-run)", priceId: tier.kind === "manual" ? null : "(dry-run)", note: "dry-run" });
      continue;
    } else {
      const description =
        tier.kind === "manual"
          ? `Self-Managed Enterprise Concierge — custom / negotiable, manual billing (unit range ${tier.unitMin}+).`
          : tier.kind === "flat"
            ? `Self-Managed ${tier.name} — $${((tier.flatCents ?? 0) / 100).toFixed(2)}/mo flat (unit range ${tier.unitMin}–${tier.unitMax}).`
            : `Self-Managed ${tier.name} — $${((tier.perUnitCents ?? 0) / 100).toFixed(2)}/unit/mo (unit range ${tier.unitMin}–${tier.unitMax}).`;
      const params: Record<string, string> = { name: tier.name, description };
      for (const [k, v] of Object.entries(productMetadata)) params[`metadata[${k}]`] = v;
      product = await stripe("POST", "/products", params);
      console.log(`  ✓ created product ${product.id} (${tier.name})`);
    }

    // 2. Enterprise = manual billing; no auto price.
    if (tier.kind === "manual") {
      created.push({
        planKey: tier.planKey,
        productId: product.id,
        priceId: null,
        note: "manual billing — no price (custom)",
      });
      continue;
    }

    // 3a. Small = flat $129/mo recurring price (licensed, not metered).
    if (tier.kind === "flat") {
      let price = await findExistingPrice(product.id, "flat");
      if (price) {
        console.log(`    ✓ price exists: ${price.id} ($129/mo flat) — reusing.`);
      } else if (DRY_RUN) {
        console.log(`    [dry-run] would create $129/mo flat price on ${product.id}`);
        price = { id: "(dry-run)" };
      } else {
        price = await stripe("POST", "/prices", {
          product: product.id,
          currency: "usd",
          unit_amount: tier.flatCents!, // 12900 ¢
          "recurring[interval]": "month",
          "recurring[usage_type]": "licensed",
          [`metadata[${METADATA_NAMESPACE}_kind]`]: "flat",
          "metadata[flat_cents]": String(tier.flatCents),
          nickname: `${tier.name} — $${((tier.flatCents ?? 0) / 100).toFixed(2)}/mo flat`,
        });
        console.log(`    ✓ created flat price ${price.id} ($${((tier.flatCents ?? 0) / 100).toFixed(2)}/mo)`);
      }
      created.push({
        planKey: tier.planKey,
        productId: product.id,
        priceId: price.id,
        note: `$${((tier.flatCents ?? 0) / 100).toFixed(2)}/mo flat (floor)`,
      });
      continue;
    }

    // 3b. Mid / Large = per-unit metered price (backed by a Billing Meter).
    let price = await findExistingPrice(product.id, "per_unit");
    if (price) {
      console.log(`    ✓ price exists: ${price.id} (per-unit metered) — reusing.`);
    } else if (DRY_RUN) {
      await findOrCreateMeter(tier);
      console.log(`    [dry-run] would create $${((tier.perUnitCents ?? 0) / 100).toFixed(2)}/unit metered price on ${product.id}`);
      price = { id: "(dry-run)" };
    } else {
      const meter = await findOrCreateMeter(tier);
      price = await stripe("POST", "/prices", {
        product: product.id,
        currency: "usd",
        unit_amount: tier.perUnitCents!, // 375 / 350 ¢
        billing_scheme: "per_unit",
        "recurring[interval]": "month",
        "recurring[usage_type]": "metered",
        "recurring[meter]": meter.id,
        [`metadata[${METADATA_NAMESPACE}_kind]`]: "per_unit",
        "metadata[per_unit_cents]": String(tier.perUnitCents),
        nickname: `${tier.name} — $${((tier.perUnitCents ?? 0) / 100).toFixed(2)}/unit/mo`,
      });
      console.log(`    ✓ created price ${price.id} ($${((tier.perUnitCents ?? 0) / 100).toFixed(2)}/unit metered)`);
    }
    created.push({
      planKey: tier.planKey,
      productId: product.id,
      priceId: price.id,
      note: `$${((tier.perUnitCents ?? 0) / 100).toFixed(2)}/unit metered`,
    });
  }

  return created;
}

async function main() {
  const mode = IS_LIVE ? "LIVE ⚠️" : "TEST";
  console.log(`\n═══ SM Stripe declining per-unit migration ═══`);
  console.log(`Mode: ${mode}${DRY_RUN ? " (DRY RUN — no writes)" : ""}`);
  console.log(`Safety: archive-not-delete · ZERO subscription mutations · idempotent`);

  await archiveOldProducts();
  const created = await createNewProducts();

  console.log("\n── New SM product / price IDs ──");
  for (const c of created) {
    console.log(
      `  ${c.planKey.padEnd(22)} product=${c.productId}  price=${c.priceId ?? "(manual)"}  [${c.note}]`,
    );
  }
  console.log("\n✅ Migration complete. No customer subscriptions were touched.\n");
}

main().catch((err) => {
  console.error("\n❌ Migration failed:", err.message);
  process.exit(1);
});
