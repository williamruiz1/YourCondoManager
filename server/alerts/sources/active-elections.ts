/**
 * 4.1 Tier 1 resolver — active elections needing board attention (4.1 Q1).
 *
 * "Active" = elections whose `status` is `open` or `closing-soon` (closing
 * within 7 days), i.e. they require board awareness and may require
 * certification after close.
 *
 * Resolver assigns:
 *   zone          = "governance"
 *   featureDomain = "governance.elections"
 *   ruleType      = "active-election"
 *   recordType    = "elections"
 *   recordId      = election.id
 *
 * Wave 16b (5.4-F1): added `resolveMany` for batched fan-out across the
 * permitted-association list. `resolve()` preserved as a thin wrapper.
 */

import { storage } from "../../storage";
import type { AlertItem, AlertSeverity } from "../types";
import { FEATURE_DOMAINS } from "../types";

const CLOSING_SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Election statuses that warrant surfacing in the cross-association alert
// engine. Draft/cancelled/completed/certified elections do not need board
// attention. We cover open voting windows and elections awaiting
// certification after their close date.
const ACTIVE_ELECTION_STATUSES = new Set([
  "nominations-open",
  "nominations-closed",
  "voting-open",
  "voting-closed",
  "awaiting-certification",
  "open",
]);

export interface AssociationContext {
  id: string;
  name: string;
}

export interface ResolveContext {
  associationName: string;
  now?: Date;
}

export interface ResolveManyContext {
  now?: Date;
}

export async function resolveMany(
  associations: AssociationContext[],
  context: ResolveManyContext = {},
): Promise<AlertItem[]> {
  if (associations.length === 0) return [];
  const now = context.now ?? new Date();
  const closingCutoff = new Date(now.getTime() + CLOSING_SOON_WINDOW_MS);
  const nameById = new Map(associations.map((a) => [a.id, a.name]));

  // Single-assoc path: keep `(associationId)` filter so legacy per-source
  // tests that don't differentiate by argument still match. Multi-assoc:
  // one call, JS-grouped by associationId.
  const allElections =
    associations.length === 1
      ? await storage.getElections(associations[0].id)
      : await storage.getElections();

  return allElections
    .filter((e) => nameById.has(e.associationId))
    .filter((e) => ACTIVE_ELECTION_STATUSES.has(e.status))
    .map((e): AlertItem => {
      const closesAt = e.closesAt ? new Date(e.closesAt) : null;
      const closesSoon = closesAt !== null && closesAt > now && closesAt < closingCutoff;
      const awaitingCert = closesAt !== null && closesAt < now && !e.certifiedAt;
      const severity: AlertSeverity = awaitingCert ? "high" : closesSoon ? "medium" : "low";
      const descriptionBits: string[] = [];
      if (e.opensAt) descriptionBits.push(`opens ${new Date(e.opensAt).toISOString().slice(0, 10)}`);
      if (closesAt) descriptionBits.push(`closes ${closesAt.toISOString().slice(0, 10)}`);
      if (awaitingCert) descriptionBits.push("awaiting certification");
      return {
        alertId: `active-election:elections:${e.id}`,
        associationId: e.associationId,
        associationName: nameById.get(e.associationId) ?? "",
        zone: "governance",
        featureDomain: FEATURE_DOMAINS.GOVERNANCE_ELECTIONS,
        ruleType: "active-election",
        recordType: "elections",
        recordId: e.id,
        severity,
        title: `Active election: ${e.title}`,
        description: descriptionBits.join(" · ") || e.description || "Active election",
        createdAt: new Date(e.createdAt),
        resolutionHref: `/app/governance/elections/${e.id}`,
        sourceRecord: e,
      };
    });
}

export async function resolve(
  associationId: string,
  context: ResolveContext,
): Promise<AlertItem[]> {
  return resolveMany([{ id: associationId, name: context.associationName }], { now: context.now });
}
