// Wave 16a — Playwright seed helpers.
//
// These helpers manage in-test fixtures via Playwright's `page.route`
// table. They build a small, mutable in-memory store that route handlers
// read from / write to so a test can simulate state transitions
// (e.g., toggle `amenitiesEnabled`, mark a work order complete) and
// observe the React frontend reacting to the change.
//
// Why not seed a real Postgres? The Wave-15b artifact doc deferred that
// to a later wave (ephemeral DB + drizzle-kit push); Wave 16a stays
// inside Playwright by mocking. This trades realism (no DB constraint
// validation) for determinism (no network egress, no flaky teardown).

import type { Page, Route } from "@playwright/test";

export type AssessmentRule = {
  id: string;
  name: string;
  cadence: "monthly" | "quarterly" | "annual";
  amount: number;
  active: boolean;
  associationId: string;
};

export type WorkOrder = {
  id: string;
  title: string;
  status: "open" | "in-progress" | "resolved" | "closed";
  associationId: string;
  unitId?: string;
};

export type Alert = {
  id: string;
  associationId: string;
  source: "work-orders-overdue" | "vendor-renewals" | "insurance-expiry" | "budget-variance";
  title: string;
  count: number;
  workOrderId?: string;
};

export type AssociationFixture = {
  id: string;
  name: string;
  amenitiesEnabled: boolean;
};

export type SeedStore = {
  associations: Map<string, AssociationFixture>;
  rules: Map<string, AssessmentRule>;
  workOrders: Map<string, WorkOrder>;
  alerts: Map<string, Alert>;
  ruleRunHistory: Array<{
    id: string;
    ruleId: string;
    runAt: string;
    chargesCreated: number;
    dryRun: boolean;
  }>;
  ledgerEntries: Array<{
    id: string;
    associationId: string;
    unitId: string;
    description: string;
    amount: number;
    postedAt: string;
  }>;
};

export function createSeedStore(): SeedStore {
  return {
    associations: new Map([
      [
        "assoc-e2e-1",
        { id: "assoc-e2e-1", name: "E2E Test Association", amenitiesEnabled: true },
      ],
    ]),
    rules: new Map(),
    workOrders: new Map(),
    alerts: new Map(),
    ruleRunHistory: [],
    ledgerEntries: [],
  };
}

// Wire seed-aware route handlers onto a Playwright page. Routes
// consult (and mutate) the provided `store` so a test can drive
// transitions.
//
// Playwright's route handlers run in LIFO order: the last-registered
// handler is consulted first. We register the broad `api/**` fallback
// FIRST (so it runs LAST) and the narrower handlers AFTER (so they
// run FIRST and pre-empt the fallback).
export async function installSeedRoutes(page: Page, store: SeedStore): Promise<void> {
  // Last-resort fallback for any /api/* call that the more-specific
  // routes below don't match. Registered first so it fires last.
  await page.route("**/api/**", async (route: Route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  // Alerts — used by Home + Hub widgets (cross-association aggregation).
  await page.route("**/api/alerts/cross-association**", async (route: Route) => {
    if (route.request().method() === "GET") {
      const alerts = [...store.alerts.values()];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          alerts: alerts.map((a) => ({
            id: a.id,
            associationId: a.associationId,
            source: a.source,
            title: a.title,
            count: a.count,
            severity: "warning",
            createdAt: new Date().toISOString(),
            readAt: null,
            dismissedAt: null,
            workOrderId: a.workOrderId,
          })),
          totalCount: alerts.reduce((sum, a) => sum + a.count, 0),
        }),
      });
      return;
    }
    await route.fallback();
  });

  // Mark/dismiss/restore a single alert by id — mutate the store and
  // return success so the React mutation cache invalidates.
  await page.route(/\/api\/alerts\/[^/]+\/(read|dismiss|restore)/, async (route: Route) => {
    const url = route.request().url();
    const match = url.match(/\/api\/alerts\/([^/]+)\/(read|dismiss|restore)/);
    if (!match) {
      await route.fallback();
      return;
    }
    const [, alertId, action] = match;
    const alert = store.alerts.get(alertId);
    if (alert && action === "dismiss") {
      store.alerts.delete(alertId);
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, alertId, action }),
    });
  });

  // Work orders — fetched by detail surfaces. The PATCH path completes a
  // work order and removes the matching overdue alert (mirrors the
  // Wave-4.1 cache-invalidation behaviour).
  await page.route(/\/api\/work-orders\/?$/, async (route: Route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([...store.workOrders.values()]),
      });
      return;
    }
    await route.fallback();
  });

  await page.route(/\/api\/work-orders\/[^/]+/, async (route: Route) => {
    const url = route.request().url();
    const match = url.match(/\/api\/work-orders\/([^/?]+)/);
    if (!match) {
      await route.fallback();
      return;
    }
    const id = match[1];
    if (route.request().method() === "GET") {
      const wo = store.workOrders.get(id);
      if (!wo) {
        await route.fulfill({ status: 404, body: "{}", contentType: "application/json" });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(wo),
      });
      return;
    }
    if (route.request().method() === "PATCH") {
      const body = (route.request().postDataJSON() ?? {}) as { status?: WorkOrder["status"] };
      const wo = store.workOrders.get(id);
      if (wo && body.status) {
        wo.status = body.status;
        if (body.status === "resolved" || body.status === "closed") {
          // Drop any alert anchored to this WO so the next /alerts
          // fetch returns count = 0.
          for (const [alertId, alert] of store.alerts) {
            if (alert.workOrderId === id) store.alerts.delete(alertId);
          }
        }
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(wo ?? { id }),
      });
      return;
    }
    await route.fallback();
  });

  // Assessment rules — Manager creates / runs / lists.
  await page.route(/\/api\/financial\/rules\/?$/, async (route: Route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([...store.rules.values()]),
      });
      return;
    }
    if (route.request().method() === "POST") {
      const body = (route.request().postDataJSON() ?? {}) as Partial<AssessmentRule>;
      const id = `rule-${store.rules.size + 1}`;
      const rule: AssessmentRule = {
        id,
        name: body.name ?? "Untitled rule",
        cadence: body.cadence ?? "monthly",
        amount: body.amount ?? 100,
        active: true,
        associationId: body.associationId ?? "assoc-e2e-1",
      };
      store.rules.set(id, rule);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(rule),
      });
      return;
    }
    await route.fallback();
  });

  await page.route(/\/api\/financial\/rules\/[^/]+\/run/, async (route: Route) => {
    const url = route.request().url();
    const match = url.match(/\/api\/financial\/rules\/([^/]+)\/run/);
    const ruleId = match?.[1] ?? "unknown";
    const rule = store.rules.get(ruleId);
    const dryRun = url.includes("dryRun=true");
    const runId = `run-${store.ruleRunHistory.length + 1}`;
    const charges = rule ? 1 : 0;
    store.ruleRunHistory.push({
      id: runId,
      ruleId,
      runAt: new Date().toISOString(),
      chargesCreated: charges,
      dryRun,
    });
    if (rule && !dryRun) {
      const entryId = `ledger-${store.ledgerEntries.length + 1}`;
      store.ledgerEntries.push({
        id: entryId,
        associationId: rule.associationId,
        unitId: "unit-101",
        description: rule.name,
        amount: rule.amount,
        postedAt: new Date().toISOString(),
      });
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        runId,
        ruleId,
        chargesCreated: charges,
        dryRun,
      }),
    });
  });

  await page.route(/\/api\/financial\/rules\/[^/]+\/run-history/, async (route: Route) => {
    const url = route.request().url();
    const match = url.match(/\/api\/financial\/rules\/([^/]+)\/run-history/);
    const ruleId = match?.[1];
    const rows = store.ruleRunHistory.filter((r) => !ruleId || r.ruleId === ruleId);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(rows),
    });
  });

  // Owner ledger — read by /portal/finances/ledger.
  await page.route(/\/api\/portal\/ledger/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(store.ledgerEntries),
    });
  });

  // Association settings — amenities toggle + reads.
  await page.route(/\/api\/associations\/[^/]+\/settings\/amenities/, async (route: Route) => {
    const url = route.request().url();
    const match = url.match(/\/api\/associations\/([^/]+)\/settings\/amenities/);
    const id = match?.[1] ?? "assoc-e2e-1";
    const assoc = store.associations.get(id);
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ amenitiesEnabled: assoc?.amenitiesEnabled ?? true }),
      });
      return;
    }
    if (route.request().method() === "PATCH") {
      const body = (route.request().postDataJSON() ?? {}) as { amenitiesEnabled?: boolean };
      if (assoc && typeof body.amenitiesEnabled === "boolean") {
        assoc.amenitiesEnabled = body.amenitiesEnabled;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ amenitiesEnabled: assoc?.amenitiesEnabled ?? true }),
      });
      return;
    }
    await route.fallback();
  });

  // Owner-side amenities-enabled view (the portal reads its own copy
  // off the same flag — mirrors the production read path).
  await page.route(/\/api\/portal\/amenities\/settings/, async (route: Route) => {
    const assoc = store.associations.get("assoc-e2e-1");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ amenitiesEnabled: assoc?.amenitiesEnabled ?? true }),
    });
  });

  // Owner-side amenities listing — 404 when disabled, [] when enabled.
  // Mirrors the real handler in server/routes/amenities.ts which returns
  // a bare array of amenity rows (not a wrapping object).
  await page.route(/\/api\/portal\/amenities(?!\/settings|\/my-reservations|\/[^/]+\/)/, async (route: Route) => {
    const assoc = store.associations.get("assoc-e2e-1");
    if (!assoc?.amenitiesEnabled) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: "Amenities disabled for this association" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  // Owner-side amenity reservations — empty list while amenities is on.
  await page.route(/\/api\/portal\/amenities\/my-reservations/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  // Generic catch-alls for the small set of background queries the
  // PortalShell + WorkspaceShell run on first paint. These can return
  // empty payloads safely.
  for (const path of [
    "**/api/portal/announcements",
    "**/api/portal/documents",
    "**/api/portal/community-hub",
  ]) {
    await page.route(path, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
  }
}

export function seedAssessmentRule(store: SeedStore, partial: Partial<AssessmentRule> = {}): AssessmentRule {
  const id = partial.id ?? `rule-${store.rules.size + 1}`;
  const rule: AssessmentRule = {
    id,
    name: partial.name ?? "Monthly HOA dues",
    cadence: partial.cadence ?? "monthly",
    amount: partial.amount ?? 250,
    active: partial.active ?? true,
    associationId: partial.associationId ?? "assoc-e2e-1",
  };
  store.rules.set(id, rule);
  return rule;
}

export function seedWorkOrder(store: SeedStore, partial: Partial<WorkOrder> = {}): WorkOrder {
  const id = partial.id ?? `wo-${store.workOrders.size + 1}`;
  const wo: WorkOrder = {
    id,
    title: partial.title ?? "Replace lobby light fixture",
    status: partial.status ?? "open",
    associationId: partial.associationId ?? "assoc-e2e-1",
    unitId: partial.unitId,
  };
  store.workOrders.set(id, wo);
  return wo;
}

export function seedAlertForWorkOrder(store: SeedStore, workOrder: WorkOrder): Alert {
  const id = `alert-wo-${workOrder.id}`;
  const alert: Alert = {
    id,
    associationId: workOrder.associationId,
    source: "work-orders-overdue",
    title: `Overdue: ${workOrder.title}`,
    count: 1,
    workOrderId: workOrder.id,
  };
  store.alerts.set(id, alert);
  return alert;
}
