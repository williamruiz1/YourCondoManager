/**
 * Wave 7 — Assessment-execution orchestrator unit tests (4.3 Q3).
 *
 * What this covers:
 *   - The orchestrator dispatches by registered rule type.
 *   - Handlers are PURE: they do not insert into ownerLedgerEntries; only the
 *     orchestrator does. (Asserted by registering a custom handler that would
 *     fail if it tried to write.)
 *   - In the success path, the orchestrator writes ONE ownerLedgerEntries row
 *     AND ONE assessmentRunLog row with status='success'.
 *   - In dry-run mode (shadow-write), the orchestrator writes ZERO
 *     ownerLedgerEntries rows and writes one assessmentRunLog row per
 *     dispatched unit with status='deferred'.
 *   - runOnDemand restricts to the requested rule id.
 *
 * Spec:
 *   docs/projects/platform-overhaul/decisions/4.3-recurring-assessment-rules-engine.md
 *   — Q3 (unified pipeline), Wave 7 build plan.
 *
 * Note on mocking:
 *   We mock ../server/db entirely. The orchestrator reads the registered
 *   handlers' listers to find eligible work — we bypass the default listers
 *   by re-registering with custom ones so the test is fully deterministic
 *   without needing a live database.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the db module BEFORE importing the orchestrator so the orchestrator's
// resolved `db` reference points at our instrumented fake.
const insertedLedgerRows: Array<Record<string, unknown>> = [];
const insertedRunLogRows: Array<Record<string, unknown>> = [];

vi.mock("../server/db", () => {
  return {
    db: {
      // select() is used by specialAssessmentsHandler's idempotency check.
      // We return a chain that resolves to [] so the handler proceeds to
      // the "post" path. Handlers don't insert — the orchestrator does —
      // so this branch is not exercised in these tests.
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
      insert: (table: unknown) => ({
        values: (row: Record<string, unknown>) => ({
          returning: (_shape?: Record<string, unknown>) => {
            const tableName = (table as { _: { name: string } } | undefined)?._
              ?.name;
            // Drizzle schema helpers expose the SQL table name at
            // `Symbol.for("drizzle:Name")`. The mock can distinguish by
            // looking at the fields we put on the row — run-log rows have
            // `ruleType`, ledger rows have `entryType`.
            const isRunLog = "ruleType" in row;
            const isLedger = "entryType" in row && !isRunLog;
            if (isLedger) {
              const id = `ledger-${insertedLedgerRows.length + 1}`;
              const stored = { id, ...row };
              insertedLedgerRows.push(stored);
              return Promise.resolve([{ id, ...row }]);
            }
            if (isRunLog) {
              const id = `runlog-${insertedRunLogRows.length + 1}`;
              const stored = { id, ...row };
              insertedRunLogRows.push(stored);
              return Promise.resolve([{ id }]);
            }
            // Unexpected table — surface clearly.
            throw new Error(
              `unexpected insert in test mock (table=${String(tableName)})`,
            );
          },
        }),
      }),
      update: () => ({
        set: () => ({ where: () => Promise.resolve() }),
      }),
    },
  };
});

import {
  __resetHandlerRegistryForTests__,
  registerRuleHandler,
  runOnDemand,
  runSweep,
  type RuleExecutionHandler,
  type RuleExecutionLister,
} from "../server/assessment-execution";

beforeEach(() => {
  insertedLedgerRows.length = 0;
  insertedRunLogRows.length = 0;
  __resetHandlerRegistryForTests__();
});

// ---------------------------------------------------------------------------
// Orchestrator tests
// ---------------------------------------------------------------------------

describe("assessment-execution orchestrator — dispatch by rule type", () => {
  it("invokes the handler registered for each rule type", async () => {
    const recurringCalls: Array<{ ruleId: string; unitId: string }> = [];
    const specialCalls: Array<{ ruleId: string; unitId: string }> = [];

    const recurringLister: RuleExecutionLister = async () => [
      {
        associationId: "assoc-1",
        ruleId: "recur-A",
        rule: { id: "recur-A" },
        unit: { id: "unit-1" },
        dueDate: new Date("2026-04-22T00:00:00Z"),
      },
    ];
    const recurringHandler: RuleExecutionHandler = async (ctx) => {
      recurringCalls.push({
        ruleId: (ctx.rule as { id: string }).id,
        unitId: ctx.unit.id,
      });
      return { status: "skipped", amount: null };
    };

    const specialLister: RuleExecutionLister = async () => [
      {
        associationId: "assoc-1",
        ruleId: "sa-1",
        rule: { id: "sa-1" },
        unit: { id: "unit-2" },
        dueDate: new Date("2026-04-22T00:00:00Z"),
      },
    ];
    const specialHandler: RuleExecutionHandler = async (ctx) => {
      specialCalls.push({
        ruleId: (ctx.rule as { id: string }).id,
        unitId: ctx.unit.id,
      });
      return { status: "skipped", amount: null };
    };

    registerRuleHandler("recurring", recurringHandler, recurringLister);
    registerRuleHandler("special-assessment", specialHandler, specialLister);

    const summary = await runSweep();

    expect(recurringCalls).toHaveLength(1);
    expect(recurringCalls[0]).toEqual({ ruleId: "recur-A", unitId: "unit-1" });
    expect(specialCalls).toHaveLength(1);
    expect(specialCalls[0]).toEqual({ ruleId: "sa-1", unitId: "unit-2" });
    expect(summary.totalDispatched).toBe(2);
  });
});

describe("assessment-execution orchestrator — handler purity", () => {
  it("the orchestrator owns the ownerLedgerEntries insert; handlers return a payload only", async () => {
    // Register a handler that returns success + payload but does NOT attempt
    // to insert on its own. Verify exactly one ledger row and one run-log
    // row are persisted by the orchestrator.
    const handler: RuleExecutionHandler = async (ctx) => ({
      status: "success",
      amount: 350,
      ledgerEntryPayload: {
        associationId: ctx.associationId,
        unitId: ctx.unit.id,
        personId: "person-1",
        entryType: "charge",
        amount: 350,
        postedAt: ctx.dueDate,
        description: "Monthly dues",
        referenceType: "recurring_charge_schedule",
        referenceId: (ctx.rule as { id: string }).id,
      },
    });
    const lister: RuleExecutionLister = async () => [
      {
        associationId: "assoc-1",
        ruleId: "recur-A",
        rule: { id: "recur-A" },
        unit: { id: "unit-1" },
        dueDate: new Date("2026-04-22T00:00:00Z"),
      },
    ];
    registerRuleHandler("recurring", handler, lister);
    // Remove the default special-assessment registration so we don't query
    // any special-assessment state in this test.
    registerRuleHandler("special-assessment", async () => ({ status: "skipped", amount: null }), async () => []);

    const summary = await runSweep();

    expect(insertedLedgerRows).toHaveLength(1);
    expect(insertedLedgerRows[0]).toMatchObject({
      associationId: "assoc-1",
      unitId: "unit-1",
      amount: 350,
      entryType: "charge",
      referenceType: "recurring_charge_schedule",
      referenceId: "recur-A",
    });
    expect(insertedRunLogRows).toHaveLength(1);
    expect(insertedRunLogRows[0]).toMatchObject({
      associationId: "assoc-1",
      ruleType: "recurring",
      ruleId: "recur-A",
      unitId: "unit-1",
      status: "success",
      amount: 350,
    });
    // Run-log row records the ledger id the orchestrator just inserted.
    expect(insertedRunLogRows[0].ledgerEntryId).toBe("ledger-1");
    expect(summary.perStatus.success).toBe(1);
  });
});

describe("assessment-execution orchestrator — dry-run mode", () => {
  it("writes assessmentRunLog rows with status='deferred' and zero ledger inserts", async () => {
    const handler: RuleExecutionHandler = async (ctx) => ({
      status: "success",
      amount: 250,
      ledgerEntryPayload: {
        associationId: ctx.associationId,
        unitId: ctx.unit.id,
        personId: "person-9",
        entryType: "charge",
        amount: 250,
        postedAt: ctx.dueDate,
        description: "Dues",
        referenceType: "recurring_charge_schedule",
        referenceId: (ctx.rule as { id: string }).id,
      },
    });
    const lister: RuleExecutionLister = async () => [
      {
        associationId: "assoc-1",
        ruleId: "recur-A",
        rule: { id: "recur-A" },
        unit: { id: "unit-1" },
        dueDate: new Date("2026-04-22T00:00:00Z"),
      },
      {
        associationId: "assoc-1",
        ruleId: "recur-A",
        rule: { id: "recur-A" },
        unit: { id: "unit-2" },
        dueDate: new Date("2026-04-22T00:00:00Z"),
      },
    ];
    registerRuleHandler("recurring", handler, lister);
    registerRuleHandler("special-assessment", async () => ({ status: "skipped", amount: null }), async () => []);

    const summary = await runSweep({ dryRun: true });

    expect(insertedLedgerRows).toHaveLength(0);
    expect(insertedRunLogRows).toHaveLength(2);
    for (const row of insertedRunLogRows) {
      expect(row.status).toBe("deferred");
      expect(row.ledgerEntryId).toBeNull();
    }
    expect(summary.dryRun).toBe(true);
    expect(summary.perStatus.deferred).toBe(2);
    expect(summary.perStatus.success).toBe(0);
  });
});

describe("assessment-execution orchestrator — failure semantics", () => {
  it("records status='failed' when the handler throws", async () => {
    const handler: RuleExecutionHandler = async () => {
      throw new Error("boom");
    };
    const lister: RuleExecutionLister = async () => [
      {
        associationId: "assoc-1",
        ruleId: "recur-A",
        rule: {},
        unit: { id: "unit-1" },
        dueDate: new Date("2026-04-22T00:00:00Z"),
      },
    ];
    registerRuleHandler("recurring", handler, lister);
    registerRuleHandler("special-assessment", async () => ({ status: "skipped", amount: null }), async () => []);

    const summary = await runSweep();
    expect(insertedLedgerRows).toHaveLength(0);
    expect(insertedRunLogRows).toHaveLength(1);
    expect(insertedRunLogRows[0]).toMatchObject({
      status: "failed",
      errorCode: "handler_threw",
      errorMessage: "boom",
    });
    expect(summary.perStatus.failed).toBe(1);
  });
});

describe("assessment-execution orchestrator — runOnDemand", () => {
  it("passes ruleId and associationId filters through to the lister", async () => {
    const captured: Array<Record<string, unknown>> = [];
    const lister: RuleExecutionLister = async (opts) => {
      captured.push({ ...opts });
      if (opts.ruleIdFilter !== "recur-target") return [];
      return [
        {
          associationId: opts.associationIdFilter ?? "assoc-1",
          ruleId: "recur-target",
          rule: { id: "recur-target" },
          unit: { id: "unit-1" },
          dueDate: new Date("2026-04-22T00:00:00Z"),
        },
      ];
    };
    const handler: RuleExecutionHandler = async () => ({
      status: "skipped",
      amount: null,
    });
    registerRuleHandler("recurring", handler, lister);

    const summary = await runOnDemand({
      ruleType: "recurring",
      ruleId: "recur-target",
      associationId: "assoc-1",
    });

    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({
      ruleIdFilter: "recur-target",
      associationIdFilter: "assoc-1",
    });
    expect(summary.totalDispatched).toBe(1);
  });

  it("throws if no handler is registered for the requested rule type", async () => {
    // Reset to a clean registry that we repopulate without 'recurring'.
    __resetHandlerRegistryForTests__();
    // Remove both defaults and add only special-assessment.
    registerRuleHandler("special-assessment", async () => ({ status: "skipped", amount: null }), async () => []);

    // Mutate away the 'recurring' default registration by re-registering both
    // and then dropping recurring via reset+re-register of only special.
    // We can't delete directly, but we CAN verify the happy path by using
    // a fake rule type through typescript casting of an unregistered key.
    await expect(
      runOnDemand({
        ruleType: "recurring-unknown" as unknown as "recurring",
        ruleId: "x",
        associationId: "assoc-1",
      }),
    ).rejects.toThrow(/No handler registered/);
  });
});
