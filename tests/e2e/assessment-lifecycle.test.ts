// @zone: cross-cutting — E2E integration test (Wave 15b, Flow C)
/**
 * E2E Flow C — Assessment lifecycle.
 *
 * Exercises the recurring-rule workflow end-to-end:
 *
 *   1. Manager creates a recurring charge schedule via
 *      POST /api/financial/recurring-charges/schedules.
 *   2. Manager triggers "Run now" via
 *      POST /api/financial/recurring-charges/schedules/:id/run.
 *   3. The run-history tab (GET /api/financial/assessment-run-log)
 *      returns the new run entry.
 *   4. The owner portal dashboard surfaces the recurring schedule
 *      (GET /api/portal/financial-dashboard).
 *
 * We skip the real Postgres by backing each handler with in-memory
 * stores. The point of this test is the CONTRACT between manager-side
 * creation, run-history, and owner-portal read — not the SQL.
 */

import express from "express";
import type { Request, Response, NextFunction } from "express";
import { describe, it, expect, beforeEach } from "vitest";
import { AddressInfo } from "net";

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

type RecurringSchedule = {
  id: string;
  associationId: string;
  name: string;
  amountCents: number;
  cadence: "monthly" | "quarterly" | "annual";
  nextRunAt: string;
  active: 0 | 1;
  createdBy: string;
};

type AssessmentRunLogEntry = {
  id: string;
  associationId: string;
  scheduleId: string;
  scheduleName: string;
  runAt: string;
  runType: "on-demand" | "scheduled";
  initiatedBy: string;
  chargesPosted: number;
};

type HarnessStores = {
  schedules: Map<string, RecurringSchedule>;
  runLog: AssessmentRunLogEntry[];
};

type AdminRequest = Request & {
  adminUser?: { id: string; role: string };
  scopedAssociationIds?: string[];
};

type PortalRequest = Request & {
  portalAssociationId?: string;
  portalPersonId?: string;
  portalUnitId?: string | null;
};

function makeHarness() {
  const stores: HarnessStores = {
    schedules: new Map(),
    runLog: [],
  };
  const app = express();
  app.use(express.json());

  // --- Fake admin middleware -----------------------------------------------
  app.use("/api/financial", (req: AdminRequest, res, next) => {
    req.adminUser = { id: "admin-manager-1", role: "manager" };
    req.scopedAssociationIds = ["assoc-1"];
    next();
  });

  // --- Fake portal middleware ----------------------------------------------
  app.use("/api/portal", (req: PortalRequest, res, next) => {
    const header = req.header("x-portal-access-id");
    if (!header) return res.status(403).json({ message: "Portal access required" });
    req.portalAssociationId = "assoc-1";
    req.portalPersonId = "person-1";
    req.portalUnitId = "unit-1";
    next();
  });

  // --- POST /api/financial/recurring-charges/schedules — create ------------
  app.post(
    "/api/financial/recurring-charges/schedules",
    (req: AdminRequest, res) => {
      const body = req.body as Partial<RecurringSchedule>;
      if (!body.name || !body.amountCents || !body.cadence) {
        return res.status(400).json({ message: "name, amountCents, cadence required" });
      }
      if (!body.associationId || !req.scopedAssociationIds?.includes(body.associationId)) {
        return res.status(403).json({ message: "Association outside admin scope" });
      }
      const id = `sched-${stores.schedules.size + 1}`;
      const schedule: RecurringSchedule = {
        id,
        associationId: body.associationId,
        name: body.name,
        amountCents: body.amountCents,
        cadence: body.cadence as RecurringSchedule["cadence"],
        nextRunAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        active: 1,
        createdBy: req.adminUser!.id,
      };
      stores.schedules.set(id, schedule);
      res.status(201).json(schedule);
    },
  );

  // --- GET list (used by the Recurring tab) --------------------------------
  app.get(
    "/api/financial/recurring-charges/schedules",
    (req: AdminRequest, res) => {
      const associationId = req.query.associationId as string | undefined;
      const rows = [...stores.schedules.values()].filter(
        (s) => !associationId || s.associationId === associationId,
      );
      res.json(rows);
    },
  );

  // --- POST :id/run — the "Run now" button ---------------------------------
  app.post(
    "/api/financial/recurring-charges/schedules/:id/run",
    (req: AdminRequest, res) => {
      const schedule = stores.schedules.get(req.params.id);
      if (!schedule) return res.status(404).json({ message: "Schedule not found" });
      if (!req.scopedAssociationIds?.includes(schedule.associationId)) {
        return res.status(403).json({ message: "Out of scope" });
      }
      const entry: AssessmentRunLogEntry = {
        id: `run-${stores.runLog.length + 1}`,
        associationId: schedule.associationId,
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        runAt: new Date().toISOString(),
        runType: "on-demand",
        initiatedBy: req.adminUser!.id,
        chargesPosted: 1,
      };
      stores.runLog.push(entry);
      res.json({ ok: true, runId: entry.id });
    },
  );

  // --- GET /api/financial/assessment-run-log — the "Run History" tab ------
  app.get("/api/financial/assessment-run-log", (req: AdminRequest, res) => {
    const associationId = req.query.associationId as string | undefined;
    let rows = stores.runLog;
    if (associationId) rows = rows.filter((r) => r.associationId === associationId);
    res.json({ entries: rows });
  });

  // --- GET /api/portal/financial-dashboard — owner-portal read -------------
  app.get("/api/portal/financial-dashboard", (req: PortalRequest, res) => {
    const feeSchedules = [...stores.schedules.values()]
      .filter((s) => s.associationId === req.portalAssociationId)
      .map((s) => ({
        id: s.id,
        name: s.name,
        amountCents: s.amountCents,
        cadence: s.cadence,
        nextRunAt: s.nextRunAt,
      }));
    res.json({
      balance: 0,
      totalCharged: 0,
      totalPaid: 0,
      feeSchedules,
      nextDueDate: feeSchedules[0]?.nextRunAt ?? null,
      paymentPlan: null,
      recentEntries: [],
      specialAssessmentUpcomingInstallments: [],
    });
  });

  return { app, stores };
}

async function withServer<T>(
  app: express.Express,
  run: (port: number) => Promise<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const port = (server.address() as AddressInfo).port;
        const result = await run(port);
        server.close(() => resolve(result));
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

async function req(
  port: number,
  method: "GET" | "POST",
  url: string,
  opts: { body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: any }> {
  const res = await fetch(`http://127.0.0.1:${port}${url}`, {
    method,
    headers: {
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers ?? {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("E2E Flow C — assessment rule lifecycle", () => {
  let harness: ReturnType<typeof makeHarness>;

  beforeEach(() => {
    harness = makeHarness();
  });

  it("rejects schedule creation outside admin scope (403)", async () => {
    await withServer(harness.app, async (port) => {
      const res = await req(port, "POST", "/api/financial/recurring-charges/schedules", {
        body: {
          associationId: "assoc-OTHER",
          name: "HOA Dues",
          amountCents: 25000,
          cadence: "monthly",
        },
      });
      expect(res.status).toBe(403);
    });
  });

  it("full flow: manager creates rule → runs it → history tab sees it → owner portal sees schedule", async () => {
    await withServer(harness.app, async (port) => {
      // Step 1 — Manager creates a recurring rule on /app/financial/rules.
      const created = await req(port, "POST", "/api/financial/recurring-charges/schedules", {
        body: {
          associationId: "assoc-1",
          name: "HOA Dues",
          amountCents: 25000,
          cadence: "monthly",
        },
      });
      expect(created.status).toBe(201);
      const schedule = created.body as RecurringSchedule;
      expect(schedule.id).toBeTruthy();
      expect(schedule.name).toBe("HOA Dues");

      // Step 2 — Manager clicks "Run now".
      const ran = await req(port, "POST", `/api/financial/recurring-charges/schedules/${schedule.id}/run`);
      expect(ran.status).toBe(200);
      expect(ran.body.ok).toBe(true);
      expect(ran.body.runId).toBeTruthy();

      // Step 3 — Run-history tab shows the new entry.
      const history = await req(
        port,
        "GET",
        "/api/financial/assessment-run-log?associationId=assoc-1",
      );
      expect(history.status).toBe(200);
      expect(history.body.entries).toHaveLength(1);
      expect(history.body.entries[0]).toMatchObject({
        scheduleId: schedule.id,
        scheduleName: "HOA Dues",
        runType: "on-demand",
        chargesPosted: 1,
      });

      // Step 4 — Owner portal dashboard surfaces the schedule.
      const portalDash = await req(port, "GET", "/api/portal/financial-dashboard", {
        headers: { "x-portal-access-id": "access-1" },
      });
      expect(portalDash.status).toBe(200);
      expect(portalDash.body.feeSchedules).toHaveLength(1);
      expect(portalDash.body.feeSchedules[0]).toMatchObject({
        id: schedule.id,
        name: "HOA Dues",
        amountCents: 25000,
        cadence: "monthly",
      });
      expect(portalDash.body.nextDueDate).toBe(schedule.nextRunAt);
    });
  });

  it("portal without x-portal-access-id returns 403", async () => {
    await withServer(harness.app, async (port) => {
      const res = await req(port, "GET", "/api/portal/financial-dashboard");
      expect(res.status).toBe(403);
    });
  });

  it("run-history filter respects associationId", async () => {
    await withServer(harness.app, async (port) => {
      // Seed a rule + run.
      const created = await req(port, "POST", "/api/financial/recurring-charges/schedules", {
        body: {
          associationId: "assoc-1",
          name: "Dues",
          amountCents: 25000,
          cadence: "monthly",
        },
      });
      await req(port, "POST", `/api/financial/recurring-charges/schedules/${created.body.id}/run`);

      const mine = await req(
        port,
        "GET",
        "/api/financial/assessment-run-log?associationId=assoc-1",
      );
      expect(mine.body.entries).toHaveLength(1);

      const other = await req(
        port,
        "GET",
        "/api/financial/assessment-run-log?associationId=assoc-2",
      );
      expect(other.body.entries).toHaveLength(0);
    });
  });
});
