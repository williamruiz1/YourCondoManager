/**
 * 4.1 Wave 2 — cross-association alert engine orchestrator.
 *
 * Spec: docs/projects/platform-overhaul/decisions/4.1-cross-association-alert-engine.md
 *
 * Responsibilities:
 *   1. Fan out across the persona's permitted associations.
 *   2. Call every Tier 1 + Tier 2 resolver for each association in parallel.
 *   3. Apply the `canAccessAlert` predicate (4.1 Q5) server-side so
 *      clients never see alerts they are not permitted to act on.
 *   4. Join each surviving alert to the caller's row in
 *      `alert_read_states` so surfaces can badge unread vs read/dismissed
 *      without a second round-trip.
 *   5. Apply `zone` / `readState` / `limit` filters from the endpoint.
 *   6. Cache the aggregated result for 60s per
 *      `(adminUserId, zone, limit, readState)` tuple (4.1 Q6 AC).
 *
 * Wave 2 deliberately ships WITHOUT mutation endpoints for
 * `alertReadStates` — Wave 3 adds read / dismiss. The cache flush helper
 * `invalidateAlertCache` is exported for future write-path wiring (it is
 * NOT called automatically on every WO/election/ledger mutation yet —
 * per the handoff brief, that invalidation wiring is deferred to a later
 * wave).
 */

import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { alertReadStates, associations as associationsTable } from "@shared/schema";
import type { AdminRole } from "@shared/schema";
import type { PersonaToggleState } from "@shared/persona-access";
import { canAccessAlert } from "./can-access-alert";
import { resolveMany as resolveManyOverdueWorkOrders } from "./sources/overdue-work-orders";
import { resolveMany as resolveManyDueMaintenance } from "./sources/due-maintenance";
import { resolveMany as resolveManyActiveElections } from "./sources/active-elections";
import { resolveMany as resolveManyDelinquentLedgerBalances } from "./sources/delinquent-ledger-balances";
import { resolveMany as resolveManyExpiringGovernanceDocuments } from "./sources/expiring-governance-documents";
import { resolveMany as resolveManyVendorContractRenewals } from "./sources/vendor-contract-renewals";
import { resolveMany as resolveManyInsuranceExpiry } from "./sources/insurance-expiry";
import { resolveMany as resolveManyBudgetVarianceFlags } from "./sources/budget-variance-flags";
import { resolveMany as resolveManyUnpaidLateFees } from "./sources/unpaid-late-fees";
import type { AlertItem, AlertReadStateEntry, ZoneLabel } from "./types";

// ---------------------------------------------------------------------------
// Test observability — a per-process counter that the integration tests use
// to assert the 60s server-side cache is actually serving the second call
// without invoking the resolvers again. The counter is incremented once per
// orchestrator run (NOT per resolver, NOT per association) because that is
// the signal tests care about: "was the expensive aggregation rerun?"
// ---------------------------------------------------------------------------

let resolveInvocationCount = 0;
export function __getResolveInvocationCount(): number {
  return resolveInvocationCount;
}
export function __resetResolveInvocationCount(): void {
  resolveInvocationCount = 0;
}

// ---------------------------------------------------------------------------
// Server-side cache — 60s TTL, keyed per-request tuple (4.1 Q6 AC).
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  expiresAt: number;
  payload: CrossAssociationAlertsResponse;
}

const cache = new Map<string, CacheEntry>();

export function invalidateAlertCache(): void {
  cache.clear();
}

function cacheKey(input: {
  adminUserId: string;
  zone?: ZoneLabel;
  limit: number;
  readState: ReadStateFilter;
}): string {
  return `${input.adminUserId}|${input.zone ?? "*"}|${input.limit}|${input.readState}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ReadStateFilter = "unread" | "all";

export interface CrossAssociationAlertsInput {
  adminUserId: string;
  adminRole: AdminRole;
  personaToggles: PersonaToggleState;
  /** Full list of associations the persona may see (ids + names). */
  permittedAssociations: Array<{ id: string; name: string }>;
  zone?: ZoneLabel;
  limit?: number;
  readState?: ReadStateFilter;
  /** Test-only: inject a fixed "now" for deterministic resolver output. */
  now?: Date;
  /** Test-only: bypass the 60s cache. */
  skipCache?: boolean;
}

export interface CrossAssociationAlertsResponse {
  alerts: AlertItem[];
  readStateBy: Record<string, AlertReadStateEntry>;
}

const DEFAULT_LIMIT = 50;

export async function getCrossAssociationAlerts(
  input: CrossAssociationAlertsInput,
): Promise<CrossAssociationAlertsResponse> {
  const limit = input.limit ?? DEFAULT_LIMIT;
  const readState = input.readState ?? "unread";
  const key = cacheKey({ adminUserId: input.adminUserId, zone: input.zone, limit, readState });

  if (!input.skipCache) {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.payload;
    }
  }

  resolveInvocationCount += 1;

  // --- Batched fan-out across permitted associations (Wave 16b 5.4-F1) -------
  //
  // Pre-Wave-16b: each of 9 resolvers ran once per association, so a 50-
  // association cold hit issued 9 × 50 = 450 storage round-trips. Wave 16b
  // switches to `resolveMany([...all permitted assocs], ctx)` per source —
  // one storage call (or one IN-query) covers the entire permitted set.
  // The 50-association cold hit collapses to ~9 storage calls (one per
  // source) plus a small number of per-budget secondary lookups.
  const resolverCtx = { now: input.now };

  const [
    overdueWo,
    dueMaint,
    elections,
    ledger,
    docs,
    vendorRenewals,
    insurance,
    budgetVariance,
    unpaidLateFees,
  ] = await Promise.all([
    resolveManyOverdueWorkOrders(input.permittedAssociations, resolverCtx),
    resolveManyDueMaintenance(input.permittedAssociations, resolverCtx),
    resolveManyActiveElections(input.permittedAssociations, resolverCtx),
    resolveManyDelinquentLedgerBalances(input.permittedAssociations, resolverCtx),
    resolveManyExpiringGovernanceDocuments(input.permittedAssociations, resolverCtx),
    resolveManyVendorContractRenewals(input.permittedAssociations, resolverCtx),
    resolveManyInsuranceExpiry(input.permittedAssociations, resolverCtx),
    resolveManyBudgetVarianceFlags(input.permittedAssociations, resolverCtx),
    resolveManyUnpaidLateFees(input.permittedAssociations, resolverCtx),
  ]);
  let alerts: AlertItem[] = [
    ...overdueWo,
    ...dueMaint,
    ...elections,
    ...ledger,
    ...docs,
    ...vendorRenewals,
    ...insurance,
    ...budgetVariance,
    ...unpaidLateFees,
  ];

  // --- Server-side feature-domain gate (4.1 Q5) ------------------------------
  alerts = alerts.filter((a) => canAccessAlert(input.adminRole, a.featureDomain, input.personaToggles));

  // --- Optional zone filter (4.1 Q6 endpoint contract) -----------------------
  if (input.zone) {
    alerts = alerts.filter((a) => a.zone === input.zone);
  }

  // --- Join read-state for the current user ----------------------------------
  const readStateBy: Record<string, AlertReadStateEntry> = {};
  if (alerts.length > 0) {
    const ids = alerts.map((a) => a.alertId);
    const rows = await db
      .select()
      .from(alertReadStates)
      .where(and(eq(alertReadStates.adminUserId, input.adminUserId), inArray(alertReadStates.alertId, ids)));
    for (const row of rows) {
      readStateBy[row.alertId] = {
        readAt: row.readAt ?? null,
        dismissedAt: row.dismissedAt ?? null,
      };
    }
  }

  // --- Optional read-state filter (default 'unread' per spec) ----------------
  if (readState === "unread") {
    alerts = alerts.filter((a) => {
      const entry = readStateBy[a.alertId];
      return !entry || (!entry.readAt && !entry.dismissedAt);
    });
  }

  // --- Sort (severity desc, createdAt desc) and limit ------------------------
  alerts.sort((a, b) => {
    const sevDelta = severityRank(b.severity) - severityRank(a.severity);
    if (sevDelta !== 0) return sevDelta;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  alerts = alerts.slice(0, limit);

  const payload: CrossAssociationAlertsResponse = { alerts, readStateBy };

  if (!input.skipCache) {
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
  }

  return payload;
}

function severityRank(sev: AlertItem["severity"]): number {
  switch (sev) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Helper used by the endpoint: resolve permitted association (id, name)
// tuples for the caller based on their admin scope. Platform-admin sees all
// non-archived associations; every other role sees the rows in
// `admin_association_scopes`.
// ---------------------------------------------------------------------------

export async function resolvePermittedAssociations(input: {
  adminRole: AdminRole;
  adminScopedAssociationIds: string[];
}): Promise<Array<{ id: string; name: string }>> {
  if (input.adminRole === "platform-admin") {
    const rows = await db
      .select({ id: associationsTable.id, name: associationsTable.name })
      .from(associationsTable)
      .where(eq(associationsTable.isArchived, 0));
    return rows;
  }
  if (input.adminScopedAssociationIds.length === 0) return [];
  const rows = await db
    .select({ id: associationsTable.id, name: associationsTable.name })
    .from(associationsTable)
    .where(inArray(associationsTable.id, input.adminScopedAssociationIds));
  return rows;
}

export { canAccessAlert } from "./can-access-alert";
