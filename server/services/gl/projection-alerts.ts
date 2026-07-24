import { eq } from "drizzle-orm";
import { db } from "../../db";
import { financialAlerts } from "@shared/schema";

const ENTITY_TYPE = "gl-projection";
const ENTITY_ID = "owner-ledger-continuity";

function alertId(associationId: string): string {
  return `gl-projection-${associationId}`;
}

function messageForReason(reason: "reconcile-failed" | "error"): string {
  return reason === "reconcile-failed"
    ? "The owner ledger and accounting journal do not reconcile. Automatic financial-statement updates are paused for this association and will retry every automation cycle."
    : "An owner-ledger accounting journal could not be completed. The payment remains recorded in the owner ledger; YCM will retry the accounting projection automatically.";
}

/**
 * Persist one deterministic, association-scoped alert for an owner-ledger →
 * GL continuity failure. The deterministic primary key makes concurrent
 * webhook paths converge on one alert without a new schema constraint.
 *
 * No owner, unit, payment, amount, provider identifier, or raw error text is
 * stored in the alert. Operators can use the aggregate audit tooling for
 * diagnostics without exposing private financial data.
 */
export async function recordGlProjectionFailure(
  associationId: string,
  reason: "reconcile-failed" | "error",
): Promise<void> {
  await db
    .insert(financialAlerts)
    .values({
      id: alertId(associationId),
      associationId,
      alertType: "audit_anomaly",
      severity: "critical",
      title: "Accounting journal continuity failure",
      message: messageForReason(reason),
      entityType: ENTITY_TYPE,
      entityId: ENTITY_ID,
      isRead: 0,
      isDismissed: 0,
      dismissedBy: null,
      dismissedAt: null,
    })
    .onConflictDoUpdate({
      target: financialAlerts.id,
      set: {
        severity: "critical",
        title: "Accounting journal continuity failure",
        message: messageForReason(reason),
        entityType: ENTITY_TYPE,
        entityId: ENTITY_ID,
        isRead: 0,
        isDismissed: 0,
        dismissedBy: null,
        dismissedAt: null,
      },
    });
}

/**
 * Resolve the continuity alert only after the canonical sync completes
 * successfully. Keeping the same deterministic row preserves the incident
 * history while removing it from the active-alert view.
 */
export async function resolveGlProjectionFailure(
  associationId: string,
): Promise<void> {
  await db
    .update(financialAlerts)
    .set({
      isDismissed: 1,
      dismissedBy: "system:gl-projection-reconciler",
      dismissedAt: new Date(),
    })
    .where(eq(financialAlerts.id, alertId(associationId)));
}

