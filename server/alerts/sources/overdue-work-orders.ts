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
 *
 * Wave 16b (5.4-F1): added `resolveMany(associations[])` so the orchestrator
 * runs ONE storage call covering all permitted associations instead of N
 * per-association calls. `resolve()` is preserved as a thin wrapper for
 * backward compatibility with the existing per-source tests; for the
 * single-association case we still pass `{associationId}` to the storage
 * filter so existing tests keep working.
 */

import { storage } from "../../storage";
import type { AlertItem, AlertSeverity } from "../types";
import { FEATURE_DOMAINS } from "../types";

const ACTIVE_WORK_ORDER_STATUSES = new Set(["open", "assigned", "in-progress", "pending-review"]);

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
  const nameById = new Map(associations.map((a) => [a.id, a.name]));

  // Single-assoc path: keep `{associationId}` filter so legacy per-source
  // mocks that branch on `filters.associationId` still match. Multi-assoc
  // path: one storage call covering everything (the F1 optimization).
  const allWorkOrders =
    associations.length === 1
      ? await storage.getWorkOrders({ associationId: associations[0].id })
      : await storage.getWorkOrders();

  return allWorkOrders
    .filter((wo) => nameById.has(wo.associationId))
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
      const severity: AlertSeverity =
        wo.priority === "urgent" ? "critical" : daysOverdue >= 7 ? "high" : "medium";
      return {
        alertId: `overdue-work-order:work_orders:${wo.id}`,
        associationId: wo.associationId,
        associationName: nameById.get(wo.associationId) ?? "",
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

export async function resolve(
  associationId: string,
  context: ResolveContext,
): Promise<AlertItem[]> {
  return resolveMany([{ id: associationId, name: context.associationName }], { now: context.now });
}
