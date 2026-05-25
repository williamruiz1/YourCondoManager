/**
 * backfill-platform-subscription.ts — One-shot script to create a
 * platform_subscription for an existing association that was onboarded
 * before subscription billing was enforced.
 *
 * founder-os#1147 — Cherry Hill backfill canonical use case.
 *
 * Usage:
 *   npx tsx scripts/backfill-platform-subscription.ts \
 *     --association <association-id-or-name> \
 *     --plan self-managed \
 *     --email <admin-email> \
 *     [--unitCount <n>] \
 *     [--trialDays 0] \
 *     [--priceId price_xxx] \
 *     [--dry-run]
 *
 * Behavior:
 *   1. Resolves the association by id (if it looks like a UUID) or by name.
 *   2. Verifies no active platform_subscription already exists.
 *   3. Creates a Stripe Customer for the association (or reuses the one
 *      attached to a canceled subscription if present).
 *   4. Creates a Stripe Subscription using either the explicit --priceId
 *      or the canonical STRIPE_PLAN_PRICE_IDS secret (matches the
 *      /api/admin/platform/subscriptions endpoint logic).
 *   5. Inserts (or reactivates) a platform_subscriptions row reflecting
 *      the new Stripe sub.
 *
 * Run with --dry-run to verify what the script would do without touching
 * Stripe or the database.
 */

import { db } from "../server/db";
import { associations, platformSubscriptions, type InsertPlatformSubscription } from "@shared/schema";
import { eq, or, like } from "drizzle-orm";
import { getSecret } from "../server/platform-secrets-store";

type Args = {
  associationKey?: string;
  plan: "self-managed" | "property-manager" | "enterprise";
  email?: string;
  unitCount?: number;
  trialDays: number;
  priceId?: string;
  dryRun: boolean;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const out: Args = { plan: "self-managed", trialDays: 0, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = () => args[++i];
    switch (a) {
      case "--association":
        out.associationKey = next();
        break;
      case "--plan":
        out.plan = next() as Args["plan"];
        break;
      case "--email":
        out.email = next();
        break;
      case "--unitCount":
        out.unitCount = parseInt(next(), 10);
        break;
      case "--trialDays":
        out.trialDays = parseInt(next(), 10);
        break;
      case "--priceId":
        out.priceId = next();
        break;
      case "--dry-run":
        out.dryRun = true;
        break;
      default:
        console.warn(`Unknown arg: ${a}`);
    }
  }
  return out;
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

async function stripeRequest(
  secretKey: string,
  method: string,
  path: string,
  body?: URLSearchParams,
): Promise<Record<string, unknown>> {
  const resp = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body?.toString(),
  });
  const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resp.ok) {
    const errMsg = (data.error as { message?: string })?.message ?? `Stripe error ${resp.status}`;
    throw new Error(errMsg);
  }
  return data;
}

async function main() {
  const args = parseArgs();
  if (!args.associationKey) {
    console.error("--association is required (id or name)");
    process.exit(1);
  }
  if (!args.email) {
    console.error("--email is required");
    process.exit(1);
  }

  // Resolve association.
  const lookupRows = isUuid(args.associationKey)
    ? await db.select().from(associations).where(eq(associations.id, args.associationKey))
    : await db.select().from(associations).where(like(associations.name, `%${args.associationKey}%`));

  if (lookupRows.length === 0) {
    console.error(`No association matched ${args.associationKey}`);
    process.exit(1);
  }
  if (lookupRows.length > 1) {
    console.error(`Multiple associations matched ${args.associationKey}:`);
    for (const a of lookupRows) console.error(`  ${a.id}  ${a.name}`);
    process.exit(1);
  }
  const assoc = lookupRows[0];
  console.log(`Resolved association: ${assoc.id} — ${assoc.name}`);

  // Check existing subscription.
  const existingRows = await db
    .select()
    .from(platformSubscriptions)
    .where(eq(platformSubscriptions.associationId, assoc.id));
  const existing = existingRows[0];

  if (existing && existing.status !== "canceled") {
    console.error(
      `Association already has a ${existing.status} subscription (${existing.id}). Cancel it first or use the admin endpoint.`,
    );
    process.exit(1);
  }

  // Resolve price.
  let priceId = args.priceId;
  if (!priceId) {
    const priceIdsRaw = await getSecret("STRIPE_PLAN_PRICE_IDS", "stripe_plan_price_ids");
    const priceIds = priceIdsRaw ? (JSON.parse(priceIdsRaw) as Record<string, string>) : {};
    if (args.plan === "self-managed") {
      const tierKey = (args.unitCount ?? 0) >= 30 ? "self-managed-large" : "self-managed-small";
      priceId = priceIds[tierKey] ?? priceIds["self-managed"];
    } else {
      priceId = priceIds[args.plan];
    }
  }
  if (!priceId) {
    console.error(`No Stripe price configured for plan ${args.plan}. Use --priceId.`);
    process.exit(1);
  }
  console.log(`Stripe price: ${priceId}`);

  if (args.dryRun) {
    console.log("[dry-run] Would create:");
    console.log(`  Stripe Customer  email=${args.email} name=${assoc.name}`);
    console.log(`  Stripe Subscription customer=<new> price=${priceId} trialDays=${args.trialDays}`);
    console.log(`  platform_subscriptions row for associationId=${assoc.id} plan=${args.plan}`);
    process.exit(0);
  }

  const secretKey = await getSecret("PLATFORM_STRIPE_SECRET_KEY", "platform_stripe_secret_key");
  if (!secretKey) {
    console.error("PLATFORM_STRIPE_SECRET_KEY not configured");
    process.exit(1);
  }

  // Create or reuse customer.
  let customerId = existing?.stripeCustomerId ?? null;
  if (!customerId) {
    const customerParams = new URLSearchParams({ email: args.email, name: assoc.name });
    customerParams.set("metadata[associationId]", assoc.id);
    customerParams.set("metadata[plan]", args.plan);
    customerParams.set("metadata[source]", "backfill-script");
    const customer = await stripeRequest(secretKey, "POST", "/customers", customerParams);
    customerId = customer.id as string;
    console.log(`Created Stripe customer ${customerId}`);
  } else {
    console.log(`Reusing Stripe customer ${customerId}`);
  }

  // Create subscription.
  const subParams = new URLSearchParams();
  subParams.set("customer", customerId);
  subParams.set("items[0][price]", priceId);
  if (args.trialDays > 0) subParams.set("trial_period_days", String(args.trialDays));
  subParams.set("metadata[associationId]", assoc.id);
  subParams.set("metadata[plan]", args.plan);
  subParams.set("metadata[source]", "backfill-script");
  subParams.set("payment_behavior", "default_incomplete");
  const stripeSub = await stripeRequest(secretKey, "POST", "/subscriptions", subParams);
  console.log(`Created Stripe subscription ${stripeSub.id} status=${stripeSub.status}`);

  const statusMap: Record<string, InsertPlatformSubscription["status"]> = {
    trialing: "trialing",
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "unpaid",
    incomplete: "incomplete",
    incomplete_expired: "canceled",
  };
  const localStatus = statusMap[stripeSub.status as string] ?? "incomplete";
  const periodEnd = typeof stripeSub.current_period_end === "number"
    ? new Date((stripeSub.current_period_end as number) * 1000) : null;
  const periodStart = typeof stripeSub.current_period_start === "number"
    ? new Date((stripeSub.current_period_start as number) * 1000) : null;
  const trialEnd = typeof stripeSub.trial_end === "number"
    ? new Date((stripeSub.trial_end as number) * 1000) : null;

  if (existing) {
    const [updated] = await db
      .update(platformSubscriptions)
      .set({
        plan: args.plan,
        status: localStatus,
        stripeCustomerId: customerId,
        stripeSubscriptionId: stripeSub.id as string,
        currentPeriodStart: periodStart ?? undefined,
        currentPeriodEnd: periodEnd ?? undefined,
        trialEndsAt: trialEnd ?? undefined,
        cancelAtPeriodEnd: 0,
        unitCount: args.unitCount ?? null,
        adminEmail: args.email,
        updatedAt: new Date(),
      })
      .where(eq(platformSubscriptions.id, existing.id))
      .returning();
    console.log(`Reactivated platform_subscriptions row ${updated.id}`);
  } else {
    const [inserted] = await db
      .insert(platformSubscriptions)
      .values({
        associationId: assoc.id,
        plan: args.plan,
        status: localStatus,
        stripeCustomerId: customerId,
        stripeSubscriptionId: stripeSub.id as string,
        currentPeriodStart: periodStart ?? undefined,
        currentPeriodEnd: periodEnd ?? undefined,
        trialEndsAt: trialEnd ?? undefined,
        cancelAtPeriodEnd: 0,
        unitCount: args.unitCount ?? null,
        adminEmail: args.email,
      })
      .returning();
    console.log(`Inserted platform_subscriptions row ${inserted.id}`);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("backfill failed:", err);
  process.exit(1);
});
