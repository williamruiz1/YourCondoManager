/**
 * 4.1 Tier 1 resolver — overdue work orders (4.1 Q1 / 0.1 AC 4).
 *
 * "Overdue" matches the existing `/api/dashboard/alerts` semantics:
 *   status IN ('open', 'assigned', 'in-progress', 'pending-review')
 *   AND scheduled_for < NOW()
 *
 * YCM's `work_orders` table has no `due_date` column; `scheduled_for` is
 * the closest available field and is already used as the overdue signal
 * elsewhere in `server/routes.ts`.
 *
 * Resolver assigns:
 *   zone          = "operations"
 *   featureDomain = "operations.work-orders"
 *   ruleType      = "overdue-work-order"
 *   recordType    = "work_orders"
 *   recordId      = work_order.id
 *
 * The deterministic `alertId` is therefore `overdue-work-order:work_orders:<id>`
 * (4.1 Q7), so every surface that renders this alert joins the same
 * read-state row in `alert_read_states`.
 */

import { storage } from "../../storage";
import type { AlertItem } from "../types";
import { FEATURE_DOMAINS } from "../types";

const ACTIVE_WORK_ORDER_STATUSES = new Set(["open", "assigned", "in-progress", "pending-review"]);

export async function resolve(
  associationId: string,
  context: { associationName: string; now?: Date },
): Promise<AlertItem[]> {
  const now = context.now ?? new Date();
  const workOrders = await storage.getWorkOrders({ associationId });

  return workOrders
    .filter((wo) => {
      if (!ACTIVE_WORK_ORDER_STATUSES.has(wo.status)) return false;
      if (!wo.scheduledFor) return false;
      return new Date(wo.scheduledFor) < now;
    })
    .map((wo): AlertItem => {
      const scheduledFor = wo.scheduledFor ? new Date(wo.scheduledFor) : now;
      const daysOverdue = Math.max(
        1,
        Math.floor((now.getTime() - scheduledFor.getTime()) / (24 * 60 * 60 * 1000)),
      );
      const severity = wo.priority === "urgent" ? "critical" : daysOverdue >= 7 ? "high" : "medium";
      return {
        alertId: `overdue-work-order:work_orders:${wo.id}`,
        associationId: wo.associationId,
        associationName: context.associationName,
        zone: "operations",
        featureDomain: FEATURE_DOMAINS.OPERATIONS_WORK_ORDERS,
        ruleType: "overdue-work-order",
        recordType: "work_orders",
        recordId: wo.id,
        severity,
        title: `Overdue work order: ${wo.title}`,
        description: `Scheduled for ${scheduledFor.toISOString().slice(0, 10)} — ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue.`,
        createdAt: new Date(wo.createdAt),
        resolutionHref: `/app/operations/work-orders/${wo.id}`,
        sourceRecord: wo,
      };
    });
}
