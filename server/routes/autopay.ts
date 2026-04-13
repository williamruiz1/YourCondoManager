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
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import {
  autopayEnrollments,
  autopayRuns,
  insertAutopayEnrollmentSchema,
  ownerLedgerEntries,
  persons,
  units,
} from "@shared/schema";

// ── Re-usable types (mirrored from routes.ts) ────────────────────────────────

type AdminRole = "platform-admin" | "board-admin" | "manager" | "viewer";

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
    requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]),
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
          })
          .from(autopayEnrollments)
          .leftJoin(units, eq(autopayEnrollments.unitId, units.id))
          .leftJoin(persons, eq(autopayEnrollments.personId, persons.id))
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
    requireAdminRole(["platform-admin", "board-admin", "manager"]),
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
    requireAdminRole(["platform-admin", "board-admin", "manager"]),
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
    requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]),
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
    requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]),
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
    requireAdminRole(["platform-admin", "board-admin", "manager"]),
    async (req: AdminRequest, res: Response) => {
      try {
        const { associationId } = req.body as { associationId: string };
        if (!associationId) return res.status(400).json({ message: "associationId is required" });
        assertAssociationInputScope(req, associationId);

        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);

        // Find active enrollments due today or earlier
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

        for (const enrollment of dueNow) {
          try {
            // Determine amount: use stored amount (already required not null in schema)
            const chargeAmount = Math.abs(enrollment.amount);

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
                referenceType: "autopay_enrollment",
                referenceId: enrollment.id,
              })
              .returning();

            await db.insert(autopayRuns).values({
              enrollmentId: enrollment.id,
              associationId,
              amount: chargeAmount,
              status: "success",
              ledgerEntryId: entry.id,
              ranAt: now,
            });

            // Advance nextPaymentDate
            const next = advanceDate(now, enrollment.frequency, enrollment.dayOfMonth ?? 1);
            await db
              .update(autopayEnrollments)
              .set({ nextPaymentDate: next, updatedAt: new Date() })
              .where(eq(autopayEnrollments.id, enrollment.id));

            succeeded++;
          } catch (err: any) {
            await db.insert(autopayRuns).values({
              enrollmentId: enrollment.id,
              associationId,
              amount: enrollment.amount,
              status: "failed",
              errorMessage: err.message,
              ranAt: now,
            });
            failed++;
          }
        }

        res.json({ succeeded, failed, totalDue: dueNow.length, processedAt: now.toISOString() });
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
        const { amount, frequency, dayOfMonth, description, unitId } = req.body as {
          amount: number;
          frequency: string;
          dayOfMonth: number;
          description?: string;
          unitId: string;
        };
        if (!unitId) return res.status(400).json({ message: "unitId is required" });
        if (!amount || amount <= 0) return res.status(400).json({ message: "amount must be positive" });

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
