/**
 * 4.1 Wave 2 — Unit test: delinquent-ledger-balances resolver.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../storage", () => ({
  storage: {
    getOwnerLedgerSummary: vi.fn(),
    getOwnerLedgerEntries: vi.fn(),
  },
}));

// Mock db.select().from(delinquencyThresholds).where(...) chain to return [].
// The resolver wraps the whole chain in .catch(() => []), so we can safely
// return an object whose .where() resolves to the desired empty array.
vi.mock("../../db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([]),
      }),
    }),
  },
}));

import { storage } from "../../storage";
import { resolve } from "../sources/delinquent-ledger-balances";

const now = new Date("2026-04-22T12:00:00Z");

describe("resolver: delinquent-ledger-balances", () => {
  beforeEach(() => {
    vi.mocked(storage.getOwnerLedgerSummary).mockReset();
    vi.mocked(storage.getOwnerLedgerEntries).mockReset();
  });

  it("returns AlertItem for units past the 30-day default threshold", async () => {
    vi.mocked(storage.getOwnerLedgerSummary).mockResolvedValueOnce([
      { personId: "person-1", unitId: "unit-1", balance: 500 },
      { personId: "person-2", unitId: "unit-2", balance: 1200 },
    ]);
    vi.mocked(storage.getOwnerLedgerEntries).mockResolvedValueOnce([
      {
        id: "e1",
        associationId: "assoc-1",
        unitId: "unit-1",
        personId: "person-1",
        entryType: "charge",
        amount: 500,
        postedAt: new Date("2026-03-10T00:00:00Z"), // 43 days ago
        description: null,
        referenceType: null,
        referenceId: null,
        createdAt: new Date("2026-03-10T00:00:00Z"),
      },
      {
        id: "e2",
        associationId: "assoc-1",
        unitId: "unit-2",
        personId: "person-2",
        entryType: "assessment",
        amount: 1200,
        postedAt: new Date("2026-01-01T00:00:00Z"), // ~112 days ago
        description: null,
        referenceType: null,
        referenceId: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ] as any);

    const items = await resolve("assoc-1", { associationName: "Test HOA", now });

    expect(items).toHaveLength(2);
    const unit1 = items.find((i) => i.recordId === "unit-1:person-1");
    expect(unit1?.alertId).toBe("delinquent-ledger-balance:owner_ledger_summary:unit-1:person-1");
    expect(unit1?.zone).toBe("financials");
    expect(unit1?.featureDomain).toBe("financials.delinquency");
    expect(unit1?.severity).toBe("medium"); // 43 days
    const unit2 = items.find((i) => i.recordId === "unit-2:person-2");
    expect(unit2?.severity).toBe("critical"); // 90+ days
  });

  it("excludes zero-or-negative balances", async () => {
    vi.mocked(storage.getOwnerLedgerSummary).mockResolvedValueOnce([
      { personId: "p1", unitId: "u1", balance: 0 },
      { personId: "p2", unitId: "u2", balance: -50 },
    ]);
    vi.mocked(storage.getOwnerLedgerEntries).mockResolvedValueOnce([] as any);
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items).toHaveLength(0);
  });

  it("excludes balances whose earliest charge is within the threshold window", async () => {
    vi.mocked(storage.getOwnerLedgerSummary).mockResolvedValueOnce([
      { personId: "p1", unitId: "u1", balance: 500 },
    ]);
    vi.mocked(storage.getOwnerLedgerEntries).mockResolvedValueOnce([
      {
        id: "e1",
        associationId: "assoc-1",
        unitId: "u1",
        personId: "p1",
        entryType: "charge",
        amount: 500,
        postedAt: new Date("2026-04-15T00:00:00Z"), // only 7 days ago
        description: null,
        referenceType: null,
        referenceId: null,
        createdAt: new Date("2026-04-15T00:00:00Z"),
      },
    ] as any);
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items).toHaveLength(0);
  });

  it("alertId is deterministic across runs", async () => {
    vi.mocked(storage.getOwnerLedgerSummary).mockResolvedValue([
      { personId: "p1", unitId: "u1", balance: 100 },
    ]);
    vi.mocked(storage.getOwnerLedgerEntries).mockResolvedValue([
      {
        id: "e1",
        associationId: "assoc-1",
        unitId: "u1",
        personId: "p1",
        entryType: "charge",
        amount: 100,
        postedAt: new Date("2026-01-01T00:00:00Z"),
        description: null,
        referenceType: null,
        referenceId: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ] as any);
    const a = await resolve("assoc-1", { associationName: "X", now });
    const b = await resolve("assoc-1", { associationName: "X", now });
    expect(a[0].alertId).toBe(b[0].alertId);
  });
});
