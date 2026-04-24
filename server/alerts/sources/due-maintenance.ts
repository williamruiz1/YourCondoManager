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
 */

import { storage } from "../../storage";
import type { AlertItem } from "../types";
import { FEATURE_DOMAINS } from "../types";

const DUE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function resolve(
  associationId: string,
  context: { associationName: string; now?: Date },
): Promise<AlertItem[]> {
  const now = context.now ?? new Date();
  const dueCutoff = new Date(now.getTime() + DUE_WINDOW_MS);
  const instances = await storage.getMaintenanceScheduleInstances({ associationId });

  return instances
    .filter((msi) => {
      if (msi.status === "completed") return false;
      return new Date(msi.dueAt) < dueCutoff;
    })
    .map((msi): AlertItem => {
      const dueAt = new Date(msi.dueAt);
      const overdue = dueAt < now;
      const severity = overdue ? "high" : "medium";
      return {
        alertId: `due-maintenance:maintenance_schedule_instances:${msi.id}`,
        associationId: msi.associationId,
        associationName: context.associationName,
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
