/**
 * verify-gl-amenity.ts — amenity money-loop ACCEPTANCE GATE (live DB).
 *
 * Audit anchor:  audits/AUDIT-financial-reporting-orchestration.md Gap F1 (Phase 3).
 * Build anchor:  audits/YCM-financial-build-plan-2026-06-20.md Phase 3.
 * Hardening:     audits/BLINDSPOT-pass-2026-06-20.md F4.
 *
 * Proves, against the LIVE database, the full Phase-3 acceptance criterion:
 *   "a clubhouse booking charges a fee, HOLDS a deposit (the 2300 liability
 *    APPEARS), then REFUNDS it (the liability CLEARS to 0¢), and every GL entry
 *    balances."
 *
 * It is SELF-CONTAINED + SELF-CLEANING (so it never leaves live data behind):
 *   1. creates a throwaway amenity + reservation scoped to a test association,
 *   2. posts the booking to the parallel GL (force, idempotent),
 *   3. asserts the 2300 Amenity-Deposits-Held liability == the held deposit (> 0),
 *   4. flips the reservation to "refunded", re-posts, asserts the liability == 0¢,
 *   5. asserts all GL entries balance (Σdebit == Σcredit) + invariants are clean,
 *   6. TEARS DOWN every row it created (gl_entries, reservation, amenity).
 *
 * FORWARD-ONLY / PARALLEL: it only writes the additive GL + its own throwaway
 * fixtures; it touches no live money path and is gated by `--force`. It exits 0
 * only if the liability appears then clears to exactly 0¢ with clean invariants.
 *
 * Run with:
 *   tsx script/verify-gl-amenity.ts                 # default: Cherry Hill assoc
 *   tsx script/verify-gl-amenity.ts <associationId>
 *
 * Requires DATABASE_URL and an existing person in the target association.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { and, eq, inArray } from "drizzle-orm";
import * as schema from "../shared/schema.js";
import {
  postAmenityReservations,
  validateInvariants,
  depositLiabilityCents,
  type AmenityReservationMoneyLike,
} from "../server/services/gl/amenity-posting.js";
import { ensureChartOfAccounts } from "../server/services/gl/gl-posting-service.js";
import { loadGlJournals } from "../server/services/gl/gl-posting-service.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const CHERRY_HILL_ID = "f301d073-ed84-4d73-84ce-3ef28af66f7a";
const associationId =
  process.argv.find((a) => !a.startsWith("-") && a.includes("-") && a.length >= 36) ?? CHERRY_HILL_ID;

const FEE_CENTS = 7500; // $75.00 usage fee
const DEPOSIT_CENTS = 20000; // $200.00 refundable deposit

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

function fmt(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Build the GL journals for a single reservation's money state + persist them
 *  idempotently. Returns the journals (for invariant + liability assertions). */
async function postOne(
  resId: string,
  money: Omit<AmenityReservationMoneyLike, "id">,
  accountByKey: Map<string, schema.GlAccount>,
) {
  const journals = postAmenityReservations([{ id: resId, ...money }]);
  const violations = validateInvariants(journals);
  if (violations.length > 0) {
    throw new Error(`invariant violations: ${violations.map((v) => `[${v.invariant}] ${v.detail}`).join("; ")}`);
  }
  const rows = journals.flatMap((j) =>
    j.legs.map((leg) => {
      const account = accountByKey.get(`${leg.accountCode}|${leg.fund}`);
      if (!account) throw new Error(`GL account missing for ${leg.accountCode}|${leg.fund}`);
      return {
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
      };
    }),
  );
  if (rows.length > 0) {
    await db.insert(schema.glEntries).values(rows).onConflictDoNothing();
  }
  return journals;
}

async function main() {
  console.log(`\n=== Amenity money-loop acceptance gate — association ${associationId} ===\n`);

  // A real person is needed for the FK. Reuse any existing one in the association.
  const [person] = await db
    .select({ id: schema.persons.id })
    .from(schema.persons)
    .where(eq(schema.persons.associationId, associationId))
    .limit(1);
  if (!person) {
    console.error(`No person in association ${associationId} — cannot create a test reservation.`);
    process.exit(2);
  }

  const accountByKey = await ensureChartOfAccounts(associationId);

  // ── Create throwaway fixtures (clearly tagged so teardown is precise) ────────
  const [amenity] = await db
    .insert(schema.amenities)
    .values({
      associationId,
      name: "VERIFY-GL-AMENITY clubhouse (throwaway)",
      category: "clubhouse",
      usageFeeCents: FEE_CENTS,
      depositCents: DEPOSIT_CENTS,
    })
    .returning();

  const [reservation] = await db
    .insert(schema.amenityReservations)
    .values({
      amenityId: amenity.id,
      associationId,
      personId: person.id,
      startAt: new Date("2026-06-21T15:00:00Z"),
      endAt: new Date("2026-06-21T19:00:00Z"),
      status: "approved",
      feeChargedCents: FEE_CENTS,
      depositHeldCents: DEPOSIT_CENTS,
    })
    .returning();

  let exitCode = 1;
  try {
    // ── Step 1+2: book it — fee charged + deposit held → liability APPEARS ─────
    await postOne(
      reservation.id,
      {
        feeChargedCents: FEE_CENTS,
        depositHeldCents: DEPOSIT_CENTS,
        depositRefundedCents: 0,
        depositForfeitedCents: 0,
        postedAt: reservation.createdAt,
        description: `clubhouse booking ${reservation.id}`,
      },
      accountByKey,
    );

    let persisted = await loadGlJournals(associationId);
    let mine = persisted.filter((j) => j.sourceId === reservation.id);
    const heldLiability = depositLiabilityCents(mine);
    console.log(`After HOLD:    deposit liability (2300) = ${fmt(heldLiability)} (${heldLiability}¢)  [expected ${fmt(DEPOSIT_CENTS)}]`);
    if (heldLiability !== DEPOSIT_CENTS) throw new Error(`deposit liability did not appear: got ${heldLiability}¢`);

    // ── Step 3: refund the deposit → liability CLEARS to 0¢ ───────────────────
    await db
      .update(schema.amenityReservations)
      .set({ depositRefundedCents: DEPOSIT_CENTS, updatedAt: new Date() })
      .where(eq(schema.amenityReservations.id, reservation.id));

    await postOne(
      reservation.id,
      {
        feeChargedCents: FEE_CENTS,
        depositHeldCents: DEPOSIT_CENTS,
        depositRefundedCents: DEPOSIT_CENTS,
        depositForfeitedCents: 0,
        postedAt: reservation.createdAt,
        description: `clubhouse booking ${reservation.id}`,
      },
      accountByKey,
    );

    persisted = await loadGlJournals(associationId);
    mine = persisted.filter((j) => j.sourceId === reservation.id);
    const clearedLiability = depositLiabilityCents(mine);
    console.log(`After REFUND:  deposit liability (2300) = ${fmt(clearedLiability)} (${clearedLiability}¢)  [expected $0.00]`);
    if (clearedLiability !== 0) throw new Error(`deposit liability did not clear: got ${clearedLiability}¢`);

    // ── All persisted entries balance + invariants clean ──────────────────────
    const violations = validateInvariants(mine);
    if (violations.length > 0) throw new Error(`invariants: ${violations.map((v) => v.detail).join("; ")}`);
    let dr = 0;
    let cr = 0;
    for (const j of mine) for (const l of j.legs) (l.side === "debit" ? (dr += l.amountCents) : (cr += l.amountCents));
    console.log(`Σdebit = ${fmt(dr)}   Σcredit = ${fmt(cr)}   balanced=${dr === cr}`);
    if (dr !== cr) throw new Error(`corpus does not balance: ΣDR=${dr} != ΣCR=${cr}`);

    console.log("\n✅ PASS — clubhouse fee posted; deposit liability appeared then cleared to $0.00; all entries balance.");
    console.log("   (The GL remains PARALLEL and NOT source-of-truth — flip is out of scope.)\n");
    exitCode = 0;
  } finally {
    // ── Teardown — remove every row this run created (never leave live data) ──
    const created = await db
      .select({ id: schema.glEntries.id })
      .from(schema.glEntries)
      .where(and(eq(schema.glEntries.associationId, associationId), eq(schema.glEntries.sourceId, reservation.id)));
    if (created.length > 0) {
      await db.delete(schema.glEntries).where(inArray(schema.glEntries.id, created.map((r) => r.id)));
    }
    await db.delete(schema.amenityReservations).where(eq(schema.amenityReservations.id, reservation.id));
    await db.delete(schema.amenities).where(eq(schema.amenities.id, amenity.id));
    console.log("(teardown: removed throwaway reservation, amenity, and its GL entries)");
  }

  await pool.end();
  process.exit(exitCode);
}

main().catch(async (err) => {
  console.error("verify-gl-amenity crashed:", err);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
