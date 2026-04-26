/**
 * Wave 49 — amenity gap-audit follow-up: booking-conflict + admin-transition
 * + blackout-CRUD + cross-tenant cancel coverage.
 *
 * Closes the four coverage gaps surfaced by
 * `docs/specs/amenity-booking-gap-audit-2026-04-26.md`:
 *
 *   1. Booking conflict detection — owner A books slot 10:00–11:00,
 *      owner B tries the same slot → 409 returned, B's reservation not
 *      created in DB.
 *   2. Admin reservation transitions — pending → approved (writes BOTH
 *      `approvedBy` AND `approvedAt`); pending → rejected (does not write
 *      `approvedBy`); approved → cancelled by admin.
 *   3. Blackout CRUD + booking — admin POSTs blackout, owner attempt to
 *      book during blackout window returns 409; admin DELETEs blackout,
 *      owner can now book that slot.
 *   4. Owner-cancel cross-tenant negative — owner A cannot cancel owner
 *      B's reservation; B's reservation is unchanged in the store.
 *
 * Strategy: in-process contract reproduction. We mirror the production
 * handlers in `server/routes/amenities.ts` against an in-memory store
 * with the same field semantics. This matches the established YCM
 * pattern (see `tests/admin-associations-start-checkout.test.ts`,
 * `tests/alerts-mutation-security.test.ts`,
 * `tests/assessment-run-log-endpoint.test.ts`) and avoids booting the
 * full Drizzle / auth / DB stack.
 *
 * Maintenance contract: this reproduction MUST stay in lockstep with
 * the production handlers in `server/routes/amenities.ts`. If a route
 * changes, this file must change with it. Reviewers should flag drift.
 */

import express from "express";
import type { Request, Response, NextFunction } from "express";
import { describe, it, expect, beforeEach } from "vitest";
import { AddressInfo } from "net";

// ---- In-memory stores -----------------------------------------------------

type AmenityRow = {
  id: string;
  associationId: string;
  name: string;
  category: string;
  capacity: number | null;
  bookingWindowDays: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  requiresApproval: 0 | 1;
  isActive: 0 | 1;
};

type ReservationRow = {
  id: string;
  amenityId: string;
  associationId: string;
  personId: string;
  startAt: Date;
  endAt: Date;
  status: "pending" | "approved" | "rejected" | "cancelled";
  notes: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type BlockRow = {
  id: string;
  amenityId: string;
  associationId: string;
  startAt: Date;
  endAt: Date;
  reason: string | null;
  createdBy: string | null;
  createdAt: Date;
};

type Stores = {
  amenities: AmenityRow[];
  reservations: ReservationRow[];
  blocks: BlockRow[];
  amenitiesEnabled: Map<string, boolean>;
};

const stores: Stores = {
  amenities: [],
  reservations: [],
  blocks: [],
  amenitiesEnabled: new Map(),
};

let idSeq = 0;
function uuid(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${idSeq}`;
}

// ---- Test harness — reproduce the route handlers inline -------------------

type AdminRole =
  | "platform-admin"
  | "board-officer"
  | "assisted-board"
  | "pm-assistant"
  | "manager"
  | "viewer";

type TestAdminReq = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
};

type TestPortalReq = Request & {
  portalAssociationId?: string;
  portalPersonId?: string;
};

type HarnessOpts = {
  adminUserId?: string;
  adminEmail?: string;
  adminRole?: AdminRole;
  portalAssociationId?: string;
  portalPersonId?: string;
};

function isAmenitiesEnabledFor(associationId: string): boolean {
  if (!associationId) return false;
  const v = stores.amenitiesEnabled.get(associationId);
  return v ?? true; // default-enabled when no explicit toggle stored
}

function sendAmenitiesDisabled(res: Response) {
  return res.status(404).json({
    message: "Amenities feature is not enabled for this association",
    code: "AMENITIES_FEATURE_DISABLED",
  });
}

function makeApp(opts: HarnessOpts = {}) {
  const app = express();
  app.use(express.json());

  function requireAdmin(req: TestAdminReq, _res: Response, next: NextFunction) {
    req.adminUserId = opts.adminUserId ?? "admin-1";
    req.adminUserEmail = opts.adminEmail ?? "admin@example.com";
    req.adminRole = opts.adminRole ?? "manager";
    next();
  }
  function requireAdminRole(roles: AdminRole[]) {
    return (req: TestAdminReq, res: Response, next: NextFunction) => {
      if (!req.adminRole || !roles.includes(req.adminRole)) {
        return res.status(403).json({ code: "ADMIN_ROLE_FORBIDDEN" });
      }
      next();
    };
  }
  function requirePortal(req: TestPortalReq, _res: Response, next: NextFunction) {
    req.portalAssociationId = opts.portalAssociationId ?? "assoc-1";
    req.portalPersonId = opts.portalPersonId ?? "person-A";
    next();
  }

  // ── Admin: PATCH /api/amenity-reservations/:id (approve / reject / cancel)
  // Mirrors server/routes/amenities.ts — Wave 49 fix #2 writes `approvedBy`.
  app.patch(
    "/api/amenity-reservations/:id",
    requireAdmin,
    requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]),
    (req: TestAdminReq, res: Response) => {
      const { id } = req.params;
      const { status, notes } = req.body as { status?: ReservationRow["status"]; notes?: string };
      const row = stores.reservations.find((r) => r.id === id);
      if (!row) return res.status(404).json({ message: "Reservation not found" });
      const now = new Date();
      row.updatedAt = now;
      if (status) row.status = status;
      if (notes !== undefined) row.notes = notes;
      if (status === "approved") {
        row.approvedAt = now;
        row.approvedBy = req.adminUserId ?? null;
      }
      res.json(row);
    },
  );

  // ── Admin: POST /api/amenities/:id/blocks
  app.post(
    "/api/amenities/:id/blocks",
    requireAdmin,
    requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]),
    (req: TestAdminReq, res: Response) => {
      const amenityId = req.params.id;
      const amenity = stores.amenities.find((a) => a.id === amenityId);
      if (!amenity) return res.status(404).json({ message: "Amenity not found" });
      const { startAt, endAt, reason } = req.body as { startAt: string; endAt: string; reason?: string };
      if (!startAt || !endAt) return res.status(400).json({ message: "startAt and endAt are required" });
      const row: BlockRow = {
        id: uuid("block"),
        amenityId,
        associationId: amenity.associationId,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        reason: reason ?? null,
        createdBy: req.adminUserId ?? null,
        createdAt: new Date(),
      };
      stores.blocks.push(row);
      res.status(201).json(row);
    },
  );

  // ── Admin: DELETE /api/amenity-blocks/:id
  app.delete(
    "/api/amenity-blocks/:id",
    requireAdmin,
    requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]),
    (req: TestAdminReq, res: Response) => {
      const { id } = req.params;
      const idx = stores.blocks.findIndex((b) => b.id === id);
      if (idx < 0) return res.status(404).json({ message: "Block not found" });
      stores.blocks.splice(idx, 1);
      res.json({ ok: true });
    },
  );

  // ── Portal: POST /api/portal/amenities/:id/reservations
  app.post(
    "/api/portal/amenities/:id/reservations",
    requirePortal,
    (req: TestPortalReq, res: Response) => {
      const amenityId = req.params.id;
      const associationId = req.portalAssociationId!;
      if (!isAmenitiesEnabledFor(associationId)) return sendAmenitiesDisabled(res);
      const personId = req.portalPersonId!;
      const amenity = stores.amenities.find(
        (a) => a.id === amenityId && a.associationId === associationId && a.isActive === 1,
      );
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

      // Conflict vs existing pending+approved reservations.
      const conflictRes = stores.reservations.find(
        (r) =>
          r.amenityId === amenityId &&
          (r.status === "pending" || r.status === "approved") &&
          r.startAt <= end &&
          r.endAt >= start,
      );
      if (conflictRes) {
        return res.status(409).json({ message: "The requested time slot conflicts with an existing reservation" });
      }
      // Conflict vs blocks.
      const conflictBlock = stores.blocks.find(
        (b) => b.amenityId === amenityId && b.startAt <= end && b.endAt >= start,
      );
      if (conflictBlock) {
        return res.status(409).json({ message: "The requested time slot is blocked by maintenance or an admin hold" });
      }

      const status: ReservationRow["status"] = amenity.requiresApproval ? "pending" : "approved";
      const row: ReservationRow = {
        id: uuid("res"),
        amenityId,
        associationId,
        personId,
        startAt: start,
        endAt: end,
        status,
        notes: notes ?? null,
        approvedBy: null,
        approvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      stores.reservations.push(row);
      res.status(201).json(row);
    },
  );

  // ── Portal: DELETE /api/portal/amenity-reservations/:id (owner cancel)
  app.delete(
    "/api/portal/amenity-reservations/:id",
    requirePortal,
    (req: TestPortalReq, res: Response) => {
      const associationId = req.portalAssociationId!;
      if (!isAmenitiesEnabledFor(associationId)) return sendAmenitiesDisabled(res);
      const { id } = req.params;
      const personId = req.portalPersonId!;
      // Owner-scope: only the owning person can cancel; mismatched personId
      // returns 404 (per the production handler's `and(eq(id), eq(personId))`
      // filter — a different owner sees the row as "not found").
      const row = stores.reservations.find((r) => r.id === id && r.personId === personId);
      if (!row) return res.status(404).json({ message: "Reservation not found" });
      if (row.status === "cancelled") {
        return res.status(400).json({ message: "Reservation is already cancelled" });
      }
      row.status = "cancelled";
      row.updatedAt = new Date();
      res.json(row);
    },
  );

  return app;
}

// ---- HTTP helpers --------------------------------------------------------

async function callJson(
  app: express.Express,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const port = (server.address() as AddressInfo).port;
        const res = await fetch(`http://127.0.0.1:${port}${path}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const text = await res.text();
        let parsed: any;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch {
          parsed = text;
        }
        server.close(() => resolve({ status: res.status, body: parsed }));
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

// ---- Seed helpers --------------------------------------------------------

function seedAmenity(overrides: Partial<AmenityRow> = {}): AmenityRow {
  const row: AmenityRow = {
    id: overrides.id ?? uuid("amenity"),
    associationId: overrides.associationId ?? "assoc-1",
    name: overrides.name ?? "Pool",
    category: overrides.category ?? "pool",
    capacity: overrides.capacity ?? 4,
    bookingWindowDays: overrides.bookingWindowDays ?? 30,
    minDurationMinutes: overrides.minDurationMinutes ?? 30,
    maxDurationMinutes: overrides.maxDurationMinutes ?? 240,
    requiresApproval: overrides.requiresApproval ?? 0,
    isActive: overrides.isActive ?? 1,
  };
  stores.amenities.push(row);
  return row;
}

function seedReservation(overrides: Partial<ReservationRow> & {
  amenityId: string;
  associationId: string;
  personId: string;
  startAt: Date;
  endAt: Date;
}): ReservationRow {
  const row: ReservationRow = {
    id: overrides.id ?? uuid("res"),
    amenityId: overrides.amenityId,
    associationId: overrides.associationId,
    personId: overrides.personId,
    startAt: overrides.startAt,
    endAt: overrides.endAt,
    status: overrides.status ?? "approved",
    notes: overrides.notes ?? null,
    approvedBy: overrides.approvedBy ?? null,
    approvedAt: overrides.approvedAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  stores.reservations.push(row);
  return row;
}

function inFuture(daysFromNow: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d;
}

// ---- Tests ---------------------------------------------------------------

beforeEach(() => {
  stores.amenities = [];
  stores.reservations = [];
  stores.blocks = [];
  stores.amenitiesEnabled = new Map();
  idSeq = 0;
});

describe("Booking conflict detection (gap-audit fix #4)", () => {
  it("409 when owner B tries the same slot owner A already has", async () => {
    const amenity = seedAmenity({ requiresApproval: 0 });
    const start = inFuture(2, 10);
    const end = inFuture(2, 11);
    seedReservation({
      amenityId: amenity.id,
      associationId: amenity.associationId,
      personId: "person-A",
      startAt: start,
      endAt: end,
      status: "approved",
    });

    const app = makeApp({ portalPersonId: "person-B", portalAssociationId: amenity.associationId });
    const res = await callJson(app, "POST", `/api/portal/amenities/${amenity.id}/reservations`, {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/conflicts/i);
    // Owner B's reservation must NOT have been created.
    const bRows = stores.reservations.filter((r) => r.personId === "person-B");
    expect(bRows).toHaveLength(0);
  });

  it("409 when overlap is partial (B starts mid-A's slot)", async () => {
    const amenity = seedAmenity({ requiresApproval: 0 });
    const aStart = inFuture(2, 10);
    const aEnd = inFuture(2, 12);
    seedReservation({
      amenityId: amenity.id,
      associationId: amenity.associationId,
      personId: "person-A",
      startAt: aStart,
      endAt: aEnd,
      status: "pending",
    });

    const app = makeApp({ portalPersonId: "person-B", portalAssociationId: amenity.associationId });
    const bStart = inFuture(2, 11);
    const bEnd = inFuture(2, 13);
    const res = await callJson(app, "POST", `/api/portal/amenities/${amenity.id}/reservations`, {
      startAt: bStart.toISOString(),
      endAt: bEnd.toISOString(),
    });
    expect(res.status).toBe(409);
    expect(stores.reservations.filter((r) => r.personId === "person-B")).toHaveLength(0);
  });

  it("non-conflicting adjacent slots are allowed", async () => {
    const amenity = seedAmenity({ requiresApproval: 0 });
    seedReservation({
      amenityId: amenity.id,
      associationId: amenity.associationId,
      personId: "person-A",
      startAt: inFuture(2, 10),
      endAt: inFuture(2, 11),
      status: "approved",
    });

    const app = makeApp({ portalPersonId: "person-B", portalAssociationId: amenity.associationId });
    const res = await callJson(app, "POST", `/api/portal/amenities/${amenity.id}/reservations`, {
      // Strictly after A's end; the route uses `startAt <= end && endAt >= start`,
      // so we stay clear with a half-hour buffer.
      startAt: inFuture(2, 12).toISOString(),
      endAt: inFuture(2, 13).toISOString(),
    });
    expect(res.status).toBe(201);
  });

  it("cancelled reservations do not block new bookings", async () => {
    const amenity = seedAmenity({ requiresApproval: 0 });
    const start = inFuture(2, 10);
    const end = inFuture(2, 11);
    seedReservation({
      amenityId: amenity.id,
      associationId: amenity.associationId,
      personId: "person-A",
      startAt: start,
      endAt: end,
      status: "cancelled",
    });

    const app = makeApp({ portalPersonId: "person-B", portalAssociationId: amenity.associationId });
    const res = await callJson(app, "POST", `/api/portal/amenities/${amenity.id}/reservations`, {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    });
    expect(res.status).toBe(201);
  });
});

describe("Admin reservation transitions (gap-audit fix #2 + fix #4)", () => {
  it("pending → approved writes BOTH approvedAt AND approvedBy", async () => {
    const amenity = seedAmenity({ requiresApproval: 1 });
    const reservation = seedReservation({
      amenityId: amenity.id,
      associationId: amenity.associationId,
      personId: "person-A",
      startAt: inFuture(2, 10),
      endAt: inFuture(2, 11),
      status: "pending",
    });

    const adminId = "admin-mgr-7";
    const app = makeApp({ adminUserId: adminId, adminRole: "manager" });
    const res = await callJson(app, "PATCH", `/api/amenity-reservations/${reservation.id}`, {
      status: "approved",
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");
    expect(res.body.approvedBy).toBe(adminId);
    expect(res.body.approvedAt).toBeTruthy();
    // Persisted in the store.
    const stored = stores.reservations.find((r) => r.id === reservation.id)!;
    expect(stored.approvedBy).toBe(adminId);
    expect(stored.approvedAt).toBeInstanceOf(Date);
  });

  it("pending → rejected does NOT write approvedBy", async () => {
    const amenity = seedAmenity({ requiresApproval: 1 });
    const reservation = seedReservation({
      amenityId: amenity.id,
      associationId: amenity.associationId,
      personId: "person-A",
      startAt: inFuture(2, 10),
      endAt: inFuture(2, 11),
      status: "pending",
    });

    const app = makeApp({ adminUserId: "admin-mgr-7", adminRole: "manager" });
    const res = await callJson(app, "PATCH", `/api/amenity-reservations/${reservation.id}`, {
      status: "rejected",
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("rejected");
    expect(res.body.approvedBy).toBeNull();
    expect(res.body.approvedAt).toBeNull();
  });

  it("approved → cancelled by admin", async () => {
    const amenity = seedAmenity({ requiresApproval: 0 });
    const reservation = seedReservation({
      amenityId: amenity.id,
      associationId: amenity.associationId,
      personId: "person-A",
      startAt: inFuture(2, 10),
      endAt: inFuture(2, 11),
      status: "approved",
      approvedBy: "admin-old-1",
      approvedAt: new Date(),
    });

    const app = makeApp({ adminUserId: "admin-mgr-7", adminRole: "manager" });
    const res = await callJson(app, "PATCH", `/api/amenity-reservations/${reservation.id}`, {
      status: "cancelled",
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
    // Cancellation does NOT overwrite the original approvedBy/approvedAt.
    expect(res.body.approvedBy).toBe("admin-old-1");
  });

  it("non-admin role (viewer) cannot patch reservations", async () => {
    const amenity = seedAmenity({ requiresApproval: 1 });
    const reservation = seedReservation({
      amenityId: amenity.id,
      associationId: amenity.associationId,
      personId: "person-A",
      startAt: inFuture(2, 10),
      endAt: inFuture(2, 11),
      status: "pending",
    });

    const app = makeApp({ adminUserId: "viewer-1", adminRole: "viewer" });
    const res = await callJson(app, "PATCH", `/api/amenity-reservations/${reservation.id}`, {
      status: "approved",
    });
    expect(res.status).toBe(403);
  });
});

describe("Blackout CRUD + booking interaction (gap-audit fix #4)", () => {
  it("admin POSTs blackout; owner can no longer book overlapping slot; admin DELETEs blackout; owner can book", async () => {
    const amenity = seedAmenity({ requiresApproval: 0 });

    // Step 1: admin creates a blackout window.
    const blockStart = inFuture(3, 9);
    const blockEnd = inFuture(3, 17);
    const adminApp = makeApp({ adminUserId: "admin-1", adminRole: "manager" });
    const blockCreate = await callJson(adminApp, "POST", `/api/amenities/${amenity.id}/blocks`, {
      startAt: blockStart.toISOString(),
      endAt: blockEnd.toISOString(),
      reason: "Maintenance",
    });
    expect(blockCreate.status).toBe(201);
    const blockId = blockCreate.body.id;

    // Step 2: owner attempts to book inside the blackout — 409.
    const ownerApp = makeApp({ portalPersonId: "person-A", portalAssociationId: amenity.associationId });
    const blockedTry = await callJson(ownerApp, "POST", `/api/portal/amenities/${amenity.id}/reservations`, {
      startAt: inFuture(3, 10).toISOString(),
      endAt: inFuture(3, 11).toISOString(),
    });
    expect(blockedTry.status).toBe(409);
    expect(blockedTry.body.message).toMatch(/blocked|maintenance|hold/i);

    // Step 3: admin deletes the blackout.
    const blockDel = await callJson(adminApp, "DELETE", `/api/amenity-blocks/${blockId}`);
    expect(blockDel.status).toBe(200);

    // Step 4: owner can now book that slot.
    const successTry = await callJson(ownerApp, "POST", `/api/portal/amenities/${amenity.id}/reservations`, {
      startAt: inFuture(3, 10).toISOString(),
      endAt: inFuture(3, 11).toISOString(),
    });
    expect(successTry.status).toBe(201);
  });

  it("non-admin role (viewer) cannot create blackouts", async () => {
    const amenity = seedAmenity();
    const app = makeApp({ adminUserId: "viewer-1", adminRole: "viewer" });
    const res = await callJson(app, "POST", `/api/amenities/${amenity.id}/blocks`, {
      startAt: inFuture(3, 9).toISOString(),
      endAt: inFuture(3, 17).toISOString(),
      reason: "Maintenance",
    });
    expect(res.status).toBe(403);
  });

  it("DELETE on unknown block id returns 404", async () => {
    const app = makeApp({ adminUserId: "admin-1", adminRole: "manager" });
    const res = await callJson(app, "DELETE", `/api/amenity-blocks/unknown-id`);
    expect(res.status).toBe(404);
  });
});

describe("Owner-cancel cross-tenant negative (gap-audit fix #3)", () => {
  it("owner A cannot cancel owner B's reservation; B's reservation is unchanged", async () => {
    const amenity = seedAmenity();
    const aRes = seedReservation({
      amenityId: amenity.id,
      associationId: amenity.associationId,
      personId: "person-A",
      startAt: inFuture(2, 10),
      endAt: inFuture(2, 11),
      status: "approved",
    });
    const bRes = seedReservation({
      amenityId: amenity.id,
      associationId: amenity.associationId,
      personId: "person-B",
      startAt: inFuture(2, 14),
      endAt: inFuture(2, 15),
      status: "approved",
    });

    // Owner A authenticated, attempting to cancel Owner B's reservation.
    const app = makeApp({ portalPersonId: "person-A", portalAssociationId: amenity.associationId });
    const res = await callJson(app, "DELETE", `/api/portal/amenity-reservations/${bRes.id}`);
    // Production filter is `and(eq(id), eq(personId))` — a non-matching
    // personId returns "not found" (404), which is the correct semantic
    // surface for "this reservation is not yours / does not exist for you".
    expect(res.status).toBe(404);

    // B's reservation must be unchanged in the store.
    const bAfter = stores.reservations.find((r) => r.id === bRes.id)!;
    expect(bAfter.status).toBe("approved");
    expect(bAfter.personId).toBe("person-B");
    // A's reservation also unchanged.
    const aAfter = stores.reservations.find((r) => r.id === aRes.id)!;
    expect(aAfter.status).toBe("approved");
  });

  it("owner A CAN cancel owner A's own reservation (positive control)", async () => {
    const amenity = seedAmenity();
    const aRes = seedReservation({
      amenityId: amenity.id,
      associationId: amenity.associationId,
      personId: "person-A",
      startAt: inFuture(2, 10),
      endAt: inFuture(2, 11),
      status: "approved",
    });

    const app = makeApp({ portalPersonId: "person-A", portalAssociationId: amenity.associationId });
    const res = await callJson(app, "DELETE", `/api/portal/amenity-reservations/${aRes.id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
  });
});
