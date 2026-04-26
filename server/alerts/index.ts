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
import type {
  AlertItem,
  AlertReadStateEntry,
  AlertRuleType,
  AlertSeverity,
  ZoneLabel,
} from "./types";
import { parseAlertId, RULE_TYPE_FEATURE_DOMAIN } from "./types";

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

  let alerts: AlertItem[] = await runAllResolversForAssociations(
    input.permittedAssociations,
    input.now,
  );

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

// ---------------------------------------------------------------------------
// Internal — Batched fan-out across permitted associations (Wave 16b 5.4-F1).
//
// Pre-Wave-16b: each of 9 resolvers ran once per association, so a 50-
// association cold hit issued 9 × 50 = 450 storage round-trips. Wave 16b
// switches to `resolveMany([...all permitted assocs], ctx)` per source — one
// storage call (or one IN-query) covers the entire permitted set. The 50-
// association cold hit collapses to ~9 storage calls (one per source) plus a
// small number of per-budget secondary lookups.
//
// Wave 35a (this PR) factored the resolver fan-out out of
// `getCrossAssociationAlerts` so `getCriticalAlertsForFanOut` can re-use it
// without re-implementing 9 imports + Promise.all.
// ---------------------------------------------------------------------------
async function runAllResolversForAssociations(
  associations: Array<{ id: string; name: string }>,
  now: Date | undefined,
): Promise<AlertItem[]> {
  const resolverCtx = { now };
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
    resolveManyOverdueWorkOrders(associations, resolverCtx),
    resolveManyDueMaintenance(associations, resolverCtx),
    resolveManyActiveElections(associations, resolverCtx),
    resolveManyDelinquentLedgerBalances(associations, resolverCtx),
    resolveManyExpiringGovernanceDocuments(associations, resolverCtx),
    resolveManyVendorContractRenewals(associations, resolverCtx),
    resolveManyInsuranceExpiry(associations, resolverCtx),
    resolveManyBudgetVarianceFlags(associations, resolverCtx),
    resolveManyUnpaidLateFees(associations, resolverCtx),
  ]);
  return [
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
}

// ---------------------------------------------------------------------------
// 4.1 Wave 35a — single-pass fan-out helper for the notifications worker.
//
// `fanOutCriticalAlerts` (server/alerts/notifications.ts) used to call
// `getCrossAssociationAlerts({ skipCache: true })` once PER admin. With 50
// admins x 50 associations x 9 resolvers, that's 22,500 resolver invocations
// every 5 minutes. The fix: compute the cross-association alert universe
// ONCE (one call to `runAllResolversForAssociations`) and let the worker
// filter the result in-memory per admin (by permitted association +
// `canAccessAlert`).
//
// Returns the full critical-severity alert set across EVERY non-archived
// association in the system. The caller is responsible for:
//   - filtering the returned alerts to each admin's permitted associations
//   - applying `canAccessAlert(adminRole, alert.featureDomain, {})` per admin
//
// The shape mirrors `AlertItem` (no transformation) so the worker can
// branch on `severity`, `featureDomain`, etc. without re-fetching.
// ---------------------------------------------------------------------------
export interface CriticalAlertsForFanOut {
  alerts: AlertItem[];
}

export async function getCriticalAlertsForFanOut(
  opts: { now?: Date; severities?: ReadonlyArray<AlertSeverity> } = {},
): Promise<CriticalAlertsForFanOut> {
  const severities = new Set<AlertSeverity>(opts.severities ?? ["critical"]);
  // Universe = every non-archived association. Fan-out is gated per-admin
  // in-memory (see notifications.ts), so we don't pre-filter here.
  const universe = await db
    .select({ id: associationsTable.id, name: associationsTable.name })
    .from(associationsTable)
    .where(eq(associationsTable.isArchived, 0));
  if (universe.length === 0) return { alerts: [] };
  resolveInvocationCount += 1;
  const all = await runAllResolversForAssociations(universe, opts.now);
  return { alerts: all.filter((a) => severities.has(a.severity)) };
}

// ---------------------------------------------------------------------------
// 4.1 Wave 35a — cheap O(1) alert-mutation auth.
//
// `assertAlertOwnership` in server/routes.ts used to call
// `getCrossAssociationAlerts({ readState: "all", limit: 500, skipCache: true })`
// on every read/dismiss/restore mutation — i.e. it ran the FULL 9-resolver
// orchestrator just to verify a single alertId belonged to the caller's
// scope. 20 alert clicks = 20 full orchestrations.
//
// `lookupAlertById` collapses that to a single SELECT against the source
// table that owns the record. Steps:
//   1. Parse `alertId` → `{ ruleType, recordType, recordId }`. Bad shape =
//      null (caller returns 404).
//   2. Map `recordType` to the source table that holds `association_id`.
//   3. Run ONE query: `SELECT association_id FROM <table> WHERE id = ?`.
//   4. Verify the persona's feature-domain access via canAccessAlert.
//   5. Return `{ associationId, featureDomain }` — caller verifies the id is
//      in the persona's permitted association set.
//
// Returns `null` if the record does not exist, the alertId is malformed,
// or the persona's role denies the rule's feature domain. The 404/403
// distinction is made by the caller based on whether the persona had any
// chance of seeing the alert at all (canAccessAlert), so we keep the
// helper itself a black box.
// ---------------------------------------------------------------------------
export interface AlertLookupResult {
  associationId: string;
  featureDomain: string;
  ruleType: AlertRuleType;
}

export async function lookupAlertById(
  alertId: string,
): Promise<AlertLookupResult | null> {
  const parsed = parseAlertId(alertId);
  if (!parsed) return null;
  const featureDomain = RULE_TYPE_FEATURE_DOMAIN[parsed.ruleType];
  const associationId = await lookupAssociationForRecord(
    parsed.recordType,
    parsed.recordId,
  );
  if (!associationId) return null;
  return { associationId, featureDomain, ruleType: parsed.ruleType };
}

/**
 * Verify the caller is permitted to mutate read-state for this alertId.
 * Combines `lookupAlertById` (single-row table lookup) with
 * `canAccessAlert` (role/feature-domain gate) and an
 * `admin_association_scopes` membership check.
 *
 * Returns `null` on success, or an HTTP response payload to return on
 * failure. Drop-in replacement for the old `assertAlertOwnership` in
 * `server/routes.ts` (which ran the full 9-resolver orchestrator) — same
 * security guarantees, O(1) DB query instead of O(N associations × 9
 * resolvers).
 */
export async function assertAlertMutationAuth(input: {
  adminUserId: string;
  adminRole: AdminRole;
  adminScopedAssociationIds: string[];
  alertId: string;
}): Promise<{ status: number; body: { message: string; code?: string } } | null> {
  const lookup = await lookupAlertById(input.alertId);
  if (!lookup) {
    return { status: 404, body: { message: "Alert not found", code: "ALERT_NOT_FOUND" } };
  }
  // Feature-domain gate (server-side parity with canAccessAlert in the
  // GET path). Wave-2 personaToggles are always {} until the toggle UI
  // lands; we keep the same default here so the read/write paths agree.
  if (!canAccessAlert(input.adminRole, lookup.featureDomain, {})) {
    return {
      status: 403,
      body: {
        message: "You do not have access to this alert",
        code: "ALERT_FEATURE_DOMAIN_FORBIDDEN",
      },
    };
  }
  // Cross-tenant gate: platform-admin sees everything; every other role
  // must have the alert's association in their `admin_association_scopes`.
  if (input.adminRole !== "platform-admin") {
    if (!input.adminScopedAssociationIds.includes(lookup.associationId)) {
      // Same 404 we used to return — opaque to cross-tenant probes.
      return { status: 404, body: { message: "Alert not found", code: "ALERT_NOT_FOUND" } };
    }
  } else {
    // Platform-admin: still require the association to exist + be non-
    // archived so a stale alertId does not bypass tenancy checks.
    const [row] = await db
      .select({ id: associationsTable.id })
      .from(associationsTable)
      .where(and(eq(associationsTable.id, lookup.associationId), eq(associationsTable.isArchived, 0)))
      .limit(1);
    if (!row) {
      return { status: 404, body: { message: "Alert not found", code: "ALERT_NOT_FOUND" } };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Internal — recordType → source-table single-row association lookup.
//
// Each Tier 1+2 resolver emits a deterministic alertId of the shape
// `${ruleType}:${recordType}:${recordId}`. The `recordType` segment is the
// underlying SQL table name (e.g. `work_orders`, `elections`, etc.). We map
// it to the Drizzle table object and run a single `SELECT association_id
// WHERE id = ?` to locate the alert's tenant.
//
// Two recordTypes are NOT plain id lookups:
//   - `owner_ledger_summary` (delinquent-ledger-balance): `recordId` is
//     `${unitId}:${personId}` — we resolve via `units.id` since
//     `units.associationId` is the canonical tenant column for ledger
//     records.
//   - `budget_lines`: `recordId` is the raw `budget_lines.id`.
// ---------------------------------------------------------------------------
async function lookupAssociationForRecord(
  recordType: string,
  recordId: string,
): Promise<string | null> {
  // Lazy-load the schema tables we need so this module's import graph
  // does not balloon for callers that never invoke the lookup path.
  const schema = await import("@shared/schema");
  switch (recordType) {
    case "work_orders": {
      const [row] = await db
        .select({ associationId: schema.workOrders.associationId })
        .from(schema.workOrders)
        .where(eq(schema.workOrders.id, recordId))
        .limit(1);
      return row?.associationId ?? null;
    }
    case "maintenance_schedule_instances": {
      const [row] = await db
        .select({ associationId: schema.maintenanceScheduleInstances.associationId })
        .from(schema.maintenanceScheduleInstances)
        .where(eq(schema.maintenanceScheduleInstances.id, recordId))
        .limit(1);
      return row?.associationId ?? null;
    }
    case "elections": {
      const [row] = await db
        .select({ associationId: schema.elections.associationId })
        .from(schema.elections)
        .where(eq(schema.elections.id, recordId))
        .limit(1);
      return row?.associationId ?? null;
    }
    case "owner_ledger_summary": {
      // recordId = `${unitId}:${personId}` — resolve via units.associationId.
      const colon = recordId.indexOf(":");
      if (colon <= 0) return null;
      const unitId = recordId.slice(0, colon);
      const [row] = await db
        .select({ associationId: schema.units.associationId })
        .from(schema.units)
        .where(eq(schema.units.id, unitId))
        .limit(1);
      return row?.associationId ?? null;
    }
    case "governance_compliance_templates": {
      const [row] = await db
        .select({ associationId: schema.governanceComplianceTemplates.associationId })
        .from(schema.governanceComplianceTemplates)
        .where(eq(schema.governanceComplianceTemplates.id, recordId))
        .limit(1);
      return row?.associationId ?? null;
    }
    case "vendors": {
      const [row] = await db
        .select({ associationId: schema.vendors.associationId })
        .from(schema.vendors)
        .where(eq(schema.vendors.id, recordId))
        .limit(1);
      return row?.associationId ?? null;
    }
    case "association_insurance_policies": {
      const [row] = await db
        .select({ associationId: schema.associationInsurancePolicies.associationId })
        .from(schema.associationInsurancePolicies)
        .where(eq(schema.associationInsurancePolicies.id, recordId))
        .limit(1);
      return row?.associationId ?? null;
    }
    case "budget_lines": {
      // budget_lines → budget_versions → budgets carries associationId.
      const [row] = await db
        .select({ associationId: schema.budgets.associationId })
        .from(schema.budgetLines)
        .innerJoin(schema.budgetVersions, eq(schema.budgetVersions.id, schema.budgetLines.budgetVersionId))
        .innerJoin(schema.budgets, eq(schema.budgets.id, schema.budgetVersions.budgetId))
        .where(eq(schema.budgetLines.id, recordId))
        .limit(1);
      return row?.associationId ?? null;
    }
    case "late_fee_events": {
      const [row] = await db
        .select({ associationId: schema.lateFeeEvents.associationId })
        .from(schema.lateFeeEvents)
        .where(eq(schema.lateFeeEvents.id, recordId))
        .limit(1);
      return row?.associationId ?? null;
    }
    default:
      return null;
  }
}

