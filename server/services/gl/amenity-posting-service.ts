/**
 * Amenity money-loop GL posting service — DB-bound, thin, idempotent
 * (YCM Financial Core — Phase 3).
 *
 * Audit anchor:  audits/AUDIT-financial-reporting-orchestration.md Gap F1 (Phase 3).
 * Build anchor:  audits/YCM-financial-build-plan-2026-06-20.md Phase 3.
 * Hardening:     audits/BLINDSPOT-pass-2026-06-20.md F4 (forward-only / parallel).
 *
 * This is the ONLY DB writer for amenity GL postings. It:
 *   1. ensures the per-association chart of accounts (reuses the dues GL seeder —
 *      the chart now includes 2300 Amenity Deposits Held + 4445 Amenity Income),
 *   2. reads the amenity_reservations money state (source of record — read-only),
 *   3. derives balanced journal entries via the PURE core (./amenity-posting.ts),
 *   4. validates the double-entry invariants BEFORE any write,
 *   5. inserts the legs idempotently (onConflictDoNothing on the source-leg unique
 *      index), so re-running is a safe no-op.
 *
 * FORWARD-ONLY / PARALLEL: it never writes to amenity_reservations or any live
 * table. It is gated by GL_ENABLED (default OFF). The reservation row STAYS the
 * source of record; the GL is built alongside it and is NOT authoritative.
 */

import { eq } from "drizzle-orm";
import { db } from "../../db";
import {
  amenityReservations,
  glEntries,
  type GlAccount,
  type InsertGlEntry,
} from "@shared/schema";
import { type JournalEntry } from "./posting";
import {
  postAmenityReservations,
  validateInvariants,
  type AmenityReservationMoneyLike,
} from "./amenity-posting";
import { ensureChartOfAccounts } from "./gl-posting-service";
import { isGlEnabled } from "./flag";

export interface AmenityGlPostingResult {
  skipped: boolean;
  reason?: string;
  accountsSeeded: number;
  reservationsConsidered: number;
  journalsConsidered: number;
  legsInserted: number;
}

/** Load amenity-reservation money state for an association as the pure-core
 *  input shape. Reservations with no money activity are dropped early. */
async function loadAmenityMoneyState(associationId: string): Promise<AmenityReservationMoneyLike[]> {
  const rows = await db
    .select()
    .from(amenityReservations)
    .where(eq(amenityReservations.associationId, associationId));

  return rows
    .filter(
      (r) =>
        r.feeChargedCents > 0 ||
        r.depositHeldCents > 0 ||
        r.depositRefundedCents > 0 ||
        r.depositForfeitedCents > 0,
    )
    .map((r) => ({
      id: r.id,
      feeChargedCents: r.feeChargedCents,
      depositHeldCents: r.depositHeldCents,
      depositRefundedCents: r.depositRefundedCents,
      depositForfeitedCents: r.depositForfeitedCents,
      postedAt: r.createdAt,
      description: `amenity reservation ${r.id}`,
    }));
}

/** Turn validated amenity journal entries into gl_entries insert rows. */
function toInsertRows(
  associationId: string,
  journals: JournalEntry[],
  accountByKey: Map<string, GlAccount>,
): InsertGlEntry[] {
  const rows: InsertGlEntry[] = [];
  for (const j of journals) {
    for (const leg of j.legs) {
      const account = accountByKey.get(`${leg.accountCode}|${leg.fund}`);
      if (!account) {
        // A missing account is a seeding bug, not a silent skip.
        throw new Error(`GL account missing for code=${leg.accountCode} fund=${leg.fund}`);
      }
      rows.push({
        associationId,
        journalId: j.journalId,
        glAccountId: account.id,
        fund: leg.fund,
        side: leg.side,
        amountCents: leg.amountCents,
        postedAt: j.postedAt,
        description: j.description,
        sourceType: j.sourceType,
        sourceId: j.sourceId,
      });
    }
  }
  return rows;
}

/**
 * Post (sync) the amenity-reservation money loop into the parallel GL for one
 * association. Idempotent — re-running never double-posts.
 *
 * Returns a result describing what happened. If GL_ENABLED is off, returns
 * `{ skipped: true }` without touching the database.
 *
 * @param opts.force  ignore the GL_ENABLED flag (used by the verify script /
 *                    tests, which must build the GL to compare it).
 */
export async function syncAssociationAmenityGl(
  associationId: string,
  opts: { force?: boolean } = {},
): Promise<AmenityGlPostingResult> {
  if (!opts.force && !isGlEnabled()) {
    return {
      skipped: true,
      reason: "GL_ENABLED is off (forward-only/parallel: GL not source-of-truth)",
      accountsSeeded: 0,
      reservationsConsidered: 0,
      journalsConsidered: 0,
      legsInserted: 0,
    };
  }

  const accountByKey = await ensureChartOfAccounts(associationId);
  const accountsSeeded = accountByKey.size;

  const moneyState = await loadAmenityMoneyState(associationId);
  const journals = postAmenityReservations(moneyState);

  // HARD GATE: validate double-entry + interfund invariants BEFORE writing.
  const violations = validateInvariants(journals);
  if (violations.length > 0) {
    throw new Error(
      `amenity GL invariant violations (refusing to post): ${violations
        .map((v) => `[${v.invariant}] ${v.detail}`)
        .join("; ")}`,
    );
  }

  const rows = toInsertRows(associationId, journals, accountByKey);
  let legsInserted = 0;
  if (rows.length > 0) {
    // Idempotent insert against gl_entries_source_leg_uq — re-running is a no-op.
    const inserted = await db
      .insert(glEntries)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: glEntries.id });
    legsInserted = inserted.length;
  }

  return {
    skipped: false,
    accountsSeeded,
    reservationsConsidered: moneyState.length,
    journalsConsidered: journals.length,
    legsInserted,
  };
}
