import { and, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db } from "../db";
import {
  associationMemberships,
  auditLogs,
  ownerLedgerEntries,
  ownerships,
  personContactPoints,
  persons,
  units,
  violations,
  type InsertOwnerLedgerEntry,
  type InsertPerson,
  type InsertViolation,
} from "@shared/schema";

type DbTx = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

export class BoardWorkflowError extends Error {
  constructor(message: string, public readonly code: string, public readonly httpStatus = 400) {
    super(message);
    this.name = "BoardWorkflowError";
  }
}

async function requireUnit(tx: DbTx, associationId: string, unitId: string) {
  const [unit] = await tx.select().from(units).where(eq(units.id, unitId)).limit(1);
  if (!unit || unit.associationId !== associationId) {
    throw new BoardWorkflowError("The selected home does not belong to this community.", "UNIT_SCOPE_MISMATCH");
  }
  return unit;
}

async function requireActiveOwner(tx: DbTx, associationId: string, unitId: string, personId: string) {
  await requireUnit(tx, associationId, unitId);
  const now = new Date();
  const [ownership] = await tx
    .select({ id: ownerships.id })
    .from(ownerships)
    .where(and(
      eq(ownerships.unitId, unitId),
      eq(ownerships.personId, personId),
      lte(ownerships.startDate, now),
      or(isNull(ownerships.endDate), gte(ownerships.endDate, now)),
    ))
    .limit(1);
  if (!ownership) {
    throw new BoardWorkflowError(
      "The selected person is not an active owner of the selected home.",
      "OWNER_UNIT_MISMATCH",
    );
  }
}

export async function postBoardCharge(input: {
  ledgerEntry: InsertOwnerLedgerEntry;
  actorEmail: string;
}) {
  return db.transaction(async (tx) => {
    await requireActiveOwner(
      tx,
      input.ledgerEntry.associationId,
      input.ledgerEntry.unitId,
      input.ledgerEntry.personId,
    );
    const [ledgerEntry] = await tx.insert(ownerLedgerEntries).values(input.ledgerEntry).returning();
    await tx.insert(auditLogs).values({
      actorEmail: input.actorEmail,
      action: "board-charge-posted",
      entityType: "owner-ledger-entry",
      entityId: ledgerEntry.id,
      associationId: input.ledgerEntry.associationId,
      beforeJson: null,
      afterJson: ledgerEntry,
    });
    return {
      ledgerEntry,
      notification: { status: "not-sent" as const, reason: "Posting a charge does not automatically send an owner notice." },
    };
  });
}

export async function logBoardViolation(input: {
  violation: InsertViolation;
  actorEmail: string;
}) {
  return db.transaction(async (tx) => {
    if (input.violation.unitId) {
      await requireUnit(tx, input.violation.associationId, input.violation.unitId);
    }
    if (input.violation.fineAmount && input.violation.fineAmount > 0) {
      if (!input.violation.unitId || !input.violation.personId) {
        throw new BoardWorkflowError("A home and active owner are required when adding a fine.", "FINE_TARGET_REQUIRED");
      }
      await requireActiveOwner(
        tx,
        input.violation.associationId,
        input.violation.unitId,
        input.violation.personId,
      );
    }

    const [violation] = await tx
      .insert(violations)
      .values({ ...input.violation, loggedByEmail: input.actorEmail })
      .returning();

    let ledgerEntry = null;
    if (
      input.violation.fineAmount &&
      input.violation.fineAmount > 0 &&
      input.violation.unitId &&
      input.violation.personId
    ) {
      [ledgerEntry] = await tx
        .insert(ownerLedgerEntries)
        .values({
          associationId: input.violation.associationId,
          unitId: input.violation.unitId,
          personId: input.violation.personId,
          entryType: "charge",
          amount: input.violation.fineAmount,
          postedAt: new Date(),
          description: `Fine — ${input.violation.violationType}`,
          referenceType: "violation",
          referenceId: violation.id,
        })
        .returning();
      await tx
        .update(violations)
        .set({ ledgerEntryId: ledgerEntry.id, updatedAt: new Date() })
        .where(eq(violations.id, violation.id));
    }

    await tx.insert(auditLogs).values({
      actorEmail: input.actorEmail,
      action: "board-violation-logged",
      entityType: "violation",
      entityId: violation.id,
      associationId: input.violation.associationId,
      beforeJson: null,
      afterJson: { ...violation, ledgerEntryId: ledgerEntry?.id ?? null },
    });
    return {
      violation: { ...violation, ledgerEntryId: ledgerEntry?.id ?? violation.ledgerEntryId },
      ledgerEntry,
      notification: { status: "not-sent" as const, reason: "Logging a violation does not automatically send a legal notice." },
    };
  });
}

export async function addBoardOwner(input: {
  person: InsertPerson;
  unitId?: string | null;
  actorEmail: string;
}) {
  return db.transaction(async (tx) => {
    const associationId = input.person.associationId;
    if (!associationId) {
      throw new BoardWorkflowError("A community is required.", "ASSOCIATION_REQUIRED");
    }
    if (input.unitId) {
      await requireUnit(tx, associationId, input.unitId);
      const activeRows = await tx
        .select({ ownershipPercentage: ownerships.ownershipPercentage })
        .from(ownerships)
        .where(and(eq(ownerships.unitId, input.unitId), isNull(ownerships.endDate)));
      const activePercentage = activeRows.reduce((sum, row) => sum + row.ownershipPercentage, 0);
      if (activePercentage + 100 > 100) {
        throw new BoardWorkflowError(
          "This home already has active ownership totaling 100%. Update the existing ownership before adding another owner.",
          "OWNERSHIP_CAPACITY_EXCEEDED",
        );
      }
    }

    const [person] = await tx.insert(persons).values(input.person).returning();
    const contacts = [
      person.email
        ? { channel: "email" as const, value: person.email.trim(), normalizedValue: person.email.trim().toLowerCase() }
        : null,
      person.phone
        ? { channel: "phone" as const, value: person.phone.trim(), normalizedValue: person.phone.replace(/\D/g, "") }
        : null,
    ].filter((row): row is NonNullable<typeof row> => Boolean(row?.normalizedValue));
    if (contacts.length > 0) {
      await tx.insert(personContactPoints).values(contacts.map((contact) => ({
        personId: person.id,
        associationId,
        ...contact,
        isPrimary: 1,
        source: "person-record",
      })));
    }

    let ownership = null;
    if (input.unitId) {
      [ownership] = await tx.insert(ownerships).values({
        unitId: input.unitId,
        personId: person.id,
        ownershipPercentage: 100,
        startDate: new Date(),
      }).returning();
      await tx.insert(associationMemberships).values({
        associationId,
        personId: person.id,
        unitId: input.unitId,
        membershipType: "owner",
        status: "active",
        isPrimary: 1,
      });
    }

    await tx.insert(auditLogs).values([
      {
        actorEmail: input.actorEmail,
        action: "board-owner-added",
        entityType: "person",
        entityId: person.id,
        associationId,
        beforeJson: null,
        afterJson: person,
      },
      ...(ownership ? [{
        actorEmail: input.actorEmail,
        action: "create",
        entityType: "ownership",
        entityId: ownership.id,
        associationId,
        beforeJson: null,
        afterJson: ownership,
      }] : []),
    ]);
    return {
      person,
      ownership,
      notification: { status: "not-sent" as const, reason: "Adding an owner does not automatically create or send a portal invitation." },
    };
  });
}
