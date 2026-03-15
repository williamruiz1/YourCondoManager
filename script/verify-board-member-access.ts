import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { storage } from "../server/storage";
import {
  associations,
  associationMemberships,
  auditLogs,
  boardRoles,
  persons,
  portalAccess,
} from "../shared/schema";

async function cleanup(ids: {
  associationId?: string;
  ownerPersonId?: string;
  boardOnlyPersonId?: string;
  ownerBoardRoleId?: string;
  boardOnlyRoleId?: string;
}) {
  if (ids.associationId) {
    await db.delete(portalAccess).where(eq(portalAccess.associationId, ids.associationId));
    await db.delete(associationMemberships).where(eq(associationMemberships.associationId, ids.associationId));
    await db.delete(boardRoles).where(eq(boardRoles.associationId, ids.associationId));
    await db.delete(auditLogs).where(eq(auditLogs.associationId, ids.associationId));
  }
  if (ids.ownerPersonId) await db.delete(persons).where(eq(persons.id, ids.ownerPersonId));
  if (ids.boardOnlyPersonId) await db.delete(persons).where(eq(persons.id, ids.boardOnlyPersonId));
  if (ids.associationId) await db.delete(associations).where(eq(associations.id, ids.associationId));
}

async function main() {
  const suffix = Date.now().toString();
  const created: {
    associationId?: string;
    ownerPersonId?: string;
    boardOnlyPersonId?: string;
    ownerBoardRoleId?: string;
    boardOnlyRoleId?: string;
  } = {};

  try {
    const [association] = await db.insert(associations).values({
      name: `Verification HOA ${suffix}`,
      associationType: "condo",
      address: "1 Verification Way",
      city: "New Haven",
      state: "CT",
      country: "USA",
    }).returning();
    created.associationId = association.id;

    const [ownerPerson] = await db.insert(persons).values({
      firstName: "Owner",
      lastName: `Director${suffix}`,
      email: `owner.director.${suffix}@example.com`,
    }).returning();
    created.ownerPersonId = ownerPerson.id;

    const [boardOnlyPerson] = await db.insert(persons).values({
      firstName: "Board",
      lastName: `Only${suffix}`,
      email: `board.only.${suffix}@example.com`,
    }).returning();
    created.boardOnlyPersonId = boardOnlyPerson.id;

    await db.insert(associationMemberships).values({
      associationId: association.id,
      personId: ownerPerson.id,
      membershipType: "owner",
      status: "active",
      isPrimary: 1,
    });

    const [ownerBoardRole] = await db.insert(boardRoles).values({
      associationId: association.id,
      personId: ownerPerson.id,
      role: "President",
      startDate: new Date(Date.now() - 86400000),
      endDate: null,
    }).returning();
    created.ownerBoardRoleId = ownerBoardRole.id;

    const [boardOnlyRole] = await db.insert(boardRoles).values({
      associationId: association.id,
      personId: boardOnlyPerson.id,
      role: "Treasurer",
      startDate: new Date(Date.now() - 86400000),
      endDate: null,
    }).returning();
    created.boardOnlyRoleId = boardOnlyRole.id;

    const ownerAccess = await storage.inviteBoardMemberAccess({
      associationId: association.id,
      personId: ownerPerson.id,
      boardRoleId: ownerBoardRole.id,
      email: ownerPerson.email,
      invitedBy: "verify-script",
    });
    const activatedOwnerAccess = await storage.updatePortalAccess(ownerAccess.id, {
      status: "active",
    }, "verify-script");
    if (!activatedOwnerAccess) throw new Error("Failed to activate owner-board access");

    const boardOnlyAccess = await storage.inviteBoardMemberAccess({
      associationId: association.id,
      personId: boardOnlyPerson.id,
      boardRoleId: boardOnlyRole.id,
      email: boardOnlyPerson.email,
      invitedBy: "verify-script",
    });

    const activatedBoardOnlyAccess = await storage.updatePortalAccess(boardOnlyAccess.id, {
      status: "active",
    }, "verify-script");
    if (!activatedBoardOnlyAccess) throw new Error("Failed to activate board-only access");

    const resolvedOwner = await storage.resolvePortalAccessContext(activatedOwnerAccess.id);
    const resolvedBoardOnly = await storage.resolvePortalAccessContext(activatedBoardOnlyAccess.id);

    if (!resolvedOwner || resolvedOwner.effectiveRole !== "owner-board-member" || !resolvedOwner.hasBoardAccess) {
      throw new Error("Owner-board member did not resolve to combined owner-board access");
    }
    if (!resolvedBoardOnly || resolvedBoardOnly.effectiveRole !== "board-member" || !resolvedBoardOnly.hasBoardAccess) {
      throw new Error("Board-only member did not resolve to board-member access");
    }

    await db.update(boardRoles).set({
      endDate: new Date(Date.now() - 1000),
    }).where(eq(boardRoles.id, ownerBoardRole.id));

    await db.update(boardRoles).set({
      endDate: new Date(Date.now() - 1000),
    }).where(eq(boardRoles.id, boardOnlyRole.id));

    const resolvedOwnerAfterTerm = await storage.resolvePortalAccessContext(activatedOwnerAccess.id);
    const resolvedBoardOnlyAfterTerm = await storage.resolvePortalAccessContext(activatedBoardOnlyAccess.id);
    const boardOnlyAccessAfterTerm = await storage.getPortalAccessById(activatedBoardOnlyAccess.id);

    if (!resolvedOwnerAfterTerm || resolvedOwnerAfterTerm.effectiveRole !== "owner" || resolvedOwnerAfterTerm.hasBoardAccess) {
      throw new Error("Owner access did not downgrade back to owner-only after board term ended");
    }
    if (resolvedBoardOnlyAfterTerm) {
      throw new Error("Board-only access should be denied after board term ended");
    }
    if (!boardOnlyAccessAfterTerm || boardOnlyAccessAfterTerm.status !== "expired") {
      throw new Error("Board-only portal access was not marked expired after board term ended");
    }

    const auditRows = await db.select().from(portalAccess).where(and(
      eq(portalAccess.associationId, association.id),
    ));

    console.log(JSON.stringify({
      associationId: association.id,
      ownerAccessId: activatedOwnerAccess.id,
      boardOnlyAccessId: activatedBoardOnlyAccess.id,
      portalAccessCount: auditRows.length,
      checks: [
        "owner-board member resolves to combined access",
        "board-only member resolves to board-member access",
        "owner access downgrades to owner-only when board term ends",
        "board-only access expires when board term ends",
      ],
      status: "passed",
    }, null, 2));
  } finally {
    await cleanup(created);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Board member access verification failed:", error);
    process.exit(1);
  });
