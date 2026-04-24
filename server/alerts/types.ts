/**
 * 4.1 Wave 2 — Alert engine types.
 *
 * Spec: docs/projects/platform-overhaul/decisions/4.1-cross-association-alert-engine.md
 *
 * `AlertItem` is the canonical shape returned by every Tier 1 resolver
 * (server/alerts/sources/*.ts) and the cross-association orchestrator
 * (server/alerts/index.ts). Client surfaces (Home panel, hub widgets,
 * inbox) consume the identical shape — per Q6, there is a single
 * aggregation endpoint `GET /api/alerts/cross-association` that all three
 * surfaces share.
 */

/**
 * Zone labels from 1.1 Zone Taxonomy (LOCKED, amended `ac446c0`).
 * Six functional zones for `/app`.
 */
export type ZoneLabel =
  | "home"
  | "financials"
  | "operations"
  | "governance"
  | "communications"
  | "platform";

/**
 * Rule-type discriminator for the Tier 1 + Tier 2 catalog (4.1 Q1).
 * The `ruleType` is the first segment of the deterministic `alertId`
 * (`${ruleType}:${recordType}:${recordId}`) so the identifier remains
 * stable across surfaces.
 *
 * Tier 2 rule types were added alongside the Wave 2 Tier 1 set. They
 * follow the same deterministic-ID and feature-domain-gating contract;
 * each new rule type has a corresponding entry in
 * `RULE_TYPE_FEATURE_DOMAIN` below and a resolver in
 * `server/alerts/sources/`.
 */
export type AlertRuleType =
  // Tier 1 (Wave 2).
  | "overdue-work-order"
  | "due-maintenance"
  | "active-election"
  | "delinquent-ledger-balance"
  | "expiring-governance-document"
  // Tier 2 (Wave 3 — Tier 2 alert sources PR).
  | "vendor-contract-renewal"
  | "insurance-expiry"
  | "budget-variance"
  | "unpaid-late-fee";

/**
 * Which underlying resolver emitted the alert. Mirrors `ruleType` for
 * Tier 1; kept as a separate alias so later tiers can group rules under
 * a single source category if needed.
 */
export type AlertSource = AlertRuleType;

/**
 * Severity is resolver-assigned. Clients order by severity desc, then
 * createdAt desc (see 4.1 Q9 — hub widget mini-list sorting).
 */
export type AlertSeverity = "low" | "medium" | "high" | "critical";

/**
 * Canonical alert payload.
 *
 * - `alertId` is deterministic: `${ruleType}:${recordType}:${recordId}`
 *   (4.1 Q7). Resolving the same record from any surface yields the same
 *   alertId, so read-state joins are unambiguous.
 * - `featureDomain` is keyed to a row in the 0.2 PM-Managed Default
 *   Access Table. The `canAccessAlert` predicate (4.1 Q5) evaluates
 *   (persona, featureDomain) — NOT just zone — to gate alert visibility.
 * - `resolutionHref` is the deep-link to the source-native workflow
 *   (0.3 Q9 AC 41: "The inbox does not replace detailed section-native
 *   workflows").
 * - `sourceRecord` is the raw resolver payload used for richer rendering
 *   in client surfaces. Kept as `unknown` to avoid cross-module type
 *   coupling; resolvers narrow it per source.
 */
export interface AlertItem {
  alertId: string;
  associationId: string;
  associationName: string;
  zone: ZoneLabel;
  featureDomain: string;
  ruleType: AlertRuleType;
  recordType: string;
  recordId: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  createdAt: Date;
  resolutionHref: string;
  sourceRecord: unknown;
}

/**
 * Per-user read/dismiss state for a single alertId. Joined into the
 * endpoint response as `readStateBy: Record<alertId, AlertReadStateEntry>`.
 */
export interface AlertReadStateEntry {
  readAt: Date | null;
  dismissedAt: Date | null;
}

/**
 * Feature-domain IDs for the 0.2 PM-Managed Default Access Table. Kept
 * as string literals here (not a pgEnum) so Wave 2 can ship without a
 * schema migration for the domain list. Wave 3+ may promote this to a
 * typed enum once the PM toggle config UI lands.
 */
export const FEATURE_DOMAINS = {
  FINANCIALS_REPORTS: "financials.reports",
  FINANCIALS_DELINQUENCY: "financials.delinquency",
  OPERATIONS_MAINTENANCE_REQUESTS: "operations.maintenance-requests",
  OPERATIONS_WORK_ORDERS: "operations.work-orders",
  GOVERNANCE_DOCUMENTS: "governance.documents",
  GOVERNANCE_ELECTIONS: "governance.elections",
  // Tier 2 (Wave 3 — Tier 2 alert sources PR). Feature-domain IDs for
  // the Tier 2 catalog. `vendors` and `governance-compliance` are not
  // currently rows in the 0.2 PM-Managed Default Access Table; they
  // default-allow Manager / Platform-Admin only via the role-only
  // fallback in `canAccessAlert` until the PM toggle-config UI lands.
  VENDORS: "vendors",
  GOVERNANCE_COMPLIANCE: "governance-compliance",
} as const;

export type FeatureDomain = (typeof FEATURE_DOMAINS)[keyof typeof FEATURE_DOMAINS];

/**
 * 4.1 Wave 3 — rule-type → feature-domain lookup.
 *
 * Each Tier 1 resolver emits alerts for a single feature domain, so the
 * deterministic `alertId` prefix is sufficient to recover the domain
 * without having to regenerate the full alert set. Used by the
 * read/dismiss mutation endpoints (Wave 3) to gate writes through
 * `canAccessAlert` without re-running the aggregation pipeline.
 */
export const RULE_TYPE_FEATURE_DOMAIN: Readonly<Record<AlertRuleType, FeatureDomain>> = {
  // Tier 1 (Wave 2).
  "overdue-work-order": FEATURE_DOMAINS.OPERATIONS_WORK_ORDERS,
  "due-maintenance": FEATURE_DOMAINS.OPERATIONS_MAINTENANCE_REQUESTS,
  "active-election": FEATURE_DOMAINS.GOVERNANCE_ELECTIONS,
  "delinquent-ledger-balance": FEATURE_DOMAINS.FINANCIALS_DELINQUENCY,
  "expiring-governance-document": FEATURE_DOMAINS.GOVERNANCE_DOCUMENTS,
  // Tier 2 (Wave 3 — Tier 2 alert sources PR).
  "vendor-contract-renewal": FEATURE_DOMAINS.VENDORS,
  "insurance-expiry": FEATURE_DOMAINS.GOVERNANCE_COMPLIANCE,
  "budget-variance": FEATURE_DOMAINS.FINANCIALS_REPORTS,
  "unpaid-late-fee": FEATURE_DOMAINS.FINANCIALS_DELINQUENCY,
};

/**
 * Parse a deterministic `alertId` (`${ruleType}:${recordType}:${recordId}`)
 * into its parts. Returns `null` if the id is malformed or references an
 * unknown ruleType — the caller should treat that as a 404.
 */
export function parseAlertId(
  alertId: string,
): { ruleType: AlertRuleType; recordType: string; recordId: string } | null {
  const firstColon = alertId.indexOf(":");
  if (firstColon <= 0) return null;
  const secondColon = alertId.indexOf(":", firstColon + 1);
  if (secondColon <= firstColon + 1) return null;
  const ruleType = alertId.slice(0, firstColon) as AlertRuleType;
  const recordType = alertId.slice(firstColon + 1, secondColon);
  const recordId = alertId.slice(secondColon + 1);
  if (!recordType || !recordId) return null;
  if (!(ruleType in RULE_TYPE_FEATURE_DOMAIN)) return null;
  return { ruleType, recordType, recordId };
}
