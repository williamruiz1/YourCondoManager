/**
 * Wave 7 — Shadow-write parity window unit test (4.3 Q3).
 *
 * What this covers:
 *   - ASSESSMENT_EXECUTION_UNIFIED defaults OFF (asserted in feature-flags test
 *     as well; we re-verify the orchestrator-side consequence here).
 *   - With the flag OFF, runShadowWriteForSweep performs shadow-write only:
 *     NO ownerLedgerEntries inserts, run-log rows are written with
 *     status='deferred'.
 *   - isUnifiedAssessmentExecutionEnabled returns false globally when no env
 *     override is set, and flips per-association when the scoped env var is
 *     set.
 *
 * Spec:
 *   docs/projects/platform-overhaul/decisions/4.3-recurring-assessment-rules-engine.md
 *   — Q3 Acceptance Criteria: shadow-write parity test.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const insertedLedgerRows: Array<Record<string, unknown>> = [];
const insertedRunLogRows: Array<Record<string, unknown>> = [];

vi.mock("../server/db", () => {
  return {
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
      insert: () => ({
        values: (row: Record<string, unknown>) => ({
          returning: () => {
            if ("ruleType" in row) {
              const id = `runlog-${insertedRunLogRows.length + 1}`;
              insertedRunLogRows.push({ id, ...row });
              return Promise.resolve([{ id }]);
            }
            if ("entryType" in row) {
              const id = `ledger-${insertedLedgerRows.length + 1}`;
              insertedLedgerRows.push({ id, ...row });
              return Promise.resolve([{ id, ...row }]);
            }
            throw new Error("unexpected insert in test mock");
          },
        }),
      }),
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    },
  };
});

import {
  __resetHandlerRegistryForTests__,
  isUnifiedAssessmentExecutionEnabled,
  registerRuleHandler,
  runShadowWriteForSweep,
  type RuleExecutionHandler,
  type RuleExecutionLister,
} from "../server/assessment-execution";

beforeEach(() => {
  insertedLedgerRows.length = 0;
  insertedRunLogRows.length = 0;
  __resetHandlerRegistryForTests__();
});

afterEach(() => {
  delete process.env.FEATURE_FLAG_ASSESSMENT_EXECUTION_UNIFIED;
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("FEATURE_FLAG_ASSESSMENT_EXECUTION_UNIFIED_")) {
      delete process.env[key];
    }
  }
});

describe("shadow-write parity window — flag gating", () => {
  it("defaults OFF globally (isUnifiedAssessmentExecutionEnabled returns false)", () => {
    expect(isUnifiedAssessmentExecutionEnabled("any-assoc")).toBe(false);
  });

  it("per-association override flips only that association", () => {
    // Uuids are dash-separated; the env-var translation upper-cases and
    // replaces dashes with underscores (see shared/feature-flags.ts).
    const id = "assoc-abc-1";
    const envKey = `FEATURE_FLAG_ASSESSMENT_EXECUTION_UNIFIED_${id
      .replace(/-/g, "_")
      .toUpperCase()}`;
    process.env[envKey] = "true";
    expect(isUnifiedAssessmentExecutionEnabled(id)).toBe(true);
    expect(isUnifiedAssessmentExecutionEnabled("other-assoc")).toBe(false);
  });

  it("global flag override flips all associations", () => {
    process.env.FEATURE_FLAG_ASSESSMENT_EXECUTION_UNIFIED = "true";
    expect(isUnifiedAssessmentExecutionEnabled("a")).toBe(true);
    expect(isUnifiedAssessmentExecutionEnabled("b")).toBe(true);
  });
});

describe("shadow-write parity window — runShadowWriteForSweep()", () => {
  it("writes only deferred run-log rows and no ledger rows", async () => {
    // Register a handler that WOULD post if the orchestrator were in real
    // mode. runShadowWriteForSweep invokes runSweep with dryRun=true, so the
    // orchestrator must coerce to 'deferred' and skip the ledger insert.
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
    const handler: RuleExecutionHandler = async (ctx) => ({
      status: "success",
      amount: 400,
      ledgerEntryPayload: {
        associationId: ctx.associationId,
        unitId: ctx.unit.id,
        personId: "p-1",
        entryType: "charge",
        amount: 400,
        postedAt: ctx.dueDate,
        description: "Dues",
        referenceType: "recurring_charge_schedule",
        referenceId: (ctx.rule as { id: string }).id,
      },
    });
    registerRuleHandler("recurring", handler, lister);
    registerRuleHandler("special-assessment", async () => ({ status: "skipped", amount: null }), async () => []);

    const summary = await runShadowWriteForSweep(new Date("2026-04-22T00:00:00Z"));

    // Real mode would have inserted 2 ledger rows. Shadow-write inserts
    // none.
    expect(insertedLedgerRows).toHaveLength(0);
    // Two units dispatched, two deferred run-log rows.
    expect(insertedRunLogRows).toHaveLength(2);
    for (const row of insertedRunLogRows) {
      expect(row.status).toBe("deferred");
      expect(row.ruleType).toBe("recurring");
      expect(row.ledgerEntryId).toBeNull();
    }
    expect(summary?.dryRun).toBe(true);
    expect(summary?.perStatus.deferred).toBe(2);
  });

  it("captures errors from a throwing handler as status='failed' under dry-run (but still no ledger row)", async () => {
    const lister: RuleExecutionLister = async () => [
      {
        associationId: "assoc-1",
        ruleId: "sa-1",
        rule: { id: "sa-1" },
        unit: { id: "unit-3" },
        dueDate: new Date("2026-04-22T00:00:00Z"),
      },
    ];
    registerRuleHandler("special-assessment", async () => {
      throw new Error("simulated handler failure");
    }, lister);
    registerRuleHandler("recurring", async () => ({ status: "skipped", amount: null }), async () => []);

    await runShadowWriteForSweep(new Date("2026-04-22T00:00:00Z"));

    expect(insertedLedgerRows).toHaveLength(0);
    // In dry-run, we ALWAYS coerce to 'deferred' on the run-log status
    // (that's the parity-window signal). The handler error is captured via
    // errorCode/errorMessage instead.
    expect(insertedRunLogRows).toHaveLength(1);
    expect(insertedRunLogRows[0].status).toBe("deferred");
    expect(insertedRunLogRows[0].errorCode).toBe("handler_threw");
    expect(insertedRunLogRows[0].errorMessage).toBe("simulated handler failure");
  });
});
