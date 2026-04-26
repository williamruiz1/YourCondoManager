import type { Express, NextFunction, Request, Response } from "express";
import { and, gte, lte, or, eq } from "drizzle-orm";
import { db } from "../db";
import {
  amenities,
  amenityBlocks,
  amenityReservations,
  associations,
  insertAmenitySchema,
  insertAmenityBlockSchema,
  insertAmenityReservationSchema,
} from "@shared/schema";
import type { AdminRole } from "@shared/schema";

// `AdminRole` is imported from `@shared/schema` (Wave 38 / Phase 14 dedup —
// the canonical source of truth, derived from `adminUserRoleEnum.enumValues`).

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

function p(value: string | string[] | undefined): string {
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}

// 4.2 Q3 addendum (3a): per-association amenities toggle. When the
// association's `amenities_enabled` column is 0, portal amenity routes must
// return a structured 404 so the owner portal treats the feature as absent.
async function isAmenitiesEnabledFor(associationId: string): Promise<boolean> {
  if (!associationId) return false;
  const [row] = await db.select({ amenitiesEnabled: associations.amenitiesEnabled })
    .from(associations)
    .where(eq(associations.id, associationId));
  if (!row) return false;
  return row.amenitiesEnabled === 1;
}

function sendAmenitiesDisabled(res: Response) {
  return res.status(404).json({
    message: "Amenities feature is not enabled for this association",
    code: "AMENITIES_FEATURE_DISABLED",
  });
}

export function registerAmenityRoutes(
  app: Express,
  requireAdmin: AnyMiddleware,
  requireAdminRole: RoleMiddlewareFactory,
  requirePortal: AnyMiddleware,
) {
  // ── Admin: amenity CRUD ──────────────────────────────────────────────────────

  app.get("/api/amenities", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"]), async (req: AdminRequest, res: Response) => {
    try {
      const associationId = p(req.query.associationId as string | string[] | undefined);
      if (!associationId) return res.status(400).json({ message: "associationId required" });
      const rows = await db.select().from(amenities)
        .where(eq(amenities.associationId, associationId))
        .orderBy(amenities.name);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/amenities", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]), async (req: AdminRequest, res: Response) => {
    try {
      const parsed = insertAmenitySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const [created] = await db.insert(amenities).values(parsed.data).returning();
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/amenities/:id", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]), async (req: AdminRequest, res: Response) => {
    try {
      const id = p(req.params.id);
      const [updated] = await db.update(amenities)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(amenities.id, id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Amenity not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/amenities/:id", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]), async (req: AdminRequest, res: Response) => {
    try {
      const id = p(req.params.id);
      const [updated] = await db.update(amenities)
        .set({ isActive: 0, updatedAt: new Date() })
        .where(eq(amenities.id, id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Amenity not found" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Admin: reservations ──────────────────────────────────────────────────────

  app.get("/api/amenities/:id/reservations", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"]), async (req: AdminRequest, res: Response) => {
    try {
      const id = p(req.params.id);
      const from = p(req.query.from as string | string[] | undefined);
      const to = p(req.query.to as string | string[] | undefined);
      const conditions = [eq(amenityReservations.amenityId, id)];
      if (from) conditions.push(gte(amenityReservations.startAt, new Date(from)));
      if (to) conditions.push(lte(amenityReservations.endAt, new Date(to)));
      const rows = await db.select().from(amenityReservations)
        .where(and(...conditions))
        .orderBy(amenityReservations.startAt);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/amenity-reservations/:id", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]), async (req: AdminRequest, res: Response) => {
    try {
      const id = p(req.params.id);
      const { status, notes } = req.body as { status?: string; notes?: string };
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (status) updateData.status = status;
      if (notes !== undefined) updateData.notes = notes;
      if (status === "approved") {
        updateData.approvedAt = new Date();
      }
      const [updated] = await db.update(amenityReservations)
        .set(updateData)
        .where(eq(amenityReservations.id, id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Reservation not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Admin: blocks ────────────────────────────────────────────────────────────

  app.get("/api/amenities/:id/blocks", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"]), async (req: AdminRequest, res: Response) => {
    try {
      const id = p(req.params.id);
      const rows = await db.select().from(amenityBlocks)
        .where(eq(amenityBlocks.amenityId, id))
        .orderBy(amenityBlocks.startAt);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/amenities/:id/blocks", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]), async (req: AdminRequest, res: Response) => {
    try {
      const id = p(req.params.id);
      const parsed = insertAmenityBlockSchema.safeParse({ ...req.body, amenityId: id });
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
      const [created] = await db.insert(amenityBlocks).values(parsed.data).returning();
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/amenity-blocks/:id", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]), async (req: AdminRequest, res: Response) => {
    try {
      const id = p(req.params.id);
      const [deleted] = await db.delete(amenityBlocks)
        .where(eq(amenityBlocks.id, id))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Block not found" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Portal: amenities ────────────────────────────────────────────────────────

  // 4.2 Q3 addendum (3a): gate every portal amenity route on the per-association
  // toggle. A disabled association returns a structured 404 (not 403) so the
  // client can render the standard NotFound surface.
  app.get("/api/portal/amenities/settings", requirePortal, async (req: PortalRequest, res: Response) => {
    try {
      const associationId = req.portalAssociationId!;
      const enabled = await isAmenitiesEnabledFor(associationId);
      res.json({ amenitiesEnabled: enabled });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/portal/amenities", requirePortal, async (req: PortalRequest, res: Response) => {
    try {
      const associationId = req.portalAssociationId!;
      if (!(await isAmenitiesEnabledFor(associationId))) return sendAmenitiesDisabled(res);
      const rows = await db.select().from(amenities)
        .where(and(eq(amenities.associationId, associationId), eq(amenities.isActive, 1)))
        .orderBy(amenities.name);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // NOTE: this specific path must come before /api/portal/amenities/:id routes
  app.get("/api/portal/amenities/my-reservations", requirePortal, async (req: PortalRequest, res: Response) => {
    try {
      const associationId = req.portalAssociationId!;
      if (!(await isAmenitiesEnabledFor(associationId))) return sendAmenitiesDisabled(res);
      const personId = req.portalPersonId!;
      const now = new Date();
      const rows = await db.select().from(amenityReservations)
        .where(and(
          eq(amenityReservations.personId, personId),
          gte(amenityReservations.endAt, now),
        ))
        .orderBy(amenityReservations.startAt);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/portal/amenities/:id/availability", requirePortal, async (req: PortalRequest, res: Response) => {
    try {
      const associationId = req.portalAssociationId!;
      if (!(await isAmenitiesEnabledFor(associationId))) return sendAmenitiesDisabled(res);
      const id = p(req.params.id);
      const from = p(req.query.from as string | string[] | undefined);
      const to = p(req.query.to as string | string[] | undefined);
      if (!from || !to) return res.status(400).json({ message: "from and to are required" });

      const fromDate = new Date(from);
      const toDate = new Date(to);

      const reservations = await db.select({
        id: amenityReservations.id,
        startAt: amenityReservations.startAt,
        endAt: amenityReservations.endAt,
        status: amenityReservations.status,
      }).from(amenityReservations)
        .where(and(
          eq(amenityReservations.amenityId, id),
          or(
            eq(amenityReservations.status, "pending"),
            eq(amenityReservations.status, "approved"),
          ),
          lte(amenityReservations.startAt, toDate),
          gte(amenityReservations.endAt, fromDate),
        ));

      const blocks = await db.select({
        id: amenityBlocks.id,
        startAt: amenityBlocks.startAt,
        endAt: amenityBlocks.endAt,
        reason: amenityBlocks.reason,
      }).from(amenityBlocks)
        .where(and(
          eq(amenityBlocks.amenityId, id),
          lte(amenityBlocks.startAt, toDate),
          gte(amenityBlocks.endAt, fromDate),
        ));

      res.json({
        busyWindows: [
          ...reservations.map((r) => ({ type: "reservation" as const, ...r })),
          ...blocks.map((b) => ({ type: "block" as const, ...b })),
        ],
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/portal/amenities/:id/reservations", requirePortal, async (req: PortalRequest, res: Response) => {
    try {
      const id = p(req.params.id);
      const associationId = req.portalAssociationId!;
      if (!(await isAmenitiesEnabledFor(associationId))) return sendAmenitiesDisabled(res);
      const personId = req.portalPersonId!;

      const [amenity] = await db.select().from(amenities)
        .where(and(eq(amenities.id, id), eq(amenities.associationId, associationId), eq(amenities.isActive, 1)));
      if (!amenity) return res.status(404).json({ message: "Amenity not found" });

      const { startAt, endAt, notes } = req.body as { startAt: string; endAt: string; notes?: string };
      if (!startAt || !endAt) return res.status(400).json({ message: "startAt and endAt are required" });

      const start = new Date(startAt);
      const end = new Date(endAt);
      const now = new Date();

      if (start < now) return res.status(400).json({ message: "Cannot book in the past" });

      const durationMinutes = (end.getTime() - start.getTime()) / 60000;
      if (durationMinutes < amenity.minDurationMinutes) {
        return res.status(400).json({ message: `Minimum duration is ${amenity.minDurationMinutes} minutes` });
      }
      if (durationMinutes > amenity.maxDurationMinutes) {
        return res.status(400).json({ message: `Maximum duration is ${amenity.maxDurationMinutes} minutes` });
      }

      const maxFuture = new Date(now);
      maxFuture.setDate(maxFuture.getDate() + amenity.bookingWindowDays);
      if (start > maxFuture) {
        return res.status(400).json({ message: `Cannot book more than ${amenity.bookingWindowDays} days in advance` });
      }

      const conflictingReservations = await db.select({ id: amenityReservations.id })
        .from(amenityReservations)
        .where(and(
          eq(amenityReservations.amenityId, id),
          or(
            eq(amenityReservations.status, "pending"),
            eq(amenityReservations.status, "approved"),
          ),
          lte(amenityReservations.startAt, end),
          gte(amenityReservations.endAt, start),
        ));

      if (conflictingReservations.length > 0) {
        return res.status(409).json({ message: "The requested time slot conflicts with an existing reservation" });
      }

      const conflictingBlocks = await db.select({ id: amenityBlocks.id })
        .from(amenityBlocks)
        .where(and(
          eq(amenityBlocks.amenityId, id),
          lte(amenityBlocks.startAt, end),
          gte(amenityBlocks.endAt, start),
        ));

      if (conflictingBlocks.length > 0) {
        return res.status(409).json({ message: "The requested time slot is blocked by maintenance or an admin hold" });
      }

      const initialStatus = amenity.requiresApproval ? "pending" : "approved";
      const parsed = insertAmenityReservationSchema.safeParse({
        amenityId: id,
        associationId,
        personId,
        startAt: start,
        endAt: end,
        status: initialStatus,
        notes: notes ?? null,
      });
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });

      const [created] = await db.insert(amenityReservations).values(parsed.data).returning();
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/portal/amenity-reservations/:id", requirePortal, async (req: PortalRequest, res: Response) => {
    try {
      const associationId = req.portalAssociationId!;
      if (!(await isAmenitiesEnabledFor(associationId))) return sendAmenitiesDisabled(res);
      const id = p(req.params.id);
      const personId = req.portalPersonId!;

      const [reservation] = await db.select().from(amenityReservations)
        .where(and(eq(amenityReservations.id, id), eq(amenityReservations.personId, personId)));
      if (!reservation) return res.status(404).json({ message: "Reservation not found" });

      if (reservation.status === "cancelled") {
        return res.status(400).json({ message: "Reservation is already cancelled" });
      }

      const [updated] = await db.update(amenityReservations)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(amenityReservations.id, id))
        .returning();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
