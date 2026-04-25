// Wave 16a — Playwright seed helpers.
//
// These helpers manage in-test fixtures via Playwright's `page.route`
// table. They build a small, mutable in-memory store that route handlers
// read from / write to so a test can simulate state transitions
// (e.g., toggle `amenitiesEnabled`, mark a work order complete) and
// observe the React frontend reacting to the change.
//
// Wave 17 added a parallel "real backend" path (see `seedRealBackend` /
// `installRealManagerSession` lower in this file). When the spec opts
// into real-backend mode, it never registers the route mocks below;
// the dev server, ephemeral pglite, and a directly-injected session
// row do the work that route mocks did before.
//
// The route-mock path stays for the four specs that have not yet been
// graduated to real-backend mode (Wave 17 follow-up).

import { createHmac, randomUUID } from "node:crypto";
import pg from "pg";
import type { BrowserContext, Page, Route } from "@playwright/test";

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

// ---------------------------------------------------------------------------
// Wave 17 — Real-backend seed helpers.
//
// These run alongside the route-mock helpers above. A spec opting into
// real-backend mode constructs a `RealBackend` handle (via
// `createRealBackend`) and calls the seed methods on it. Each method
// inserts rows directly into the ephemeral pglite DB. The dev server
// and its session middleware then see real rows, so the alert engine,
// auth gate, and PATCH handler all run for real — no `route.fulfill`
// involved.
// ---------------------------------------------------------------------------

export interface RealBackendOptions {
  connectionString: string;
  sessionSecret: string;
  /**
   * Cookie name used by the express-session middleware. Production uses
   * `sid`; dev uses `sid_dev` (server/index.ts line 85). We default to
   * the prod name; the dev server sets `NODE_ENV=test` for these specs
   * so we honor that — see `playwright.config.ts`.
   */
  cookieName?: string;
}

export interface RealBackendHandle {
  pool: pg.Pool;
  /** Drop test data and close the pool. */
  cleanup: () => Promise<void>;
  /** Truncate every test-mutable table without re-running migrations. */
  reset: () => Promise<void>;
  /** Seed a manager session and attach the cookie to the browser context. */
  installManagerSession: (context: BrowserContext, options?: ManagerSessionOptions) => Promise<ManagerSessionDescriptor>;
  /** Seed an association + admin scope row. */
  seedAssociation: (id: string, name: string) => Promise<void>;
  /**
   * Seed an overdue work order anchored to an association. The dev
   * server's overdue-work-orders alert source runs against
   * `status IN ('open', 'assigned', 'in-progress', 'pending-review')`
   * AND `scheduled_for < NOW()`, so we set `scheduled_for` to the past
   * by default.
   */
  seedOverdueWorkOrder: (input: SeedWorkOrderInput) => Promise<{ id: string }>;
}

export interface ManagerSessionOptions {
  email?: string;
  associationId?: string;
}

export interface ManagerSessionDescriptor {
  adminUserId: string;
  authUserId: string;
  email: string;
  associationId: string;
}

export interface SeedWorkOrderInput {
  id?: string;
  title: string;
  associationId: string;
  scheduledFor?: Date;
  status?: "open" | "assigned" | "in-progress" | "pending-review";
}

const TEST_HOST = "localhost";

/**
 * Sign a session id the same way express-session does (`s:<sid>.<sig>`,
 * URL-encoded). We re-implement the trivial helper inline so we don't
 * need an additional `@types/cookie-signature` devDep.
 */
function signSessionId(sid: string, secret: string): string {
  const sig = createHmac("sha256", secret).update(sid).digest("base64").replace(/=+$/, "");
  return `s:${sid}.${sig}`;
}

export async function createRealBackend(options: RealBackendOptions): Promise<RealBackendHandle> {
  const pool = new pg.Pool({ connectionString: options.connectionString });
  const cookieName = options.cookieName ?? "sid";

  async function reset(): Promise<void> {
    // Truncate tables that any spec may write to. The seedDatabase
    // built-in only inserts known associations; we leave the
    // user_sessions table truncated so cookies from a prior run don't
    // leak in.
    await pool.query(`
      TRUNCATE TABLE
        alert_read_states,
        work_orders,
        admin_association_scopes,
        admin_users,
        auth_external_accounts,
        auth_users,
        user_sessions,
        units,
        buildings,
        associations
      RESTART IDENTITY CASCADE
    `);
  }

  async function seedAssociation(id: string, name: string): Promise<void> {
    await pool.query(
      `INSERT INTO associations (id, name, address, city, state, country, is_archived)
       VALUES ($1, $2, $3, $4, $5, $6, 0)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [id, name, "1 Test Street", "Hartford", "CT", "USA"],
    );
  }

  async function seedOverdueWorkOrder(input: SeedWorkOrderInput): Promise<{ id: string }> {
    const id = input.id ?? randomUUID();
    const scheduledFor = input.scheduledFor ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO work_orders (id, association_id, title, description, status, priority, category, scheduled_for)
       VALUES ($1, $2, $3, $4, $5, 'medium', 'general', $6)`,
      [id, input.associationId, input.title, "Seeded by Playwright", input.status ?? "open", scheduledFor],
    );
    return { id };
  }

  async function installManagerSession(
    context: BrowserContext,
    overrides: ManagerSessionOptions = {},
  ): Promise<ManagerSessionDescriptor> {
    const email = overrides.email ?? `manager-${Date.now()}@e2e.test`;
    const associationId = overrides.associationId ?? "assoc-e2e-1";

    // Insert admin_user row (manager role).
    const adminUserId = randomUUID();
    await pool.query(
      `INSERT INTO admin_users (id, email, role, is_active)
       VALUES ($1, $2, 'manager', 1)
       ON CONFLICT (email) DO UPDATE SET role = 'manager', is_active = 1
       RETURNING id`,
      [adminUserId, email],
    );

    // Resolve the admin id (may have been overridden by an existing row).
    const { rows: adminRows } = await pool.query<{ id: string }>(
      `SELECT id FROM admin_users WHERE email = $1`,
      [email],
    );
    const resolvedAdminId = adminRows[0]?.id;
    if (!resolvedAdminId) throw new Error("Failed to upsert admin_user");

    // Scope the manager to the seeded association.
    await pool.query(
      `INSERT INTO admin_association_scopes (id, admin_user_id, association_id)
       VALUES (gen_random_uuid(), $1, $2)
       ON CONFLICT (admin_user_id, association_id) DO NOTHING`,
      [resolvedAdminId, associationId],
    );

    // Insert auth_user that links to the admin row.
    const authUserId = randomUUID();
    await pool.query(
      `INSERT INTO auth_users (id, admin_user_id, email, first_name, last_name, is_active)
       VALUES ($1, $2, $3, 'E2E', 'Manager', 1)
       ON CONFLICT (email) DO UPDATE SET admin_user_id = EXCLUDED.admin_user_id, is_active = 1
       RETURNING id`,
      [authUserId, resolvedAdminId, email],
    );
    const { rows: authRows } = await pool.query<{ id: string }>(
      `SELECT id FROM auth_users WHERE email = $1`,
      [email],
    );
    const resolvedAuthUserId = authRows[0]?.id;
    if (!resolvedAuthUserId) throw new Error("Failed to upsert auth_user");

    // Build a session row mirroring what passport+express-session would
    // write after a successful login. The cookie field shape mirrors
    // `session.cookie` defaults so connect-pg-simple treats it as a
    // legitimate live session.
    const sid = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const sess = {
      cookie: {
        originalMaxAge: 7 * 24 * 60 * 60 * 1000,
        expires: expiresAt.toISOString(),
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: false,
      },
      passport: { user: resolvedAuthUserId },
    };

    await pool.query(
      `INSERT INTO user_sessions (sid, sess, expire) VALUES ($1, $2, $3)
       ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
      [sid, sess, expiresAt],
    );

    // Attach the signed cookie to the Playwright browser context so any
    // subsequent navigation includes it. The cookie value is the sid
    // signed with SESSION_SECRET — connect-pg-simple looks the sid up
    // in `user_sessions`, sees the session row above, and the rest of
    // the auth pipeline runs as if a real OAuth login happened.
    const signed = signSessionId(sid, options.sessionSecret);
    // Playwright sets the cookie value verbatim. express-session reads
    // cookies via `cookie.parse()` which URI-decodes — so we attach
    // the raw signed value, not the URI-encoded form.
    await context.addCookies([
      {
        name: cookieName,
        value: signed,
        domain: TEST_HOST,
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        expires: Math.floor(expiresAt.getTime() / 1000),
      },
    ]);

    return {
      adminUserId: resolvedAdminId,
      authUserId: resolvedAuthUserId,
      email,
      associationId,
    };
  }

  async function cleanup(): Promise<void> {
    await pool.end();
  }

  return {
    pool,
    cleanup,
    reset,
    installManagerSession,
    seedAssociation,
    seedOverdueWorkOrder,
  };
}
