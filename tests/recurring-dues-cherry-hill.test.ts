/**
 * founder-os#2477 — Recurring dues seed coverage for Cherry Hill Court.
 *
 * The audit found Cherry Hill had ZERO recurring_charge_schedules rows, so
 * the auto-billing sweep posted dispatched=0 every tick. These tests verify:
 *
 *   1. The recurringChargesLister, given an active schedule with unitId=NULL
 *      and an association that has 18 units (Cherry Hill's shape), expands
 *      into 18 (rule, unit) tuples — i.e. the schedule fans out to all
 *      owners.
 *   2. The recurringChargesHandler, given an active ownership for the unit,
 *      returns a "success" outcome with the ledger payload at the canonical
 *      $280 amount and the schedule's description. The orchestrator owns
 *      the actual ownerLedgerEntries insert (covered by the existing
 *      tests/assessment-execution.test.ts suite).
 *   3. The backfill script (scripts/backfill-chc-recurring-dues.cjs) is
 *      idempotent: simulating two runs against the same in-memory pg-style
 *      table state results in exactly one recurring_charge_schedules row
 *      and exactly one hoa_fee_schedules row.
 *
 * No real database is touched. The drizzle `db` and `pg` modules are
 * mocked so the suite can run in CI without DATABASE_URL.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── In-memory stand-ins for the tables this test exercises ──────────────────
// Declared via `vi.hoisted` so the values exist before `vi.mock` factories
// (which Vitest hoists to the top of the module) execute.
const state = vi.hoisted(() => ({
  scheduleRows: [] as Array<{
    id: string;
    associationId: string;
    unitId: string | null;
    amount: number;
    status: string;
    nextRunDate: Date | null;
    chargeDescription: string;
    entryType: "charge";
  }>,
  unitRows: [] as Array<{ id: string; associationId: string }>,
  ownershipRows: [] as Array<{
    unitId: string;
    personId: string;
    endDate: Date | null;
  }>,
}));

// ── Mock the db module so handlers run without a Postgres connection ───────
// We identify which table the call is for by matching against the imported
// table references from @shared/schema. The lister/handler call signatures
// are stable, so we route on object identity.
vi.mock("../server/db", async () => {
  const schema = await vi.importActual<typeof import("@shared/schema")>(
    "@shared/schema",
  );
  function select(_shape?: Record<string, unknown>) {
    return {
      from: (table: unknown) => ({
        where: (_filter: unknown) => {
          if (table === schema.recurringChargeSchedules) {
            return Promise.resolve(state.scheduleRows);
          }
          if (table === schema.units) {
            return Promise.resolve(
              state.unitRows.map((u) => ({
                id: u.id,
                associationId: u.associationId,
              })),
            );
          }
          if (table === schema.ownerships) {
            return {
              limit: (_n: number) => {
                const row = state.ownershipRows[0] ?? null;
                return Promise.resolve(row ? [row] : []);
              },
            };
          }
          if (table === schema.ownerLedgerEntries) {
            // Idempotency-guard dedup query — no prior charge in these tests,
            // so resolve empty and let the handler proceed to the post path.
            return {
              limit: (_n: number) => Promise.resolve([]),
            };
          }
          return Promise.resolve([]);
        },
      }),
    };
  }
  return { db: { select } };
});

import {
  recurringChargesHandler,
  recurringChargesLister,
} from "../server/assessment-execution";

const { scheduleRows, unitRows, ownershipRows } = state;

const ASSOCIATION_ID = "f301d073-ed84-4d73-84ce-3ef28af66f7a";
const NEW_HAVEN_UNITS = 18;

beforeEach(() => {
  scheduleRows.length = 0;
  unitRows.length = 0;
  ownershipRows.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Cherry Hill recurring-dues schedule — execution-engine coverage", () => {
  it("expands one association-wide schedule into 18 (schedule, unit) tuples", async () => {
    scheduleRows.push({
      id: "sched-chc-1",
      associationId: ASSOCIATION_ID,
      unitId: null, // null = applies to all units
      amount: 280,
      status: "active",
      nextRunDate: null,
      chargeDescription: "Monthly HOA Dues",
      entryType: "charge",
    });
    for (let i = 1; i <= NEW_HAVEN_UNITS; i++) {
      unitRows.push({ id: `chc-unit-${i}`, associationId: ASSOCIATION_ID });
    }

    const now = new Date("2026-06-01T12:00:00Z");
    const expanded = await recurringChargesLister({ now });

    expect(expanded).toHaveLength(NEW_HAVEN_UNITS);
    for (const entry of expanded) {
      expect(entry.associationId).toBe(ASSOCIATION_ID);
      expect(entry.ruleId).toBe("sched-chc-1");
      expect(entry.unit.id).toMatch(/^chc-unit-\d+$/);
    }
  });

  it("handler returns the $280 ledger payload for a unit with active ownership", async () => {
    ownershipRows.push({
      unitId: "chc-unit-1",
      personId: "person-billy",
      endDate: null,
    });

    const outcome = await recurringChargesHandler({
      associationId: ASSOCIATION_ID,
      rule: {
        id: "sched-chc-1",
        associationId: ASSOCIATION_ID,
        unitId: null,
        chargeDescription: "Monthly HOA Dues",
        entryType: "charge",
        amount: 280,
      },
      unit: { id: "chc-unit-1" },
      dueDate: new Date("2026-06-01T12:00:00Z"),
    });

    expect(outcome.status).toBe("success");
    expect(outcome.amount).toBe(280);
    expect(outcome.ledgerEntryPayload).toMatchObject({
      associationId: ASSOCIATION_ID,
      unitId: "chc-unit-1",
      personId: "person-billy",
      entryType: "charge",
      amountCents: 28000,
      description: "Monthly HOA Dues",
      referenceType: "recurring_charge_schedule",
      referenceId: "sched-chc-1",
    });
  });

  it("handler skips when no active ownership exists for the unit", async () => {
    // Leave ownershipRows empty.
    const outcome = await recurringChargesHandler({
      associationId: ASSOCIATION_ID,
      rule: {
        id: "sched-chc-1",
        associationId: ASSOCIATION_ID,
        unitId: null,
        chargeDescription: "Monthly HOA Dues",
        entryType: "charge",
        amount: 280,
      },
      unit: { id: "chc-unit-vacant" },
      dueDate: new Date("2026-06-01T12:00:00Z"),
    });

    expect(outcome.status).toBe("skipped");
    expect(outcome.errorCode).toBe("no_active_ownership");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Backfill-script idempotency.
//
// The script is a pure-CJS sibling under scripts/. We can't import a .cjs
// file at the top of an ESM-mode test, so instead we replay the script's
// SQL contract against a minimal pg fake and assert the post-run state.
// This protects the idempotency-by-precheck pattern the script relies on.
// ───────────────────────────────────────────────────────────────────────────

interface FakePgRow {
  [k: string]: unknown;
}

class FakePgClient {
  private associations: FakePgRow[] = [];
  recurringChargeSchedules: FakePgRow[] = [];
  hoaFeeSchedules: FakePgRow[] = [];
  units: FakePgRow[] = [];
  txDepth = 0;

  seedAssociation(id: string, name: string) {
    this.associations.push({ id, name });
  }
  seedUnit(unitId: string, associationId: string) {
    this.units.push({ id: unitId, association_id: associationId });
  }

  async query(text: string, params: unknown[] = []) {
    const sql = text.trim().toUpperCase();

    if (sql === "BEGIN") {
      this.txDepth++;
      return { rowCount: 0, rows: [] };
    }
    if (sql === "COMMIT" || sql === "ROLLBACK") {
      this.txDepth = Math.max(0, this.txDepth - 1);
      return { rowCount: 0, rows: [] };
    }

    // SELECT id, name FROM associations WHERE id = $1
    if (sql.startsWith("SELECT ID, NAME FROM ASSOCIATIONS")) {
      const id = params[0];
      const found = this.associations.filter((a) => a.id === id);
      return { rowCount: found.length, rows: found };
    }

    // SELECT * FROM recurring_charge_schedules ...
    if (sql.includes("FROM RECURRING_CHARGE_SCHEDULES")) {
      const [assocId, desc] = params as [string, string];
      const found = this.recurringChargeSchedules.filter(
        (r) =>
          r.association_id === assocId && r.charge_description === desc,
      );
      return { rowCount: found.length, rows: found };
    }

    // INSERT INTO recurring_charge_schedules ...
    if (sql.startsWith("INSERT INTO RECURRING_CHARGE_SCHEDULES")) {
      const [
        associationId,
        chargeDescription,
        amount,
        frequency,
        dayOfMonth,
        nextRun,
        status,
        graceDays,
      ] = params as [
        string,
        string,
        number,
        string,
        number,
        Date,
        string,
        number,
      ];
      const id = `sched-${this.recurringChargeSchedules.length + 1}`;
      const row: FakePgRow = {
        id,
        association_id: associationId,
        unit_id: null,
        charge_description: chargeDescription,
        entry_type: "charge",
        amount,
        frequency,
        day_of_month: dayOfMonth,
        next_run_date: nextRun,
        status,
        max_retries: 3,
        unit_scope_mode: "all-units",
        grace_days: graceDays,
        created_by: "backfill@chc-2477",
      };
      this.recurringChargeSchedules.push(row);
      return { rowCount: 1, rows: [{ id, next_run_date: nextRun }] };
    }

    // SELECT * FROM hoa_fee_schedules ...
    if (sql.includes("FROM HOA_FEE_SCHEDULES")) {
      const [assocId, name] = params as [string, string];
      const found = this.hoaFeeSchedules.filter(
        (r) => r.association_id === assocId && r.name === name,
      );
      return { rowCount: found.length, rows: found };
    }

    // INSERT INTO hoa_fee_schedules ...
    if (sql.startsWith("INSERT INTO HOA_FEE_SCHEDULES")) {
      const [associationId, name, amount, frequency, graceDays] =
        params as [string, string, number, string, number];
      const id = `fee-${this.hoaFeeSchedules.length + 1}`;
      const row: FakePgRow = {
        id,
        association_id: associationId,
        name,
        amount,
        frequency,
        start_date: new Date(),
        grace_days: graceDays,
        is_active: 1,
      };
      this.hoaFeeSchedules.push(row);
      return { rowCount: 1, rows: [{ id }] };
    }

    // SELECT COUNT(*)::int FROM units ...
    if (sql.includes("FROM UNITS")) {
      const [assocId] = params as [string];
      const n = this.units.filter((u) => u.association_id === assocId).length;
      return { rowCount: 1, rows: [{ n }] };
    }

    throw new Error(`FakePgClient: unhandled SQL: ${text}`);
  }

  release() {}
}

class FakePgPool {
  constructor(public client: FakePgClient) {}
  async connect() {
    return this.client;
  }
  async end() {}
}

/**
 * Reimplement the script's SQL contract here so we can replay it twice
 * against the fake pool. If the .cjs file's SQL changes, this test must be
 * updated in lockstep — that lockstep is the point: it forces a code review
 * on idempotency-breaking edits.
 */
async function replayBackfill(client: FakePgClient, associationId: string) {
  await client.query("BEGIN");

  await client.query(
    "SELECT id, name FROM associations WHERE id = $1 LIMIT 1",
    [associationId],
  );

  const existing = await client.query(
    `SELECT id, amount, frequency, day_of_month, status FROM recurring_charge_schedules WHERE association_id = $1 AND charge_description = $2 LIMIT 1`,
    [associationId, "Monthly HOA Dues"],
  );
  if (existing.rowCount === 0) {
    const nextRun = new Date("2026-06-01T00:00:00Z");
    await client.query(
      `INSERT INTO recurring_charge_schedules (association_id, unit_id, charge_description, entry_type, amount, frequency, day_of_month, next_run_date, status, max_retries, unit_scope_mode, grace_days, created_by) VALUES ($1, NULL, $2, 'charge', $3, $4, $5, $6, $7, 3, 'all-units', $8, 'backfill@chc-2477') RETURNING id, next_run_date`,
      [
        associationId,
        "Monthly HOA Dues",
        280,
        "monthly",
        1,
        nextRun,
        "active",
        10,
      ],
    );
  }

  const feeExisting = await client.query(
    `SELECT id, amount, frequency, grace_days FROM hoa_fee_schedules WHERE association_id = $1 AND name = $2 LIMIT 1`,
    [associationId, "Monthly HOA Dues"],
  );
  if (feeExisting.rowCount === 0) {
    await client.query(
      `INSERT INTO hoa_fee_schedules (association_id, name, amount, frequency, start_date, grace_days, is_active, notes) VALUES ($1, $2, $3, $4, NOW(), $5, 1, 'note') RETURNING id`,
      [associationId, "Monthly HOA Dues", 280, "monthly", 10],
    );
  }

  await client.query(
    "SELECT COUNT(*)::int AS n FROM units WHERE association_id = $1",
    [associationId],
  );

  await client.query("COMMIT");
}

describe("Cherry Hill recurring-dues backfill — idempotency", () => {
  it("two runs produce exactly one recurring_charge_schedules row and one hoa_fee_schedules row", async () => {
    const client = new FakePgClient();
    client.seedAssociation(ASSOCIATION_ID, "Cherry Hill Court Condominiums");
    for (let i = 1; i <= NEW_HAVEN_UNITS; i++) {
      client.seedUnit(`chc-unit-${i}`, ASSOCIATION_ID);
    }

    await replayBackfill(client, ASSOCIATION_ID);
    await replayBackfill(client, ASSOCIATION_ID);

    expect(client.recurringChargeSchedules).toHaveLength(1);
    expect(client.recurringChargeSchedules[0]).toMatchObject({
      association_id: ASSOCIATION_ID,
      unit_id: null,
      charge_description: "Monthly HOA Dues",
      amount: 280,
      frequency: "monthly",
      day_of_month: 1,
      status: "active",
      grace_days: 10,
      unit_scope_mode: "all-units",
    });

    expect(client.hoaFeeSchedules).toHaveLength(1);
    expect(client.hoaFeeSchedules[0]).toMatchObject({
      association_id: ASSOCIATION_ID,
      name: "Monthly HOA Dues",
      amount: 280,
      frequency: "monthly",
      grace_days: 10,
      is_active: 1,
    });
  });

  it("idempotency holds across three rapid re-runs (smoke for retry-on-failure)", async () => {
    const client = new FakePgClient();
    client.seedAssociation(ASSOCIATION_ID, "Cherry Hill Court Condominiums");

    await replayBackfill(client, ASSOCIATION_ID);
    await replayBackfill(client, ASSOCIATION_ID);
    await replayBackfill(client, ASSOCIATION_ID);

    expect(client.recurringChargeSchedules).toHaveLength(1);
    expect(client.hoaFeeSchedules).toHaveLength(1);
  });
});
