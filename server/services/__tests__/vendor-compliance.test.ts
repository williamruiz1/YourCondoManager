/**
 * Unit tests for the PURE vendor-compliance-status decision
 * (founder-os#9482). No DB, no mocking — exercised directly.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  vendorComplianceStatus,
  getComplianceWindowDays,
  DEFAULT_COMPLIANCE_WINDOW_DAYS,
} from "../vendor-compliance";

const now = new Date("2026-06-01T00:00:00Z");
const daysFromNow = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

describe("vendorComplianceStatus", () => {
  it("compliant: W-9 + current COI + insurance-expiry well beyond the window", () => {
    const result = vendorComplianceStatus(
      { w9ReceivedAt: daysFromNow(-100), hasCurrentCoi: true, insuranceExpiresAt: daysFromNow(90) },
      now,
    );
    expect(result.status).toBe("compliant");
    expect(result.missing).toEqual([]);
    expect(result.daysUntilExpiry).toBe(90);
  });

  it("expiring: all three facts present, insurance expires INSIDE the window", () => {
    const result = vendorComplianceStatus(
      { w9ReceivedAt: daysFromNow(-10), hasCurrentCoi: true, insuranceExpiresAt: daysFromNow(15) },
      now,
    );
    expect(result.status).toBe("expiring");
    expect(result.missing).toEqual([]);
    expect(result.daysUntilExpiry).toBe(15);
  });

  it("lapsed: insurance-expiry date is in the past", () => {
    const result = vendorComplianceStatus(
      { w9ReceivedAt: daysFromNow(-10), hasCurrentCoi: true, insuranceExpiresAt: daysFromNow(-1) },
      now,
    );
    expect(result.status).toBe("lapsed");
    expect(result.daysUntilExpiry).toBe(-1);
  });

  it("lapsed: missing W-9 alone forces lapsed even with a future insurance-expiry date", () => {
    const result = vendorComplianceStatus(
      { w9ReceivedAt: null, hasCurrentCoi: true, insuranceExpiresAt: daysFromNow(90) },
      now,
    );
    expect(result.status).toBe("lapsed");
    expect(result.missing).toEqual(["w9"]);
  });

  it("lapsed: missing current COI alone forces lapsed", () => {
    const result = vendorComplianceStatus(
      { w9ReceivedAt: daysFromNow(-10), hasCurrentCoi: false, insuranceExpiresAt: daysFromNow(90) },
      now,
    );
    expect(result.status).toBe("lapsed");
    expect(result.missing).toEqual(["coi"]);
  });

  it("lapsed: missing insurance-expiry date alone forces lapsed", () => {
    const result = vendorComplianceStatus(
      { w9ReceivedAt: daysFromNow(-10), hasCurrentCoi: true, insuranceExpiresAt: null },
      now,
    );
    expect(result.status).toBe("lapsed");
    expect(result.missing).toEqual(["insurance-expiry"]);
    expect(result.daysUntilExpiry).toBeNull();
  });

  it("lapsed: nothing on file at all — all three missing", () => {
    const result = vendorComplianceStatus({ w9ReceivedAt: null, hasCurrentCoi: false, insuranceExpiresAt: null }, now);
    expect(result.status).toBe("lapsed");
    expect(result.missing).toEqual(["w9", "coi", "insurance-expiry"]);
  });

  describe("window-edge boundaries (default 30-day window)", () => {
    it("exactly at the window boundary (30 days out) is expiring, not compliant", () => {
      const result = vendorComplianceStatus(
        { w9ReceivedAt: daysFromNow(-1), hasCurrentCoi: true, insuranceExpiresAt: daysFromNow(30) },
        now,
      );
      expect(result.status).toBe("expiring");
    });

    it("one day beyond the window boundary (31 days out) is compliant", () => {
      const result = vendorComplianceStatus(
        { w9ReceivedAt: daysFromNow(-1), hasCurrentCoi: true, insuranceExpiresAt: daysFromNow(31) },
        now,
      );
      expect(result.status).toBe("compliant");
    });

    it("exactly at expiry (0 days out) is expiring, not lapsed", () => {
      const result = vendorComplianceStatus(
        { w9ReceivedAt: daysFromNow(-1), hasCurrentCoi: true, insuranceExpiresAt: daysFromNow(0) },
        now,
      );
      expect(result.status).toBe("expiring");
      expect(result.daysUntilExpiry).toBe(0);
    });

    it("one day past expiry (-1 days) is lapsed", () => {
      const result = vendorComplianceStatus(
        { w9ReceivedAt: daysFromNow(-1), hasCurrentCoi: true, insuranceExpiresAt: daysFromNow(-1) },
        now,
      );
      expect(result.status).toBe("lapsed");
    });
  });

  it("honors an explicit custom window (configurable — founder-os#9482 acceptance criterion)", () => {
    // 20 days out is inside a 45-day window (expiring) but outside a 10-day window (compliant).
    const insuranceExpiresAt = daysFromNow(20);
    const wide = vendorComplianceStatus({ w9ReceivedAt: daysFromNow(-1), hasCurrentCoi: true, insuranceExpiresAt }, now, 45);
    const narrow = vendorComplianceStatus({ w9ReceivedAt: daysFromNow(-1), hasCurrentCoi: true, insuranceExpiresAt }, now, 10);
    expect(wide.status).toBe("expiring");
    expect(narrow.status).toBe("compliant");
  });
});

describe("getComplianceWindowDays", () => {
  const originalEnv = process.env.VENDOR_COMPLIANCE_WINDOW_DAYS;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.VENDOR_COMPLIANCE_WINDOW_DAYS;
    else process.env.VENDOR_COMPLIANCE_WINDOW_DAYS = originalEnv;
  });

  it("falls back to the 30-day default when unset", () => {
    delete process.env.VENDOR_COMPLIANCE_WINDOW_DAYS;
    expect(getComplianceWindowDays()).toBe(DEFAULT_COMPLIANCE_WINDOW_DAYS);
    expect(DEFAULT_COMPLIANCE_WINDOW_DAYS).toBe(30);
  });

  it("honors a valid override", () => {
    process.env.VENDOR_COMPLIANCE_WINDOW_DAYS = "45";
    expect(getComplianceWindowDays()).toBe(45);
  });

  it("falls back to the default on an invalid override", () => {
    process.env.VENDOR_COMPLIANCE_WINDOW_DAYS = "not-a-number";
    expect(getComplianceWindowDays()).toBe(DEFAULT_COMPLIANCE_WINDOW_DAYS);
  });
});
