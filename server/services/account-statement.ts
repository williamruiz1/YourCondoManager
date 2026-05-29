/**
 * Owner account statement — DB-backed assembly (readiness P0-3 / Issue #206).
 *
 * Produces the document a treasurer hands an owner: opening balance, the
 * period's line items (assessments / charges / payments / late fees / credits /
 * adjustments), and the closing balance for a date range. This is the single
 * deliverable William's gate ("know my balance") asks for.
 *
 * The pure statement math lives in `account-statement-math.ts` (DB-free, so it
 * is unit-testable without Postgres). This module loads the owner's ledger
 * rows + resolves the display header, then calls `computeStatement`.
 *
 * Scope semantics:
 *   - associationId is ALWAYS required (tenant isolation).
 *   - personId scopes to a single owner across all their units (the portal's
 *     model — an owner may hold multiple units under one personId).
 *   - unitId optionally narrows to a single unit.
 */
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import {
  associations,
  ownerLedgerEntries,
  persons,
  units,
} from "@shared/schema";
import {
  computeStatement,
  type AccountStatement,
  type StatementLedgerEntry,
} from "./account-statement-math";

// Re-export the pure-math surface so existing imports of these symbols from
// `account-statement` keep working.
export {
  computeStatement,
  parsePeriodBounds,
} from "./account-statement-math";
export type {
  AccountStatement,
  StatementLineItem,
  StatementCategoryTotals,
  StatementEntryType,
  StatementLedgerEntry,
} from "./account-statement-math";

/** Display header for the rendered statement (owner / unit / association). */
export interface StatementHeader {
  associationName: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  unitNumber: string | null;
  building: string | null;
}

export interface AccountStatementWithHeader extends AccountStatement {
  header: StatementHeader;
}

/**
 * Load the owner's ledger entries (tenant + owner + optional-unit scoped),
 * resolve the display header, and compute the statement.
 *
 * Tenant isolation: every query filters by `associationId`. The personId
 * filter scopes to a single owner; unitId, when present, narrows to one unit.
 *
 * Returns null if the person doesn't belong to the association (defensive —
 * prevents leaking a statement for someone outside the tenant).
 */
export async function buildAccountStatement(input: {
  associationId: string;
  personId: string;
  unitId: string | null;
  from: Date;
  to: Date;
}): Promise<AccountStatementWithHeader | null> {
  const { associationId, personId, unitId, from, to } = input;

  // Verify the person belongs to this association (tenant fence).
  const personRows = await db
    .select({
      id: persons.id,
      firstName: persons.firstName,
      lastName: persons.lastName,
      email: persons.email,
      associationId: persons.associationId,
    })
    .from(persons)
    .where(and(eq(persons.id, personId), eq(persons.associationId, associationId)))
    .limit(1);
  const person = personRows[0];
  if (!person) return null;

  // Pull all ledger entries for the owner scope (across all time — the pure
  // function partitions into opening vs in-period). Tenant + owner scoped;
  // optionally unit-scoped.
  const whereClause = unitId
    ? and(
        eq(ownerLedgerEntries.associationId, associationId),
        eq(ownerLedgerEntries.personId, personId),
        eq(ownerLedgerEntries.unitId, unitId),
      )
    : and(
        eq(ownerLedgerEntries.associationId, associationId),
        eq(ownerLedgerEntries.personId, personId),
      );

  const rows = await db
    .select({
      id: ownerLedgerEntries.id,
      entryType: ownerLedgerEntries.entryType,
      amount: ownerLedgerEntries.amount,
      postedAt: ownerLedgerEntries.postedAt,
      description: ownerLedgerEntries.description,
    })
    .from(ownerLedgerEntries)
    .where(whereClause);

  const entries: StatementLedgerEntry[] = rows.map((r) => ({
    id: r.id,
    entryType: r.entryType,
    amount: r.amount,
    postedAt: r.postedAt instanceof Date ? r.postedAt : new Date(r.postedAt),
    description: r.description,
  }));

  // Resolve header display fields.
  const [assocRow] = await db
    .select({ name: associations.name })
    .from(associations)
    .where(eq(associations.id, associationId))
    .limit(1);

  let unitNumber: string | null = null;
  let building: string | null = null;
  if (unitId) {
    const [unitRow] = await db
      .select({ unitNumber: units.unitNumber, building: units.building })
      .from(units)
      .where(and(eq(units.id, unitId), eq(units.associationId, associationId)))
      .limit(1);
    unitNumber = unitRow?.unitNumber ?? null;
    building = unitRow?.building ?? null;
  }

  const statement = computeStatement({
    associationId,
    personId,
    unitId,
    entries,
    from,
    to,
  });

  return {
    ...statement,
    header: {
      associationName: assocRow?.name ?? null,
      ownerName: `${person.firstName} ${person.lastName}`.trim() || null,
      ownerEmail: person.email ?? null,
      unitNumber,
      building,
    },
  };
}
