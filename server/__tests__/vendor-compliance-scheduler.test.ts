/**
 * Tests for the vendor-compliance sweep (founder-os#9482 acceptance criteria
 * b–e). `storage` and `fileAction` are mocked (same pattern as
 * `server/alerts/__tests__/vendor-contract-renewals.test.ts` and
 * `server/routes/__tests__/agent-actions.test.ts`) so this never touches a
 * real DATABASE_URL — the ladder gating itself is already locked in
 * `agent-action-service.test.ts`; this proves the SWEEP wires it correctly.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../storage", () => ({
  storage: {
    getVendors: vi.fn(),
    getVendorCoiOnFileMap: vi.fn(),
    hasOpenAgentAction: vi.fn(),
  },
}));

vi.mock("../services/agent-action-service", () => ({
  fileAction: vi.fn(),
}));

// founder-os#10741: the scheduler now advisory-locks its TICK (see
// scheduler-lock.ts), which transitively imports `server/db.ts` (requires
// DATABASE_URL). This suite tests the pure `runVendorComplianceSweep` sweep
// matrix — NOT the tick — so mock the lock as a pass-through to preserve the
// "never touches a real DATABASE_URL" invariant above.
vi.mock("../scheduler-lock", () => ({
  withSchedulerLock: async (_name: string, fn: () => Promise<unknown>) => ({
    acquired: true,
    value: await fn(),
  }),
  SchedulerLock: {
    AUTOMATION_SWEEP: "ycm:automation-sweep",
    ELECTION_AUTO_CLOSE: "ycm:election-auto-close",
    DEPROVISIONING: "ycm:deprovisioning-sweep",
    VENDOR_COMPLIANCE: "ycm:vendor-compliance-sweep",
  },
}));

import { storage } from "../storage";
import { fileAction } from "../services/agent-action-service";
import { runVendorComplianceSweep, VENDOR_COMPLIANCE_ACTION_TYPE } from "../vendor-compliance-scheduler";

const now = new Date("2026-06-01T00:00:00Z");
const daysFromNow = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

function makeVendor(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "vendor-1",
    associationId: "assoc-a",
    name: "Acme HVAC",
    trade: "hvac",
    serviceArea: null,
    primaryContactName: null,
    primaryEmail: null,
    primaryPhone: null,
    licenseNumber: null,
    insuranceExpiresAt: daysFromNow(15), // inside the default 30-day window
    w9ReceivedAt: daysFromNow(-100),
    status: "active",
    notes: null,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("runVendorComplianceSweep", () => {
  beforeEach(() => {
    vi.mocked(storage.getVendors).mockReset();
    vi.mocked(storage.getVendorCoiOnFileMap).mockReset();
    vi.mocked(storage.hasOpenAgentAction).mockReset();
    vi.mocked(fileAction).mockReset();
  });

  it("(b) files an L1 queue item for a seeded near-expiry vendor via the real fileAction path", async () => {
    const vendor = makeVendor();
    vi.mocked(storage.getVendors).mockResolvedValue([vendor] as any);
    vi.mocked(storage.getVendorCoiOnFileMap).mockResolvedValue({ [vendor.id]: true });
    vi.mocked(storage.hasOpenAgentAction).mockResolvedValue(false);
    vi.mocked(fileAction).mockResolvedValue({ id: "action-1" } as any);

    const result = await runVendorComplianceSweep(now);

    expect(result.filed).toHaveLength(1);
    expect(result.filed[0]).toMatchObject({ vendorId: vendor.id, associationId: "assoc-a", status: "expiring" });
    expect(fileAction).toHaveBeenCalledTimes(1);
    expect(fileAction).toHaveBeenCalledWith(
      expect.objectContaining({
        associationId: "assoc-a",
        actionType: VENDOR_COMPLIANCE_ACTION_TYPE,
        targetEntityType: "vendor",
        targetEntityId: vendor.id,
        severity: "medium",
      }),
    );
  });

  it("a lapsed vendor (expired insurance) files with severity high", async () => {
    const vendor = makeVendor({ insuranceExpiresAt: daysFromNow(-5) });
    vi.mocked(storage.getVendors).mockResolvedValue([vendor] as any);
    vi.mocked(storage.getVendorCoiOnFileMap).mockResolvedValue({ [vendor.id]: true });
    vi.mocked(storage.hasOpenAgentAction).mockResolvedValue(false);
    vi.mocked(fileAction).mockResolvedValue({ id: "action-1" } as any);

    const result = await runVendorComplianceSweep(now);

    expect(result.filed[0].status).toBe("lapsed");
    expect(fileAction).toHaveBeenCalledWith(expect.objectContaining({ severity: "high" }));
  });

  it("a compliant vendor (well outside the window) files nothing", async () => {
    const vendor = makeVendor({ insuranceExpiresAt: daysFromNow(90) });
    vi.mocked(storage.getVendors).mockResolvedValue([vendor] as any);
    vi.mocked(storage.getVendorCoiOnFileMap).mockResolvedValue({ [vendor.id]: true });
    vi.mocked(storage.hasOpenAgentAction).mockResolvedValue(false);

    const result = await runVendorComplianceSweep(now);

    expect(result.filed).toHaveLength(0);
    expect(fileAction).not.toHaveBeenCalled();
    // the dedup check itself is skipped entirely for a compliant vendor —
    // there is nothing to dedup against.
    expect(storage.hasOpenAgentAction).not.toHaveBeenCalled();
  });

  it("an inactive vendor is skipped even if its insurance has lapsed", async () => {
    const vendor = makeVendor({ status: "inactive", insuranceExpiresAt: daysFromNow(-30) });
    vi.mocked(storage.getVendors).mockResolvedValue([vendor] as any);
    vi.mocked(storage.getVendorCoiOnFileMap).mockResolvedValue({});

    const result = await runVendorComplianceSweep(now);

    expect(result.filed).toHaveLength(0);
    expect(fileAction).not.toHaveBeenCalled();
  });

  it("(c) idempotency: a second sweep files ZERO duplicates when an open reminder already exists", async () => {
    const vendor = makeVendor();
    vi.mocked(storage.getVendors).mockResolvedValue([vendor] as any);
    vi.mocked(storage.getVendorCoiOnFileMap).mockResolvedValue({ [vendor.id]: true });
    vi.mocked(fileAction).mockResolvedValue({ id: "action-1" } as any);

    // First sweep: nothing open yet -> files one.
    vi.mocked(storage.hasOpenAgentAction).mockResolvedValueOnce(false);
    const first = await runVendorComplianceSweep(now);
    expect(first.filed).toHaveLength(1);
    expect(fileAction).toHaveBeenCalledTimes(1);

    // Second sweep: the reminder filed above is now "open" -> skip, no dupe.
    vi.mocked(storage.hasOpenAgentAction).mockResolvedValueOnce(true);
    const second = await runVendorComplianceSweep(now);
    expect(second.filed).toHaveLength(0);
    expect(second.skippedAlreadyOpen).toHaveLength(1);
    expect(fileAction).toHaveBeenCalledTimes(1); // still just the one from the first sweep
  });

  it("(d) isolation: a scoped sweep for association A never files for association B's vendors", async () => {
    // storage.getVendors(associationId) is the association-scoped boundary
    // (already tenant-isolated at the DB layer, per getVendorRenewalAlerts'
    // convention); this proves the sweep tags every filed item with the
    // VENDOR's own associationId and never leaks a cross-tenant value.
    const vendorA = makeVendor({ id: "vendor-a", associationId: "assoc-a", insuranceExpiresAt: daysFromNow(5) });
    vi.mocked(storage.getVendors).mockImplementation(async (associationId?: string) => {
      if (associationId === "assoc-a") return [vendorA] as any;
      if (associationId === "assoc-b") return [] as any; // assoc-b's vendor is NOT in assoc-a's scoped result
      return [vendorA] as any;
    });
    vi.mocked(storage.getVendorCoiOnFileMap).mockResolvedValue({ [vendorA.id]: true });
    vi.mocked(storage.hasOpenAgentAction).mockResolvedValue(false);
    vi.mocked(fileAction).mockResolvedValue({ id: "action-1" } as any);

    const result = await runVendorComplianceSweep(now, "assoc-a");

    expect(result.filed).toHaveLength(1);
    expect(result.filed[0].associationId).toBe("assoc-a");
    expect(fileAction).toHaveBeenCalledWith(expect.objectContaining({ associationId: "assoc-a" }));
    expect(fileAction).not.toHaveBeenCalledWith(expect.objectContaining({ associationId: "assoc-b" }));
  });

  it("(d) isolation (unscoped sweep): each vendor's filed item carries its OWN associationId, never a mixed-up one", async () => {
    const vendorA = makeVendor({ id: "vendor-a", associationId: "assoc-a", insuranceExpiresAt: daysFromNow(5) });
    const vendorB = makeVendor({ id: "vendor-b", associationId: "assoc-b", insuranceExpiresAt: daysFromNow(-1) });
    vi.mocked(storage.getVendors).mockResolvedValue([vendorA, vendorB] as any);
    vi.mocked(storage.getVendorCoiOnFileMap).mockResolvedValue({ [vendorA.id]: true, [vendorB.id]: true });
    vi.mocked(storage.hasOpenAgentAction).mockResolvedValue(false);
    vi.mocked(fileAction).mockResolvedValue({ id: "action-x" } as any);

    const result = await runVendorComplianceSweep(now);

    expect(result.filed).toHaveLength(2);
    const byVendor = Object.fromEntries(result.filed.map((f) => [f.vendorId, f.associationId]));
    expect(byVendor["vendor-a"]).toBe("assoc-a");
    expect(byVendor["vendor-b"]).toBe("assoc-b");
  });

  it("(e) end-to-end: seeded near-expiry vendor -> sweep -> the filed reasoning names the vendor and days-to-expiry", async () => {
    const vendor = makeVendor({ name: "Bright Plumbing", insuranceExpiresAt: daysFromNow(10) });
    vi.mocked(storage.getVendors).mockResolvedValue([vendor] as any);
    vi.mocked(storage.getVendorCoiOnFileMap).mockResolvedValue({ [vendor.id]: true });
    vi.mocked(storage.hasOpenAgentAction).mockResolvedValue(false);
    vi.mocked(fileAction).mockResolvedValue({ id: "action-1" } as any);

    await runVendorComplianceSweep(now);

    // listQueue()'s severity-ranking / status-scoping is already covered by
    // agent-action-service.test.ts + agent-actions.test.ts; this proves the
    // SWEEP hands fileAction() a reasoning string an operator can actually
    // read on the queue.
    expect(fileAction).toHaveBeenCalledWith(
      expect.objectContaining({
        reasoning: expect.stringContaining("Bright Plumbing"),
        createdByAgent: "vendor-compliance-scheduler",
      }),
    );
    const call = vi.mocked(fileAction).mock.calls[0][0];
    expect(call.reasoning).toContain("expires in 10 day");
  });

  it("a vendor missing its W-9 gets a reasoning string naming the gap, independent of the expiry date", async () => {
    const vendor = makeVendor({ w9ReceivedAt: null, insuranceExpiresAt: daysFromNow(90) });
    vi.mocked(storage.getVendors).mockResolvedValue([vendor] as any);
    vi.mocked(storage.getVendorCoiOnFileMap).mockResolvedValue({ [vendor.id]: true });
    vi.mocked(storage.hasOpenAgentAction).mockResolvedValue(false);
    vi.mocked(fileAction).mockResolvedValue({ id: "action-1" } as any);

    const result = await runVendorComplianceSweep(now);

    expect(result.filed[0].status).toBe("lapsed");
    const call = vi.mocked(fileAction).mock.calls[0][0];
    expect(call.reasoning).toContain("no W-9 on file");
  });
});
