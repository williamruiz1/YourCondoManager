/**
 * Vendor compliance tracking — W-9 / COI / insurance-expiry (founder-os#9482).
 *
 * A vendor is COMPLIANT when all three of its compliance facts are current:
 *   - a W-9 is on file (w9ReceivedAt is set)
 *   - a current COI (Certificate of Insurance) document is on file
 *     (reuses the existing documents/document_tags substrate — see
 *     `storage.getVendorCoiOnFile`; no new document store was added)
 *   - the insurance-expiry date (vendors.insuranceExpiresAt — the same
 *     canonical signal `server/alerts/sources/vendor-contract-renewals.ts`
 *     already tracks) is in the future, outside the reminder window
 *
 * Missing any one of the three facts, or an insurance expiry inside the
 * reminder window, degrades the vendor to EXPIRING (still time to act) or
 * LAPSED (already past due / never on file). This is a PURE function — no
 * DB access — so it's exercised directly with no mocking (see
 * `__tests__/vendor-compliance.test.ts`).
 *
 * The reminder window is configurable via `VENDOR_COMPLIANCE_WINDOW_DAYS`
 * (falls back to the 30-day default already used by the vendor-contract-
 * renewal alert resolver, for consistency across the two surfaces).
 */

export type VendorComplianceStatus = "compliant" | "expiring" | "lapsed";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_COMPLIANCE_WINDOW_DAYS = 30;

export function getComplianceWindowDays(): number {
  const raw = process.env.VENDOR_COMPLIANCE_WINDOW_DAYS;
  if (!raw) return DEFAULT_COMPLIANCE_WINDOW_DAYS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_COMPLIANCE_WINDOW_DAYS;
}

export interface VendorComplianceInput {
  w9ReceivedAt: Date | null;
  hasCurrentCoi: boolean;
  insuranceExpiresAt: Date | null;
}

export interface VendorComplianceResult {
  status: VendorComplianceStatus;
  daysUntilExpiry: number | null;
  missing: Array<"w9" | "coi" | "insurance-expiry">;
}

/**
 * PURE compliance-status decision. Any missing compliance fact (no W-9, no
 * current COI, no insurance-expiry date on file) is treated as LAPSED —
 * a vendor with nothing on file has no proof of compliance, regardless of
 * dates. Otherwise the status is driven by the insurance-expiry date
 * relative to `now` and the reminder window:
 *   expired (daysUntilExpiry < 0)              -> lapsed
 *   within the window (0 <= daysUntilExpiry <= windowDays) -> expiring
 *   beyond the window                          -> compliant
 */
export function vendorComplianceStatus(
  input: VendorComplianceInput,
  now: Date = new Date(),
  windowDays: number = getComplianceWindowDays(),
): VendorComplianceResult {
  const missing: Array<"w9" | "coi" | "insurance-expiry"> = [];
  if (!input.w9ReceivedAt) missing.push("w9");
  if (!input.hasCurrentCoi) missing.push("coi");
  if (!input.insuranceExpiresAt) missing.push("insurance-expiry");

  if (missing.length > 0) {
    // No expiry date to compute against if insurance-expiry itself is
    // missing; if it IS present but W-9/COI are missing, still surface how
    // many days remain so the reminder reasoning can cite it.
    const daysUntilExpiry = input.insuranceExpiresAt
      ? Math.floor((input.insuranceExpiresAt.getTime() - now.getTime()) / MS_PER_DAY)
      : null;
    return { status: "lapsed", daysUntilExpiry, missing };
  }

  const daysUntilExpiry = Math.floor((input.insuranceExpiresAt!.getTime() - now.getTime()) / MS_PER_DAY);
  if (daysUntilExpiry < 0) return { status: "lapsed", daysUntilExpiry, missing };
  if (daysUntilExpiry <= windowDays) return { status: "expiring", daysUntilExpiry, missing };
  return { status: "compliant", daysUntilExpiry, missing };
}
