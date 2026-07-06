/**
 * Treasurer month-close lifecycle tests (YCM#220 / production-readiness P2-5).
 *
 * Exercises the REAL service logic against an in-memory db mock that implements
 * the exact drizzle chain shapes the service calls + a mocked reconciliation
 * report so the matched/unmatched counts are controllable. Proves:
 *
 *   1. Month-bounds parsing (valid + malformed).
 *   2. getMonthCloseState composes live counts + the close record.
 *   3. close/reopen lifecycle: close → isClosed; reopen → not closed; re-close.
 *   4. Unmatched guard: close with stragglers requires acknowledgement (soft).
 *   5. Double-close is refused (ALREADY_CLOSED); reopen-when-open is refused
 *      (NOT_CLOSED).
 *   6. Every close/reopen writes an audit row.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── In-memory tables + report controls (hoisted for vi.mock factories) ────────
const H = vi.hoisted(() => {
  type Row = Record<string, any>;
  const periodTable: Row[] = [];
  const auditTable: Row[] = [];
  const state = { idSeq: 1 };
  const nextId = () => `pc-${String(state.idSeq++).padStart(4, "0")}`;
  const PC = { __table: "periodCloses" } as any;
  const AUDIT = { __table: "auditLogs" } as any;
  for (const col of ["id", "associationId", "periodMonth", "status"]) {
    Object.defineProperty(PC, col, { value: { __col: col }, configurable: true });
  }
  const matches = (row: Row, where: any): boolean => {
    if (!where) return true;
    if (where.op === "eq") return row[where.col.__col] === where.val;
    if (where.op === "and") return where.clauses.every((c: any) => matches(row, c));
    return true;
  };
  // Controllable reconciliation report counts.
  const report = {
    matchedCount: 0,
    unmatchedBankTxCount: 0,
    unmatchedLedgerEntryCount: 0,
  };
  return { periodTable, auditTable, state, nextId, PC, AUDIT, matches, report };
});

const { periodTable, auditTable, state, nextId, matches, report } = H;

vi.mock("@shared/schema", () => ({
  periodCloses: H.PC,
  auditLogs: H.AUDIT,
}));

vi.mock("drizzle-orm", () => {
  const eq = (col: any, val: any) => ({ op: "eq", col, val });
  const and = (...clauses: any[]) => ({ op: "and", clauses });
  const desc = (col: any) => ({ op: "desc", col });
  return { eq, and, desc };
});

// Report engine mocked → counts driven by H.report.
vi.mock("../report", () => ({
  buildReconciliationReport: vi.fn(async () => ({
    totals: {
      matchedCount: H.report.matchedCount,
      unmatchedBankTxCount: H.report.unmatchedBankTxCount,
      unmatchedLedgerEntryCount: H.report.unmatchedLedgerEntryCount,
    },
    unmatchedBankTransactions: [],
    unmatchedLedgerEntries: [],
  })),
}));

vi.mock("../../../db", () => {
  const { periodTable, auditTable, nextId, matches } = H;
  const db = {
    select() {
      return {
        from(_table: any) {
          return {
            where(where: any) {
              const run = () => periodTable.filter((r) => matches(r, where));
              return {
                limit(_n: number) {
                  return Promise.resolve(run());
                },
                then(resolve: any) {
                  return Promise.resolve(run()).then(resolve);
                },
              };
            },
          };
        },
      };
    },
    insert(table: any) {
      return {
        values(vals: any) {
          const doInsert = () => {
            if (table.__table === "auditLogs") {
              auditTable.push({ id: nextId(), createdAt: new Date(), ...vals });
              return [];
            }
            const row = { id: nextId(), ...vals };
            periodTable.push(row);
            return [row];
          };
          const chain: any = {
            onConflictDoUpdate({ set }: any) {
              return {
                returning() {
                  const idx = periodTable.findIndex(
                    (r) =>
                      r.associationId === vals.associationId &&
                      r.periodMonth === vals.periodMonth,
                  );
                  if (idx >= 0) {
                    periodTable[idx] = { ...periodTable[idx], ...set };
                    return Promise.resolve([periodTable[idx]]);
                  }
                  const row = { id: nextId(), ...vals };
                  periodTable.push(row);
                  return Promise.resolve([row]);
                },
              };
            },
            returning() {
              return Promise.resolve(doInsert());
            },
            then(resolve: any) {
              return Promise.resolve(doInsert()).then(resolve);
            },
          };
          return chain;
        },
      };
    },
    update(_table: any) {
      return {
        set(setVals: any) {
          return {
            where(where: any) {
              return {
                returning() {
                  const updated: any[] = [];
                  for (let i = 0; i < periodTable.length; i++) {
                    if (matches(periodTable[i], where)) {
                      periodTable[i] = { ...periodTable[i], ...setVals };
                      updated.push(periodTable[i]);
                    }
                  }
                  return Promise.resolve(updated);
                },
              };
            },
          };
        },
      };
    },
  };
  return { db };
});

import {
  monthBounds,
  getMonthCloseState,
  closeMonth,
  reopenMonth,
  PeriodCloseError,
} from "../period-close";

const ASSOC = "assoc-1";
const ACTOR = { actorUserId: "admin-1", actorEmail: "treasurer@example.com" };

beforeEach(() => {
  periodTable.length = 0;
  auditTable.length = 0;
  state.idSeq = 1;
  report.matchedCount = 0;
  report.unmatchedBankTxCount = 0;
  report.unmatchedLedgerEntryCount = 0;
  vi.clearAllMocks();
});

describe("monthBounds", () => {
  it("parses YYYY-MM to UTC month bounds", () => {
    const { start, end } = monthBounds("2026-06");
    expect(start.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-06-30T23:59:59.999Z");
  });

  it("handles February leap-year boundary", () => {
    const { end } = monthBounds("2028-02");
    expect(end.toISOString().slice(0, 10)).toBe("2028-02-29");
  });

  it("rejects a malformed month", () => {
    expect(() => monthBounds("2026-6")).toThrow(PeriodCloseError);
    expect(() => monthBounds("June")).toThrow(PeriodCloseError);
    expect(() => monthBounds("2026-13")).toThrow(/month must be 01-12/);
  });
});

describe("getMonthCloseState", () => {
  it("reports counts and no close record for a never-closed month", async () => {
    report.matchedCount = 5;
    report.unmatchedBankTxCount = 2;
    report.unmatchedLedgerEntryCount = 1;
    const s = await getMonthCloseState({ associationId: ASSOC, periodMonth: "2026-06" });
    expect(s.matchedCount).toBe(5);
    expect(s.unmatchedBankTxCount).toBe(2);
    expect(s.unmatchedLedgerEntryCount).toBe(1);
    expect(s.unmatchedTotal).toBe(3);
    expect(s.isClosed).toBe(false);
    expect(s.close).toBeNull();
    expect(s.periodStart).toBe("2026-06-01");
    expect(s.periodEnd).toBe("2026-06-30");
  });
});

describe("close / reopen lifecycle", () => {
  it("closes a fully-matched month without acknowledgement", async () => {
    report.matchedCount = 4;
    const rec = await closeMonth({ associationId: ASSOC, periodMonth: "2026-06", ...ACTOR });
    expect(rec.status).toBe("closed");
    expect(rec.closedByEmail).toBe("treasurer@example.com");
    expect(rec.matchedCount).toBe(4);

    const s = await getMonthCloseState({ associationId: ASSOC, periodMonth: "2026-06" });
    expect(s.isClosed).toBe(true);
    expect(s.close?.closedByEmail).toBe("treasurer@example.com");
    // Audit row written.
    expect(auditTable.some((a) => a.action === "period.closed")).toBe(true);
  });

  it("reopen makes the month not-closed and audit-logs it", async () => {
    await closeMonth({ associationId: ASSOC, periodMonth: "2026-06", ...ACTOR });
    const rec = await reopenMonth({ associationId: ASSOC, periodMonth: "2026-06", ...ACTOR });
    expect(rec.status).toBe("reopened");
    expect(rec.reopenedByEmail).toBe("treasurer@example.com");

    const s = await getMonthCloseState({ associationId: ASSOC, periodMonth: "2026-06" });
    expect(s.isClosed).toBe(false);
    expect(s.close?.status).toBe("reopened");
    expect(auditTable.some((a) => a.action === "period.reopened")).toBe(true);
  });

  it("supports close → reopen → re-close (one row upserted)", async () => {
    await closeMonth({ associationId: ASSOC, periodMonth: "2026-06", ...ACTOR });
    await reopenMonth({ associationId: ASSOC, periodMonth: "2026-06", ...ACTOR });
    const rec = await closeMonth({ associationId: ASSOC, periodMonth: "2026-06", ...ACTOR });
    expect(rec.status).toBe("closed");
    expect(rec.reopenedAt).toBeNull(); // reopen markers cleared on re-close
    // Exactly one period row for the (assoc, month).
    expect(periodTable.filter((r) => r.periodMonth === "2026-06").length).toBe(1);
  });
});

describe("unmatched guard (soft)", () => {
  it("refuses to close with stragglers unless acknowledged", async () => {
    report.matchedCount = 3;
    report.unmatchedBankTxCount = 2;
    await expect(
      closeMonth({ associationId: ASSOC, periodMonth: "2026-06", ...ACTOR }),
    ).rejects.toMatchObject({ code: "UNMATCHED_ACK_REQUIRED" });
    // Nothing persisted.
    expect(periodTable.length).toBe(0);
  });

  it("closes with stragglers when acknowledged", async () => {
    report.matchedCount = 3;
    report.unmatchedBankTxCount = 2;
    report.unmatchedLedgerEntryCount = 1;
    const rec = await closeMonth({
      associationId: ASSOC,
      periodMonth: "2026-06",
      acknowledgeUnmatched: true,
      ...ACTOR,
    });
    expect(rec.status).toBe("closed");
    expect(rec.unmatchedBankTxCount).toBe(2);
    expect(rec.unmatchedLedgerEntryCount).toBe(1);
    const audit = auditTable.find((a) => a.action === "period.closed");
    expect(audit?.afterJson?.acknowledgedUnmatched).toBe(true);
  });
});

describe("invalid transitions", () => {
  it("refuses to double-close an already-closed month", async () => {
    await closeMonth({ associationId: ASSOC, periodMonth: "2026-06", ...ACTOR });
    await expect(
      closeMonth({ associationId: ASSOC, periodMonth: "2026-06", ...ACTOR }),
    ).rejects.toMatchObject({ code: "ALREADY_CLOSED" });
  });

  it("refuses to reopen a month that is not closed", async () => {
    await expect(
      reopenMonth({ associationId: ASSOC, periodMonth: "2026-06", ...ACTOR }),
    ).rejects.toMatchObject({ code: "NOT_CLOSED" });
  });
});
