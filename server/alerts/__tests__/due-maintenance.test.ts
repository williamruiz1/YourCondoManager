/**
 * 4.1 Wave 2 — Unit test: due-maintenance resolver.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../storage", () => ({
  storage: {
    getMaintenanceScheduleInstances: vi.fn(),
  },
}));

import { storage } from "../../storage";
import { resolve, resolveMany } from "../sources/due-maintenance";

const now = new Date("2026-04-22T12:00:00Z");

function makeInstance(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "msi-1",
    templateId: "tpl-1",
    associationId: "assoc-1",
    unitId: null,
    vendorId: null,
    workOrderId: null,
    title: "HVAC filter",
    component: "hvac",
    locationText: "Roof",
    dueAt: new Date("2026-04-25T00:00:00Z"), // 3 days from now
    status: "scheduled",
    createdAt: new Date("2026-04-01T00:00:00Z"),
    updatedAt: new Date("2026-04-01T00:00:00Z"),
    ...overrides,
  };
}

describe("resolver: due-maintenance", () => {
  beforeEach(() => {
    vi.mocked(storage.getMaintenanceScheduleInstances).mockReset();
  });

  it("returns AlertItem for instances due within 7 days (not completed)", async () => {
    vi.mocked(storage.getMaintenanceScheduleInstances).mockResolvedValueOnce([
      makeInstance({ id: "msi-upcoming" }),
      makeInstance({ id: "msi-overdue", dueAt: new Date("2026-04-15T00:00:00Z") }),
    ] as any);
    const items = await resolve("assoc-1", { associationName: "Test HOA", now });
    expect(items).toHaveLength(2);
    expect(items[0].alertId).toBe("due-maintenance:maintenance_schedule_instances:msi-upcoming");
    expect(items[0].zone).toBe("operations");
    expect(items[0].featureDomain).toBe("operations.maintenance-requests");
    expect(items[0].ruleType).toBe("due-maintenance");
    const overdue = items.find((i) => i.recordId === "msi-overdue");
    expect(overdue?.severity).toBe("high");
    const upcoming = items.find((i) => i.recordId === "msi-upcoming");
    expect(upcoming?.severity).toBe("medium");
  });

  it("excludes completed instances", async () => {
    vi.mocked(storage.getMaintenanceScheduleInstances).mockResolvedValueOnce([
      makeInstance({ id: "msi-done", status: "completed" }),
    ] as any);
    const items = await resolve("assoc-1", { associationName: "Test HOA", now });
    expect(items).toHaveLength(0);
  });

  it("excludes instances due more than 7 days out", async () => {
    vi.mocked(storage.getMaintenanceScheduleInstances).mockResolvedValueOnce([
      makeInstance({ id: "msi-far", dueAt: new Date("2026-05-10T00:00:00Z") }),
    ] as any);
    const items = await resolve("assoc-1", { associationName: "Test HOA", now });
    expect(items).toHaveLength(0);
  });

  it("alertId is deterministic", async () => {
    vi.mocked(storage.getMaintenanceScheduleInstances).mockResolvedValue([makeInstance({ id: "stable" })] as any);
    const a = await resolve("assoc-1", { associationName: "X", now });
    const b = await resolve("assoc-1", { associationName: "X", now });
    expect(a[0].alertId).toBe(b[0].alertId);
  });

  // -------------------------------------------------------------------------
  // 5.4-F1 Wave 16b — resolveMany batched fan-out.
  // -------------------------------------------------------------------------

  it("resolveMany: emits alerts for 3 associations from a single storage call", async () => {
    vi.mocked(storage.getMaintenanceScheduleInstances).mockResolvedValueOnce([
      makeInstance({ id: "msi-1", associationId: "assoc-1" }),
      makeInstance({ id: "msi-2", associationId: "assoc-2" }),
      makeInstance({ id: "msi-3", associationId: "assoc-3" }),
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
    expect(vi.mocked(storage.getMaintenanceScheduleInstances).mock.calls).toHaveLength(1);
    expect(vi.mocked(storage.getMaintenanceScheduleInstances).mock.calls[0][0]).toBeUndefined();
  });
});
