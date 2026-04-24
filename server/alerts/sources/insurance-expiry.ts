/**
 * 4.1 Tier 2 resolver — insurance expiry (4.1 Q1 Tier 2).
 *
 * Spec wording: "Insurance expiry" — surface association-level insurance
 * policies expiring within the next 60 days (default). YCM's canonical
 * insurance-tracking table is `association_insurance_policies`
 * (`shared/schema.ts:1838`), which has an `expirationDate` column.
 *
 * Resolver assigns:
 *   zone          = "governance"
 *   featureDomain = "governance-compliance"
 *   ruleType      = "insurance-expiry"
 *   recordType    = "association_insurance_policies"
 *   recordId      = policy.id
 *
 * `alertId` therefore is
 *   `insurance-expiry:association_insurance_policies:<id>`.
 *
 * Severity (task heuristics):
 *   critical — expiring within 30 days (or already lapsed)
 *   high     — expiring within 45 days
 *   medium   — expiring within 60 days
 */

import { and, eq, isNotNull, lte } from "drizzle-orm";
import { db } from "../../db";
import { associationInsurancePolicies } from "@shared/schema";
import type { AlertItem, AlertSeverity } from "../types";
import { FEATURE_DOMAINS } from "../types";

const DEFAULT_LEAD_TIME_DAYS = 60;
const CRITICAL_DAYS = 30;
const HIGH_DAYS = 45;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function resolve(
  associationId: string,
  context: { associationName: string; now?: Date; leadTimeDays?: number },
): Promise<AlertItem[]> {
  const now = context.now ?? new Date();
  const leadTimeDays = context.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS;
  const cutoff = new Date(now.getTime() + leadTimeDays * MS_PER_DAY);

  const rows = await db
    .select()
    .from(associationInsurancePolicies)
    .where(
      and(
        eq(associationInsurancePolicies.associationId, associationId),
        isNotNull(associationInsurancePolicies.expirationDate),
        lte(associationInsurancePolicies.expirationDate, cutoff),
      ),
    );

  return rows
    .filter((policy) => policy.expirationDate !== null)
    .map((policy): AlertItem => {
      const expiresAt = new Date(policy.expirationDate as Date);
      const daysUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / MS_PER_DAY);
      const expired = daysUntilExpiry < 0;

      let severity: AlertSeverity;
      if (expired || daysUntilExpiry <= CRITICAL_DAYS) {
        severity = "critical";
      } else if (daysUntilExpiry <= HIGH_DAYS) {
        severity = "high";
      } else {
        severity = "medium";
      }

      const carrierLabel = policy.carrier || "Unknown carrier";
      const policyTypeLabel = policy.policyType;

      return {
        alertId: `insurance-expiry:association_insurance_policies:${policy.id}`,
        associationId,
        associationName: context.associationName,
        zone: "governance",
        featureDomain: FEATURE_DOMAINS.GOVERNANCE_COMPLIANCE,
        ruleType: "insurance-expiry",
        recordType: "association_insurance_policies",
        recordId: policy.id,
        severity,
        title: `${expired ? "Insurance expired" : "Insurance expiring"}: ${policyTypeLabel} (${carrierLabel})`,
        description: expired
          ? `Policy expired ${expiresAt.toISOString().slice(0, 10)} (${-daysUntilExpiry} day${-daysUntilExpiry === 1 ? "" : "s"} ago).`
          : `Policy expires ${expiresAt.toISOString().slice(0, 10)} (in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}).`,
        createdAt: new Date(policy.createdAt),
        resolutionHref: `/app/governance/insurance/${policy.id}`,
        sourceRecord: policy,
      };
    });
}
