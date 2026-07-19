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
// A-AUTHZ-003/004: shared, fail-closed tenant-isolation guards. Every admin route
// below now enforces association scope (was: role-only, cross-tenant IDOR on
// list + every by-id amenity/reservation/block handler).
import {
  assertAssociationScope,
  assertAssociationInputScope,
  getAssociationIdQuery,
} from "../lib/tenant-scope";
import {
  captureAmenityBookingMoney,
  resolveAmenityDeposit,
} from "../services/amenity-money-service";

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

/** True iff the admin's scope includes `associationId` (platform-admin always).
 * A false result → the caller responds 404 (no cross-tenant existence oracle). */
function inScope(req: AdminRequest, associationId: string | null | undefined): boolean {
  try {
    assertAssociationScope(req, associationId ?? "");
    return true;
  } catch {
    return false;
  }
}

/** True when an error is a tenant-scope denial (→ 403) vs a real server error. */
function isScopeError(e: unknown): boolean {
  const m = e instanceof Error ? e.message : "";
  return /outside admin scope|association is outside|associationId is required|No association scopes/i.test(m);
}

/** Resolve the owning associationId of an amenity by id (null if not found). */
async function amenityAssociationId(id: string): Promise<string | null> {
  if (!id) return null;
  const [row] = await db.select({ associationId: amenities.associationId }).from(amenities).where(eq(amenities.id, id));
  return row?.associationId ?? null;
}

/** Resolve the owning associationId of a reservation by id (null if not found). */
async function reservationAssociationId(id: string): Promise<string | null> {
  if (!id) return null;
  const [row] = await db
    .select({ associationId: amenityReservations.associationId })
    .from(amenityReservations)
    .where(eq(amenityReservations.id, id));
  return row?.associationId ?? null;
}

/** Resolve the owning associationId of a block by id, via its amenity. */
async function blockAssociationId(id: string): Promise<string | null> {
  if (!id) return null;
  const [row] = await db
    .select({ associationId: amenities.associationId })
    .from(amenityBlocks)
    .innerJoin(amenities, eq(amenities.id, amenityBlocks.amenityId))
    .where(eq(amenityBlocks.id, id));
  return row?.associationId ?? null;
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
      // A-AUTHZ-003: validate the requested associationId against the admin's scope
      // (was: raw client value → any admin could list any tenant's amenities).
      let associationId: string | undefined;
      try {
        associationId = getAssociationIdQuery(req);
      } catch (e) {
        if (isScopeError(e)) return res.status(403).json({ message: "Association is outside your scope" });
        throw e;
      }
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
      // A-AUTHZ-003: reject a client-supplied cross-tenant associationId on create.
      try {
        assertAssociationInputScope(req, parsed.data.associationId);
      } catch (e) {
        if (isScopeError(e)) return res.status(403).json({ message: "Association is outside your scope" });
        throw e;
      }
      const [created] = await db.insert(amenities).values(parsed.data).returning();
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/amenities/:id", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]), async (req: AdminRequest, res: Response) => {
    try {
      const id = p(req.params.id);
      // A-AUTHZ-003: assert the amenity belongs to the admin's scope before mutating.
      if (!inScope(req, await amenityAssociationId(id))) return res.status(404).json({ message: "Amenity not found" });
      const body = { ...(req.body ?? {}) };
      delete body.associationId; // never allow re-homing into another tenant
      const [updated] = await db.update(amenities)
        .set({ ...body, updatedAt: new Date() })
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
      // A-AUTHZ-003: assert the amenity belongs to the admin's scope before deleting.
      if (!inScope(req, await amenityAssociationId(id))) return res.status(404).json({ message: "Amenity not found" });
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
      // A-AUTHZ-003: the amenity (and thus its reservations) must be in the admin's scope.
      if (!inScope(req, await amenityAssociationId(id))) return res.status(404).json({ message: "Amenity not found" });
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
      // A-AUTHZ-003: reservation (references units/owners + deposit MONEY) must be in scope.
      if (!inScope(req, await reservationAssociationId(id))) return res.status(404).json({ message: "Reservation not found" });
      const { status, notes, depositResolution, refundCents, forfeitCents } = req.body as {
        status?: string;
        notes?: string;
        // ── Amenity money loop, Slices 3+4 (founder-os#10181) ──────────────────
        // The deposit resolution: refund (clean checkout), forfeit (damage/
        // violation), or a partial split. Amounts are INTEGER CENTS. Optional —
        // omitted on a plain status/notes edit.
        depositResolution?: "refund" | "forfeit" | "partial";
        refundCents?: number;
        forfeitCents?: number;
      };
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (status) updateData.status = status;
      if (notes !== undefined) updateData.notes = notes;
      // Wave 49 (gap-audit fix #2): write `approvedBy` whenever status flips
      // to "approved" so the reservation carries the admin user id alongside
      // the approval timestamp. Migration 0021 dropped the FK to persons.id
      // so this column can hold an admin_users.id without violating
      // referential integrity. Rejection is intentionally NOT audited here
      // (the audit only flagged the approve case); rejection auditing would
      // require an additional `rejectedBy` column.
      if (status === "approved") {
        updateData.approvedAt = new Date();
        updateData.approvedBy = req.adminUserId ?? null;
      }
      const [updated] = await db.update(amenityReservations)
        .set(updateData)
        .where(eq(amenityReservations.id, id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Reservation not found" });

      // ── Amenity money loop, Slices 3+4 (founder-os#10181) ──────────────────
      // When the admin resolves the deposit (refund / forfeit / partial), route
      // it through the gated money service. GATED fail-safe OFF: a non-allowlisted
      // association is a pure no-op. Invariant violations (over-resolving) are a
      // client input error → 400. The service writes depositRefundedCents /
      // depositForfeitedCents and fires the parallel GL (non-fatal).
      let responseRow = updated;
      if (depositResolution || (refundCents ?? 0) > 0 || (forfeitCents ?? 0) > 0) {
        try {
          const resolve = await resolveAmenityDeposit({
            reservationId: id,
            refundCents: refundCents ?? 0,
            forfeitCents: forfeitCents ?? 0,
          });
          if (resolve.mutated) {
            const [refreshed] = await db.select().from(amenityReservations)
              .where(eq(amenityReservations.id, id));
            if (refreshed) responseRow = refreshed;
          }
        } catch (resolveErr: any) {
          const msg = resolveErr?.message ?? String(resolveErr);
          // Invariant / input errors from the service are client errors.
          if (/must be a non-negative integer|exceeds the/.test(msg)) {
            return res.status(400).json({ message: msg });
          }
          // Any other error is non-fatal to the status/notes update already made.
          console.error(`[amenity-money] non-fatal deposit-resolution error for reservation=${id}: ${msg}`);
        }
      }

      res.json(responseRow);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Admin: blocks ────────────────────────────────────────────────────────────

  app.get("/api/amenities/:id/blocks", requireAdmin, requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"]), async (req: AdminRequest, res: Response) => {
    try {
      const id = p(req.params.id);
      // A-AUTHZ-003: the amenity (and its blocks) must be in the admin's scope.
      if (!inScope(req, await amenityAssociationId(id))) return res.status(404).json({ message: "Amenity not found" });
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
      // A-AUTHZ-003: the amenity being blocked must be in the admin's scope.
      if (!inScope(req, await amenityAssociationId(id))) return res.status(404).json({ message: "Amenity not found" });
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
      // A-AUTHZ-003: the block's amenity must be in the admin's scope.
      if (!inScope(req, await blockAssociationId(id))) return res.status(404).json({ message: "Block not found" });
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

      // ── Amenity money loop, Slices 1+2 (founder-os#10181) ──────────────────
      // Charge the usage fee + hold the refundable deposit. This is GATED
      // fail-safe OFF per association (isGlEnabledForAssociation): for every
      // non-allowlisted association — the default, incl. CHC — it is a PURE
      // NO-OP (no charge, no column write). It is also NON-FATAL: a money-capture
      // error must never break the booking that already committed. When enabled
      // it writes feeChargedCents / depositHeldCents and fires the parallel GL.
      let responseRow = created;
      try {
        const capture = await captureAmenityBookingMoney({ reservationId: created.id });
        if (capture.mutated) {
          const [refreshed] = await db.select().from(amenityReservations)
            .where(eq(amenityReservations.id, created.id));
          if (refreshed) responseRow = refreshed;
        }
      } catch (moneyErr: any) {
        console.error(`[amenity-money] non-fatal capture error for reservation=${created.id}: ${moneyErr?.message ?? moneyErr}`);
      }

      res.status(201).json(responseRow);
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
