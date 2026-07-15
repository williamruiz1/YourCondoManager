/**
 * Tests for P1-5 — Automated late-fee assessment sweep.
 *
 * Covers:
 *   1. lateFeeAssessmentPeriodKey helper
 *   2. lateFeeAssessmentReferenceId helper
 *   3. Handler: idempotency (already-posted skip)
 *   4. Handler: zero-fee skip (graceDays not exceeded — mimicked via balance=0)
 *   5. Handler: flat fee success path (returns correct ledgerEntryPayload)
 *   6. Handler: percent fee success path
 *   7. Handler: maxFee cap applied
 *   8. Handler: late-fee events row inserted alongside ledger payload
 *   9. Lister: only emits entries when autoLateFeeEnabled=1 and daysPastDue > graceDays
 *  10. Lister: filters by associationIdFilter correctly
 *  11. Integration: "late-fee" rule type is registered in the orchestrator
 *
 * DB calls are replaced by vi.mock so no real Postgres is needed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  lateFeeAssessmentPeriodKey,
  lateFeeAssessmentReferenceId,
  LATE_FEE_REFERENCE_TYPE,
  lateFeeAssessmentHandler,
  lateFeeAssessmentLister,
} from "../server/services/late-fee-assessment-service";
import type { RuleExecutionContext } from "../server/assessment-execution";
import type { LateFeeRule } from "@shared/schema";

// ---------------------------------------------------------------------------
// DB mock — we intercept drizzle calls via vi.mock on "../server/db"
// ---------------------------------------------------------------------------

type MockRow = Record<string, unknown>;

const dbSelectMock = vi.fn();
const dbInsertMock = vi.fn();

vi.mock("../server/db", () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    insert: (...args: unknown[]) => dbInsertMock(...args),
  },
}));

/**
 * Drizzle chains terminate at different depths depending on whether the
 * caller uses .limit() or awaits .where() directly.  This helper returns a
 * fluent chain that:
 *   - Keeps returning `chain` from every method so you can append more calls.
 *   - Is thenable (has `.then`) so `await chain` resolves to `rows`.
 *   - Has `.limit()` that also resolves to `rows`.
 *
 * Supported call patterns:
 *   await db.select().from(t)                     → rows
 *   await db.select().from(t).where(c)            → rows
 *   await db.select().from(t).where(c).limit(1)   → rows
 *   await db.select().from(t).orderBy(col)        → rows
 */
function makeSelectChain(rows: MockRow[]): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  const fluent = (..._args: unknown[]): typeof chain => chain;
  chain["from"] = fluent;
  chain["where"] = fluent;
  chain["limit"] = () => Promise.resolve(rows);
  chain["orderBy"] = fluent;
  // Make the chain itself a thenable so `await chain` works.
  chain["then"] = (
    resolve: (v: MockRow[]) => void,
    _reject?: (e: unknown) => void,
  ) => Promise.resolve(rows).then(resolve, _reject);
  return chain;
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date("2026-06-01T12:00:00.000Z");

const FLAT_RULE: LateFeeRule = {
  id: "rule-flat-1",
  associationId: "assoc-1",
  name: "Standard Late Fee",
  feeType: "flat",
  feeAmount: 25,
  graceDays: 5,
  maxFee: null,
  isActive: 1,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const PERCENT_RULE: LateFeeRule = {
  ...FLAT_RULE,
  id: "rule-pct-1",
  feeType: "percent",
  feeAmount: 5, // 5%
  maxFee: 100,
};

function makeCtx(
  rule: LateFeeRule,
  opts: { balance?: number; personId?: string; unitId?: string } = {},
): RuleExecutionContext {
  const balance = opts.balance ?? 500;
  const unitId = opts.unitId ?? "unit-1";
  const personId = opts.personId ?? "person-1";
  const periodKey = lateFeeAssessmentPeriodKey(NOW);

  return {
    associationId: rule.associationId,
    rule: {
      rule,
      unitId,
      personId,
      balance,
      periodKey,
    },
    unit: { id: unitId },
    dueDate: NOW,
  };
}

// ---------------------------------------------------------------------------
// 1 + 2. Pure helpers
// ---------------------------------------------------------------------------

describe("lateFeeAssessmentPeriodKey", () => {
  it("formats date as YYYY-MM", () => {
    expect(lateFeeAssessmentPeriodKey(new Date("2026-06-01"))).toBe("2026-06");
    expect(lateFeeAssessmentPeriodKey(new Date("2026-01-31"))).toBe("2026-01");
    expect(lateFeeAssessmentPeriodKey(new Date("2025-12-15"))).toBe("2025-12");
  });

  it("uses UTC month boundary", () => {
    // Date constructed at UTC midnight on 2026-06-01 — always "2026-06".
    const d = new Date(Date.UTC(2026, 5, 1, 0, 0, 0));
    expect(lateFeeAssessmentPeriodKey(d)).toBe("2026-06");
  });
});

describe("lateFeeAssessmentReferenceId", () => {
  it("concatenates ruleId:unitId:periodKey", () => {
    expect(lateFeeAssessmentReferenceId("r1", "u1", "2026-06")).toBe(
      "r1:u1:2026-06",
    );
  });

  it("produces different IDs for different months", () => {
    const a = lateFeeAssessmentReferenceId("r1", "u1", "2026-06");
    const b = lateFeeAssessmentReferenceId("r1", "u1", "2026-07");
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// 3. Handler — idempotency skip
// ---------------------------------------------------------------------------

describe("lateFeeAssessmentHandler — idempotency", () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
    dbInsertMock.mockReset();
  });

  it("returns skipped when a ledger entry already exists for the period", async () => {
    // First db.select() is the idempotency check — returns an existing row.
    dbSelectMock.mockReturnValueOnce(
      makeSelectChain([{ id: "existing-entry-1" }]),
    );

    const ctx = makeCtx(FLAT_RULE);
    const outcome = await lateFeeAssessmentHandler(ctx);

    expect(outcome.status).toBe("skipped");
    expect(outcome.errorCode).toBe("already_posted");
    // No insert should have been called.
    expect(dbInsertMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. Handler — zero-fee skip
// ---------------------------------------------------------------------------

describe("lateFeeAssessmentHandler — zero fee", () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
    dbInsertMock.mockReset();
  });

  it("skips when computed fee rounds to zero (percent rule on zero balance)", async () => {
    // Idempotency check: no existing entry.
    dbSelectMock.mockReturnValueOnce(makeSelectChain([]));
    // Ownership check: return an ownership row.
    dbSelectMock.mockReturnValueOnce(
      makeSelectChain([{ id: "own-1", personId: "person-1" }]),
    );

    // balance = 0 → 5% of 0 = $0 fee
    const ctx = makeCtx(PERCENT_RULE, { balance: 0 });
    const outcome = await lateFeeAssessmentHandler(ctx);

    expect(outcome.status).toBe("skipped");
    expect(outcome.errorCode).toBe("zero_fee");
    expect(dbInsertMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 5. Handler — flat fee success
// ---------------------------------------------------------------------------

describe("lateFeeAssessmentHandler — flat fee success", () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
    dbInsertMock.mockReset();
  });

  it("returns success with correct flat-fee ledger payload", async () => {
    // Idempotency check: no existing entry.
    dbSelectMock.mockReturnValueOnce(makeSelectChain([]));
    // Ownership check: active ownership row.
    dbSelectMock.mockReturnValueOnce(
      makeSelectChain([{ id: "own-1", personId: "person-1" }]),
    );

    // db.insert lateFeeEvents — return a dummy row.
    dbInsertMock.mockReturnValueOnce({
      values: () => Promise.resolve([{ id: "evt-1" }]),
    });

    const ctx = makeCtx(FLAT_RULE, { balance: 500 });
    const outcome = await lateFeeAssessmentHandler(ctx);

    expect(outcome.status).toBe("success");
    expect(outcome.amount).toBe(25);
    expect(outcome.ledgerEntryPayload).toBeDefined();
    expect(outcome.ledgerEntryPayload?.entryType).toBe("late-fee");
    expect(outcome.ledgerEntryPayload?.amountCents).toBe(2500);
    expect(outcome.ledgerEntryPayload?.referenceType).toBe(LATE_FEE_REFERENCE_TYPE);
    expect(outcome.ledgerEntryPayload?.referenceId).toContain("rule-flat-1:unit-1:");
    expect(outcome.ledgerEntryPayload?.description).toContain("Standard Late Fee");
  });

  it("embeds the period key in the description", async () => {
    dbSelectMock.mockReturnValueOnce(makeSelectChain([]));
    dbSelectMock.mockReturnValueOnce(
      makeSelectChain([{ id: "own-1", personId: "person-1" }]),
    );
    dbInsertMock.mockReturnValueOnce({
      values: () => Promise.resolve([{ id: "evt-1" }]),
    });

    const ctx = makeCtx(FLAT_RULE);
    const outcome = await lateFeeAssessmentHandler(ctx);
    const periodKey = lateFeeAssessmentPeriodKey(NOW);

    expect(outcome.ledgerEntryPayload?.description).toContain(periodKey);
  });
});

// ---------------------------------------------------------------------------
// 6. Handler — percent fee success
// ---------------------------------------------------------------------------

describe("lateFeeAssessmentHandler — percent fee success", () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
    dbInsertMock.mockReset();
  });

  it("computes percent of balance correctly", async () => {
    dbSelectMock.mockReturnValueOnce(makeSelectChain([]));
    dbSelectMock.mockReturnValueOnce(
      makeSelectChain([{ id: "own-1", personId: "person-1" }]),
    );
    dbInsertMock.mockReturnValueOnce({
      values: () => Promise.resolve([{ id: "evt-1" }]),
    });

    // 5% of $300 = $15
    const ctx = makeCtx(PERCENT_RULE, { balance: 300 });
    const outcome = await lateFeeAssessmentHandler(ctx);

    expect(outcome.status).toBe("success");
    expect(outcome.amount).toBe(15);
    expect(outcome.ledgerEntryPayload?.amountCents).toBe(1500);
  });
});

// ---------------------------------------------------------------------------
// 7. Handler — maxFee cap
// ---------------------------------------------------------------------------

describe("lateFeeAssessmentHandler — maxFee cap", () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
    dbInsertMock.mockReset();
  });

  it("caps fee at maxFee when computed fee exceeds it", async () => {
    dbSelectMock.mockReturnValueOnce(makeSelectChain([]));
    dbSelectMock.mockReturnValueOnce(
      makeSelectChain([{ id: "own-1", personId: "person-1" }]),
    );
    dbInsertMock.mockReturnValueOnce({
      values: () => Promise.resolve([{ id: "evt-1" }]),
    });

    // 5% of $3000 = $150, but maxFee = $100
    const ctx = makeCtx(PERCENT_RULE, { balance: 3000 });
    const outcome = await lateFeeAssessmentHandler(ctx);

    expect(outcome.amount).toBe(100);
    expect(outcome.ledgerEntryPayload?.amountCents).toBe(10000);
  });

  it("does not cap below zero", async () => {
    dbSelectMock.mockReturnValueOnce(makeSelectChain([]));
    dbSelectMock.mockReturnValueOnce(
      makeSelectChain([{ id: "own-1", personId: "person-1" }]),
    );
    dbInsertMock.mockReturnValueOnce({
      values: () => Promise.resolve([{ id: "evt-1" }]),
    });

    const ruleWithZeroMax: LateFeeRule = { ...FLAT_RULE, maxFee: 0 };
    const ctx = makeCtx(ruleWithZeroMax);
    const outcome = await lateFeeAssessmentHandler(ctx);

    // maxFee=0 → fee=0 → zero_fee skip
    expect(outcome.status).toBe("skipped");
    expect(outcome.errorCode).toBe("zero_fee");
  });
});

// ---------------------------------------------------------------------------
// 8. Handler — lateFeeEvents row inserted
// ---------------------------------------------------------------------------

describe("lateFeeAssessmentHandler — lateFeeEvents insert", () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
    dbInsertMock.mockReset();
  });

  it("inserts a lateFeeEvents audit row on success", async () => {
    dbSelectMock.mockReturnValueOnce(makeSelectChain([]));
    dbSelectMock.mockReturnValueOnce(
      makeSelectChain([{ id: "own-1", personId: "person-1" }]),
    );

    let insertedValues: Record<string, unknown> | null = null;
    dbInsertMock.mockReturnValueOnce({
      values: (v: Record<string, unknown>) => {
        insertedValues = v;
        return Promise.resolve([{ id: "evt-1" }]);
      },
    });

    const ctx = makeCtx(FLAT_RULE, { balance: 200 });
    await lateFeeAssessmentHandler(ctx);

    expect(insertedValues).not.toBeNull();
    expect(insertedValues?.balanceAmount).toBe(200);
    expect(insertedValues?.calculatedFee).toBe(25);
    expect(insertedValues?.referenceType).toBe(LATE_FEE_REFERENCE_TYPE);
  });
});

// ---------------------------------------------------------------------------
// 9. Lister — autoLateFeeEnabled gating
// ---------------------------------------------------------------------------

describe("lateFeeAssessmentLister", () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
    dbInsertMock.mockReset();
  });

  it("returns empty when no associations have autoLateFeeEnabled=1", async () => {
    // delinquencySettings query returns no rows (none enabled)
    dbSelectMock.mockReturnValueOnce(makeSelectChain([]));

    const results = await lateFeeAssessmentLister({ now: NOW });
    expect(results).toHaveLength(0);
  });

  it("returns empty when escalations exist but daysPastDue <= graceDays", async () => {
    // delinquencySettings: one assoc enabled
    dbSelectMock.mockReturnValueOnce(
      makeSelectChain([{ associationId: "assoc-1" }]),
    );
    // lateFeeRules: one active rule with graceDays=15
    dbSelectMock.mockReturnValueOnce(
      makeSelectChain([
        {
          id: "rule-1",
          associationId: "assoc-1",
          feeType: "flat",
          feeAmount: 25,
          graceDays: 15,
          maxFee: null,
          isActive: 1,
          name: "R1",
          createdAt: NOW,
          updatedAt: NOW,
        },
      ]),
    );
    // delinquencyEscalations: daysPastDue = 10 (≤ graceDays=15 → skip)
    dbSelectMock.mockReturnValueOnce(
      makeSelectChain([
        {
          id: "esc-1",
          associationId: "assoc-1",
          unitId: "unit-1",
          personId: "person-1",
          balance: 200,
          daysPastDue: 10,
          status: "active",
        },
      ]),
    );

    const results = await lateFeeAssessmentLister({ now: NOW });
    expect(results).toHaveLength(0);
  });

  it("emits an entry when daysPastDue > graceDays", async () => {
    // delinquencySettings: one assoc enabled
    dbSelectMock.mockReturnValueOnce(
      makeSelectChain([{ associationId: "assoc-1" }]),
    );
    // lateFeeRules: graceDays=5
    dbSelectMock.mockReturnValueOnce(
      makeSelectChain([
        {
          id: "rule-1",
          associationId: "assoc-1",
          feeType: "flat",
          feeAmount: 25,
          graceDays: 5,
          maxFee: null,
          isActive: 1,
          name: "R1",
          createdAt: NOW,
          updatedAt: NOW,
        },
      ]),
    );
    // delinquencyEscalations: daysPastDue=20 > graceDays=5
    dbSelectMock.mockReturnValueOnce(
      makeSelectChain([
        {
          id: "esc-1",
          associationId: "assoc-1",
          unitId: "unit-1",
          personId: "person-1",
          balance: 200,
          daysPastDue: 20,
          status: "active",
        },
      ]),
    );

    const results = await lateFeeAssessmentLister({ now: NOW });
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe("rule-1");
    expect(results[0].unit.id).toBe("unit-1");
    expect(results[0].associationId).toBe("assoc-1");
  });

  it("fans out: one escalation × two rules → two entries", async () => {
    dbSelectMock.mockReturnValueOnce(
      makeSelectChain([{ associationId: "assoc-1" }]),
    );
    // Two active rules
    dbSelectMock.mockReturnValueOnce(
      makeSelectChain([
        {
          id: "rule-A",
          associationId: "assoc-1",
          feeType: "flat",
          feeAmount: 25,
          graceDays: 5,
          maxFee: null,
          isActive: 1,
          name: "A",
          createdAt: NOW,
          updatedAt: NOW,
        },
        {
          id: "rule-B",
          associationId: "assoc-1",
          feeType: "percent",
          feeAmount: 2,
          graceDays: 5,
          maxFee: 50,
          isActive: 1,
          name: "B",
          createdAt: NOW,
          updatedAt: NOW,
        },
      ]),
    );
    // One escalation past grace
    dbSelectMock.mockReturnValueOnce(
      makeSelectChain([
        {
          id: "esc-1",
          associationId: "assoc-1",
          unitId: "unit-1",
          personId: "person-1",
          balance: 400,
          daysPastDue: 30,
          status: "active",
        },
      ]),
    );

    const results = await lateFeeAssessmentLister({ now: NOW });
    expect(results).toHaveLength(2);
    const ruleIds = results.map((r) => r.ruleId).sort();
    expect(ruleIds).toEqual(["rule-A", "rule-B"]);
  });
});

// ---------------------------------------------------------------------------
// 10. Lister — associationIdFilter
// ---------------------------------------------------------------------------

describe("lateFeeAssessmentLister — associationIdFilter", () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
    dbInsertMock.mockReset();
  });

  it("excludes entries for other associations when filter is set", async () => {
    // Two associations enabled
    dbSelectMock.mockReturnValueOnce(
      makeSelectChain([
        { associationId: "assoc-A" },
        { associationId: "assoc-B" },
      ]),
    );
    // All rules (only assoc-A has one)
    dbSelectMock.mockReturnValueOnce(
      makeSelectChain([
        {
          id: "rule-A",
          associationId: "assoc-A",
          feeType: "flat",
          feeAmount: 25,
          graceDays: 5,
          maxFee: null,
          isActive: 1,
          name: "RA",
          createdAt: NOW,
          updatedAt: NOW,
        },
      ]),
    );
    // Escalations for both assocs
    dbSelectMock.mockReturnValueOnce(
      makeSelectChain([
        {
          id: "esc-A",
          associationId: "assoc-A",
          unitId: "unit-A",
          personId: "person-A",
          balance: 200,
          daysPastDue: 30,
          status: "active",
        },
        {
          id: "esc-B",
          associationId: "assoc-B",
          unitId: "unit-B",
          personId: "person-B",
          balance: 300,
          daysPastDue: 30,
          status: "active",
        },
      ]),
    );

    // Filter to assoc-B only: no rules → no entries
    const results = await lateFeeAssessmentLister({
      now: NOW,
      associationIdFilter: "assoc-B",
    });
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 11. Integration: "late-fee" is registered in the orchestrator
// ---------------------------------------------------------------------------

describe("assessment-execution orchestrator registration", () => {
  it('has "late-fee" in the registered rule types', async () => {
    // Import fresh to pick up the registered default handlers.
    const { getRegisteredRuleTypes } = await import(
      "../server/assessment-execution"
    );
    const types = getRegisteredRuleTypes();
    expect(types).toContain("late-fee");
  });
});
