/**
 * 4.1 Tier 2 — Unit test: vendor-contract-renewals resolver.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../storage", () => ({
  storage: {
    getVendors: vi.fn(),
  },
}));

import { storage } from "../../storage";
import { resolve } from "../sources/vendor-contract-renewals";

const now = new Date("2026-04-22T12:00:00Z");

function makeVendor(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "vendor-1",
    associationId: "assoc-1",
    name: "Acme HVAC",
    trade: "hvac",
    serviceArea: null,
    primaryContactName: null,
    primaryEmail: null,
    primaryPhone: null,
    licenseNumber: null,
    insuranceExpiresAt: new Date("2026-05-10T00:00:00Z"), // ~18 days away
    status: "active",
    notes: null,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("resolver: vendor-contract-renewals", () => {
  beforeEach(() => {
    vi.mocked(storage.getVendors).mockReset();
  });

  it("emits AlertItem for vendors whose insurance/contract is within the default 30-day window", async () => {
    vi.mocked(storage.getVendors).mockResolvedValueOnce([makeVendor()] as any);

    const items = await resolve("assoc-1", { associationName: "Test HOA", now });

    expect(items).toHaveLength(1);
    expect(items[0].alertId).toBe("vendor-contract-renewal:vendors:vendor-1");
    expect(items[0].zone).toBe("operations");
    expect(items[0].featureDomain).toBe("vendors");
    expect(items[0].ruleType).toBe("vendor-contract-renewal");
    expect(items[0].recordType).toBe("vendors");
    expect(items[0].recordId).toBe("vendor-1");
    expect(items[0].associationId).toBe("assoc-1");
    expect(items[0].associationName).toBe("Test HOA");
    expect(items[0].severity).toBe("medium"); // 18 days out
    expect(items[0].resolutionHref).toBe("/app/operations/vendors/vendor-1");
  });

  it("escalates to high severity when expiring within 14 days", async () => {
    vi.mocked(storage.getVendors).mockResolvedValueOnce([
      makeVendor({ id: "v-near", insuranceExpiresAt: new Date("2026-04-30T00:00:00Z") }),
    ] as any);
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items[0].severity).toBe("high");
  });

  it("surfaces vendors explicitly flagged pending-renewal even without an expiry date", async () => {
    vi.mocked(storage.getVendors).mockResolvedValueOnce([
      makeVendor({ id: "v-nodate", status: "pending-renewal", insuranceExpiresAt: null }),
    ] as any);
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items).toHaveLength(1);
    expect(items[0].alertId).toBe("vendor-contract-renewal:vendors:v-nodate");
    expect(items[0].description).toContain("no contract end date");
  });

  it("excludes vendors whose expiry is outside the lead-time window", async () => {
    vi.mocked(storage.getVendors).mockResolvedValueOnce([
      makeVendor({ id: "v-far", insuranceExpiresAt: new Date("2026-09-01T00:00:00Z") }),
    ] as any);
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items).toHaveLength(0);
  });

  it("excludes inactive vendors", async () => {
    vi.mocked(storage.getVendors).mockResolvedValueOnce([
      makeVendor({ id: "v-inactive", status: "inactive" }),
    ] as any);
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items).toHaveLength(0);
  });

  it("does not crash on vendors with no expiry date and status active", async () => {
    vi.mocked(storage.getVendors).mockResolvedValueOnce([
      makeVendor({ id: "v-malformed", insuranceExpiresAt: null, status: "active" }),
    ] as any);
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items).toHaveLength(0);
  });

  it("produces deterministic alertId across multiple runs", async () => {
    vi.mocked(storage.getVendors).mockResolvedValue([makeVendor({ id: "stable" })] as any);
    const a = await resolve("assoc-1", { associationName: "X", now });
    const b = await resolve("assoc-1", { associationName: "X", now });
    expect(a[0].alertId).toBe(b[0].alertId);
    expect(a[0].alertId).toBe("vendor-contract-renewal:vendors:stable");
  });
});
