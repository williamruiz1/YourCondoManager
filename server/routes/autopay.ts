/**
 * Autopay Enrollment & Recurring Collection Routes
 *
 * Admin routes:
 *   GET  /api/financial/autopay/enrollments          — list enrollments with unit/person detail
 *   POST /api/financial/autopay/enrollments          — create enrollment (admin-side)
 *   PATCH /api/financial/autopay/enrollments/:id     — update (pause/resume/cancel/change freq)
 *   GET  /api/financial/autopay/enrollments/:id/runs — run history for a single enrollment
 *   GET  /api/financial/autopay/runs                 — all runs for the association
 *   POST /api/financial/autopay/run                  — trigger collection run
 *
 * Portal routes:
 *   GET  /api/portal/autopay/enrollments             — list enrollments for logged-in owner
 *   POST /api/portal/autopay/enroll                  — create enrollment
 *   PATCH /api/portal/autopay/enrollments/:id        — pause/resume/cancel own enrollment
 *   GET  /api/portal/autopay/enrollments/:id/runs    — run history for own enrollment
 */

import type { Express, NextFunction, Request, Response } from "express";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  autopayEnrollments,
  autopayRuns,
  insertAutopayEnrollmentSchema,
  ownerLedgerEntries,
  paymentTransactions,
  persons,
  savedPaymentMethods,
  units,
} from "@shared/schema";
import { storage } from "../storage";
import {
  createPaymentTransaction,
  chargeOffSession,
  updatePaymentTransactionStatus,
} from "../services/payment-service";
import { markTransactionForRetry, getDelinquencySettings } from "../services/retry-service";

// ── Re-usable types (mirrored from routes.ts) ────────────────────────────────

type AdminRole = "platform-admin" | "board-officer" | "assisted-board" | "pm-assistant" | "manager" | "viewer";

export type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

export type PortalRequest = Request & {
  portalAccessId?: string;
  portalAssociationId?: string;
  portalPersonId?: string;
  portalUnitId?: string | null;
  portalEmail?: string;
  portalRole?: string;
  portalBoardRoleId?: string | null;
  portalHasBoardAccess?: boolean;
  portalEffectiveRole?: string;
};

// ── Helpers passed in from the main router ────────────────────────────────────

export interface AutopayRouteHelpers {
  requireAdmin: (req: any, res: Response, next: NextFunction) => any;
  requireAdminRole: (roles: AdminRole[]) => (req: any, res: Response, next: NextFunction) => any;
  requirePortal: (req: any, res: Response, next: NextFunction) => any;
  getAssociationIdQuery: (req: Request) => string | undefined;
  assertAssociationScope: (req: AdminRequest, associationId: string) => void;
  assertAssociationInputScope: (req: AdminRequest, associationId: string | null | undefined) => void;
}

// ── Frequency helpers ─────────────────────────────────────────────────────────

function advanceDate(from: Date, frequency: string, dayOfMonth: number): Date {
  const next = new Date(from);
  if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
  else if (frequency === "quarterly") next.setMonth(next.getMonth() + 3);
  else if (frequency === "annual") next.setFullYear(next.getFullYear() + 1);
  next.setDate(dayOfMonth || 1);
  return next;
}

function computeFirstRunDate(dayOfMonth: number): Date {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), dayOfMonth || 1);
  if (next <= now) next.setMonth(next.getMonth() + 1);
  return next;
}

// ── Phase 2: Autopay Collection Runner (exported for automation sweep) ────────

export async function runAutopayCollectionForAssociation(
  associationId: string,
): Promise<{ succeeded: number; failed: number; skipped: number }> {
  const gateway = await storage.getActivePaymentGatewayConnection({
    associationId,
    provider: "stripe",
  });

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const enrollments = await db
    .select()
    .from(autopayEnrollments)
    .where(
      and(
        eq(autopayEnrollments.associationId, associationId),
        eq(autopayEnrollments.status, "active"),
      ),
    );

  const dueNow = enrollments.filter(
    (e) => !e.nextPaymentDate || new Date(e.nextPaymentDate).toISOString().slice(0, 10) <= todayStr,
  );

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const enrollment of dueNow) {
    try {
      // Dedup: check if already charged this month
      const [existingRun] = await db
        .select()
        .from(autopayRuns)
        .where(
          and(
            eq(autopayRuns.enrollmentId, enrollment.id),
            eq(autopayRuns.status, "success"),
            gte(autopayRuns.ranAt, monthStart),
          ),
        )
        .limit(1);

      if (existingRun) {
        skipped++;
        continue;
      }

      // Check for in-flight transaction this month
      const [existingTxn] = await db
        .select()
        .from(paymentTransactions)
        .where(
          and(
            eq(paymentTransactions.autopayEnrollmentId, enrollment.id),
            inArray(paymentTransactions.status, ["initiated", "pending", "succeeded"]),
            gte(paymentTransactions.createdAt, monthStart),
          ),
        )
        .limit(1);

      if (existingTxn) {
        skipped++;
        continue;
      }

      // Check payment method
      if (!enrollment.paymentMethodId) {
        await db.insert(autopayRuns).values({
          enrollmentId: enrollment.id,
          associationId,
          amount: Math.abs(enrollment.amount),
          status: "skipped",
          errorMessage: "No payment method linked — owner must update autopay settings",
          ranAt: now,
        });
        skipped++;
        continue; // Don't advance nextPaymentDate
      }

      const [method] = await db
        .select()
        .from(savedPaymentMethods)
        .where(eq(savedPaymentMethods.id, enrollment.paymentMethodId))
        .limit(1);

      if (!method || method.status !== "active" || !method.providerPaymentMethodId || !method.providerCustomerId) {
        await db.insert(autopayRuns).values({
          enrollmentId: enrollment.id,
          associationId,
          amount: Math.abs(enrollment.amount),
          status: "skipped",
          errorMessage: "Payment method is not active or not verified",
          ranAt: now,
        });
        skipped++;
        continue;
      }

      if (!gateway?.secretKey) {
        await db.insert(autopayRuns).values({
          enrollmentId: enrollment.id,
          associationId,
          amount: Math.abs(enrollment.amount),
          status: "skipped",
          errorMessage: "Stripe gateway not configured for association",
          ranAt: now,
        });
        skipped++;
        continue;
      }

      const chargeAmount = Math.abs(enrollment.amount);
      const amountCents = Math.round(chargeAmount * 100);

      // Create payment transaction
      const txn = await createPaymentTransaction({
        associationId,
        unitId: enrollment.unitId,
        personId: enrollment.personId,
        amountCents,
        description: enrollment.description || "Autopay HOA dues",
        source: "autopay",
        paymentMethodId: enrollment.paymentMethodId,
        autopayEnrollmentId: enrollment.id,
        isOffSession: true,
      });

      // Charge off-session
      const chargeResult = await chargeOffSession({
        secretKey: gateway.secretKey,
        stripeCustomerId: method.providerCustomerId,
        stripePaymentMethodId: method.providerPaymentMethodId,
        amountCents,
        currency: "usd",
        description: enrollment.description || "Autopay HOA dues",
        associationId,
        personId: enrollment.personId,
        unitId: enrollment.unitId,
        transactionId: txn.id,
        enrollmentId: enrollment.id,
      });

      // Update transaction with provider info
      await updatePaymentTransactionStatus({
        transactionId: txn.id,
        providerIntentId: chargeResult.intentId || undefined,
        status: chargeResult.status === "succeeded" ? "succeeded"
          : chargeResult.status === "pending" ? "pending"
          : "failed",
        failureCode: chargeResult.failureCode,
        failureReason: chargeResult.failureReason,
      });

      // Create ledger entry only if immediately succeeded
      let ledgerEntryId: string | null = null;
      if (chargeResult.status === "succeeded") {
        const [entry] = await db
          .insert(ownerLedgerEntries)
          .values({
            associationId,
            unitId: enrollment.unitId,
            personId: enrollment.personId,
            entryType: "payment",
            amount: -chargeAmount,
            postedAt: now,
            description: enrollment.description || "Autopay HOA dues",
            referenceType: "autopay_payment_transaction",
            referenceId: txn.id,
          })
          .returning();
        ledgerEntryId = entry.id;
      }

      // Record the run
      const runStatus = chargeResult.status === "failed" ? "failed" as const : "success" as const;
      await db.insert(autopayRuns).values({
        enrollmentId: enrollment.id,
        associationId,
        amount: chargeAmount,
        status: runStatus,
        ledgerEntryId,
        paymentTransactionId: txn.id,
        errorMessage: chargeResult.failureReason ?? null,
        ranAt: now,
      });

      // Advance nextPaymentDate
      const next = advanceDate(now, enrollment.frequency, enrollment.dayOfMonth ?? 1);
      await db
        .update(autopayEnrollments)
        .set({ nextPaymentDate: next, updatedAt: new Date() })
        .where(eq(autopayEnrollments.id, enrollment.id));

      if (chargeResult.status === "failed") {
        // Phase 3: classify failure and mark for retry if eligible
        try {
          const settings = await getDelinquencySettings(associationId);
          await markTransactionForRetry(txn.id, chargeResult.failureCode, chargeResult.failureReason, settings);
        } catch (retryErr) {
          console.error("[autopay] Failed to mark for retry:", retryErr);
        }
        failed++;
      } else {
        succeeded++;
      }
    } catch (err: any) {
      await db.insert(autopayRuns).values({
        enrollmentId: enrollment.id,
        associationId,
        amount: Math.abs(enrollment.amount),
        status: "failed",
        errorMessage: err.message,
        ranAt: now,
      });
      failed++;
    }
  }

  return { succeeded, failed, skipped };
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerAutopayRoutes(app: Express, helpers: AutopayRouteHelpers): void {
  const {
    requireAdmin,
    requireAdminRole,
    requirePortal,
    getAssociationIdQuery,
    assertAssociationScope,
    assertAssociationInputScope,
  } = helpers;

  // ── Admin: list enrollments with joined unit/person ─────────────────────────

  app.get(
    "/api/financial/autopay/enrollments",
    requireAdmin as any,
    requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"]),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) return res.status(400).json({ message: "associationId is required" });
        assertAssociationScope(req, associationId);

        const rows = await db
          .select({
            enrollment: autopayEnrollments,
            unit: { id: units.id, unitNumber: units.unitNumber, building: units.building },
            person: { id: persons.id, firstName: persons.firstName, lastName: persons.lastName, email: persons.email },
            paymentMethod: { displayName: savedPaymentMethods.displayName, status: savedPaymentMethods.status },
          })
          .from(autopayEnrollments)
          .leftJoin(units, eq(autopayEnrollments.unitId, units.id))
          .leftJoin(persons, eq(autopayEnrollments.personId, persons.id))
          .leftJoin(savedPaymentMethods, eq(autopayEnrollments.paymentMethodId, savedPaymentMethods.id))
          .where(eq(autopayEnrollments.associationId, associationId))
          .orderBy(desc(autopayEnrollments.enrolledAt));

        res.json(rows);
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    },
  );

  // ── Admin: create enrollment ────────────────────────────────────────────────

  app.post(
    "/api/financial/autopay/enrollments",
    requireAdmin as any,
    requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]),
    async (req: AdminRequest, res: Response) => {
      try {
        const parsed = insertAutopayEnrollmentSchema.parse({
          ...req.body,
          enrolledBy: req.adminUserEmail || "unknown",
        });
        assertAssociationInputScope(req, parsed.associationId);
        const nextPaymentDate = computeFirstRunDate(parsed.dayOfMonth ?? 1);
        const [result] = await db
          .insert(autopayEnrollments)
          .values({ ...parsed, nextPaymentDate })
          .returning();
        res.status(201).json(result);
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    },
  );

  // ── Admin: update enrollment (pause/resume/cancel/change) ───────────────────

  app.patch(
    "/api/financial/autopay/enrollments/:id",
    requireAdmin as any,
    requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]),
    async (req: AdminRequest, res: Response) => {
      try {
        const id = req.params.id as string;
        const [existing] = await db
          .select()
          .from(autopayEnrollments)
          .where(eq(autopayEnrollments.id, id))
          .limit(1);
        if (!existing) return res.status(404).json({ message: "Enrollment not found" });
        assertAssociationScope(req, existing.associationId);

        const updates = insertAutopayEnrollmentSchema.partial().parse(req.body);
        const now = new Date();
        const setClauses: Record<string, any> = { ...updates, updatedAt: now };

        if (updates.status === "cancelled") {
          setClauses.cancelledBy = req.adminUserEmail || "unknown";
          setClauses.cancelledAt = now;
        }
        // On resume, recalculate next run date
        if (updates.status === "active" && existing.status === "paused") {
          setClauses.nextPaymentDate = computeFirstRunDate(existing.dayOfMonth ?? 1);
        }

        const [result] = await db
          .update(autopayEnrollments)
          .set(setClauses)
          .where(eq(autopayEnrollments.id, id))
          .returning();
        res.json(result);
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    },
  );

  // ── Admin: run history for a single enrollment ──────────────────────────────

  app.get(
    "/api/financial/autopay/enrollments/:id/runs",
    requireAdmin as any,
    requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"]),
    async (req: AdminRequest, res: Response) => {
      try {
        const id = req.params.id as string;
        const [enrollment] = await db
          .select()
          .from(autopayEnrollments)
          .where(eq(autopayEnrollments.id, id))
          .limit(1);
        if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });
        assertAssociationScope(req, enrollment.associationId);

        const rows = await db
          .select()
          .from(autopayRuns)
          .where(eq(autopayRuns.enrollmentId, id))
          .orderBy(desc(autopayRuns.ranAt));
        res.json(rows);
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    },
  );

  // ── Admin: all runs for an association ──────────────────────────────────────

  app.get(
    "/api/financial/autopay/runs",
    requireAdmin as any,
    requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"]),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) return res.status(400).json({ message: "associationId is required" });
        assertAssociationScope(req, associationId);
        const rows = await db
          .select()
          .from(autopayRuns)
          .where(eq(autopayRuns.associationId, associationId))
          .orderBy(desc(autopayRuns.ranAt));
        res.json(rows);
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    },
  );

  // ── Admin: trigger collection run ──────────────────────────────────────────

  app.post(
    "/api/financial/autopay/run",
    requireAdmin as any,
    requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]),
    async (req: AdminRequest, res: Response) => {
      try {
        const { associationId } = req.body as { associationId: string };
        if (!associationId) return res.status(400).json({ message: "associationId is required" });
        assertAssociationInputScope(req, associationId);

        const result = await runAutopayCollectionForAssociation(associationId);
        res.json({ ...result, totalDue: result.succeeded + result.failed + result.skipped, processedAt: new Date().toISOString() });
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    },
  );

  // ── Portal: list enrollments for the logged-in owner ────────────────────────

  app.get(
    "/api/portal/autopay/enrollments",
    requirePortal as any,
    async (req: PortalRequest, res: Response) => {
      try {
        const rows = await db
          .select()
          .from(autopayEnrollments)
          .where(
            and(
              eq(autopayEnrollments.associationId, req.portalAssociationId!),
              eq(autopayEnrollments.personId, req.portalPersonId!),
            ),
          )
          .orderBy(desc(autopayEnrollments.enrolledAt));
        res.json(rows);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );

  // ── Portal: create enrollment ────────────────────────────────────────────────

  app.post(
    "/api/portal/autopay/enroll",
    requirePortal as any,
    async (req: PortalRequest, res: Response) => {
      try {
        const { amount, frequency, dayOfMonth, description, unitId, paymentMethodId } = req.body as {
          amount: number;
          frequency: string;
          dayOfMonth: number;
          description?: string;
          unitId: string;
          paymentMethodId?: string;
        };
        if (!unitId) return res.status(400).json({ message: "unitId is required" });
        if (!amount || amount <= 0) return res.status(400).json({ message: "amount must be positive" });

        // Validate payment method belongs to this owner if provided
        if (paymentMethodId) {
          const [pm] = await db
            .select()
            .from(savedPaymentMethods)
            .where(
              and(
                eq(savedPaymentMethods.id, paymentMethodId),
                eq(savedPaymentMethods.personId, req.portalPersonId!),
                eq(savedPaymentMethods.associationId, req.portalAssociationId!),
                eq(savedPaymentMethods.isActive, 1),
              ),
            )
            .limit(1);
          if (!pm) return res.status(400).json({ message: "Invalid or inactive payment method" });
        }

        // Check for duplicate active enrollment
        const [existing] = await db
          .select()
          .from(autopayEnrollments)
          .where(
            and(
              eq(autopayEnrollments.associationId, req.portalAssociationId!),
              eq(autopayEnrollments.personId, req.portalPersonId!),
              eq(autopayEnrollments.unitId, unitId),
              eq(autopayEnrollments.status, "active"),
            ),
          )
          .limit(1);
        if (existing) return res.status(409).json({ message: "Autopay already active for this unit" });

        const day = dayOfMonth || 1;
        const nextPaymentDate = computeFirstRunDate(day);

        const [enrollment] = await db
          .insert(autopayEnrollments)
          .values({
            associationId: req.portalAssociationId!,
            unitId,
            personId: req.portalPersonId!,
            paymentMethodId: paymentMethodId ?? null,
            amount,
            frequency: (frequency || "monthly") as "monthly" | "quarterly" | "annual",
            dayOfMonth: day,
            status: "active",
            nextPaymentDate,
            description: description || "Autopay HOA dues",
            enrolledBy: req.portalPersonId!,
          })
          .returning();
        res.status(201).json(enrollment);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );

  // ── Portal: update own enrollment (pause/resume/cancel) ─────────────────────

  app.patch(
    "/api/portal/autopay/enrollments/:id",
    requirePortal as any,
    async (req: PortalRequest, res: Response) => {
      try {
        const id = req.params.id as string;
        const [enrollment] = await db
          .select()
          .from(autopayEnrollments)
          .where(eq(autopayEnrollments.id, id))
          .limit(1);
        if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });
        if (enrollment.personId !== req.portalPersonId)
          return res.status(403).json({ message: "Not authorized" });

        const { status, amount, frequency, dayOfMonth } = req.body as {
          status?: "active" | "paused" | "cancelled";
          amount?: number;
          frequency?: string;
          dayOfMonth?: number;
        };

        const now = new Date();
        const setClauses: Record<string, any> = { updatedAt: now };

        if (status) {
          setClauses.status = status;
          if (status === "cancelled") {
            setClauses.cancelledBy = req.portalPersonId!;
            setClauses.cancelledAt = now;
          }
          if (status === "active" && enrollment.status === "paused") {
            setClauses.nextPaymentDate = computeFirstRunDate(enrollment.dayOfMonth ?? 1);
          }
        }
        if (amount && amount > 0) setClauses.amount = amount;
        if (frequency) setClauses.frequency = frequency;
        if (dayOfMonth) {
          setClauses.dayOfMonth = dayOfMonth;
          setClauses.nextPaymentDate = computeFirstRunDate(dayOfMonth);
        }

        const [result] = await db
          .update(autopayEnrollments)
          .set(setClauses)
          .where(eq(autopayEnrollments.id, id))
          .returning();
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );

  // ── Portal: run history for a single enrollment ──────────────────────────────

  app.get(
    "/api/portal/autopay/enrollments/:id/runs",
    requirePortal as any,
    async (req: PortalRequest, res: Response) => {
      try {
        const id = req.params.id as string;
        const [enrollment] = await db
          .select()
          .from(autopayEnrollments)
          .where(eq(autopayEnrollments.id, id))
          .limit(1);
        if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });
        if (enrollment.personId !== req.portalPersonId)
          return res.status(403).json({ message: "Not authorized" });

        const rows = await db
          .select()
          .from(autopayRuns)
          .where(eq(autopayRuns.enrollmentId, id))
          .orderBy(desc(autopayRuns.ranAt));
        res.json(rows);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );
}
