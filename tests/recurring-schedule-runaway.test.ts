/**
 * P0 incident regression — recurring-charge schedule runaway loop.
 *
 * Incident: the unified assessment sweep posted a monthly recurring charge,
 * then RE-POSTED it on every ~5-min sweep around the clock because:
 *   1. the orchestrator never advanced `recurring_charge_schedules.next_run_date`
 *      after a run, so the lister (which selects schedules WHERE next_run_date
 *      IS NULL OR next_run_date <= now) kept re-selecting the schedule; and
 *   2. there was no idempotency guard preventing a second post for the same
 *      (schedule, unit, period).
 *
 * The fix is defense in depth:
 *   - advance `next_run_date` to the next period after a successful sweep
 *     (the schedule fires once per period, then waits); AND
 *   - an idempotency guard in the handler that skips a (schedule, unit) that
 *     already has a recurring-charge ledger row inside the current period
 *     window [periodStart, nextRunDate).
 *
 * This suite proves the canonical scenario:
 *   - a monthly schedule with next_run_date <= now fires EXACTLY ONCE;
 *   - posts one charge per unit;
 *   - advances next_run_date to next month; and
 *   - a second IMMEDIATE sweep posts NOTHING.
 *
 * No real database is touched — the drizzle `db` module is mocked with a small
 * stateful fake that re-implements the few predicates the lister + handler +
 * orchestrator rely on (active + due selection, the period-window dedup query,
 * and the next_run_date UPDATE). The period predicate is computed via the
 * production `computeRecurringPeriod` helper so the test stays faithful to the
 * real boundary math.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface ScheduleRow {
  id: string;
  associationId: string;
  unitId: string | null;
  chargeDescription: string;
  entryType: "charge";
  amount: number;
  frequency: "monthly" | "quarterly" | "annual";
  dayOfMonth: number;
  nextRunDate: Date | null;
  status: "active" | "paused" | "archived";
  updatedAt: Date;
}

interface UnitRow {
  id: string;
  associationId: string;
}

interface OwnershipRow {
  unitId: string;
  personId: string;
  endDate: Date | null;
  startDate: Date;
}

interface LedgerRow {
  id: string;
  associationId: string;
  unitId: string;
  referenceType: string | null;
  referenceId: string | null;
  postedAt: Date;
  amount: number;
}

const state = vi.hoisted(() => ({
  schedules: [] as ScheduleRow[],
  units: [] as UnitRow[],
  ownerships: [] as OwnershipRow[],
  ledger: [] as LedgerRow[],
  runLog: [] as Array<Record<string, unknown>>,
  now: new Date("2026-06-01T12:00:00Z"),
}));

// The mock must reproduce the period-window dedup the handler relies on. It
// imports the production helper so the boundary math is identical.
const helpers = vi.hoisted(() => ({
  computeRecurringPeriod: null as
    | null
    | ((
        s: { frequency: ScheduleRow["frequency"]; dayOfMonth: number },
        dueDate: Date,
      ) => { periodStart: Date; nextRunDate: Date }),
}));

vi.mock("../server/db", async () => {
  const schema = await vi.importActual<typeof import("@shared/schema")>(
    "@shared/schema",
  );
  // Stash a captured filter target across the select chain so the ledger
  // dedup query can be re-applied faithfully. The handler always issues the
  // dedup query immediately before resolving ownership for a single unit, so
  // we narrow using the *last* unit the lister/handler touched.
  let lastLedgerProbe: { unitId: string | null; referenceId: string | null } = {
    unitId: null,
    referenceId: null,
  };

  function applyLedgerProbe(): LedgerRow[] {
    // Re-implement: associationId + unitId + referenceType=recurring +
    // referenceId=scheduleId + postedAt in [periodStart, nextRunDate).
    const compute = helpers.computeRecurringPeriod;
    const sched = state.schedules.find((s) => s.id === lastLedgerProbe.referenceId);
    if (!compute || !sched) return [];
    const { periodStart, nextRunDate } = compute(sched, state.now);
    return state.ledger.filter(
      (row) =>
        row.unitId === lastLedgerProbe.unitId &&
        row.referenceType === "recurring_charge_schedule" &&
        row.referenceId === lastLedgerProbe.referenceId &&
        row.postedAt >= periodStart &&
        row.postedAt < nextRunDate,
    );
  }

  function select(shape?: Record<string, unknown>) {
    return {
      from: (table: unknown) => ({
        where: (filter: unknown) => {
          if (table === schema.recurringChargeSchedules) {
            // Reproduce: status='active' AND (nextRunDate IS NULL OR <= now).
            const rows = state.schedules.filter(
              (s) =>
                s.status === "active" &&
                (s.nextRunDate === null || s.nextRunDate <= state.now),
            );
            return Promise.resolve(rows);
          }
          if (table === schema.units) {
            return Promise.resolve(
              state.units.map((u) => ({ id: u.id, associationId: u.associationId })),
            );
          }
          if (table === schema.ownerLedgerEntries) {
            // The handler's dedup query selects { id } — recover the probe
            // target by scanning the drizzle filter's bound values is brittle,
            // so we instead snapshot from the most recent capture. The capture
            // is set by the handler indirectly: it always queries with the
            // unit + scheduleId that are the next ones it will post for. We set
            // it in the ownerships branch below (handler order: ledger dedup →
            // ownership). To keep it correct we expose a hook the test sets.
            return {
              limit: (_n: number) => Promise.resolve(applyLedgerProbe()),
            };
          }
          if (table === schema.ownerships) {
            return {
              limit: (_n: number) => {
                // Active ownership: endDate IS NULL for the probed unit.
                const row = state.ownerships.find(
                  (o) => o.unitId === lastLedgerProbe.unitId && o.endDate === null,
                );
                return Promise.resolve(row ? [row] : []);
              },
            };
          }
          void shape;
          void filter;
          return Promise.resolve([]);
        },
      }),
    };
  }

  return {
    db: {
      // Test hook: lets the test set which (unit, schedule) the next ledger
      // dedup query should resolve against.
      __setLedgerProbe(unitId: string, referenceId: string) {
        lastLedgerProbe = { unitId, referenceId };
      },
      select,
      insert: (table: unknown) => ({
        values: (row: Record<string, unknown>) => ({
          returning: (_shape?: Record<string, unknown>) => {
            if (table === schema.ownerLedgerEntries) {
              const id = `ledger-${state.ledger.length + 1}`;
              state.ledger.push({
                id,
                associationId: row.associationId as string,
                unitId: row.unitId as string,
                referenceType: (row.referenceType as string) ?? null,
                referenceId: (row.referenceId as string) ?? null,
                postedAt: row.postedAt as Date,
                amount: row.amount as number,
              });
              return Promise.resolve([{ id, ...row }]);
            }
            if (table === schema.assessmentRunLog) {
              const id = `runlog-${state.runLog.length + 1}`;
              state.runLog.push({ id, ...row });
              return Promise.resolve([{ id }]);
            }
            throw new Error("unexpected insert table in runaway test mock");
          },
        }),
      }),
      update: (table: unknown) => ({
        set: (changes: Record<string, unknown>) => ({
          where: (_filter: unknown) => {
            if (table === schema.recurringChargeSchedules) {
              // We can't read the drizzle filter, but the orchestrator only
              // ever advances schedules that fired this sweep — and the test
              // exercises a single schedule. Apply to the (only) schedule whose
              // nextRunDate is currently due.
              for (const s of state.schedules) {
                if (s.status === "active" && (s.nextRunDate === null || s.nextRunDate <= state.now)) {
                  if (changes.nextRunDate instanceof Date) {
                    s.nextRunDate = changes.nextRunDate;
                  }
                  if (changes.updatedAt instanceof Date) {
                    s.updatedAt = changes.updatedAt;
                  }
                }
              }
            }
            return Promise.resolve();
          },
        }),
      }),
    },
  };
});

// Mock the alerts cache flush — irrelevant to this suite.
vi.mock("../server/alerts", () => ({ invalidateAlertCache: () => {} }));

import {
  computeRecurringPeriod,
  recurringChargesHandler,
  recurringChargesLister,
  runSweep,
} from "../server/assessment-execution";
import { db } from "../server/db";

helpers.computeRecurringPeriod = computeRecurringPeriod;

const ASSOCIATION_ID = "f301d073-ed84-4d73-84ce-3ef28af66f7a";

beforeEach(() => {
  state.schedules.length = 0;
  state.units.length = 0;
  state.ownerships.length = 0;
  state.ledger.length = 0;
  state.runLog.length = 0;
  state.now = new Date("2026-06-01T12:00:00Z");
});

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * Drive the recurring rule type through the orchestrator. We invoke the
 * handler per unit manually (to set the ledger probe) and the lister +
 * advance via runSweep. To keep the mock honest, we run the handler path the
 * orchestrator would, setting the probe before each unit's dedup query.
 *
 * Simpler: exercise the lister → handler → advance chain directly so the test
 * mirrors the orchestrator's contract without needing the mock to infer the
 * drizzle filter per unit.
 */
async function sweepRecurringOnce(now: Date): Promise<{
  posted: number;
  skipped: number;
}> {
  state.now = now;
  const eligible = await recurringChargesLister({ now });
  let posted = 0;
  let skipped = 0;
  for (const entry of eligible) {
    const schedule = entry.rule as ScheduleRow;
    // Mirror the production DB filter target for this unit's dedup query.
    (db as unknown as {
      __setLedgerProbe(u: string, r: string): void;
    }).__setLedgerProbe(entry.unit.id, schedule.id);
    const outcome = await recurringChargesHandler({
      associationId: entry.associationId,
      rule: entry.rule,
      unit: entry.unit,
      dueDate: entry.dueDate,
    });
    if (outcome.status === "success" && outcome.ledgerEntryPayload) {
      // The orchestrator owns the insert — simulate it so the next sweep's
      // dedup guard can see the row.
      state.ledger.push({
        id: `ledger-${state.ledger.length + 1}`,
        associationId: outcome.ledgerEntryPayload.associationId,
        unitId: outcome.ledgerEntryPayload.unitId,
        referenceType: outcome.ledgerEntryPayload.referenceType,
        referenceId: outcome.ledgerEntryPayload.referenceId,
        postedAt: outcome.ledgerEntryPayload.postedAt,
        amount: outcome.ledgerEntryPayload.amount,
      });
      posted++;
    } else {
      skipped++;
    }
  }
  // Advance nextRunDate exactly as the orchestrator does for the schedules
  // that fired this sweep.
  if (eligible.length > 0) {
    const sched = eligible[0].rule as ScheduleRow;
    const { nextRunDate } = computeRecurringPeriod(sched, eligible[0].dueDate);
    for (const s of state.schedules) {
      if (s.id === sched.id) {
        s.nextRunDate = nextRunDate;
        s.updatedAt = new Date();
      }
    }
  }
  return { posted, skipped };
}

describe("recurring-charge schedule — runaway-loop regression", () => {
  it("fires once, posts one charge per unit, advances next_run_date, and a second immediate sweep posts nothing", async () => {
    // Cherry Hill shape: one association-wide monthly schedule, several units,
    // all with active ownership.
    state.schedules.push({
      id: "sched-chc-1",
      associationId: ASSOCIATION_ID,
      unitId: null,
      chargeDescription: "Monthly HOA Dues",
      entryType: "charge",
      amount: 280,
      frequency: "monthly",
      dayOfMonth: 1,
      nextRunDate: new Date("2026-06-01T00:00:00Z"), // due (<= now)
      status: "active",
      updatedAt: new Date("2026-05-01T00:00:00Z"),
    });
    const UNIT_COUNT = 3;
    for (let i = 1; i <= UNIT_COUNT; i++) {
      state.units.push({ id: `chc-unit-${i}`, associationId: ASSOCIATION_ID });
      state.ownerships.push({
        unitId: `chc-unit-${i}`,
        personId: `person-${i}`,
        endDate: null,
        startDate: new Date("2020-01-01T00:00:00Z"),
      });
    }

    // ── First sweep: should post exactly one charge per unit. ──────────────
    const first = await sweepRecurringOnce(new Date("2026-06-01T12:00:00Z"));
    expect(first.posted).toBe(UNIT_COUNT);
    expect(first.skipped).toBe(0);
    expect(state.ledger).toHaveLength(UNIT_COUNT);

    // next_run_date advanced to July 1.
    const sched = state.schedules[0];
    expect(sched.nextRunDate?.toISOString()).toBe("2026-07-01T00:00:00.000Z");

    // ── Second IMMEDIATE sweep (same minute): must post NOTHING. ───────────
    // The schedule is no longer due (next_run_date = July 1 > now), so the
    // lister won't even select it — the loop is broken at the source.
    const second = await sweepRecurringOnce(new Date("2026-06-01T12:05:00Z"));
    expect(second.posted).toBe(0);
    expect(state.ledger).toHaveLength(UNIT_COUNT); // unchanged
  });

  it("idempotency guard alone blocks a duplicate post even if next_run_date is still due (advancement failed)", async () => {
    // Simulate the failure mode where next_run_date did NOT advance (e.g. a
    // crash between the ledger insert and the schedule UPDATE). The handler's
    // period-window dedup must still prevent a second post.
    state.schedules.push({
      id: "sched-chc-1",
      associationId: ASSOCIATION_ID,
      unitId: "chc-unit-1",
      chargeDescription: "Monthly HOA Dues",
      entryType: "charge",
      amount: 280,
      frequency: "monthly",
      dayOfMonth: 1,
      nextRunDate: new Date("2026-06-01T00:00:00Z"), // stays due
      status: "active",
      updatedAt: new Date("2026-05-01T00:00:00Z"),
    });
    state.units.push({ id: "chc-unit-1", associationId: ASSOCIATION_ID });
    state.ownerships.push({
      unitId: "chc-unit-1",
      personId: "person-1",
      endDate: null,
      startDate: new Date("2020-01-01T00:00:00Z"),
    });

    state.now = new Date("2026-06-01T12:00:00Z");

    // Pre-existing charge already posted this period (June 1 12:00).
    state.ledger.push({
      id: "ledger-pre",
      associationId: ASSOCIATION_ID,
      unitId: "chc-unit-1",
      referenceType: "recurring_charge_schedule",
      referenceId: "sched-chc-1",
      postedAt: new Date("2026-06-01T12:00:00Z"),
      amount: 280,
    });

    (db as unknown as {
      __setLedgerProbe(u: string, r: string): void;
    }).__setLedgerProbe("chc-unit-1", "sched-chc-1");

    const outcome = await recurringChargesHandler({
      associationId: ASSOCIATION_ID,
      rule: state.schedules[0],
      unit: { id: "chc-unit-1" },
      dueDate: state.now,
    });

    expect(outcome.status).toBe("skipped");
    expect(outcome.errorCode).toBe("already_posted");
    // No new ledger row was produced (handler is pure — orchestrator would
    // have inserted only on success).
    expect(outcome.ledgerEntryPayload).toBeUndefined();
  });

  it("runSweep advances next_run_date so the orchestrator path itself breaks the loop", async () => {
    // Exercise the real orchestrator (runSweep) end-to-end with the mock,
    // proving the advance + dedup wiring lives in the orchestrator, not just
    // the manual harness above.
    state.schedules.push({
      id: "sched-chc-1",
      associationId: ASSOCIATION_ID,
      unitId: "chc-unit-1",
      chargeDescription: "Monthly HOA Dues",
      entryType: "charge",
      amount: 280,
      frequency: "monthly",
      dayOfMonth: 1,
      nextRunDate: new Date("2026-06-01T00:00:00Z"),
      status: "active",
      updatedAt: new Date("2026-05-01T00:00:00Z"),
    });
    state.units.push({ id: "chc-unit-1", associationId: ASSOCIATION_ID });
    state.ownerships.push({
      unitId: "chc-unit-1",
      personId: "person-1",
      endDate: null,
      startDate: new Date("2020-01-01T00:00:00Z"),
    });
    state.now = new Date("2026-06-01T12:00:00Z");

    // Point the dedup probe at the single unit (single-schedule, single-unit
    // sweep) — runSweep issues the handler's dedup query for this unit.
    (db as unknown as {
      __setLedgerProbe(u: string, r: string): void;
    }).__setLedgerProbe("chc-unit-1", "sched-chc-1");

    const summary = await runSweep({
      now: state.now,
      ruleTypes: ["recurring"],
    });

    expect(summary.perStatus.success).toBe(1);
    // The orchestrator advanced next_run_date to July 1.
    expect(state.schedules[0].nextRunDate?.toISOString()).toBe(
      "2026-07-01T00:00:00.000Z",
    );
  });
});

describe("computeRecurringPeriod — boundary math", () => {
  it("monthly: period containing June 1 advances to July 1", () => {
    const { periodStart, nextRunDate } = computeRecurringPeriod(
      { frequency: "monthly", dayOfMonth: 1 },
      new Date("2026-06-15T00:00:00Z"),
    );
    expect(periodStart.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(nextRunDate.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("quarterly: advances three months", () => {
    const { periodStart, nextRunDate } = computeRecurringPeriod(
      { frequency: "quarterly", dayOfMonth: 1 },
      new Date("2026-06-01T12:00:00Z"),
    );
    expect(periodStart.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(nextRunDate.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("annual: advances twelve months", () => {
    const { nextRunDate } = computeRecurringPeriod(
      { frequency: "annual", dayOfMonth: 15 },
      new Date("2026-06-15T12:00:00Z"),
    );
    expect(nextRunDate.toISOString()).toBe("2027-06-15T00:00:00.000Z");
  });

  it("clamps day-of-month to the last day of a short target month", () => {
    // Defensive clamp (schema caps dayOfMonth at 1-28, but the helper must be
    // safe if it ever widens): a Jan-31 monthly schedule advances to Feb,
    // clamping the next run to Feb 28 (2026 is not a leap year).
    const { periodStart, nextRunDate } = computeRecurringPeriod(
      { frequency: "monthly", dayOfMonth: 31 },
      new Date("2026-01-31T12:00:00Z"),
    );
    expect(periodStart.toISOString()).toBe("2026-01-31T00:00:00.000Z");
    expect(nextRunDate.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });
});
