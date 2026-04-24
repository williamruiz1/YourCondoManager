/**
 * Wave 7 — Shadow-write parity helper tests (4.3 Q3).
 *
 * What this covers:
 *   - compareShadowRuns returns hasDrift=false when legacy ledger + shadow
 *     run-log agree on (ruleType, ruleId, unitId) and amount.
 *   - compareShadowRuns detects a fabricated amount-mismatch drift.
 *   - compareShadowRuns reports a shadow row missing from legacy.
 *   - compareShadowRuns reports a legacy row missing from shadow.
 *
 * Spec:
 *   docs/projects/platform-overhaul/decisions/4.3-recurring-assessment-rules-engine.md
 *   — Q3 Acceptance Criteria: "parity-drift surfaces as an ops alert".
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakeLedgerRow {
  id: string;
  associationId: string;
  unitId: string;
  amount: number;
  referenceType: string | null;
  referenceId: string | null;
  postedAt: Date;
}
interface FakeRunLogRow {
  id: string;
  associationId: string;
  ruleType: "recurring" | "special-assessment";
  ruleId: string;
  unitId: string | null;
  amount: number | null;
  status: "success" | "failed" | "retrying" | "skipped" | "deferred";
  runStartedAt: Date;
}

// Shared state populated per test, read by the mocked db module.
const fakeLedger: FakeLedgerRow[] = [];
const fakeRunLog: FakeRunLogRow[] = [];

// Minimal shape-routing: compareShadowRuns issues exactly two selects —
// one against owner_ledger_entries (by referenceType) and one against
// assessment_run_log. We route by the presence of distinguishing fields in
// the selected projection.
vi.mock("../server/db", () => {
  return {
    db: {
      select: (projection?: Record<string, unknown>) => {
        // The parity helper calls db.select({ ... fields }).from(table).where(...)
        // with a projection object for the ledger query, and db.select().from(table).where(...)
        // with no projection for the run-log query. We use this to route.
        const isLedgerQuery =
          projection !== undefined &&
          typeof projection === "object" &&
          "referenceType" in projection;
        return {
          from: (_table: unknown) => ({
            where: (_filters: unknown) => {
              if (isLedgerQuery) {
                return Promise.resolve(
                  fakeLedger.map((r) => ({
                    id: r.id,
                    unitId: r.unitId,
                    amount: r.amount,
                    referenceType: r.referenceType,
                    referenceId: r.referenceId,
                  })),
                );
              }
              return Promise.resolve(fakeRunLog);
            },
          }),
        };
      },
    },
  };
});

import { compareShadowRuns } from "../server/assessment-execution-parity";

beforeEach(() => {
  fakeLedger.length = 0;
  fakeRunLog.length = 0;
});

const windowStart = new Date("2026-04-22T00:00:00Z");
const windowEnd = new Date("2026-04-22T23:59:59Z");
const posted = new Date("2026-04-22T12:00:00Z");

describe("compareShadowRuns — clean parity", () => {
  it("reports hasDrift=false when both sides agree on amount and keys", async () => {
    fakeLedger.push({
      id: "ledger-1",
      associationId: "assoc-1",
      unitId: "unit-1",
      amount: 350,
      referenceType: "recurring_charge_schedule",
      referenceId: "rec-A",
      postedAt: posted,
    });
    fakeRunLog.push({
      id: "run-1",
      associationId: "assoc-1",
      ruleType: "recurring",
      ruleId: "rec-A",
      unitId: "unit-1",
      amount: 350,
      status: "deferred",
      runStartedAt: posted,
    });

    const report = await compareShadowRuns("assoc-1", windowStart, windowEnd);

    expect(report.hasDrift).toBe(false);
    expect(report.amountMismatches).toHaveLength(0);
    expect(report.missingFromShadow).toHaveLength(0);
    expect(report.missingFromLegacy).toHaveLength(0);
    expect(report.legacyLedgerRowCount).toBe(1);
    expect(report.shadowDeferredRowCount).toBe(1);
  });
});

describe("compareShadowRuns — detects fabricated drift", () => {
  it("flags an amount mismatch outside the 1-cent tolerance", async () => {
    fakeLedger.push({
      id: "ledger-1",
      associationId: "assoc-1",
      unitId: "unit-1",
      amount: 350,
      referenceType: "recurring_charge_schedule",
      referenceId: "rec-A",
      postedAt: posted,
    });
    fakeRunLog.push({
      id: "run-1",
      associationId: "assoc-1",
      ruleType: "recurring",
      ruleId: "rec-A",
      unitId: "unit-1",
      amount: 360, // drift!
      status: "deferred",
      runStartedAt: posted,
    });

    const report = await compareShadowRuns("assoc-1", windowStart, windowEnd);

    expect(report.hasDrift).toBe(true);
    expect(report.amountMismatches).toHaveLength(1);
    expect(report.amountMismatches[0]).toMatchObject({
      ruleType: "recurring",
      ruleId: "rec-A",
      unitId: "unit-1",
      legacyAmount: 350,
      shadowAmount: 360,
    });
  });

  it("reports a legacy row missing from the shadow log", async () => {
    fakeLedger.push({
      id: "ledger-1",
      associationId: "assoc-1",
      unitId: "unit-1",
      amount: 350,
      referenceType: "recurring_charge_schedule",
      referenceId: "rec-A",
      postedAt: posted,
    });
    // No corresponding shadow row.

    const report = await compareShadowRuns("assoc-1", windowStart, windowEnd);

    expect(report.hasDrift).toBe(true);
    expect(report.missingFromShadow).toHaveLength(1);
    expect(report.missingFromShadow[0]).toMatchObject({
      ruleType: "recurring",
      ruleId: "rec-A",
      unitId: "unit-1",
      amount: 350,
    });
    expect(report.missingFromLegacy).toHaveLength(0);
  });

  it("reports a shadow row missing from the legacy ledger", async () => {
    fakeRunLog.push({
      id: "run-1",
      associationId: "assoc-1",
      ruleType: "special-assessment",
      ruleId: "sa-1",
      unitId: "unit-7",
      amount: 1000,
      status: "deferred",
      runStartedAt: posted,
    });
    // No corresponding legacy row.

    const report = await compareShadowRuns("assoc-1", windowStart, windowEnd);

    expect(report.hasDrift).toBe(true);
    expect(report.missingFromLegacy).toHaveLength(1);
    expect(report.missingFromLegacy[0]).toMatchObject({
      ruleType: "special-assessment",
      ruleId: "sa-1",
      unitId: "unit-7",
      amount: 1000,
    });
    expect(report.missingFromShadow).toHaveLength(0);
  });

  it("extracts the assessmentId from the composite special-assessment referenceId", async () => {
    // Legacy ledger rows for special assessments use
    //   referenceId = `<assessmentId>:<installmentNumber>:<unitId>`
    // The parity normalizer must strip that down to the assessmentId for
    // matching against the orchestrator's run-log rows.
    fakeLedger.push({
      id: "ledger-1",
      associationId: "assoc-1",
      unitId: "unit-7",
      amount: 1000,
      referenceType: "special_assessment_installment",
      referenceId: "sa-1:1:unit-7",
      postedAt: posted,
    });
    fakeRunLog.push({
      id: "run-1",
      associationId: "assoc-1",
      ruleType: "special-assessment",
      ruleId: "sa-1",
      unitId: "unit-7",
      amount: 1000,
      status: "deferred",
      runStartedAt: posted,
    });

    const report = await compareShadowRuns("assoc-1", windowStart, windowEnd);
    expect(report.hasDrift).toBe(false);
  });
});
