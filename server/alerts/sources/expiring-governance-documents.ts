/**
 * 4.1 Tier 1 resolver — expiring governance documents (4.1 Q1).
 *
 * Spec wording: "Expiring governance documents (within configurable
 * lead-time window; default 30 days)."
 *
 * YCM's `documents` table has no expiry column. The closest canonical
 * signal is `governance_compliance_templates.nextReviewDueAt` — the
 * review deadline for an association's governance/compliance template
 * (bylaws, rules, resolutions, state-level compliance checklists). A
 * template approaching or past its `nextReviewDueAt` represents a
 * governance document that needs reconfirmation or update before it
 * lapses from a compliance standpoint.
 *
 * Resolver assigns:
 *   zone          = "governance"
 *   featureDomain = "governance.documents"
 *   ruleType      = "expiring-governance-document"
 *   recordType    = "governance_compliance_templates"
 *   recordId      = template.id
 *
 * `alertId` therefore is
 *   `expiring-governance-document:governance_compliance_templates:<id>`.
 */

import { and, eq, isNotNull, lte } from "drizzle-orm";
import { db } from "../../db";
import { governanceComplianceTemplates } from "@shared/schema";
import type { AlertItem } from "../types";
import { FEATURE_DOMAINS } from "../types";

const DEFAULT_LEAD_TIME_DAYS = 30;

export async function resolve(
  associationId: string,
  context: { associationName: string; now?: Date; leadTimeDays?: number },
): Promise<AlertItem[]> {
  const now = context.now ?? new Date();
  const leadTimeDays = context.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS;
  const cutoff = new Date(now.getTime() + leadTimeDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select()
    .from(governanceComplianceTemplates)
    .where(
      and(
        eq(governanceComplianceTemplates.associationId, associationId),
        isNotNull(governanceComplianceTemplates.nextReviewDueAt),
        lte(governanceComplianceTemplates.nextReviewDueAt, cutoff),
      ),
    );

  return rows.map((template): AlertItem => {
    const nextReviewAt = template.nextReviewDueAt ? new Date(template.nextReviewDueAt) : cutoff;
    const daysUntilReview = Math.floor((nextReviewAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const expired = daysUntilReview < 0;
    const severity = expired ? "high" : daysUntilReview <= 7 ? "medium" : "low";
    return {
      alertId: `expiring-governance-document:governance_compliance_templates:${template.id}`,
      associationId,
      associationName: context.associationName,
      zone: "governance",
      featureDomain: FEATURE_DOMAINS.GOVERNANCE_DOCUMENTS,
      ruleType: "expiring-governance-document",
      recordType: "governance_compliance_templates",
      recordId: template.id,
      severity,
      title: `${expired ? "Lapsed" : "Expiring"} governance document: ${template.name}`,
      description: expired
        ? `Review was due ${nextReviewAt.toISOString().slice(0, 10)} (${-daysUntilReview} days ago).`
        : `Review due ${nextReviewAt.toISOString().slice(0, 10)} (in ${daysUntilReview} day${daysUntilReview === 1 ? "" : "s"}).`,
      createdAt: new Date(template.createdAt),
      resolutionHref: `/app/governance/documents/${template.id}`,
      sourceRecord: template,
    };
  });
}
