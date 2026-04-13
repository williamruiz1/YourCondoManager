import type { Express, NextFunction, Request, Response } from "express";
import { and, eq, lte, desc, sum, sql } from "drizzle-orm";
import { db } from "../db";
import {
  autopayEnrollments,
  autopayRuns,
  ownerLedgerEntries,
  units,
  persons,
  insertAutopayEnrollmentSchema,
} from "@shared/schema";

type AdminRole = "platform-admin" | "board-admin" | "manager" | "viewer";
type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};
type PortalRequest = Request & {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMiddleware = (req: any, res: any, next: NextFunction) => any;
type RoleMiddlewareFactory = (roles: AdminRole[]) => AnyMiddleware;

function assertAssociationScope(req: AdminRequest, associationId: string) {
  if (req.adminRole === "platform-admin") return;
  if (!req.adminScopedAssociationIds?.includes(associationId)) {
    throw new Error("Not authorized for this association");
  }
}

function assertAssociationInputScope(req: AdminRequest, associationId: string) {
  assertAssociationScope(req, associationId);
}

function getAssociationIdQuery(req: AdminRequest): string | undefined {
  const v = req.query.associationId;
  if (!v) return undefined;
  if (Array.isArray(v)) return v[0] as string;
  if (typeof v === "string") return v;
  return undefined;
}

export function registerAutopayRoutes(
  app: Express,
  requireAdmin: AnyMiddleware,
  requireAdminRole: RoleMiddlewareFactory,
  requirePortal: AnyMiddleware,
) {
  // ── Admin: list enrollments with unit/person details ──────────────────────

  app.get(
    "/api/financial/autopay/enrollments",
    requireAdmin,
    requireAdminRole(["platform-admin", "board-admin", "manager", "viewer"]),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) return res.status(400).json({ message: "associationId is required" });
        assertAssociationScope(req, associationId);

        const rows = await db
          .select({
            id: autopayEnrollments.id,
            associationId: autopayEnrollments.associationId,
            unitId: autopayEnrollments.unitId,
            personId: autopayEnrollments.personId,
            amount: autopayEnrollments.amount,
            frequency: autopayEnrollments.frequency,
            dayOfMonth: autopayEnrollments.dayOfMonth,
            status: autopayEnrollments.status,
            nextPaymentDate: autopayEnrollments.nextPaymentDate,
            description: autopayEnrollments.description,
            enrolledBy: autopayEnrollments.enrolledBy,
            enrolledAt: autopayEnrollments.enrolledAt,
            cancelledBy: autopayEnrollments.cancelledBy,
            cancelledAt: autopayEnrollments.cancelledAt,
            createdAt: autopayEnrollments.createdAt,
            updatedAt: autopayEnrollments.updatedAt,
            unitNumber: units.unitNumber,
            building: units.building,
            personFirstName: persons.firstName,
            personLastName: persons.lastName,
            personEmail: persons.email,
          })
          .from(autopayEnrollments)
          .leftJoin(units, eq(autopayEnrollments.unitId, units.id))
          .leftJoin(persons, eq(autopayEnrollments.personId, persons.id))
          .where(eq(autopayEnrollments.associationId, associationId))
          .orderBy(desc(autopayEnrollments.createdAt));

        res.json(rows);
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    },
  );

  // ── Admin: get run history for a single enrollment ─────────────────────────

  app.get(
    "/api/financial/autopay/enrollments/:id/runs",
    requireAdmin,
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

  // ── Admin: update enrollment (pause/resume/cancel/change frequency/amount) ─

  app.patch(
    "/api/financial/autopay/enrollments/:id",
    requireAdmin,
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
        const setClauses: Partial<typeof existing> & { updatedAt: Date } = {
          ...updates,
          updatedAt: now,
        };

        if (updates.status === "cancelled") {
          (setClauses as any).cancelledBy = req.adminUserEmail || "unknown";
          (setClauses as any).cancelledAt = now;
        }

        // Recalculate nextPaymentDate when resuming or changing frequency
        if (updates.status === "active" || updates.frequency || updates.dayOfMonth) {
          const freq = updates.frequency ?? existing.frequency;
          const day = updates.dayOfMonth ?? existing.dayOfMonth ?? 1;
          const next = new Date(now.getFullYear(), now.getMonth(), day);
          if (next <= now) next.setMonth(next.getMonth() + 1);
          (setClauses as any).nextPaymentDate = next;
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

  // ── Admin: trigger collection run ─────────────────────────────────────────

  app.post(
    "/api/financial/autopay/run",
    requireAdmin,
    requireAdminRole(["platform-admin", "board-admin", "manager"]),
    async (req: AdminRequest, res: Response) => {
      try {
        const { associationId } = req.body as { associationId: string };
        if (!associationId) return res.status(400).json({ message: "associationId is required" });
        assertAssociationInputScope(req, associationId);

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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
          (e) => !e.nextPaymentDate || new Date(e.nextPaymentDate) <= today,
        );

        let succeeded = 0;
        let failed = 0;
        let skipped = 0;

        for (const enrollment of enrollments) {
          if (!dueNow.find((d) => d.id === enrollment.id)) {
            skipped++;
            continue;
          }

          try {
            // Compute amount: use stored amount (no null in schema, always has value)
            const payAmount = enrollment.amount;

            // Create ledger entry (payment)
            const [entry] = await db
              .insert(ownerLedgerEntries)
              .values({
                associationId,
                unitId: enrollment.unitId,
                personId: enrollment.personId,
                entryType: "payment",
                amount: -Math.abs(payAmount),
                postedAt: now,
                description: enrollment.description,
                referenceType: "autopay_enrollment",
                referenceId: enrollment.id,
              })
              .returning();

            // Record successful run
            await db.insert(autopayRuns).values({
              enrollmentId: enrollment.id,
              associationId,
              amount: payAmount,
              status: "success",
              ledgerEntryId: entry.id,
              ranAt: now,
            });

            // Advance nextPaymentDate
            const next = new Date(now);
            const day = enrollment.dayOfMonth ?? 1;
            if (enrollment.frequency === "monthly") next.setMonth(next.getMonth() + 1);
            else if (enrollment.frequency === "quarterly") next.setMonth(next.getMonth() + 3);
            else if (enrollment.frequency === "annual") next.setFullYear(next.getFullYear() + 1);
            next.setDate(day);

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

        res.json({
          succeeded,
          failed,
          skipped,
          totalActive: enrollments.length,
          totalDue: dueNow.length,
        });
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    },
  );

  // ── Admin: all runs for association ──────────────────────────────────────

  app.get(
    "/api/financial/autopay/runs",
    requireAdmin,
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

  // ── Portal: list enrollments for logged-in user ───────────────────────────

  app.get("/api/portal/autopay/enrollments", requirePortal, async (req: PortalRequest, res: Response) => {
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
        .orderBy(desc(autopayEnrollments.createdAt));
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Keep backward-compat alias used by current portal UI
  app.get("/api/portal/autopay", requirePortal, async (req: PortalRequest, res: Response) => {
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
        .orderBy(desc(autopayEnrollments.createdAt));
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Portal: enroll in autopay ─────────────────────────────────────────────

  app.post("/api/portal/autopay/enroll", requirePortal, async (req: PortalRequest, res: Response) => {
    try {
      const { amount, frequency, dayOfMonth, description, unitId, paymentMethodToken } = req.body as {
        amount?: number;
        frequency?: string;
        dayOfMonth?: number;
        description?: string;
        unitId: string;
        paymentMethodToken?: string;
      };

      if (!unitId) return res.status(400).json({ message: "unitId is required" });

      // Validate frequency
      const validFrequencies = ["monthly", "quarterly", "annual"];
      const freq = frequency || "monthly";
      if (!validFrequencies.includes(freq)) {
        return res.status(400).json({ message: "frequency must be monthly, quarterly, or annual" });
      }

      // Verify unit belongs to portal user's association
      const [unit] = await db
        .select()
        .from(units)
        .where(
          and(
            eq(units.id, unitId),
            eq(units.associationId, req.portalAssociationId!),
          ),
        )
        .limit(1);
      if (!unit) return res.status(404).json({ message: "Unit not found in your association" });

      // Check if already enrolled and active
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

      // Compute next run date
      const now = new Date();
      const day = dayOfMonth || 1;
      const next = new Date(now.getFullYear(), now.getMonth(), day);
      if (next <= now) next.setMonth(next.getMonth() + 1);

      // Default amount to 0 if not provided (will use balance at run time in future)
      const enrollAmount = amount && amount > 0 ? amount : 0;

      const [enrollment] = await db
        .insert(autopayEnrollments)
        .values({
          associationId: req.portalAssociationId!,
          unitId,
          personId: req.portalPersonId!,
          amount: enrollAmount,
          frequency: freq as "monthly" | "quarterly" | "annual",
          dayOfMonth: day,
          status: "active",
          nextPaymentDate: next,
          description: description || "Autopay HOA dues",
          enrolledBy: req.portalPersonId!,
        })
        .returning();

      res.status(201).json(enrollment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Backward-compat alias used by current portal UI
  app.post("/api/portal/enroll-autopay", requirePortal, async (req: PortalRequest, res: Response) => {
    try {
      const { amount, frequency, dayOfMonth, description } = req.body as {
        amount: number;
        frequency: string;
        dayOfMonth: number;
        description?: string;
      };

      // Use the portal unit if available
      const unitId = req.portalUnitId;
      if (!unitId) return res.status(400).json({ message: "No unit linked to your portal access" });

      if (!amount || amount <= 0) return res.status(400).json({ message: "amount must be positive" });

      const validFrequencies = ["monthly", "quarterly", "annual"];
      const freq = frequency || "monthly";
      if (!validFrequencies.includes(freq)) {
        return res.status(400).json({ message: "frequency must be monthly, quarterly, or annual" });
      }

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

      const now = new Date();
      const day = dayOfMonth || 1;
      const next = new Date(now.getFullYear(), now.getMonth(), day);
      if (next <= now) next.setMonth(next.getMonth() + 1);

      const [enrollment] = await db
        .insert(autopayEnrollments)
        .values({
          associationId: req.portalAssociationId!,
          unitId,
          personId: req.portalPersonId!,
          amount,
          frequency: freq as "monthly" | "quarterly" | "annual",
          dayOfMonth: day,
          status: "active",
          nextPaymentDate: next,
          description: description || "Autopay HOA dues",
          enrolledBy: req.portalPersonId!,
        })
        .returning();

      res.status(201).json(enrollment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Portal: update enrollment (pause/resume/cancel/change frequency/amount) ─

  app.patch(
    "/api/portal/autopay/enrollments/:id",
    requirePortal,
    async (req: PortalRequest, res: Response) => {
      try {
        const id = req.params.id as string;
        const [enrollment] = await db
          .select()
          .from(autopayEnrollments)
          .where(eq(autopayEnrollments.id, id))
          .limit(1);
        if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });
        if (enrollment.personId !== req.portalPersonId) {
          return res.status(403).json({ message: "Not authorized" });
        }

        const { status, frequency, amount, dayOfMonth } = req.body as {
          status?: "active" | "paused" | "cancelled";
          frequency?: "monthly" | "quarterly" | "annual";
          amount?: number;
          dayOfMonth?: number;
        };

        const now = new Date();
        const updates: Record<string, unknown> = { updatedAt: now };

        if (status) updates.status = status;
        if (frequency) updates.frequency = frequency;
        if (amount !== undefined) updates.amount = amount;
        if (dayOfMonth !== undefined) updates.dayOfMonth = dayOfMonth;

        if (status === "cancelled") {
          updates.cancelledBy = req.portalPersonId!;
          updates.cancelledAt = now;
        }

        // Recalculate nextPaymentDate when resuming or changing schedule
        if (status === "active" || frequency || dayOfMonth !== undefined) {
          const newFreq = frequency ?? enrollment.frequency;
          const newDay = dayOfMonth ?? enrollment.dayOfMonth ?? 1;
          const next = new Date(now.getFullYear(), now.getMonth(), newDay);
          if (next <= now) next.setMonth(next.getMonth() + 1);
          updates.nextPaymentDate = next;
        }

        const [result] = await db
          .update(autopayEnrollments)
          .set(updates as any)
          .where(eq(autopayEnrollments.id, id))
          .returning();
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );

  // Backward-compat cancel endpoint used by current portal UI
  app.post("/api/portal/cancel-autopay", requirePortal, async (req: PortalRequest, res: Response) => {
    try {
      const { enrollmentId } = req.body as { enrollmentId: string };
      if (!enrollmentId) return res.status(400).json({ message: "enrollmentId is required" });

      const [enrollment] = await db
        .select()
        .from(autopayEnrollments)
        .where(eq(autopayEnrollments.id, enrollmentId))
        .limit(1);
      if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });
      if (enrollment.personId !== req.portalPersonId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const now = new Date();
      const [result] = await db
        .update(autopayEnrollments)
        .set({
          status: "cancelled",
          cancelledBy: req.portalPersonId!,
          cancelledAt: now,
          updatedAt: now,
        })
        .where(eq(autopayEnrollments.id, enrollmentId))
        .returning();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Portal: run history for an enrollment ─────────────────────────────────

  app.get(
    "/api/portal/autopay/enrollments/:id/runs",
    requirePortal,
    async (req: PortalRequest, res: Response) => {
      try {
        const id = req.params.id as string;
        const [enrollment] = await db
          .select()
          .from(autopayEnrollments)
          .where(eq(autopayEnrollments.id, id))
          .limit(1);
        if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });
        if (enrollment.personId !== req.portalPersonId) {
          return res.status(403).json({ message: "Not authorized" });
        }

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
