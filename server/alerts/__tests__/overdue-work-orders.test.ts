/**
 * 4.1 Wave 2 — Unit test: overdue-work-orders resolver.
 *
 * Mocks `server/storage` so we can assert shape and deterministic IDs
 * without a live database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../storage", () => ({
  storage: {
    getWorkOrders: vi.fn(),
  },
}));

import { storage } from "../../storage";
import { resolve, resolveMany } from "../sources/overdue-work-orders";

const now = new Date("2026-04-22T12:00:00Z");

function makeWorkOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "wo-1",
    associationId: "assoc-1",
    maintenanceRequestId: null,
    unitId: null,
    vendorId: null,
    vendorInvoiceId: null,
    title: "Broken HVAC",
    description: "Unit 3B HVAC not cooling",
    locationText: "Unit 3B",
    category: "hvac",
    priority: "medium",
    status: "open",
    assignedTo: null,
    estimatedCost: null,
    actualCost: null,
    scheduledFor: new Date("2026-04-10T00:00:00Z"), // 12 days overdue
    startedAt: null,
    completedAt: null,
    resolutionNotes: null,
    photosJson: [],
    vendorEstimatedCompletionDate: null,
    vendorNotes: null,
    createdAt: new Date("2026-04-01T00:00:00Z"),
    updatedAt: new Date("2026-04-10T00:00:00Z"),
    ...overrides,
  };
}

describe("resolver: overdue-work-orders", () => {
  beforeEach(() => {
    vi.mocked(storage.getWorkOrders).mockReset();
  });

  it("returns AlertItem for each active, past-due work order", async () => {
    vi.mocked(storage.getWorkOrders).mockResolvedValueOnce([
      makeWorkOrder({ id: "wo-1", status: "open" }),
      makeWorkOrder({ id: "wo-2", status: "in-progress", priority: "urgent" }),
    ] as any);

    const items = await resolve("assoc-1", { associationName: "Test HOA", now });

    expect(items).toHaveLength(2);
    expect(items[0].alertId).toBe("overdue-work-order:work_orders:wo-1");
    expect(items[0].zone).toBe("operations");
    expect(items[0].featureDomain).toBe("operations.work-orders");
    expect(items[0].ruleType).toBe("overdue-work-order");
    expect(items[0].recordType).toBe("work_orders");
    expect(items[0].recordId).toBe("wo-1");
    expect(items[0].associationId).toBe("assoc-1");
    expect(items[0].associationName).toBe("Test HOA");
    expect(items[1].severity).toBe("critical"); // priority=urgent
  });

  it("filters out closed/cancelled work orders", async () => {
    vi.mocked(storage.getWorkOrders).mockResolvedValueOnce([
      makeWorkOrder({ id: "wo-closed", status: "closed" }),
      makeWorkOrder({ id: "wo-cancelled", status: "cancelled" }),
    ] as any);
    const items = await resolve("assoc-1", { associationName: "Test HOA", now });
    expect(items).toHaveLength(0);
  });

  it("filters out work orders without scheduledFor", async () => {
    vi.mocked(storage.getWorkOrders).mockResolvedValueOnce([
      makeWorkOrder({ id: "wo-noschedule", scheduledFor: null }),
    ] as any);
    const items = await resolve("assoc-1", { associationName: "Test HOA", now });
    expect(items).toHaveLength(0);
  });

  it("filters out work orders with future scheduledFor", async () => {
    vi.mocked(storage.getWorkOrders).mockResolvedValueOnce([
      makeWorkOrder({ id: "wo-future", scheduledFor: new Date("2026-05-01T00:00:00Z") }),
    ] as any);
    const items = await resolve("assoc-1", { associationName: "Test HOA", now });
    expect(items).toHaveLength(0);
  });

  it("produces identical alertId for the same record across multiple calls", async () => {
    vi.mocked(storage.getWorkOrders).mockResolvedValue([makeWorkOrder({ id: "stable" })] as any);
    const a = await resolve("assoc-1", { associationName: "X", now });
    const b = await resolve("assoc-1", { associationName: "X", now });
    expect(a[0].alertId).toBe(b[0].alertId);
    expect(a[0].alertId).toBe("overdue-work-order:work_orders:stable");
  });

  // -------------------------------------------------------------------------
  // 5.4-F1 Wave 16b — resolveMany batched fan-out.
  // -------------------------------------------------------------------------

  it("resolveMany: emits alerts for 3 associations in a single storage call", async () => {
    vi.mocked(storage.getWorkOrders).mockResolvedValueOnce([
      makeWorkOrder({ id: "wo-1", associationId: "assoc-1" }),
      makeWorkOrder({ id: "wo-2", associationId: "assoc-2" }),
      makeWorkOrder({ id: "wo-3", associationId: "assoc-3" }),
    ] as any);

    const items = await resolveMany(
      [
        { id: "assoc-1", name: "A" },
        { id: "assoc-2", name: "B" },
        { id: "assoc-3", name: "C" },
      ],
      { now },
    );

    expect(items).toHaveLength(3);
    expect(items.map((i) => i.associationId).sort()).toEqual(["assoc-1", "assoc-2", "assoc-3"]);
    // Multi-assoc path: storage was called exactly once, no associationId filter.
    expect(vi.mocked(storage.getWorkOrders).mock.calls).toHaveLength(1);
    expect(vi.mocked(storage.getWorkOrders).mock.calls[0][0]).toBeUndefined();
  });

  it("resolveMany: drops rows whose associationId is not in the permitted set", async () => {
    vi.mocked(storage.getWorkOrders).mockResolvedValueOnce([
      makeWorkOrder({ id: "wo-permitted", associationId: "assoc-1" }),
      makeWorkOrder({ id: "wo-other", associationId: "assoc-99" }),
    ] as any);
    const items = await resolveMany([{ id: "assoc-1", name: "A" }, { id: "assoc-2", name: "B" }], {
      now,
    });
    expect(items.map((i) => i.recordId)).toEqual(["wo-permitted"]);
  });
});
