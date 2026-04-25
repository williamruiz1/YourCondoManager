/**
 * 4.1 Tier 2 — Unit test: unpaid-late-fees resolver.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../storage", () => ({
  storage: {
    getLateFeeEvents: vi.fn(),
    getOwnerLedgerEntries: vi.fn(),
  },
}));

import { storage } from "../../storage";
import { resolve, resolveMany } from "../sources/unpaid-late-fees";

const now = new Date("2026-04-22T12:00:00Z");

function makeEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "lfev-1",
    associationId: "assoc-1",
    ruleId: "rule-1",
    referenceType: null,
    referenceId: null,
    balanceAmount: 500,
    dueDate: new Date("2026-01-01T00:00:00Z"),
    asOfDate: new Date("2026-02-01T00:00:00Z"),
    calculatedFee: 50,
    createdAt: new Date("2026-02-01T00:00:00Z"),
    ...overrides,
  };
}

function makeLedgerEntry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "ledger-entry",
    associationId: "assoc-1",
    unitId: "unit-1",
    personId: "person-1",
    entryType: "payment",
    amount: 50,
    postedAt: new Date("2026-02-10T00:00:00Z"),
    description: null,
    referenceType: null,
    referenceId: null,
    createdAt: new Date("2026-02-10T00:00:00Z"),
    ...overrides,
  };
}

describe("resolver: unpaid-late-fees", () => {
  beforeEach(() => {
    vi.mocked(storage.getLateFeeEvents).mockReset();
    vi.mocked(storage.getOwnerLedgerEntries).mockReset();
  });

  it("emits an AlertItem for unpaid fee events (critical when > 30 days old)", async () => {
    vi.mocked(storage.getLateFeeEvents).mockResolvedValueOnce([
      makeEvent({ id: "lfev-old", createdAt: new Date("2026-02-01T00:00:00Z") }), // 80 days ago
    ] as any);
    vi.mocked(storage.getOwnerLedgerEntries).mockResolvedValueOnce([]);

    const items = await resolve("assoc-1", { associationName: "Test HOA", now });

    expect(items).toHaveLength(1);
    expect(items[0].alertId).toBe("unpaid-late-fee:late_fee_events:lfev-old");
    expect(items[0].zone).toBe("financials");
    expect(items[0].featureDomain).toBe("financials.delinquency");
    expect(items[0].ruleType).toBe("unpaid-late-fee");
    expect(items[0].recordType).toBe("late_fee_events");
    expect(items[0].severity).toBe("critical"); // > 30 days
    expect(items[0].resolutionHref).toBe("/app/financials/late-fees/lfev-old");
  });

  it("uses medium severity for recent unpaid fees within 30-day window", async () => {
    vi.mocked(storage.getLateFeeEvents).mockResolvedValueOnce([
      makeEvent({ id: "lfev-recent", createdAt: new Date("2026-04-10T00:00:00Z") }), // 12 days ago
    ] as any);
    vi.mocked(storage.getOwnerLedgerEntries).mockResolvedValueOnce([]);
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items[0].severity).toBe("medium");
  });

  it("excludes fee events whose amount is covered by a payment within 30 days", async () => {
    vi.mocked(storage.getLateFeeEvents).mockResolvedValueOnce([
      makeEvent({ id: "lfev-paid", calculatedFee: 50, createdAt: new Date("2026-02-01T00:00:00Z") }),
    ] as any);
    vi.mocked(storage.getOwnerLedgerEntries).mockResolvedValueOnce([
      makeLedgerEntry({
        entryType: "payment",
        amount: -75, // absolute value >= 50
        postedAt: new Date("2026-02-20T00:00:00Z"), // within 30d
      }),
    ] as any);
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items).toHaveLength(0);
  });

  it("includes fee events when payments fall outside the 30-day match window", async () => {
    vi.mocked(storage.getLateFeeEvents).mockResolvedValueOnce([
      makeEvent({ id: "lfev-late-pay", calculatedFee: 50, createdAt: new Date("2026-02-01T00:00:00Z") }),
    ] as any);
    vi.mocked(storage.getOwnerLedgerEntries).mockResolvedValueOnce([
      makeLedgerEntry({
        entryType: "payment",
        amount: 50,
        postedAt: new Date("2026-04-15T00:00:00Z"), // way past 30d
      }),
    ] as any);
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items).toHaveLength(1);
  });

  it("ignores payments whose amount is less than the fee", async () => {
    vi.mocked(storage.getLateFeeEvents).mockResolvedValueOnce([
      makeEvent({ id: "lfev-short", calculatedFee: 100 }),
    ] as any);
    vi.mocked(storage.getOwnerLedgerEntries).mockResolvedValueOnce([
      makeLedgerEntry({ amount: 25, postedAt: new Date("2026-02-10T00:00:00Z") }),
    ] as any);
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items).toHaveLength(1);
  });

  it("ignores non-payment ledger entries (charges/credits/adjustments)", async () => {
    vi.mocked(storage.getLateFeeEvents).mockResolvedValueOnce([makeEvent()] as any);
    vi.mocked(storage.getOwnerLedgerEntries).mockResolvedValueOnce([
      makeLedgerEntry({
        entryType: "charge",
        amount: 500,
        postedAt: new Date("2026-02-15T00:00:00Z"),
      }),
    ] as any);
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items).toHaveLength(1);
  });

  it("returns empty array when there are no fee events", async () => {
    vi.mocked(storage.getLateFeeEvents).mockResolvedValueOnce([]);
    vi.mocked(storage.getOwnerLedgerEntries).mockResolvedValueOnce([]);
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items).toEqual([]);
  });

  it("ignores malformed events with non-positive calculatedFee", async () => {
    vi.mocked(storage.getLateFeeEvents).mockResolvedValueOnce([
      makeEvent({ id: "lfev-zero", calculatedFee: 0 }),
    ] as any);
    vi.mocked(storage.getOwnerLedgerEntries).mockResolvedValueOnce([]);
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items).toEqual([]);
  });

  it("produces deterministic alertId", async () => {
    vi.mocked(storage.getLateFeeEvents).mockResolvedValue([
      makeEvent({ id: "stable" }),
    ] as any);
    vi.mocked(storage.getOwnerLedgerEntries).mockResolvedValue([]);
    const a = await resolve("assoc-1", { associationName: "X", now });
    const b = await resolve("assoc-1", { associationName: "X", now });
    expect(a[0].alertId).toBe(b[0].alertId);
    expect(a[0].alertId).toBe("unpaid-late-fee:late_fee_events:stable");
  });

  // -------------------------------------------------------------------------
  // 5.4-F1 Wave 16b — resolveMany batched fan-out.
  // -------------------------------------------------------------------------

  it("resolveMany: emits alerts for 3 associations from a single events call", async () => {
    vi.mocked(storage.getLateFeeEvents).mockResolvedValueOnce([
      makeEvent({ id: "lf-a1", associationId: "assoc-1" }),
      makeEvent({ id: "lf-a2", associationId: "assoc-2" }),
      makeEvent({ id: "lf-a3", associationId: "assoc-3" }),
    ] as any);
    vi.mocked(storage.getOwnerLedgerEntries).mockResolvedValueOnce([]);
    const items = await resolveMany(
      [
        { id: "assoc-1", name: "A" },
        { id: "assoc-2", name: "B" },
        { id: "assoc-3", name: "C" },
      ],
      { now },
    );
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.associationId).sort()).toEqual([
      "assoc-1",
      "assoc-2",
      "assoc-3",
    ]);
    expect(vi.mocked(storage.getLateFeeEvents).mock.calls).toHaveLength(1);
    expect(vi.mocked(storage.getLateFeeEvents).mock.calls[0][0]).toBeUndefined();
    expect(vi.mocked(storage.getOwnerLedgerEntries).mock.calls).toHaveLength(1);
    expect(vi.mocked(storage.getOwnerLedgerEntries).mock.calls[0][0]).toBeUndefined();
  });
});
