/**
 * 4.1 Tier 1 resolver — due maintenance schedule instances (4.1 Q1 / 0.1 AC 4).
 *
 * "Due" matches the existing `/api/dashboard/alerts` semantics:
 *   status != 'completed' AND due_at < NOW() + 7 days
 *
 * Resolver assigns:
 *   zone          = "operations"
 *   featureDomain = "operations.maintenance-requests"
 *   ruleType      = "due-maintenance"
 *   recordType    = "maintenance_schedule_instances"
 *   recordId      = instance.id
 *
 * The deterministic `alertId` is therefore
 *   `due-maintenance:maintenance_schedule_instances:<id>`
 * per 4.1 Q7.
 *
 * Wave 16b (5.4-F1): `resolveMany` collapses the per-association storage
 * fan-out into a single call. `resolve()` is preserved as a thin wrapper.
 */

import { storage } from "../../storage";
import type { AlertItem, AlertSeverity } from "../types";
import { FEATURE_DOMAINS } from "../types";

const DUE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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
  const dueCutoff = new Date(now.getTime() + DUE_WINDOW_MS);
  const nameById = new Map(associations.map((a) => [a.id, a.name]));

  const allInstances =
    associations.length === 1
      ? await storage.getMaintenanceScheduleInstances({ associationId: associations[0].id })
      : await storage.getMaintenanceScheduleInstances();

  return allInstances
    .filter((msi) => nameById.has(msi.associationId))
    .filter((msi) => {
      if (msi.status === "completed") return false;
      return new Date(msi.dueAt) < dueCutoff;
    })
    .map((msi): AlertItem => {
      const dueAt = new Date(msi.dueAt);
      const overdue = dueAt < now;
      const severity: AlertSeverity = overdue ? "high" : "medium";
      return {
        alertId: `due-maintenance:maintenance_schedule_instances:${msi.id}`,
        associationId: msi.associationId,
        associationName: nameById.get(msi.associationId) ?? "",
        zone: "operations",
        featureDomain: FEATURE_DOMAINS.OPERATIONS_MAINTENANCE_REQUESTS,
        ruleType: "due-maintenance",
        recordType: "maintenance_schedule_instances",
        recordId: msi.id,
        severity,
        title: `${overdue ? "Overdue" : "Upcoming"} maintenance: ${msi.title}`,
        description: `Due ${dueAt.toISOString().slice(0, 10)} at ${msi.locationText}.`,
        createdAt: new Date(msi.createdAt),
        resolutionHref: `/app/operations/maintenance/${msi.id}`,
        sourceRecord: msi,
      };
    });
}

export async function resolve(
  associationId: string,
  context: ResolveContext,
): Promise<AlertItem[]> {
  return resolveMany([{ id: associationId, name: context.associationName }], { now: context.now });
}
