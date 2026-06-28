/**
 * BUILD #8014 — CT CGS §47-258 statutory assessment lien + pre-foreclosure tests.
 *
 * Per the repo test reality (no live DB — every test mocks `../server/db`), the
 * STATUTORY LOGIC lives in pure functions in
 * `server/services/assessment-lien-service.ts`, and these tests exercise those
 * pure functions directly (the exact code paths the storage/route glue calls).
 *
 * Continuity matrix (each row → ≥1 passing test):
 *   §47-258(a)    — lien arises automatically on the unpaid assessment (arose-date)
 *   §47-258(b)    — 9-month super-priority over a first mortgage (portable to DE §81-316)
 *   §47-258(d)    — no separate recording required (automatic)
 *   §47-258(e)    — 3-year statute-of-limitations clock
 *   §47-258(m)(1) — pre-foreclosure gate (≥2 months + attestation + demand-with-mortgagee-copy)
 *   §47-258(m)(2) — 60-day pre-foreclosure notice itemizing debt/fees/intent/payment + mortgagee copy
 *   release       — lien released on payment in full
 */

import { describe, it, expect, vi } from "vitest";

// The pure functions never touch the DB, but the service module imports `../db`
// at load time (for the thin glue). Mock it so the import is side-effect-free.
vi.mock("../server/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

import {
  ASSESSMENT_LIEN_SOL_YEARS,
  SUPER_PRIORITY_MONTHS_DEFAULT,
  PRE_FORECLOSURE_MIN_MONTHS_OWED,
  PRE_FORECLOSURE_NOTICE_DAYS,
  buildAssessmentLien,
  lienRequiresRecording,
  computeSuperPriority,
  computeLienExpiry,
  isLienEnforceable,
  resolveLienStatusAfterPayment,
  evaluatePreForeclosureGate,
  buildPreForeclosureNotice,
  addYears,
  addDays,
} from "../server/services/assessment-lien-service";

const AROSE = new Date("2026-01-15T00:00:00.000Z");

// ===========================================================================
// §47-258(a) — lien arises automatically on the unpaid assessment
// ===========================================================================

describe("§47-258(a) — lien arises automatically (arose-date)", () => {
  it("builds an active lien with arose-date = the assessment due date, amount tracked, association-scoped", () => {
    const lien = buildAssessmentLien({
      associationId: "assoc-1",
      unitId: "unit-7",
      personId: "person-3",
      aroseDate: AROSE,
      principalAmount: 1800,
      monthlyCommonExpense: 200,
    });

    expect(lien.associationId).toBe("assoc-1");
    expect(lien.unitId).toBe("unit-7");
    expect(lien.aroseDate).toEqual(AROSE); // arose-date = due date
    expect(lien.principalAmount).toBe(1800); // amount tracked
    expect(lien.status).toBe("active");
    // §47-258(e) expiry set automatically from arose-date + SOL.
    expect(lien.expiresAt).toEqual(addYears(AROSE, ASSESSMENT_LIEN_SOL_YEARS));
  });

  it("defaults the statute section to CT 47-258 but accepts DE 81-316 (portable)", () => {
    const ct = buildAssessmentLien({
      associationId: "a", unitId: "u", aroseDate: AROSE, principalAmount: 100,
    });
    expect(ct.statuteSection).toBe("47-258");

    const de = buildAssessmentLien({
      associationId: "a", unitId: "u", aroseDate: AROSE, principalAmount: 100,
      statuteSection: "81-316",
    });
    expect(de.statuteSection).toBe("81-316");
  });

  it("rejects an invalid arose-date or negative principal", () => {
    expect(() =>
      buildAssessmentLien({ associationId: "a", unitId: "u", aroseDate: new Date("nope"), principalAmount: 100 }),
    ).toThrow();
    expect(() =>
      buildAssessmentLien({ associationId: "a", unitId: "u", aroseDate: AROSE, principalAmount: -5 }),
    ).toThrow();
  });
});

// ===========================================================================
// §47-258(b) — 9-month super-priority over a first mortgage (portable)
// ===========================================================================

describe("§47-258(b) — 9-month super-priority", () => {
  it("computes the 9-month priority amount + window correctly", () => {
    const enforcement = new Date("2026-10-01T00:00:00.000Z");
    const r = computeSuperPriority({
      monthlyCommonExpense: 200,
      totalLienAmount: 3000,
      enforcementDate: enforcement,
    });

    expect(r.monthsOfPriority).toBe(SUPER_PRIORITY_MONTHS_DEFAULT); // 9
    expect(r.superPriorityAmount).toBe(1800); // 200 × 9
    expect(r.subordinateAmount).toBe(1200); // 3000 − 1800
    expect(r.windowEnd).toEqual(enforcement);
    // window start = enforcement − 9 months = 2026-01-01
    expect(r.windowStart.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(r.statuteSection).toBe("47-258");
  });

  it("caps the super-priority at the total lien amount (cannot exceed what is owed)", () => {
    const r = computeSuperPriority({
      monthlyCommonExpense: 500,
      totalLienAmount: 1000, // less than 9 × 500 = 4500
      enforcementDate: new Date("2026-10-01T00:00:00.000Z"),
    });
    expect(r.superPriorityAmount).toBe(1000);
    expect(r.subordinateAmount).toBe(0);
  });

  it("is state-portable — DE §81-316 reuses the same 9-month calc via params", () => {
    const r = computeSuperPriority({
      monthlyCommonExpense: 200,
      totalLienAmount: 3000,
      enforcementDate: new Date("2026-10-01T00:00:00.000Z"),
      monthsOfPriority: 9,
      statuteSection: "81-316",
    });
    expect(r.statuteSection).toBe("81-316");
    expect(r.monthsOfPriority).toBe(9);
    expect(r.superPriorityAmount).toBe(1800);
  });
});

// ===========================================================================
// §47-258(d) — no separate recording required (automatic)
// ===========================================================================

describe("§47-258(d) — automatic, no recording required", () => {
  it("a lien is enforceable WITHOUT any recording record", () => {
    // §47-258(d): enforceability never depends on a recording step.
    expect(lienRequiresRecording()).toBe(false);

    // The lien is enforceable purely from arose-date + active status + SOL window,
    // with no recording input anywhere in the enforceability computation.
    const enforceable = isLienEnforceable(AROSE, new Date("2026-06-01T00:00:00.000Z"));
    expect(enforceable).toBe(true);
  });
});

// ===========================================================================
// §47-258(e) — 3-year statute-of-limitations clock
// ===========================================================================

describe("§47-258(e) — 3-year statute of limitations", () => {
  it("computes the SOL expiry from the arose-date", () => {
    expect(computeLienExpiry(AROSE)).toEqual(addYears(AROSE, 3));
    expect(ASSESSMENT_LIEN_SOL_YEARS).toBe(3);
  });

  it("allows enforcement within the 3-year window", () => {
    const withinWindow = new Date("2028-01-14T00:00:00.000Z"); // < arose + 3yr
    expect(isLienEnforceable(AROSE, withinWindow)).toBe(true);
  });

  it("blocks enforcement after the 3-year window expires", () => {
    const afterWindow = new Date("2029-02-01T00:00:00.000Z"); // > arose + 3yr (2029-01-15)
    expect(isLienEnforceable(AROSE, afterWindow)).toBe(false);
  });
});

// ===========================================================================
// §47-258(m)(1) — pre-foreclosure gate
// ===========================================================================

describe("§47-258(m)(1) — pre-foreclosure gate", () => {
  const ALL_PRESENT = {
    monthsOwed: 3,
    boardVoteOrPolicyAttested: true,
    writtenDemandSent: true,
    mortgageeCopySent: true,
  };

  it("allows the foreclosure path when ALL conditions are met", () => {
    const r = evaluatePreForeclosureGate(ALL_PRESENT);
    expect(r.allowed).toBe(true);
    expect(r.blockReasons).toEqual([]);
    expect(r.minMonthsOwed).toBe(PRE_FORECLOSURE_MIN_MONTHS_OWED); // 2
  });

  it("blocks when fewer than 2 months are owed", () => {
    const r = evaluatePreForeclosureGate({ ...ALL_PRESENT, monthsOwed: 1 });
    expect(r.allowed).toBe(false);
    expect(r.blockReasons).toContain("months_owed_below_minimum");
  });

  it("blocks when the board-vote / standard-policy attestation is missing", () => {
    const r = evaluatePreForeclosureGate({ ...ALL_PRESENT, boardVoteOrPolicyAttested: false });
    expect(r.allowed).toBe(false);
    expect(r.blockReasons).toContain("board_vote_or_policy_attestation_missing");
  });

  it("blocks when the written demand was not sent", () => {
    const r = evaluatePreForeclosureGate({ ...ALL_PRESENT, writtenDemandSent: false });
    expect(r.allowed).toBe(false);
    expect(r.blockReasons).toContain("written_demand_missing");
  });

  it("blocks a demand sent WITHOUT the simultaneous mortgagee copy", () => {
    const r = evaluatePreForeclosureGate({ ...ALL_PRESENT, mortgageeCopySent: false });
    expect(r.allowed).toBe(false);
    expect(r.blockReasons).toContain("mortgagee_copy_missing");
  });

  it("also blocks when the lien is past its 3-year SOL (when arose/asOf supplied)", () => {
    const r = evaluatePreForeclosureGate({
      ...ALL_PRESENT,
      aroseDate: AROSE,
      asOf: new Date("2029-06-01T00:00:00.000Z"), // > arose + 3yr
    });
    expect(r.allowed).toBe(false);
    expect(r.blockReasons).toContain("lien_unenforceable_sol_expired");
  });
});

// ===========================================================================
// §47-258(m)(2) — 60-day pre-foreclosure notice
// ===========================================================================

describe("§47-258(m)(2) — 60-day pre-foreclosure notice", () => {
  const ISSUED = new Date("2026-03-01T00:00:00.000Z");
  const baseInput = {
    ownerName: "Jane Owner",
    unitNumber: "12B",
    associationName: "Maple Court Condominium Association",
    principalDebt: 1800,
    fees: 150,
    attorneyCosts: 250,
    issuedAt: ISSUED,
    paymentInstructions: "Pay via the owner portal or mail a check to the management office.",
    mortgageeName: "First National Bank",
    mortgageeContact: "loans@firstnational.example",
  };

  it("includes ALL required items: debt, fees, costs, total, intent, payment instructions", () => {
    const n = buildPreForeclosureNotice(baseInput);

    expect(n.requiredItems.debt).toBe(1800);
    expect(n.requiredItems.fees).toBe(150);
    expect(n.requiredItems.attorneyCosts).toBe(250);
    expect(n.requiredItems.total).toBe(2200); // 1800 + 150 + 250
    expect(n.totalDue).toBe(2200);
    expect(n.requiredItems.intent).toContain("foreclos");
    expect(n.requiredItems.paymentInstructions).toBe(baseInput.paymentInstructions);

    // Body itemizes each component + cites §47-258.
    expect(n.body).toContain("1800.00");
    expect(n.body).toContain("150.00");
    expect(n.body).toContain("250.00");
    expect(n.body).toContain("2200.00");
    expect(n.body).toContain("§47-258");
    expect(n.body).toContain(baseInput.paymentInstructions);
  });

  it("enforces the 60-day window (deadline = issued + 60 days)", () => {
    const n = buildPreForeclosureNotice(baseInput);
    expect(n.noticeDays).toBe(PRE_FORECLOSURE_NOTICE_DAYS); // 60
    expect(n.deadlineAt).toEqual(addDays(ISSUED, 60));
    // 2026-03-01 + 60 days = 2026-04-30
    expect(n.deadlineAt.toISOString().slice(0, 10)).toBe("2026-04-30");
  });

  it("generates the simultaneous mortgagee copy", () => {
    const n = buildPreForeclosureNotice(baseInput);
    expect(n.mortgageeCopy).not.toBeNull();
    expect(n.mortgageeCopy?.recipient).toBe("First National Bank");
    expect(n.mortgageeCopy?.subject).toContain("COPY");
    expect(n.mortgageeCopy?.body).toContain("§47-258(m)");
    expect(n.mortgageeCopy?.body).toContain("2200.00");
  });

  it("omits the mortgagee copy when no mortgagee is known", () => {
    const n = buildPreForeclosureNotice({ ...baseInput, mortgageeName: null, mortgageeContact: null });
    expect(n.mortgageeCopy).toBeNull();
  });
});

// ===========================================================================
// release — lien released on payment in full
// ===========================================================================

describe("release — lien released on payment", () => {
  it("paid-in-full → released", () => {
    const status = resolveLienStatusAfterPayment({
      principalAmount: 1800,
      amountPaid: 1800,
      aroseDate: AROSE,
      asOf: new Date("2026-06-01T00:00:00.000Z"),
    });
    expect(status).toBe("released");
  });

  it("overpayment → released", () => {
    const status = resolveLienStatusAfterPayment({
      principalAmount: 1800,
      amountPaid: 2000,
      aroseDate: AROSE,
      asOf: new Date("2026-06-01T00:00:00.000Z"),
    });
    expect(status).toBe("released");
  });

  it("partial payment within SOL → stays active", () => {
    const status = resolveLienStatusAfterPayment({
      principalAmount: 1800,
      amountPaid: 500,
      aroseDate: AROSE,
      asOf: new Date("2026-06-01T00:00:00.000Z"),
    });
    expect(status).toBe("active");
  });

  it("partial payment after SOL expiry → expired", () => {
    const status = resolveLienStatusAfterPayment({
      principalAmount: 1800,
      amountPaid: 500,
      aroseDate: AROSE,
      asOf: new Date("2029-06-01T00:00:00.000Z"), // > arose + 3yr
    });
    expect(status).toBe("expired");
  });
});
