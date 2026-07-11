/**
 * Amenity money-loop GL posting core (YCM Financial Core — Phase 3).
 *
 * Audit anchor:  audits/AUDIT-financial-reporting-orchestration.md Gap F1 (Phase 3).
 * Build anchor:  audits/YCM-financial-build-plan-2026-06-20.md Phase 3 — amenity
 *                rental money loop ("a clubhouse booking charges a fee, holds +
 *                refunds a deposit, and posts to the GL as a real liability").
 * Hardening:     audits/BLINDSPOT-pass-2026-06-20.md F4 (forward-only / parallel).
 *
 * THIS FILE IS PURE — no DB, no I/O, no Date.now(). It turns one amenity
 * reservation's money STATE (fee charged, deposit held, deposit refunded,
 * deposit forfeited) into a set of BALANCED double-entry legs that post to the
 * SAME fund-aware GL as the dues subledger. Being pure makes the double-entry
 * invariants (Σdebit == Σcredit, deposit liability nets to zero after refund)
 * testable without a database, and keeps the live booking path untouched.
 *
 * FORWARD-ONLY / PARALLEL (per BLINDSPOT F4): the amenity_reservations row is the
 * source fact; the GL is DERIVED from it and is NOT authoritative. These postings
 * are gated by GL_ENABLED (default OFF) at the service boundary. Nothing in the
 * live booking insert path is changed.
 *
 * MONEY IS INTEGER CENTS everywhere — the reservation columns are already cents,
 * so the balance invariant is exact and cannot float-drift.
 *
 * ── The accounting model ──────────────────────────────────────────────────────
 *
 *   FEE (amenity usage fee billed):
 *       DR  1200 Accounts Receivable        (asset ↑ — resident now owes the fee)
 *       CR  4445 Amenity Rental Income       (income ↑)
 *     (When the fee is paid through the owner ledger, the existing dues posting
 *      path clears 1200 — Phase 3 books the EARNING of the fee, mirroring how
 *      assessments are billed before payment.)
 *
 *   DEPOSIT HELD (refundable deposit taken at booking):
 *       DR  1010 Operating Cash             (asset ↑ — cash received)
 *       CR  2300 Amenity Deposits Held      (LIABILITY ↑ — we owe it back)
 *     The 2300 liability is real on the balance sheet until refunded/forfeited.
 *
 *   DEPOSIT REFUNDED (returned on checkout/clean return):
 *       DR  2300 Amenity Deposits Held      (liability ↓ — obligation discharged)
 *       CR  1010 Operating Cash             (asset ↓ — cash paid back)
 *     After a full refund the 2300 balance for this booking nets to ZERO.
 *
 *   DEPOSIT FORFEITED (kept for damage/violation — reclass liability → income):
 *       DR  2300 Amenity Deposits Held      (liability ↓ — no longer owed back)
 *       CR  4445 Amenity Rental Income       (income ↑ — recognised as income)
 *
 * Each event is its own balanced journal with a STABLE, source-derived journalId
 * so re-posting the same reservation produces no duplicate legs (idempotent — the
 * same (sourceType, sourceId, account, side) unique index the dues GL uses).
 */

import type { GlFund } from "@shared/schema";
import {
  validateInvariants,
  type JournalEntry,
  type PostingLeg,
} from "./posting";

/** Account codes the amenity money loop touches. Centralised so the chart seed,
 *  the postings, and the tests all reference one source of truth. */
export const AMENITY_GL_CODES = {
  /** 1010 Operating Cash (asset). */
  CASH: "1010",
  /** 1200 Accounts Receivable — Assessments (asset). The fee is billed here. */
  AR: "1200",
  /** 2300 Amenity Deposits Held (LIABILITY) — the refundable deposit obligation. */
  DEPOSIT_LIABILITY: "2300",
  /** 4445 Amenity Rental Income (income). Fee + forfeited-deposit income. */
  AMENITY_INCOME: "4445",
} as const;

/**
 * The minimal money-state shape this mapper needs from an amenity_reservations
 * row. Kept structural so the pure core has no DB dependency. All amounts are
 * INTEGER CENTS (the schema columns are integer cents). The amenity money loop is
 * an OPERATING-fund concern in Phase 3.
 */
export interface AmenityReservationMoneyLike {
  /** amenity_reservations.id — makes the postings idempotent + traceable. */
  id: string;
  /** Usage fee billed for this booking (cents). 0 == no fee. */
  feeChargedCents: number;
  /** Refundable deposit held at booking (cents). 0 == no deposit. */
  depositHeldCents: number;
  /** Portion of the held deposit refunded (cents). */
  depositRefundedCents: number;
  /** Portion of the held deposit forfeited → income (cents). */
  depositForfeitedCents: number;
  /** When the booking posted (drives postedAt on the legs). */
  postedAt: Date;
  /** Optional human description for the legs. */
  description?: string | null;
}

const FUND: GlFund = "operating";

/** Guard: amounts must be non-negative integer cents. A negative or fractional
 *  money-state value is a programming/data error, never silently posted. */
function assertCents(label: string, cents: number): void {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error(`amenity posting: ${label} must be a non-negative integer (cents), got ${cents}`);
  }
}

/**
 * Map ONE amenity reservation's money state to its set of balanced journal
 * entries — one journal per money EVENT (fee / deposit-held / refund / forfeit).
 * Each is a distinct journalId so the events post (and reconcile) independently
 * and idempotently. Zero-amount events produce no journal (a balanced no-op).
 *
 * INVARIANT (proven by the test suite): after a full refund the 2300 Deposit
 * liability derived from these legs nets to 0¢; debits == credits everywhere.
 */
export function postAmenityReservation(res: AmenityReservationMoneyLike): JournalEntry[] {
  assertCents("feeChargedCents", res.feeChargedCents);
  assertCents("depositHeldCents", res.depositHeldCents);
  assertCents("depositRefundedCents", res.depositRefundedCents);
  assertCents("depositForfeitedCents", res.depositForfeitedCents);

  // A booking can never refund + forfeit more deposit than it held. Catch the
  // over-resolution before it produces a negative liability.
  if (res.depositRefundedCents + res.depositForfeitedCents > res.depositHeldCents) {
    throw new Error(
      `amenity posting: refunded (${res.depositRefundedCents}) + forfeited ` +
        `(${res.depositForfeitedCents}) exceeds held (${res.depositHeldCents}) for reservation ${res.id}`,
    );
  }

  const journals: JournalEntry[] = [];
  const baseDesc = res.description ?? "amenity reservation";

  const leg = (accountCode: string, side: "debit" | "credit", amountCents: number): PostingLeg => ({
    accountCode,
    fund: FUND,
    side,
    amountCents,
  });

  // ── FEE — DR AR, CR Amenity Rental Income ──────────────────────────────────
  if (res.feeChargedCents > 0) {
    journals.push({
      journalId: `amn-fee-${res.id}`,
      sourceType: "amenity_reservation",
      sourceId: res.id,
      postedAt: res.postedAt,
      description: `${baseDesc} — usage fee`,
      legs: [
        leg(AMENITY_GL_CODES.AR, "debit", res.feeChargedCents),
        leg(AMENITY_GL_CODES.AMENITY_INCOME, "credit", res.feeChargedCents),
      ],
    });
  }

  // ── DEPOSIT HELD — DR Cash, CR Deposit Liability ───────────────────────────
  if (res.depositHeldCents > 0) {
    journals.push({
      journalId: `amn-deposit-${res.id}`,
      sourceType: "amenity_reservation",
      sourceId: res.id,
      postedAt: res.postedAt,
      description: `${baseDesc} — refundable deposit held`,
      legs: [
        leg(AMENITY_GL_CODES.CASH, "debit", res.depositHeldCents),
        leg(AMENITY_GL_CODES.DEPOSIT_LIABILITY, "credit", res.depositHeldCents),
      ],
    });
  }

  // ── DEPOSIT REFUNDED — DR Deposit Liability, CR Cash ───────────────────────
  if (res.depositRefundedCents > 0) {
    journals.push({
      journalId: `amn-refund-${res.id}`,
      sourceType: "amenity_reservation",
      sourceId: res.id,
      postedAt: res.postedAt,
      description: `${baseDesc} — deposit refunded`,
      legs: [
        leg(AMENITY_GL_CODES.DEPOSIT_LIABILITY, "debit", res.depositRefundedCents),
        leg(AMENITY_GL_CODES.CASH, "credit", res.depositRefundedCents),
      ],
    });
  }

  // ── DEPOSIT FORFEITED — DR Deposit Liability, CR Amenity Income ─────────────
  if (res.depositForfeitedCents > 0) {
    journals.push({
      journalId: `amn-forfeit-${res.id}`,
      sourceType: "amenity_reservation",
      sourceId: res.id,
      postedAt: res.postedAt,
      description: `${baseDesc} — deposit forfeited (recognised as income)`,
      legs: [
        leg(AMENITY_GL_CODES.DEPOSIT_LIABILITY, "debit", res.depositForfeitedCents),
        leg(AMENITY_GL_CODES.AMENITY_INCOME, "credit", res.depositForfeitedCents),
      ],
    });
  }

  return journals;
}

/** Map a batch of reservations to journal entries (flattened). */
export function postAmenityReservations(rows: AmenityReservationMoneyLike[]): JournalEntry[] {
  return rows.flatMap(postAmenityReservation);
}

/**
 * The 2300 Amenity Deposits Held liability balance (cents) derived from a corpus
 * of amenity journals — credit-normal, so balance = ΣCR − ΣDR. This is the
 * number the acceptance gate asserts: it appears (> 0) once a deposit is held and
 * clears to 0 once the deposit is fully refunded/forfeited.
 */
export function depositLiabilityCents(journals: JournalEntry[]): number {
  let credit = 0;
  let debit = 0;
  for (const j of journals) {
    for (const l of j.legs) {
      if (l.accountCode !== AMENITY_GL_CODES.DEPOSIT_LIABILITY) continue;
      if (l.side === "credit") credit += l.amountCents;
      else debit += l.amountCents;
    }
  }
  // Liability is credit-normal: positive == amount still owed back.
  return credit - debit;
}

/** Re-export the shared invariant gate so callers can validate amenity journals
 *  with the SAME checks the dues GL uses (balanced + interfund + positive legs). */
export { validateInvariants };
