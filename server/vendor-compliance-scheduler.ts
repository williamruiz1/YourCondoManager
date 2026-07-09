/**
 * Vendor compliance sweep — W-9 / COI / insurance-expiry reminders
 * (founder-os#9482).
 *
 * Daily sweep, mirroring the `server/de-provisioning.ts` scheduler shape:
 * a pure/testable `runVendorComplianceSweep()` core + a `setInterval`
 * wrapper (`startVendorComplianceScheduler`) called once from
 * `server/index.ts`.
 *
 * For every active vendor whose compliance status (per
 * `server/services/vendor-compliance.ts`) is "expiring" or "lapsed", the
 * sweep files ONE informational L1 queue item
 * (`suggest.vendor_compliance_renewal`) onto that vendor's association's
 * agent-action queue (`server/services/agent-action-service.ts`) — the
 * existing YCM Chief-of-Staff queue surface. L1 items are always-executable
 * / require no approval; this sweep only SURFACES the reminder, it never
 * changes the vendor's status or terminates it (per dispatch scope: reminder
 * + status only, no auto-termination).
 *
 * Idempotent: before filing, the sweep checks
 * `storage.hasOpenAgentAction("vendor", vendor.id, ACTION_TYPE)` — a vendor
 * already carrying an open (queued|approved) reminder is skipped, so
 * re-running the sweep never duplicates a reminder for the same lapse.
 *
 * Tenant isolation: `associationId` on every filed action is the VENDOR's
 * own `associationId` (never a global/ambient value), so a reminder can
 * never surface on the wrong association's queue.
 */
import { storage } from "./storage";
import { fileAction } from "./services/agent-action-service";
import { vendorComplianceStatus, type VendorComplianceStatus } from "./services/vendor-compliance";
import { log } from "./logger";
import type { Vendor } from "@shared/schema";

export const VENDOR_COMPLIANCE_ACTION_TYPE = "suggest.vendor_compliance_renewal";

function severityForStatus(status: VendorComplianceStatus): "medium" | "high" {
  return status === "lapsed" ? "high" : "medium";
}

function reasoningFor(vendor: Vendor, status: VendorComplianceStatus, missing: string[], daysUntilExpiry: number | null): string {
  const parts: string[] = [];
  if (missing.includes("w9")) parts.push("no W-9 on file");
  if (missing.includes("coi")) parts.push("no current COI on file");
  if (missing.includes("insurance-expiry")) parts.push("no insurance-expiry date on file");
  if (daysUntilExpiry !== null && !missing.includes("insurance-expiry")) {
    parts.push(
      daysUntilExpiry < 0
        ? `insurance expired ${-daysUntilExpiry} day${-daysUntilExpiry === 1 ? "" : "s"} ago`
        : `insurance expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}`,
    );
  }
  const detail = parts.length > 0 ? parts.join("; ") : "compliance record incomplete";
  return `Vendor "${vendor.name}" is ${status} — ${detail}.`;
}

export interface VendorComplianceSweepResult {
  filed: Array<{ vendorId: string; vendorName: string; associationId: string; status: VendorComplianceStatus }>;
  skippedAlreadyOpen: Array<{ vendorId: string; status: VendorComplianceStatus }>;
  errors: Array<{ vendorId: string; message: string }>;
}

/**
 * Sweep core. Optionally scoped to a single association (mirrors
 * `storage.getVendors(associationId?)`); the scheduler calls it unscoped
 * (all associations) on its interval.
 */
export async function runVendorComplianceSweep(
  now: Date = new Date(),
  associationId?: string,
): Promise<VendorComplianceSweepResult> {
  const result: VendorComplianceSweepResult = { filed: [], skippedAlreadyOpen: [], errors: [] };

  const vendors = (await storage.getVendors(associationId)).filter((v) => v.status !== "inactive");
  if (vendors.length === 0) return result;

  const coiMap = await storage.getVendorCoiOnFileMap(vendors.map((v) => v.id));

  for (const vendor of vendors) {
    try {
      const { status, missing, daysUntilExpiry } = vendorComplianceStatus(
        {
          w9ReceivedAt: vendor.w9ReceivedAt ? new Date(vendor.w9ReceivedAt) : null,
          hasCurrentCoi: Boolean(coiMap[vendor.id]),
          insuranceExpiresAt: vendor.insuranceExpiresAt ? new Date(vendor.insuranceExpiresAt) : null,
        },
        now,
      );

      if (status === "compliant") continue;

      const alreadyOpen = await storage.hasOpenAgentAction("vendor", vendor.id, VENDOR_COMPLIANCE_ACTION_TYPE);
      if (alreadyOpen) {
        result.skippedAlreadyOpen.push({ vendorId: vendor.id, status });
        continue;
      }

      await fileAction({
        associationId: vendor.associationId,
        actionType: VENDOR_COMPLIANCE_ACTION_TYPE,
        reasoning: reasoningFor(vendor, status, missing, daysUntilExpiry),
        createdByAgent: "vendor-compliance-scheduler",
        targetEntityType: "vendor",
        targetEntityId: vendor.id,
        severity: severityForStatus(status),
        payload: { status, missing, daysUntilExpiry },
      });
      result.filed.push({ vendorId: vendor.id, vendorName: vendor.name, associationId: vendor.associationId, status });
      log(
        `[vendor-compliance] reminder filed vendorId=${vendor.id} associationId=${vendor.associationId} status=${status}`,
        "automation",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ vendorId: vendor.id, message });
      console.error(`[vendor-compliance] sweep failed for vendor ${vendor.id}`, err);
    }
  }

  return result;
}

let complianceTimer: NodeJS.Timeout | null = null;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Daily scheduler. Runs `runVendorComplianceSweep` at startup and then every
 * 24 hours. Call once from `server/index.ts`.
 */
export function startVendorComplianceScheduler(intervalMs: number = DAY_MS): void {
  if (complianceTimer) return;
  const tick = async (): Promise<void> => {
    try {
      const result = await runVendorComplianceSweep();
      if (result.filed.length > 0 || result.errors.length > 0) {
        log(
          `[vendor-compliance] sweep complete filed=${result.filed.length} skipped=${result.skippedAlreadyOpen.length} errors=${result.errors.length}`,
          "automation",
        );
      }
    } catch (err) {
      console.error("[vendor-compliance] sweep failed", err);
    }
  };
  complianceTimer = setInterval(() => {
    void tick();
  }, intervalMs);
  void tick();
  log(`[vendor-compliance] scheduler started (interval ${intervalMs}ms)`, "automation");
}

export function stopVendorComplianceScheduler(): void {
  if (complianceTimer) {
    clearInterval(complianceTimer);
    complianceTimer = null;
  }
}
