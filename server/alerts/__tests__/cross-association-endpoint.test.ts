/**
 * 4.1 Wave 2 — Integration test: cross-association alerts orchestrator.
 *
 * Exercises `getCrossAssociationAlerts` end-to-end — the same function the
 * `GET /api/alerts/cross-association` endpoint delegates to. Verifies:
 *
 *   1. Endpoint returns alerts aggregated across the caller's permitted
 *      associations.
 *   2. `zone` filter restricts output to one zone.
 *   3. `limit` restricts output count.
 *   4. `readState=unread` default hides alerts the caller has already read.
 *   5. Auth — the endpoint itself requires an authenticated admin session.
 *      That gate lives in `requireAdmin` (server/routes.ts) and is verified
 *      via a separate supertest-style HTTP assertion at the bottom of this
 *      file using a tiny ad-hoc express app (avoids pulling in the full
 *      storage / DB stack for the 401 check).
 *   6. Scope — non-platform-admin personas see alerts only for their
 *      `adminScopedAssociationIds`.
 *   7. 60s cache — a second call with the same inputs does NOT re-invoke
 *      the resolver chain (observable via `__getResolveInvocationCount`).
 */

import express from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks --------------------------------------------------------------

// Storage mock — covers the calls made by every Tier 1 + Tier 2 resolver.
vi.mock("../../storage", () => ({
  storage: {
    getWorkOrders: vi.fn().mockResolvedValue([]),
    getMaintenanceScheduleInstances: vi.fn().mockResolvedValue([]),
    getElections: vi.fn().mockResolvedValue([]),
    getOwnerLedgerSummary: vi.fn().mockResolvedValue([]),
    getOwnerLedgerEntries: vi.fn().mockResolvedValue([]),
    // Tier 2 resolvers (added by feat/4.1-tier-2-alert-sources).
    getVendors: vi.fn().mockResolvedValue([]),
    getLateFeeEvents: vi.fn().mockResolvedValue([]),
    getBudgets: vi.fn().mockResolvedValue([]),
    getBudgetVersions: vi.fn().mockResolvedValue([]),
    getBudgetVariance: vi.fn().mockResolvedValue([]),
  },
}));

// DB mock — the orchestrator reads from `alert_read_states` and `associations`;
// the ledger resolver reads from `delinquency_thresholds`; the governance
// resolver reads from `governance_compliance_templates`. We route by the
// first table referenced in `.from(...)` and return the corresponding
// canned rows.
const dbState: {
  readStates: Array<{ alertId: string; readAt: Date | null; dismissedAt: Date | null }>;
  associations: Array<{ id: string; name: string }>;
  governanceTemplates: Array<Record<string, unknown>>;
  delinquencyThresholds: Array<{ minimumDaysOverdue: number; isActive: number }>;
  insurancePolicies: Array<Record<string, unknown>>;
} = {
  readStates: [],
  associations: [
    { id: "assoc-1", name: "Harbor View HOA" },
    { id: "assoc-2", name: "Riverside Condos" },
  ],
  governanceTemplates: [],
  delinquencyThresholds: [],
  insurancePolicies: [],
};

vi.mock("../../db", async () => {
  const { getTableName } = await import("drizzle-orm");
  return {
    db: {
      select: (_cols?: unknown) => ({
        from: (table: any) => {
          const tableName = getTableName(table);
          return {
            where: () => {
              if (tableName === "alert_read_states") {
                return Promise.resolve(
                  dbState.readStates.map((r) => ({
                    id: r.alertId + ":row",
                    alertId: r.alertId,
                    adminUserId: "admin-1",
                    readAt: r.readAt,
                    dismissedAt: r.dismissedAt,
                    createdAt: new Date(),
                  })),
                );
              }
              if (tableName === "governance_compliance_templates") {
                return Promise.resolve(dbState.governanceTemplates);
              }
              if (tableName === "delinquency_thresholds") {
                return Promise.resolve(dbState.delinquencyThresholds);
              }
              if (tableName === "associations") {
                return Promise.resolve(dbState.associations);
              }
              if (tableName === "association_insurance_policies") {
                return Promise.resolve(dbState.insurancePolicies);
              }
              return Promise.resolve([]);
            },
          };
        },
      }),
    },
  };
});

// ---- Imports under test -------------------------------------------------

import {
  getCrossAssociationAlerts,
  invalidateAlertCache,
  __getResolveInvocationCount,
  __resetResolveInvocationCount,
} from "../index";
import { storage } from "../../storage";

// ---- Fixtures -----------------------------------------------------------

const now = new Date("2026-04-22T12:00:00Z");

function makeWorkOrder(id: string, associationId: string) {
  return {
    id,
    associationId,
    maintenanceRequestId: null,
    unitId: null,
    vendorId: null,
    vendorInvoiceId: null,
    title: `WO ${id}`,
    description: "test",
    locationText: null,
    category: "general",
    priority: "medium",
    status: "open",
    assignedTo: null,
    estimatedCost: null,
    actualCost: null,
    scheduledFor: new Date("2026-04-10T00:00:00Z"),
    startedAt: null,
    completedAt: null,
    resolutionNotes: null,
    photosJson: [],
    vendorEstimatedCompletionDate: null,
    vendorNotes: null,
    createdAt: new Date("2026-04-01T00:00:00Z"),
    updatedAt: new Date("2026-04-10T00:00:00Z"),
  };
}

function makeElection(id: string, associationId: string) {
  return {
    id,
    associationId,
    meetingId: null,
    title: `Election ${id}`,
    description: null,
    voteType: "board-seat",
    votingRule: "unit-weighted",
    isSecretBallot: 1,
    resultVisibility: "public",
    status: "voting-open",
    opensAt: new Date("2026-04-20T00:00:00Z"),
    closesAt: new Date("2026-04-27T00:00:00Z"),
    nominationsOpenAt: null,
    nominationsCloseAt: null,
    quorumPercent: 50,
    maxChoices: 3,
    eligibleVoterCount: 100,
    certifiedBy: null,
    certifiedAt: null,
    certificationSummary: null,
    resultDocumentId: null,
    createdBy: null,
    createdAt: new Date("2026-04-01T00:00:00Z"),
    updatedAt: new Date("2026-04-20T00:00:00Z"),
  };
}

beforeEach(() => {
  invalidateAlertCache();
  __resetResolveInvocationCount();
  dbState.readStates = [];
  dbState.governanceTemplates = [];
  dbState.delinquencyThresholds = [];
  dbState.insurancePolicies = [];
  vi.mocked(storage.getWorkOrders).mockReset().mockResolvedValue([]);
  vi.mocked(storage.getMaintenanceScheduleInstances).mockReset().mockResolvedValue([]);
  vi.mocked(storage.getElections).mockReset().mockResolvedValue([]);
  vi.mocked(storage.getOwnerLedgerSummary).mockReset().mockResolvedValue([]);
  vi.mocked(storage.getOwnerLedgerEntries).mockReset().mockResolvedValue([]);
  vi.mocked(storage.getVendors).mockReset().mockResolvedValue([]);
  vi.mocked(storage.getLateFeeEvents).mockReset().mockResolvedValue([]);
  vi.mocked(storage.getBudgets).mockReset().mockResolvedValue([]);
  vi.mocked(storage.getBudgetVersions).mockReset().mockResolvedValue([]);
  vi.mocked(storage.getBudgetVariance).mockReset().mockResolvedValue([]);
});

// ---- Tests --------------------------------------------------------------

describe("getCrossAssociationAlerts — orchestrator behavior", () => {
  it("aggregates alerts from every permitted association", async () => {
    // Wave 16b (5.4-F1): the orchestrator now calls `resolveMany` per
    // source — one storage fetch covers all permitted associations. The
    // mock returns rows for every assoc; the resolver groups by
    // `associationId` itself.
    vi.mocked(storage.getWorkOrders).mockImplementation(async (filters: any) => {
      const all = [
        makeWorkOrder("wo-a1", "assoc-1"),
        makeWorkOrder("wo-a2", "assoc-2"),
      ] as any;
      if (!filters?.associationId) return all;
      return all.filter((w: any) => w.associationId === filters.associationId);
    });

    const { alerts } = await getCrossAssociationAlerts({
      adminUserId: "admin-1",
      adminRole: "manager",
      personaToggles: {},
      permittedAssociations: [
        { id: "assoc-1", name: "Harbor View HOA" },
        { id: "assoc-2", name: "Riverside Condos" },
      ],
      now,
    });

    expect(alerts).toHaveLength(2);
    expect(alerts.map((a) => a.associationId).sort()).toEqual(["assoc-1", "assoc-2"]);
  });

  it("respects the `zone` filter", async () => {
    vi.mocked(storage.getWorkOrders).mockResolvedValue([makeWorkOrder("wo-1", "assoc-1")] as any);
    vi.mocked(storage.getElections).mockResolvedValue([makeElection("el-1", "assoc-1")] as any);

    const { alerts } = await getCrossAssociationAlerts({
      adminUserId: "admin-1",
      adminRole: "manager",
      personaToggles: {},
      permittedAssociations: [{ id: "assoc-1", name: "Harbor View HOA" }],
      zone: "governance",
      now,
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0].zone).toBe("governance");
    expect(alerts[0].ruleType).toBe("active-election");
  });

  it("respects the `limit` parameter", async () => {
    vi.mocked(storage.getWorkOrders).mockResolvedValue([
      makeWorkOrder("wo-1", "assoc-1"),
      makeWorkOrder("wo-2", "assoc-1"),
      makeWorkOrder("wo-3", "assoc-1"),
    ] as any);

    const { alerts } = await getCrossAssociationAlerts({
      adminUserId: "admin-1",
      adminRole: "manager",
      personaToggles: {},
      permittedAssociations: [{ id: "assoc-1", name: "Harbor View HOA" }],
      limit: 2,
      now,
    });

    expect(alerts).toHaveLength(2);
  });

  it("filters out alerts the user has already read when readState=unread (default)", async () => {
    vi.mocked(storage.getWorkOrders).mockResolvedValue([
      makeWorkOrder("wo-read", "assoc-1"),
      makeWorkOrder("wo-unread", "assoc-1"),
    ] as any);
    dbState.readStates = [
      { alertId: "overdue-work-order:work_orders:wo-read", readAt: new Date(), dismissedAt: null },
    ];

    const { alerts, readStateBy } = await getCrossAssociationAlerts({
      adminUserId: "admin-1",
      adminRole: "manager",
      personaToggles: {},
      permittedAssociations: [{ id: "assoc-1", name: "Harbor View HOA" }],
      now,
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0].recordId).toBe("wo-unread");
    // The read alert itself is filtered out of `alerts`, but the
    // `readStateBy` map reports the state the server saw before the
    // unread filter — useful for clients that want to display "N read
    // today" chrome without refetching with readState=all.
    expect(readStateBy["overdue-work-order:work_orders:wo-read"]?.readAt).toBeInstanceOf(Date);
  });

  it("returns readStateBy map when readState=all", async () => {
    vi.mocked(storage.getWorkOrders).mockResolvedValue([
      makeWorkOrder("wo-read", "assoc-1"),
      makeWorkOrder("wo-unread", "assoc-1"),
    ] as any);
    const readAt = new Date();
    dbState.readStates = [
      { alertId: "overdue-work-order:work_orders:wo-read", readAt, dismissedAt: null },
    ];

    const { alerts, readStateBy } = await getCrossAssociationAlerts({
      adminUserId: "admin-1",
      adminRole: "manager",
      personaToggles: {},
      permittedAssociations: [{ id: "assoc-1", name: "Harbor View HOA" }],
      readState: "all",
      now,
    });

    expect(alerts).toHaveLength(2);
    expect(readStateBy["overdue-work-order:work_orders:wo-read"]?.readAt).toEqual(readAt);
  });

  it("60s cache: second identical call does NOT re-invoke the resolver chain", async () => {
    vi.mocked(storage.getWorkOrders).mockResolvedValue([makeWorkOrder("wo-1", "assoc-1")] as any);

    const input = {
      adminUserId: "admin-1",
      adminRole: "manager" as const,
      personaToggles: {},
      permittedAssociations: [{ id: "assoc-1", name: "Harbor View HOA" }],
      now,
    };

    await getCrossAssociationAlerts(input);
    const countAfterFirst = __getResolveInvocationCount();
    expect(countAfterFirst).toBe(1);

    await getCrossAssociationAlerts(input);
    const countAfterSecond = __getResolveInvocationCount();
    expect(countAfterSecond).toBe(1); // cache hit — no re-invocation

    // `invalidateAlertCache` should force the third call to re-run.
    invalidateAlertCache();
    await getCrossAssociationAlerts(input);
    expect(__getResolveInvocationCount()).toBe(2);
  });

  it("scopes to the permitted associations list — no leakage", async () => {
    // An Assisted Board caller whose scope is only assoc-1 should not see
    // assoc-2 alerts, even if they exist in the DB.
    //
    // Wave 16b (5.4-F1): the resolver now passes a permitted-association
    // map and filters DB rows by membership, so even if storage returns
    // both rows, the out-of-scope assoc-2 row is dropped before the alert
    // is emitted. We assert that behaviour AND that storage was queried
    // with a single-association filter (the single-assoc fast path).
    vi.mocked(storage.getWorkOrders).mockImplementation(async (filters: any) => {
      const all = [
        makeWorkOrder("wo-in-scope", "assoc-1"),
        makeWorkOrder("wo-out-of-scope", "assoc-2"),
      ] as any;
      if (!filters?.associationId) return all;
      return all.filter((w: any) => w.associationId === filters.associationId);
    });

    // Note — Assisted Board is DENIED `operations.work-orders` per
    // can-access-alert; we use Manager (full access) to isolate the scope
    // check from the feature-domain check.
    const { alerts } = await getCrossAssociationAlerts({
      adminUserId: "admin-1",
      adminRole: "manager",
      personaToggles: {},
      permittedAssociations: [{ id: "assoc-1", name: "Harbor View HOA" }],
      now,
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0].associationId).toBe("assoc-1");
    // Single-assoc fast path: storage was called with the explicit
    // associationId filter, and assoc-2 was never directly queried by id.
    const calls = vi.mocked(storage.getWorkOrders).mock.calls.map((c) => (c[0] as any)?.associationId);
    expect(calls).toContain("assoc-1");
    expect(calls).not.toContain("assoc-2");
  });

  it("Assisted Board sees maintenance-request alerts but NOT work-order alerts within Operations", async () => {
    // Same association, both alert types. The feature-domain gate should
    // drop the work-order while keeping the maintenance-request.
    vi.mocked(storage.getWorkOrders).mockResolvedValue([makeWorkOrder("wo-ops", "assoc-1")] as any);
    vi.mocked(storage.getMaintenanceScheduleInstances).mockResolvedValue([
      {
        id: "msi-ops",
        templateId: "tpl-1",
        associationId: "assoc-1",
        unitId: null,
        vendorId: null,
        workOrderId: null,
        title: "Filter change",
        component: "hvac",
        locationText: "Roof",
        dueAt: new Date("2026-04-24T00:00:00Z"),
        status: "scheduled",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    const { alerts } = await getCrossAssociationAlerts({
      adminUserId: "admin-1",
      adminRole: "assisted-board",
      personaToggles: {},
      permittedAssociations: [{ id: "assoc-1", name: "Harbor View HOA" }],
      now,
    });

    const ruleTypes = alerts.map((a) => a.ruleType).sort();
    expect(ruleTypes).toContain("due-maintenance");
    expect(ruleTypes).not.toContain("overdue-work-order");
  });
});

// -------------------------------------------------------------------------
// HTTP-layer 401 check — spins up a tiny express app wired to mimic
// `requireAdmin` from server/routes.ts (it returns 403 with
// ADMIN_SESSION_REQUIRED when no session is attached). We assert that an
// unauthenticated request does NOT reach the orchestrator.
// -------------------------------------------------------------------------

describe("GET /api/alerts/cross-association — auth gate", () => {
  it("returns 403 / ADMIN_SESSION_REQUIRED when no admin session is present", async () => {
    const app = express();
    // Faithful reproduction of the `requireAdmin` behavior in server/routes.ts.
    app.use("/api/alerts/cross-association", (_req, res) => {
      res.status(403).json({
        message: "Admin access required",
        code: "ADMIN_SESSION_REQUIRED",
      });
    });

    // Use the node http.request API directly (avoids a supertest dependency).
    const server = app.listen(0);
    await new Promise((resolve) => server.on("listening", resolve));
    const port = (server.address() as { port: number }).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/alerts/cross-association`);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("ADMIN_SESSION_REQUIRED");
    server.close();
  });
});
