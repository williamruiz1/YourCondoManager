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
  ownerships,
  persons,
  units,
} from "@shared/schema";
import { ownerLedgerAmountDollars } from "@shared/owner-ledger-money";
import { loadUnitPayerRoster, type UnitPayerRoster } from "./unit-payer-roster";
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
 * Phase 1 (P0-1) — the UNIT-scoped statement. The balance-bearing entity is the
 * UNIT; every co-owner's ledger rows for the unit are aggregated. The header
 * carries the full payer roster (all authorized co-owners + the designated
 * primary contact) rather than a single owner.
 */
export interface UnitStatementHeader {
  associationName: string | null;
  unitNumber: string | null;
  building: string | null;
  unitAccountRef: string | null;
  /** All authorized payers on the unit (primary first). */
  payerRoster: UnitPayerRoster["members"];
  primaryContactPersonId: string | null;
}

export interface UnitAccountStatementWithHeader extends AccountStatement {
  header: UnitStatementHeader;
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
  //
  // `persons.association_id` is an OPTIONAL column (nullable, no NOT NULL) and
  // is NOT the system's authoritative person↔association binding — across CHC
  // (and any association seeded without backfilling it) all `persons` rows have
  // `association_id = NULL`, so fencing on it 404'd EVERY owner's statement
  // (Issue: owner-portal account-statement 404). The rest of the portal
  // (ledger, financial-dashboard, owned-units resolution) never scopes by
  // `persons.association_id` — it scopes by the owner's ledger entries +
  // ownerships in the association. We match that model: a person is in-scope
  // for this association's statement if ANY authoritative binding holds —
  //   (a) an ownership of a unit in this association (the portal's canonical
  //       binding, the same `ownerships ⋈ units.associationId` the portal uses),
  //   (b) ledger entries in this association (they're a billed owner here), OR
  //   (c) `persons.association_id` matches where the column IS populated.
  // This is strictly no looser than the old fence: every admitted case is a
  // real person↔association relationship, so cross-tenant leakage is impossible.
  const personRows = await db
    .select({
      id: persons.id,
      firstName: persons.firstName,
      lastName: persons.lastName,
      email: persons.email,
      associationId: persons.associationId,
    })
    .from(persons)
    .where(eq(persons.id, personId))
    .limit(1);
  const person = personRows[0];
  if (!person) return null;

  // Tenant binding check (matches how the working portal finance views scope).
  let belongsToAssociation = person.associationId === associationId;
  if (!belongsToAssociation) {
    const [ownershipRow] = await db
      .select({ id: ownerships.id })
      .from(ownerships)
      .innerJoin(units, eq(ownerships.unitId, units.id))
      .where(
        and(
          eq(ownerships.personId, personId),
          eq(units.associationId, associationId),
        ),
      )
      .limit(1);
    belongsToAssociation = Boolean(ownershipRow);
  }
  if (!belongsToAssociation) {
    const [ledgerRow] = await db
      .select({ id: ownerLedgerEntries.id })
      .from(ownerLedgerEntries)
      .where(
        and(
          eq(ownerLedgerEntries.personId, personId),
          eq(ownerLedgerEntries.associationId, associationId),
        ),
      )
      .limit(1);
    belongsToAssociation = Boolean(ledgerRow);
  }
  if (!belongsToAssociation) return null;

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
      amountCents: ownerLedgerEntries.amountCents,
      postedAt: ownerLedgerEntries.postedAt,
      description: ownerLedgerEntries.description,
    })
    .from(ownerLedgerEntries)
    .where(whereClause);

  const entries: StatementLedgerEntry[] = rows.map((r) => ({
    id: r.id,
    entryType: r.entryType,
    amount: ownerLedgerAmountDollars(r),
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


/**
 * Phase 1 (P0-1) — build the UNIT-scoped account statement.
 *
 * The UNIT is the balance-bearing entity: this aggregates EVERY co-owner's
 * ledger rows for the unit (scoped by `unitId`, NOT `personId`) into one
 * statement, and attaches the payer roster (all authorized co-owners + the
 * designated primary contact) to the header.
 *
 * This is ADDITIVE — `buildAccountStatement(personId)` is unchanged and remains
 * the per-owner view. This function is the unit source-of-truth statement the
 * roadmap's P0-1 calls for. Callers should gate on the UNIT_CENTRIC_LEDGER flag
 * before preferring this over the person-scoped statement (that gating is the
 * caller's / route's responsibility; the function itself is always safe to
 * call and reads only additive data).
 *
 * Tenant isolation: every query filters by `associationId`; the unit must
 * belong to the association or the function returns null.
 */
export async function buildUnitAccountStatement(input: {
  associationId: string;
  unitId: string;
  from: Date;
  to: Date;
}): Promise<UnitAccountStatementWithHeader | null> {
  const { associationId, unitId, from, to } = input;

  // Verify the unit belongs to this association (tenant fence).
  const [unitRow] = await db
    .select({
      id: units.id,
      unitNumber: units.unitNumber,
      building: units.building,
      unitAccountRef: units.unitAccountRef,
    })
    .from(units)
    .where(and(eq(units.id, unitId), eq(units.associationId, associationId)))
    .limit(1);
  if (!unitRow) return null;

  // Pull EVERY ledger entry for the unit scope (all co-owners, all time). The
  // pure computeStatement partitions into opening vs in-period.
  const rows = await db
    .select({
      id: ownerLedgerEntries.id,
      entryType: ownerLedgerEntries.entryType,
      amountCents: ownerLedgerEntries.amountCents,
      postedAt: ownerLedgerEntries.postedAt,
      description: ownerLedgerEntries.description,
    })
    .from(ownerLedgerEntries)
    .where(
      and(
        eq(ownerLedgerEntries.associationId, associationId),
        eq(ownerLedgerEntries.unitId, unitId),
      ),
    );

  const entries: StatementLedgerEntry[] = rows.map((r) => ({
    id: r.id,
    entryType: r.entryType,
    amount: ownerLedgerAmountDollars(r),
    postedAt: r.postedAt instanceof Date ? r.postedAt : new Date(r.postedAt),
    description: r.description,
  }));

  const [assocRow] = await db
    .select({ name: associations.name })
    .from(associations)
    .where(eq(associations.id, associationId))
    .limit(1);

  const roster = await loadUnitPayerRoster(associationId, unitId);

  const statement = computeStatement({
    associationId,
    // The unit statement is not scoped to a single person; personId is left
    // empty (the balance owner is the UNIT). unitId is the anchor.
    personId: "",
    unitId,
    entries,
    from,
    to,
  });

  return {
    ...statement,
    header: {
      associationName: assocRow?.name ?? null,
      unitNumber: unitRow.unitNumber,
      building: unitRow.building ?? null,
      unitAccountRef: unitRow.unitAccountRef ?? null,
      payerRoster: roster?.members ?? [],
      primaryContactPersonId: roster?.primaryContactPersonId ?? null,
    },
  };
}
