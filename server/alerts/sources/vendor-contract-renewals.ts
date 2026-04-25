/**
 * 4.1 Tier 2 resolver — vendor contract renewals (4.1 Q1 Tier 2).
 *
 * Spec wording: "Vendor contract renewals" — surface vendors whose
 * contract is due to renew within the next 30 days (default).
 *
 * SCHEMA NOTE: YCM's `vendors` table has no dedicated `contractEndDate`
 * column. The closest canonical signal is `insuranceExpiresAt` — a
 * vendor's insurance expiry is the single contract-lifecycle date the
 * PM tracks per vendor, and the vendor cannot continue performing work
 * without current insurance. The `vendor_status` enum also includes
 * the explicit `pending-renewal` state, which we surface unconditionally
 * (a vendor manually marked `pending-renewal` always warrants a renewal
 * alert, regardless of whether an insurance date is set).
 *
 * Resolver assigns:
 *   zone          = "operations"
 *   featureDomain = "vendors"
 *   ruleType      = "vendor-contract-renewal"
 *   recordType    = "vendors"
 *   recordId      = vendor.id
 *
 * `alertId` therefore is `vendor-contract-renewal:vendors:<id>`.
 *
 * Severity (task heuristics):
 *   critical — not used for this rule type
 *   high     — expiring within 14 days
 *   medium   — everything else inside the 30-day window (incl. pending-renewal)
 *
 * Wave 16b (5.4-F1): `resolveMany` calls `storage.getVendors()` once,
 * groups by associationId. `resolve()` preserved as a thin wrapper.
 */

import { storage } from "../../storage";
import type { AlertItem, AlertSeverity } from "../types";
import { FEATURE_DOMAINS } from "../types";

const DEFAULT_LEAD_TIME_DAYS = 30;
const HIGH_SEVERITY_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface AssociationContext {
  id: string;
  name: string;
}

export interface ResolveContext {
  associationName: string;
  now?: Date;
  leadTimeDays?: number;
}

export interface ResolveManyContext {
  now?: Date;
  leadTimeDays?: number;
}

export async function resolveMany(
  associations: AssociationContext[],
  context: ResolveManyContext = {},
): Promise<AlertItem[]> {
  if (associations.length === 0) return [];
  const now = context.now ?? new Date();
  const leadTimeDays = context.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS;
  const cutoff = new Date(now.getTime() + leadTimeDays * MS_PER_DAY);
  const nameById = new Map(associations.map((a) => [a.id, a.name]));

  const allVendors =
    associations.length === 1
      ? await storage.getVendors(associations[0].id)
      : await storage.getVendors();

  const alerts: AlertItem[] = [];
  for (const vendor of allVendors) {
    if (!nameById.has(vendor.associationId)) continue;
    if (vendor.status === "inactive") continue;

    const expiresAt = vendor.insuranceExpiresAt ? new Date(vendor.insuranceExpiresAt) : null;
    const pendingRenewal = vendor.status === "pending-renewal";
    const withinWindow = expiresAt !== null && expiresAt <= cutoff;

    if (!pendingRenewal && !withinWindow) continue;

    const daysUntilExpiry =
      expiresAt !== null
        ? Math.floor((expiresAt.getTime() - now.getTime()) / MS_PER_DAY)
        : null;
    const expired = daysUntilExpiry !== null && daysUntilExpiry < 0;

    let severity: AlertSeverity;
    if (daysUntilExpiry !== null && daysUntilExpiry <= HIGH_SEVERITY_DAYS) {
      severity = "high";
    } else {
      severity = "medium";
    }

    const titlePrefix = expired ? "Lapsed vendor contract" : "Vendor contract renewal";
    let description: string;
    if (expiresAt === null) {
      description = `Vendor status marked pending-renewal — no contract end date on file.`;
    } else if (expired) {
      description = `Insurance expired ${expiresAt.toISOString().slice(0, 10)} (${-1 * (daysUntilExpiry ?? 0)} days ago).`;
    } else {
      description = `Insurance expires ${expiresAt.toISOString().slice(0, 10)} (in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}).`;
    }

    alerts.push({
      alertId: `vendor-contract-renewal:vendors:${vendor.id}`,
      associationId: vendor.associationId,
      associationName: nameById.get(vendor.associationId) ?? "",
      zone: "operations",
      featureDomain: FEATURE_DOMAINS.VENDORS,
      ruleType: "vendor-contract-renewal",
      recordType: "vendors",
      recordId: vendor.id,
      severity,
      title: `${titlePrefix}: ${vendor.name}`,
      description,
      createdAt: new Date(vendor.createdAt),
      resolutionHref: `/app/operations/vendors/${vendor.id}`,
      sourceRecord: vendor,
    });
  }

  return alerts;
}

export async function resolve(
  associationId: string,
  context: ResolveContext,
): Promise<AlertItem[]> {
  return resolveMany([{ id: associationId, name: context.associationName }], {
    now: context.now,
    leadTimeDays: context.leadTimeDays,
  });
}
