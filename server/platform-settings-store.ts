/**
 * Platform Settings Store
 *
 * Runtime-tunable non-secret platform configuration backed by the
 * `platform_settings` database table. Distinct from `platform-secrets-store`
 * (which stores encrypted credentials) — these are admin-editable knobs like
 * the Stripe Connect application-fee rate.
 *
 * Per Issue founder-os#969 (spec §1.2 — application fee rate stored in
 * `platform_settings` so future rate changes don't require a deploy).
 *
 * Resolution order for any setting:
 *   1. Environment variable (always wins — set in hosting environment)
 *   2. Database-stored value (set via Platform Controls UI / admin API)
 *   3. Caller-provided default
 */

import { db } from "./db";
import { platformSettings } from "../shared/schema";
import { eq } from "drizzle-orm";

const cache = new Map<string, string>();
let loaded = false;

async function loadAll(): Promise<void> {
  if (loaded) return;
  const rows = await db.select().from(platformSettings);
  for (const row of rows) {
    cache.set(row.key, row.value);
  }
  loaded = true;
}

/** Resolve a setting value (env first, then DB, then caller default). */
export async function getSetting(
  envVar: string,
  dbKey: string,
  fallback: string | null = null,
): Promise<string | null> {
  const fromEnv = process.env[envVar]?.trim();
  if (fromEnv) return fromEnv;
  await loadAll();
  return cache.get(dbKey) ?? fallback;
}

/** Resolve a setting as a finite number; falls back if not parseable. */
export async function getNumericSetting(
  envVar: string,
  dbKey: string,
  fallback: number,
): Promise<number> {
  const raw = await getSetting(envVar, dbKey, null);
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Persist a setting to the database and update the in-memory cache. */
export async function setSetting(
  key: string,
  value: string,
  options: { description?: string | null; updatedBy?: string } = {},
): Promise<void> {
  await db
    .insert(platformSettings)
    .values({
      key,
      value,
      description: options.description ?? null,
      updatedBy: options.updatedBy ?? "admin",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: {
        value,
        description: options.description ?? null,
        updatedBy: options.updatedBy ?? "admin",
        updatedAt: new Date(),
      },
    });
  cache.set(key, value);
}

/** Drop the in-memory cache (call after external DB changes). */
export function invalidateSettingsCache(): void {
  cache.clear();
  loaded = false;
}

// ── Canonical setting keys ──────────────────────────────────────────────────

/**
 * Stripe Connect application-fee rate per spec §1.2. Stored as a decimal
 * string (e.g., "0.01" = 1.0%). Resolved at charge-creation time.
 */
export const STRIPE_APPLICATION_FEE_RATE_KEY = "stripe.application_fee_rate";

/**
 * Resolve the current Stripe application-fee rate. Env override:
 * `STRIPE_APPLICATION_FEE_RATE` (numeric, e.g., "0.01"). DB key:
 * `stripe.application_fee_rate`. Default: 0.01 (1.0%) per spec §1.2.
 */
export async function getStripeApplicationFeeRate(): Promise<number> {
  return getNumericSetting(
    "STRIPE_APPLICATION_FEE_RATE",
    STRIPE_APPLICATION_FEE_RATE_KEY,
    0.01,
  );
}
