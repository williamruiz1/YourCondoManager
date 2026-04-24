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
 * Rule-type discriminator for the Tier 1 catalog (4.1 Q1 resolution).
 * The `ruleType` is the first segment of the deterministic `alertId`
 * (`${ruleType}:${recordType}:${recordId}`) so the identifier remains
 * stable across surfaces.
 */
export type AlertRuleType =
  | "overdue-work-order"
  | "due-maintenance"
  | "active-election"
  | "delinquent-ledger-balance"
  | "expiring-governance-document";

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
} as const;

export type FeatureDomain = (typeof FEATURE_DOMAINS)[keyof typeof FEATURE_DOMAINS];
