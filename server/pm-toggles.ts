/**
 * PM toggle registry (4.3 Q6 + ADR 0.2 "PM Toggle Configuration Model").
 *
 * PM toggles are per-association boolean overrides that extend the default
 * PM-Managed Default Access Table. Each `(associationId, toggleKey)` row
 * carries an enabled flag. Absence of a row = "not overridden" which every
 * consumer today resolves to `false` / disabled.
 *
 * Public surface:
 *   - `isToggleEnabled(associationId, toggleKey)` — cache-aware boolean read.
 *   - `setToggle(associationId, toggleKey, enabled, adminUserId)` — write.
 *   - `listTogglesForAssociation(associationId)` — bulk fetch for the
 *     Manager settings surface.
 *   - `canAssessmentRulesWrite(persona, associationId)` — role + toggle
 *     gate used by write endpoints on `/api/financial/rules/*` and CRUD.
 *
 * Cache TTL: 30s. Invalidated on `setToggle()` writes for the affected
 * `(associationId, toggleKey)` key.
 */

import { and, eq } from "drizzle-orm";

import { db } from "./db";
import {
  adminUsers,
  PM_TOGGLE_KEYS,
  pmToggles,
  type PmToggleKey,
} from "../shared/schema";
import type { AdminRole } from "../shared/schema";

const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  value: boolean;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(associationId: string, toggleKey: PmToggleKey): string {
  return `${associationId}::${toggleKey}`;
}

function invalidate(associationId: string, toggleKey: PmToggleKey): void {
  cache.delete(cacheKey(associationId, toggleKey));
}

/**
 * Read a single toggle for an association. Default OFF on miss.
 */
export async function isToggleEnabled(
  associationId: string,
  toggleKey: PmToggleKey,
): Promise<boolean> {
  const key = cacheKey(associationId, toggleKey);
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.expiresAt > now) {
    return hit.value;
  }

  const [row] = await db
    .select({ enabled: pmToggles.enabled })
    .from(pmToggles)
    .where(and(eq(pmToggles.associationId, associationId), eq(pmToggles.toggleKey, toggleKey)))
    .limit(1);

  const value = row?.enabled === 1;
  cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}

/**
 * Write a toggle value. Upserts the `(associationId, toggleKey)` row.
 * Invalidates the cache entry so subsequent reads hit the DB.
 */
export async function setToggle(
  associationId: string,
  toggleKey: PmToggleKey,
  enabled: boolean,
  adminUserId: string,
): Promise<void> {
  const enabledInt = enabled ? 1 : 0;
  const existing = await db
    .select({ id: pmToggles.id })
    .from(pmToggles)
    .where(and(eq(pmToggles.associationId, associationId), eq(pmToggles.toggleKey, toggleKey)))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(pmToggles).values({
      associationId,
      toggleKey,
      enabled: enabledInt,
      updatedBy: adminUserId,
    });
  } else {
    await db
      .update(pmToggles)
      .set({ enabled: enabledInt, updatedAt: new Date(), updatedBy: adminUserId })
      .where(eq(pmToggles.id, existing[0].id));
  }

  invalidate(associationId, toggleKey);
}

/**
 * Return all PM toggle states for an association. Any key with no row
 * resolves to `false`. The returned map is keyed by the canonical
 * `PM_TOGGLE_KEYS` set — callers never see unknown keys.
 */
export async function listTogglesForAssociation(
  associationId: string,
): Promise<Record<PmToggleKey, boolean>> {
  const rows = await db
    .select({ toggleKey: pmToggles.toggleKey, enabled: pmToggles.enabled })
    .from(pmToggles)
    .where(eq(pmToggles.associationId, associationId));

  const result: Record<PmToggleKey, boolean> = {} as Record<PmToggleKey, boolean>;
  for (const key of PM_TOGGLE_KEYS) {
    result[key] = false;
  }
  for (const row of rows) {
    if ((PM_TOGGLE_KEYS as readonly string[]).includes(row.toggleKey)) {
      result[row.toggleKey as PmToggleKey] = row.enabled === 1;
    }
  }
  return result;
}

/**
 * 4.3 Q6 auth gate — decides whether a caller with a given admin role
 * may write assessment rules against the given association.
 *
 * Matrix:
 *   - `platform-admin`, `manager`, `board-officer`, `pm-assistant`
 *     → allowed unconditionally.
 *   - `assisted-board` → allowed ONLY when `assessment_rules_write` is ON.
 *   - `viewer`, any other role → denied.
 */
export async function canAssessmentRulesWrite(
  role: AdminRole | null | undefined,
  associationId: string,
): Promise<boolean> {
  switch (role) {
    case "platform-admin":
    case "manager":
    case "board-officer":
    case "pm-assistant":
      return true;
    case "assisted-board":
      return isToggleEnabled(associationId, "assessment_rules_write");
    default:
      return false;
  }
}

/**
 * Test-only: clear the in-memory cache. Exported under a leading
 * underscore to discourage runtime use. Vitest imports this in
 * `beforeEach` to prevent cross-test bleed.
 */
export function __clearPmToggleCache(): void {
  cache.clear();
}

// Tiny helper re-export so callers don't have to separately import the
// canonical list from the schema layer.
export { PM_TOGGLE_KEYS };

// Keep a type-level reference to `adminUsers` so circular-import guards
// don't strip it — referenced indirectly via foreign key on write path.
export type { adminUsers };
