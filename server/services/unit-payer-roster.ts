/**
 * Unit payer roster (Phase 1 — P0-1).
 *
 * Aggregates every co-owner name for a unit into a single, matchable roster,
 * with a designated PRIMARY contact person. This is the deterministic,
 * unit-scoped name source the reconciliation matcher reads when it matches a
 * deposit to a UNIT (rather than a single person).
 *
 * DESIGN CHOICE (per the roadmap: "Prefer deriving the roster from existing
 * `ownerships` rather than a brand-new table if clean"):
 *   - The roster is DERIVED from `ownerships ⋈ persons` — no new roster table.
 *     Every authorized co-owner of a unit is already modeled as an `ownerships`
 *     row (many-persons-per-unit, with startDate/endDate). That IS the roster.
 *   - The PRIMARY contact is `units.primaryContactPersonId` when set (an
 *     explicit, editable designation added in Phase 1), else it falls back to
 *     the earliest-startDate ACTIVE ownership (deterministic, stable).
 *
 * "Active" = an ownership whose window covers `asOf` (default now):
 * `startDate <= asOf` AND (`endDate` is null OR `endDate >= asOf`). Ended
 * ownerships (former owners) are excluded from the matchable roster by default.
 *
 * Pure helpers (roster assembly + name normalization + name-in-descriptor test)
 * live below the DB loader so they are unit-testable without Postgres.
 *
 * Tenant isolation: the loader filters every query by `associationId` and only
 * considers units within the association.
 */
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { ownerships, persons, units } from "@shared/schema";

/** One authorized payer on a unit's roster. */
export interface RosterMember {
  personId: string;
  firstName: string;
  lastName: string;
  /** Normalized "first last" for descriptor matching. */
  normalizedName: string;
  ownershipPercentage: number;
  startDate: Date;
  endDate: Date | null;
  /** True for exactly one member — the designated primary contact. */
  isPrimaryContact: boolean;
}

/** The full matchable roster for a single unit. */
export interface UnitPayerRoster {
  unitId: string;
  unitNumber: string | null;
  unitAccountRef: string | null;
  members: RosterMember[];
  /** The primary-contact person id (may be null if a unit has no owners). */
  primaryContactPersonId: string | null;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Normalize a name the SAME way the auto-matcher normalizes a bank descriptor,
 * so a roster name and a descriptor token compare on the same form.
 * (lowercase → [^a-z0-9 ] to space → collapse whitespace → trim)
 */
export function normalizeRosterName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface RawOwnership {
  personId: string;
  firstName: string;
  lastName: string;
  ownershipPercentage: number;
  startDate: Date;
  endDate: Date | null;
}

/** Is this ownership window active at `asOf`? */
export function isOwnershipActive(
  o: { startDate: Date; endDate: Date | null },
  asOf: Date,
): boolean {
  const startsOnOrBefore = o.startDate.getTime() <= asOf.getTime();
  const endsOnOrAfter = o.endDate === null || o.endDate.getTime() >= asOf.getTime();
  return startsOnOrBefore && endsOnOrAfter;
}

/**
 * Pure roster assembly — given a unit's raw active ownerships and the
 * explicit primaryContactPersonId (or null), produce the ordered roster with
 * exactly one primary flagged.
 *
 * Primary-contact resolution:
 *   1. If `explicitPrimaryPersonId` is set AND belongs to an active member →
 *      that member is primary.
 *   2. Else → the earliest-startDate active member (ties broken by personId for
 *      determinism) is primary.
 *   3. If there are no active members → primary is null.
 *
 * Ordering: primary first, then by ascending startDate, then personId.
 */
export function assembleRoster(input: {
  unitId: string;
  unitNumber: string | null;
  unitAccountRef: string | null;
  activeOwnerships: RawOwnership[];
  explicitPrimaryPersonId: string | null;
}): UnitPayerRoster {
  const { unitId, unitNumber, unitAccountRef, activeOwnerships, explicitPrimaryPersonId } = input;

  // Determine the primary person id.
  let primaryPersonId: string | null = null;
  if (activeOwnerships.length > 0) {
    const explicitIsActive =
      explicitPrimaryPersonId !== null &&
      activeOwnerships.some((o) => o.personId === explicitPrimaryPersonId);
    if (explicitIsActive) {
      primaryPersonId = explicitPrimaryPersonId;
    } else {
      // Earliest startDate, tie-broken by personId.
      const earliest = [...activeOwnerships].sort((a, b) => {
        const dt = a.startDate.getTime() - b.startDate.getTime();
        if (dt !== 0) return dt;
        return a.personId.localeCompare(b.personId);
      })[0];
      primaryPersonId = earliest.personId;
    }
  }

  const members: RosterMember[] = activeOwnerships.map((o) => ({
    personId: o.personId,
    firstName: o.firstName,
    lastName: o.lastName,
    normalizedName: normalizeRosterName(`${o.firstName} ${o.lastName}`),
    ownershipPercentage: o.ownershipPercentage,
    startDate: o.startDate,
    endDate: o.endDate,
    isPrimaryContact: o.personId === primaryPersonId,
  }));

  // Order: primary first, then ascending startDate, then personId.
  members.sort((a, b) => {
    if (a.isPrimaryContact && !b.isPrimaryContact) return -1;
    if (!a.isPrimaryContact && b.isPrimaryContact) return 1;
    const dt = a.startDate.getTime() - b.startDate.getTime();
    if (dt !== 0) return dt;
    return a.personId.localeCompare(b.personId);
  });

  return { unitId, unitNumber, unitAccountRef, members, primaryContactPersonId: primaryPersonId };
}

/**
 * Does ANY roster member's name appear in the bank descriptor? Returns the
 * best match tier across the roster:
 *   - "exact"   — some member's full first+last both appear as tokens.
 *   - "partial" — some member's first OR last appears, but none is exact.
 *   - "none"    — no member's name appears.
 *
 * This is the "match a deposit to a UNIT when ANY name on the roster appears"
 * signal (P0-1). Whole-token matching (same as the person-centric matcher) to
 * avoid substring false positives.
 */
export function rosterNameMatch(
  bankDescription: string | null | undefined,
  roster: Pick<UnitPayerRoster, "members">,
): "exact" | "partial" | "none" {
  if (!bankDescription) return "none";
  const tokens = new Set(normalizeRosterName(bankDescription).split(/\s+/).filter(Boolean));
  let best: "exact" | "partial" | "none" = "none";
  for (const m of roster.members) {
    const first = normalizeRosterName(m.firstName);
    const last = normalizeRosterName(m.lastName);
    const firstHit = first.length >= 2 && tokens.has(first);
    const lastHit = last.length >= 2 && tokens.has(last);
    if (firstHit && lastHit) return "exact"; // can't do better than exact
    if (firstHit || lastHit) best = "partial";
  }
  return best;
}

// ── DB loaders ────────────────────────────────────────────────────────────────

/**
 * Load the payer rosters for every unit in an association. Derived from
 * `ownerships ⋈ persons`, keyed by unit. Only ACTIVE ownerships (window covers
 * `asOf`) are included in each roster's member list.
 *
 * Tenant-isolated: units + ownerships + persons are all constrained to the
 * association (units by associationId; ownerships/persons by the unit set).
 */
export async function loadUnitPayerRosters(
  associationId: string,
  asOf: Date = new Date(),
): Promise<Map<string, UnitPayerRoster>> {
  const unitRows = await db
    .select({
      id: units.id,
      unitNumber: units.unitNumber,
      unitAccountRef: units.unitAccountRef,
      primaryContactPersonId: units.primaryContactPersonId,
    })
    .from(units)
    .where(eq(units.associationId, associationId));

  const unitIds = new Set(unitRows.map((u) => u.id));
  if (unitIds.size === 0) return new Map();

  // Ownerships joined to persons, restricted to units in this association.
  const ownershipRows = await db
    .select({
      unitId: ownerships.unitId,
      personId: ownerships.personId,
      ownershipPercentage: ownerships.ownershipPercentage,
      startDate: ownerships.startDate,
      endDate: ownerships.endDate,
      firstName: persons.firstName,
      lastName: persons.lastName,
    })
    .from(ownerships)
    .innerJoin(persons, eq(ownerships.personId, persons.id));

  const byUnit = new Map<string, RawOwnership[]>();
  for (const r of ownershipRows) {
    if (!unitIds.has(r.unitId)) continue; // tenant fence — only this assoc's units
    const startDate = r.startDate instanceof Date ? r.startDate : new Date(r.startDate);
    const endDate =
      r.endDate === null || r.endDate === undefined
        ? null
        : r.endDate instanceof Date
          ? r.endDate
          : new Date(r.endDate);
    if (!isOwnershipActive({ startDate, endDate }, asOf)) continue;
    const list = byUnit.get(r.unitId) ?? [];
    list.push({
      personId: r.personId,
      firstName: r.firstName,
      lastName: r.lastName,
      ownershipPercentage: r.ownershipPercentage,
      startDate,
      endDate,
    });
    byUnit.set(r.unitId, list);
  }

  const out = new Map<string, UnitPayerRoster>();
  for (const u of unitRows) {
    out.set(
      u.id,
      assembleRoster({
        unitId: u.id,
        unitNumber: u.unitNumber,
        unitAccountRef: u.unitAccountRef,
        activeOwnerships: byUnit.get(u.id) ?? [],
        explicitPrimaryPersonId: u.primaryContactPersonId ?? null,
      }),
    );
  }
  return out;
}

/** Load the payer roster for a single unit (tenant-scoped). */
export async function loadUnitPayerRoster(
  associationId: string,
  unitId: string,
  asOf: Date = new Date(),
): Promise<UnitPayerRoster | null> {
  const [unitRow] = await db
    .select({
      id: units.id,
      unitNumber: units.unitNumber,
      unitAccountRef: units.unitAccountRef,
      primaryContactPersonId: units.primaryContactPersonId,
    })
    .from(units)
    .where(and(eq(units.id, unitId), eq(units.associationId, associationId)))
    .limit(1);
  if (!unitRow) return null;

  const ownershipRows = await db
    .select({
      personId: ownerships.personId,
      ownershipPercentage: ownerships.ownershipPercentage,
      startDate: ownerships.startDate,
      endDate: ownerships.endDate,
      firstName: persons.firstName,
      lastName: persons.lastName,
    })
    .from(ownerships)
    .innerJoin(persons, eq(ownerships.personId, persons.id))
    .where(eq(ownerships.unitId, unitId));

  const active: RawOwnership[] = [];
  for (const r of ownershipRows) {
    const startDate = r.startDate instanceof Date ? r.startDate : new Date(r.startDate);
    const endDate =
      r.endDate === null || r.endDate === undefined
        ? null
        : r.endDate instanceof Date
          ? r.endDate
          : new Date(r.endDate);
    if (!isOwnershipActive({ startDate, endDate }, asOf)) continue;
    active.push({
      personId: r.personId,
      firstName: r.firstName,
      lastName: r.lastName,
      ownershipPercentage: r.ownershipPercentage,
      startDate,
      endDate,
    });
  }

  return assembleRoster({
    unitId: unitRow.id,
    unitNumber: unitRow.unitNumber,
    unitAccountRef: unitRow.unitAccountRef,
    activeOwnerships: active,
    explicitPrimaryPersonId: unitRow.primaryContactPersonId ?? null,
  });
}
