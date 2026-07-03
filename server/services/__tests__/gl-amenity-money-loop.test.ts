/**
 * Amenity money-loop invariant suite (YCM Financial Core — Phase 3).
 *
 * Audit anchor:  audits/AUDIT-financial-reporting-orchestration.md Gap F1 (Phase 3).
 * Build anchor:  audits/YCM-financial-build-plan-2026-06-20.md Phase 3 —
 *                "a clubhouse booking charges a fee, holds + refunds a deposit,
 *                 and posts to the GL as a real liability".
 *
 * Pure-function suite — no DB. THIS IS THE PHASE-3 ACCEPTANCE GATE. It proves:
 *   1. a fee posts balanced (DR AR == CR Amenity Income)
 *   2. a deposit held posts balanced AND the 2300 liability APPEARS (> 0)
 *   3. a refund posts balanced AND clears the 2300 liability to EXACTLY 0¢
 *   4. a forfeit reclasses the liability to income, clearing it to 0¢
 *   5. every journal + the whole corpus balances (Σdebit == Σcredit)
 *   6. interfund nets to zero (operating-only loop)
 *   7. over-resolving (refund+forfeit > held) is rejected fail-loud
 *   8. re-deriving from the same reservation is stable (idempotent journalIds)
 */

import { describe, it, expect } from "vitest";
import {
  postAmenityReservation,
  postAmenityReservations,
  depositLiabilityCents,
  validateInvariants,
  AMENITY_GL_CODES,
  type AmenityReservationMoneyLike,
} from "../gl/amenity-posting";
import { isJournalBalanced } from "../gl/posting";

const at = (d: string) => new Date(`${d}T00:00:00Z`);

/** A clubhouse booking: $75.00 usage fee + $200.00 refundable deposit. */
const CLUBHOUSE_FEE_CENTS = 7500;
const CLUBHOUSE_DEPOSIT_CENTS = 20000;

function clubhouse(overrides: Partial<AmenityReservationMoneyLike> = {}): AmenityReservationMoneyLike {
  return {
    id: "resv-clubhouse-1",
    feeChargedCents: CLUBHOUSE_FEE_CENTS,
    depositHeldCents: CLUBHOUSE_DEPOSIT_CENTS,
    depositRefundedCents: 0,
    depositForfeitedCents: 0,
    postedAt: at("2026-06-21"),
    description: "Clubhouse — Cherry Hill Court",
    ...overrides,
  };
}

describe("ACCEPTANCE GATE — clubhouse booking: fee + deposit held → liability appears → refund → liability clears to 0¢", () => {
  it("step 1: a usage fee posts balanced (DR AR == CR Amenity Income)", () => {
    const journals = postAmenityReservation(clubhouse({ depositHeldCents: 0 }));
    const fee = journals.find((j) => j.journalId.startsWith("amn-fee-"))!;
    expect(fee).toBeDefined();
    expect(isJournalBalanced(fee)).toBe(true);
    expect(fee.legs.find((l) => l.accountCode === AMENITY_GL_CODES.AR)?.side).toBe("debit");
    expect(fee.legs.find((l) => l.accountCode === AMENITY_GL_CODES.AMENITY_INCOME)?.side).toBe("credit");
    expect(fee.legs.reduce((s, l) => s + (l.side === "debit" ? l.amountCents : 0), 0)).toBe(CLUBHOUSE_FEE_CENTS);
  });

  it("step 2: holding the deposit makes the 2300 liability APPEAR on the balance sheet", () => {
    // Book it: fee charged + deposit held, not yet refunded.
    const held = clubhouse();
    const journals = postAmenityReservation(held);

    // The deposit-held journal balances: DR Cash, CR Deposit Liability.
    const depJ = journals.find((j) => j.journalId.startsWith("amn-deposit-"))!;
    expect(isJournalBalanced(depJ)).toBe(true);
    expect(depJ.legs.find((l) => l.accountCode === AMENITY_GL_CODES.CASH)?.side).toBe("debit");
    expect(depJ.legs.find((l) => l.accountCode === AMENITY_GL_CODES.DEPOSIT_LIABILITY)?.side).toBe("credit");

    // LIABILITY APPEARS: 2300 balance == the full held deposit (a real liability).
    expect(depositLiabilityCents(journals)).toBe(CLUBHOUSE_DEPOSIT_CENTS);
    expect(depositLiabilityCents(journals)).toBeGreaterThan(0);
  });

  it("step 3: refunding the deposit CLEARS the 2300 liability to EXACTLY 0¢", () => {
    // Full lifecycle on one reservation: fee + deposit held + deposit refunded.
    const fullCycle = clubhouse({ depositRefundedCents: CLUBHOUSE_DEPOSIT_CENTS });
    const journals = postAmenityReservation(fullCycle);

    // The refund journal balances: DR Deposit Liability, CR Cash.
    const refundJ = journals.find((j) => j.journalId.startsWith("amn-refund-"))!;
    expect(isJournalBalanced(refundJ)).toBe(true);
    expect(refundJ.legs.find((l) => l.accountCode === AMENITY_GL_CODES.DEPOSIT_LIABILITY)?.side).toBe("debit");
    expect(refundJ.legs.find((l) => l.accountCode === AMENITY_GL_CODES.CASH)?.side).toBe("credit");

    // LIABILITY CLEARS: 2300 nets to exactly 0¢ after a full refund.
    expect(depositLiabilityCents(journals)).toBe(0);
  });

  it("ACCEPTANCE: all GL entries balance (Σdebit == Σcredit), interfund nets to zero, deposit nets to 0 after refund", () => {
    const journals = postAmenityReservation(clubhouse({ depositRefundedCents: CLUBHOUSE_DEPOSIT_CENTS }));

    // Every leg positive, every journal balances, corpus balances, interfund == 0.
    expect(validateInvariants(journals)).toEqual([]);

    // Corpus-level Σdebit == Σcredit (the double-entry invariant).
    let debit = 0;
    let credit = 0;
    for (const j of journals) for (const l of j.legs) (l.side === "debit" ? (debit += l.amountCents) : (credit += l.amountCents));
    expect(debit).toBe(credit);

    // Deposit liability nets to zero after refund.
    expect(depositLiabilityCents(journals)).toBe(0);
  });
});

describe("deposit FORFEIT — liability reclasses to income and clears to 0¢", () => {
  it("forfeiting the full deposit clears the liability and recognises income, balanced", () => {
    const journals = postAmenityReservation(clubhouse({ depositForfeitedCents: CLUBHOUSE_DEPOSIT_CENTS }));
    const forfeitJ = journals.find((j) => j.journalId.startsWith("amn-forfeit-"))!;
    expect(isJournalBalanced(forfeitJ)).toBe(true);
    expect(forfeitJ.legs.find((l) => l.accountCode === AMENITY_GL_CODES.DEPOSIT_LIABILITY)?.side).toBe("debit");
    expect(forfeitJ.legs.find((l) => l.accountCode === AMENITY_GL_CODES.AMENITY_INCOME)?.side).toBe("credit");
    expect(depositLiabilityCents(journals)).toBe(0);
    expect(validateInvariants(journals)).toEqual([]);
  });

  it("a partial refund + partial forfeit still clears the liability to 0¢ and balances", () => {
    // $200 held → $150 refunded + $50 forfeited (damage). Liability must net to 0.
    const journals = postAmenityReservation(
      clubhouse({ depositRefundedCents: 15000, depositForfeitedCents: 5000 }),
    );
    expect(depositLiabilityCents(journals)).toBe(0);
    expect(validateInvariants(journals)).toEqual([]);
  });

  it("a partially-resolved deposit leaves the remaining liability outstanding (and balanced)", () => {
    // $200 held → only $150 refunded so far → $50 still owed back (liability > 0).
    const journals = postAmenityReservation(clubhouse({ depositRefundedCents: 15000 }));
    expect(depositLiabilityCents(journals)).toBe(CLUBHOUSE_DEPOSIT_CENTS - 15000);
    expect(depositLiabilityCents(journals)).toBe(5000);
    expect(validateInvariants(journals)).toEqual([]);
  });
});

describe("guards — fail-loud on bad money state", () => {
  it("rejects refunding + forfeiting MORE than was held (would create a negative liability)", () => {
    expect(() =>
      postAmenityReservation(clubhouse({ depositRefundedCents: 15000, depositForfeitedCents: 10000 })),
    ).toThrow(/exceeds held/);
  });

  it("rejects a negative or fractional cents value", () => {
    expect(() => postAmenityReservation(clubhouse({ feeChargedCents: -1 }))).toThrow(/non-negative integer/);
    expect(() => postAmenityReservation(clubhouse({ depositHeldCents: 12.5 }))).toThrow(/non-negative integer/);
  });

  it("a free booking (no fee, no deposit) produces no journals — a balanced no-op", () => {
    const journals = postAmenityReservation(clubhouse({ feeChargedCents: 0, depositHeldCents: 0 }));
    expect(journals).toHaveLength(0);
  });
});

describe("idempotency + corpus — many bookings stay balanced and re-derive stably", () => {
  it("a mixed corpus of bookings passes validateInvariants with no violations", () => {
    const rows: AmenityReservationMoneyLike[] = [
      clubhouse({ id: "r1", depositRefundedCents: CLUBHOUSE_DEPOSIT_CENTS }), // full cycle, refunded
      clubhouse({ id: "r2", feeChargedCents: 5000, depositHeldCents: 10000 }), // fee + deposit outstanding
      clubhouse({ id: "r3", feeChargedCents: 0, depositHeldCents: 30000, depositForfeitedCents: 30000 }), // forfeited
      clubhouse({ id: "r4", feeChargedCents: 2500, depositHeldCents: 0 }), // fee only
    ];
    const journals = postAmenityReservations(rows);
    expect(validateInvariants(journals)).toEqual([]);
  });

  it("re-deriving the same reservation yields identical, stable journalIds (idempotent posting)", () => {
    const res = clubhouse({ depositRefundedCents: CLUBHOUSE_DEPOSIT_CENTS });
    const a = postAmenityReservation(res).map((j) => j.journalId).sort();
    const b = postAmenityReservation(res).map((j) => j.journalId).sort();
    expect(a).toEqual(b);
    // The journalIds are source-derived (no random/Date) so the DB unique index
    // (source_type, source_id, account, side) makes re-posting a no-op.
    expect(a).toContain("amn-fee-resv-clubhouse-1");
    expect(a).toContain("amn-deposit-resv-clubhouse-1");
    expect(a).toContain("amn-refund-resv-clubhouse-1");
  });
});
