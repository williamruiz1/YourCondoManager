/**
 * Platform Secrets Store
 *
 * Provides a runtime-configurable key/value store for platform credentials
 * (Twilio, VAPID, etc.) backed by the `platform_secrets` database table.
 *
 * Resolution order for any secret:
 *   1. Environment variable (always wins — set in hosting environment)
 *   2. Database-stored value (set via Platform Controls UI)
 *   3. null (not configured)
 *
 * Values are stored as-is in the database. Sensitive fields (auth tokens,
 * private keys) should only be written over HTTPS in production.
 */

import { db } from "./db";
import { platformSecrets } from "../shared/schema";
import { eq } from "drizzle-orm";

// In-memory cache — populated on first use and after writes
const cache = new Map<string, string>();
let loaded = false;

async function loadAll() {
  if (loaded) return;
  const rows = await db.select().from(platformSecrets);
  for (const row of rows) {
    cache.set(row.key, row.value);
  }
  loaded = true;
}

/** Get a secret: env var first, then DB, then null */
export async function getSecret(envVar: string, dbKey: string): Promise<string | null> {
  const fromEnv = process.env[envVar]?.trim();
  if (fromEnv) return fromEnv;
  await loadAll();
  return cache.get(dbKey) ?? null;
}

/** Persist a secret to the database and update the in-memory cache */
export async function setSecret(key: string, value: string, updatedBy?: string): Promise<void> {
  await db
    .insert(platformSecrets)
    .values({ key, value, updatedBy: updatedBy ?? "admin", updatedAt: new Date() })
    .onConflictDoUpdate({
      target: platformSecrets.key,
      set: { value, updatedBy: updatedBy ?? "admin", updatedAt: new Date() },
    });
  cache.set(key, value);
}

/** Delete a secret from the database and cache */
export async function deleteSecret(key: string): Promise<void> {
  await db.delete(platformSecrets).where(eq(platformSecrets.key, key));
  cache.delete(key);
}

/** Return all DB-stored secrets (keys only — values masked for display) */
export async function listSecretKeys(): Promise<string[]> {
  await loadAll();
  return Array.from(cache.keys());
}

/** Invalidate the in-memory cache (call after external DB changes) */
export function invalidateSecretsCache() {
  cache.clear();
  loaded = false;
}
