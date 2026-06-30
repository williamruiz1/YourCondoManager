/**
 * CT resale / "6(d)" certificate — CGS §47-270 generator tests (founder-os#8013).
 *
 * Exercises the PURE service `buildResaleCertificateDocument` + its helpers
 * (`computeAmountsDue`, `addBusinessDays`, `computeResaleCertificateDue`,
 * `resaleCertificateFeeUsd`). No DB — the cert logic is pure over its input
 * bundle (mirrors the account-statement-math pure-fn test pattern).
 *
 * Each `it()` maps to a continuity-matrix row (§47-270(a)(1)-(15) + (b)/(c) +
 * attestation), so "done" == these pass (OP #79: requirements ARE the
 * definition of done).
 */
import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  buildResaleCertificateDocument,
  computeAmountsDue,
  computeResaleCertificateDue,
  RESALE_CERTIFICATE_EXPEDITE_FEE_USD,
  RESALE_CERTIFICATE_EXPEDITE_SLA_BUSINESS_DAYS,
  RESALE_CERTIFICATE_FEE_USD,
  RESALE_CERTIFICATE_SLA_BUSINESS_DAYS,
  resaleCertificateFeeUsd,
  ResaleCertificateUnsupportedStateError,
  type ResaleCertificateInputs,
} from "../server/services/resale-certificate-service";

// A Friday, so 10 business days lands cleanly across two weekends.
const REQ_AT = new Date("2026-06-05T14:00:00.000Z"); // Fri 2026-06-05

function baseInputs(overrides: Partial<ResaleCertificateInputs> = {}): ResaleCertificateInputs {
  return {
    state: "CT",
    association: { name: "Cherry Hill Court Condominium Association, Inc.", isIncorporated: true },
    unit: { unitNumber: "971", building: "A" },
    sellingOwnerName: "Jane Seller",
    purchaserName: "Bob Buyer",
    request: { requestedAt: REQ_AT, expedited: false },
    rightsOfFirstRefusalOrRestraints: [],
    periodicCommonExpenseAssessment: 350,
    ownerLedger: [],
    approvedCapitalExpenditures: [],
    reserveForCapitalExpendituresUsd: 0,
    reserveBasis: null,
    currentOperatingBudget: null,
    unsatisfiedJudgments: [],
    pendingSuits: [],
    insurancePolicies: [],
    alienationProceedsRestrictions: [],
    cooperativeTaxDeductibilityStatement: null,
    pendingCommonElementSalesOrEncumbrances: [],
    useOrOccupancyRestrictions: [],
    unitsSixtyPlusDaysDelinquent: 0,
    foreclosureActionsPastTwelveMonths: 0,
    attestation: { boardMemberName: "Chris Chair", validityDays: 30 },
    generatedAt: REQ_AT,
    ...overrides,
  };
}

// ── §47-270(b)(1) business-day SLA + $185 fee ────────────────────────────────
describe("§47-270(b)(1) — SLA clock + fee", () => {
  it("addBusinessDays skips weekends", () => {
    // Fri + 1 business day = Mon (skips Sat/Sun).
    const mon = addBusinessDays(new Date("2026-06-05T00:00:00.000Z"), 1);
    expect(mon.getUTCDay()).toBe(1); // Monday
    expect(mon.toISOString().slice(0, 10)).toBe("2026-06-08");
  });

  it("due = receipt + 10 business days (non-expedited)", () => {
    const due = computeResaleCertificateDue(REQ_AT, false);
    // Fri 06-05 + 10 business days = Fri 06-19.
    expect(due.toISOString().slice(0, 10)).toBe("2026-06-19");
    expect(RESALE_CERTIFICATE_SLA_BUSINESS_DAYS).toBe(10);
  });

  it("expedited due = receipt + 3 business days", () => {
    const due = computeResaleCertificateDue(REQ_AT, true);
    // Fri 06-05 + 3 business days = Wed 06-10.
    expect(due.toISOString().slice(0, 10)).toBe("2026-06-10");
    expect(RESALE_CERTIFICATE_EXPEDITE_SLA_BUSINESS_DAYS).toBe(3);
  });

  it("fee = $185 base, $195 expedited (+$10)", () => {
    expect(RESALE_CERTIFICATE_FEE_USD).toBe(185);
    expect(RESALE_CERTIFICATE_EXPEDITE_FEE_USD).toBe(10);
    expect(resaleCertificateFeeUsd(false)).toBe(185);
    expect(resaleCertificateFeeUsd(true)).toBe(195);
  });

  it("certificate carries the dueAt + fee in its request block", () => {
    const cert = buildResaleCertificateDocument(baseInputs());
    expect(cert.request.dueAt.slice(0, 10)).toBe("2026-06-19");
    expect(cert.request.feeUsd).toBe(185);
    expect(cert.request.slaBusinessDays).toBe(10);
  });
});

// ── §47-270(a)(1) ────────────────────────────────────────────────────────────
describe("§47-270(a)(1) — right of first refusal / restraints", () => {
  it("none ⇒ applies false", () => {
    const cert = buildResaleCertificateDocument(baseInputs());
    expect(cert.disclosures.a1_rightOfFirstRefusal.applies).toBe(false);
  });
  it("present ⇒ applies true + statement lists them", () => {
    const cert = buildResaleCertificateDocument(
      baseInputs({ rightsOfFirstRefusalOrRestraints: ["Board has 30-day right of first refusal"] }),
    );
    expect(cert.disclosures.a1_rightOfFirstRefusal.applies).toBe(true);
    expect(cert.disclosures.a1_rightOfFirstRefusal.statement).toContain("right of first refusal");
  });
});

// ── §47-270(a)(2) ────────────────────────────────────────────────────────────
describe("§47-270(a)(2) — periodic + unpaid assessments for the unit", () => {
  it("computeAmountsDue partitions common vs special, nets payments", () => {
    const { amounts } = computeAmountsDue(350, [
      { entryType: "assessment", amount: 350, description: "June common charge", referenceType: null },
      { entryType: "assessment", amount: 1200, description: "Roof special", referenceType: "special_assessment" },
      { entryType: "payment", amount: -100, description: "Partial payment", referenceType: null },
    ]);
    expect(amounts.periodicCommonExpenseAssessment).toBe(350);
    expect(amounts.unpaidCommonExpense).toBe(250); // 350 - 100 payment
    expect(amounts.unpaidSpecialAssessment).toBe(1200);
    expect(amounts.totalCurrentlyDue).toBe(1450);
  });

  it("cert shows current periodic + unpaid for the unit", () => {
    const cert = buildResaleCertificateDocument(
      baseInputs({
        ownerLedger: [
          { entryType: "assessment", amount: 350, description: "June common charge", referenceType: null },
        ],
      }),
    );
    expect(cert.disclosures.a2_amountsDue.periodicCommonExpenseAssessment).toBe(350);
    expect(cert.disclosures.a2_amountsDue.unpaidCommonExpense).toBe(350);
  });
});

// ── §47-270(a)(3) ────────────────────────────────────────────────────────────
describe("§47-270(a)(3) — other fees owed", () => {
  it("late fees surface as other fees", () => {
    const cert = buildResaleCertificateDocument(
      baseInputs({
        ownerLedger: [
          { entryType: "late-fee", amount: 25, description: "Late fee — May", referenceType: null },
        ],
      }),
    );
    expect(cert.disclosures.a3_otherFees).toHaveLength(1);
    expect(cert.disclosures.a3_otherFees[0]).toMatchObject({ description: "Late fee — May", amount: 25 });
  });
});

// ── §47-270(a)(4) ────────────────────────────────────────────────────────────
describe("§47-270(a)(4) — capex > $1,000 current + next FY", () => {
  it("only surfaces capex strictly over $1,000", () => {
    const cert = buildResaleCertificateDocument(
      baseInputs({
        approvedCapitalExpenditures: [
          { description: "Roof replacement", amount: 45000, fiscalYear: 2026 },
          { description: "Lobby paint", amount: 800, fiscalYear: 2026 }, // below threshold — excluded
          { description: "Boiler", amount: 1001, fiscalYear: 2027 },
        ],
      }),
    );
    const descs = cert.disclosures.a4_approvedCapitalExpenditures.map((c) => c.description);
    expect(descs).toContain("Roof replacement");
    expect(descs).toContain("Boiler");
    expect(descs).not.toContain("Lobby paint");
  });
});

// ── §47-270(a)(5) — RESERVE INPUT PARAM (NOT imported from #8016) ─────────────
describe("§47-270(a)(5) — reserves (board-declared input param)", () => {
  it("reserve input appears on the cert with its basis", () => {
    const cert = buildResaleCertificateDocument(
      baseInputs({
        reserveForCapitalExpendituresUsd: 82500.5,
        reserveBasis: "2026 reserve study, fully-funded baseline",
      }),
    );
    expect(cert.disclosures.a5_reservesForCapitalExpenditures.amountUsd).toBe(82500.5);
    expect(cert.disclosures.a5_reservesForCapitalExpenditures.basis).toBe(
      "2026 reserve study, fully-funded baseline",
    );
  });
});

// ── §47-270(a)(6) ────────────────────────────────────────────────────────────
describe("§47-270(a)(6) — current operating budget", () => {
  it("budget summary (total + line count + ratified) included", () => {
    const cert = buildResaleCertificateDocument(
      baseInputs({
        currentOperatingBudget: {
          fiscalYear: 2026,
          ratified: true,
          lines: [
            { lineItemName: "Landscaping", plannedAmount: 12000 },
            { lineItemName: "Insurance", plannedAmount: 18000 },
          ],
        },
      }),
    );
    expect(cert.disclosures.a6_currentOperatingBudget).toMatchObject({
      fiscalYear: 2026,
      totalPlanned: 30000,
      lineCount: 2,
      ratified: true,
    });
  });
});

// ── §47-270(a)(7) ────────────────────────────────────────────────────────────
describe("§47-270(a)(7) — unsatisfied judgments + pending suits", () => {
  it("judgments/suits field present", () => {
    const cert = buildResaleCertificateDocument(
      baseInputs({
        unsatisfiedJudgments: ["$4,000 vendor judgment (2025)"],
        pendingSuits: ["Smith v. Association (water intrusion)"],
      }),
    );
    expect(cert.disclosures.a7_judgmentsAndSuits.unsatisfiedJudgments).toHaveLength(1);
    expect(cert.disclosures.a7_judgmentsAndSuits.pendingSuits).toHaveLength(1);
  });
});

// ── §47-270(a)(8) ────────────────────────────────────────────────────────────
describe("§47-270(a)(8) — insurance coverage incl. schedule", () => {
  it("insurance info on cert", () => {
    const cert = buildResaleCertificateDocument(
      baseInputs({
        insurancePolicies: [
          {
            policyType: "master",
            carrier: "Travelers",
            policyNumber: "MST-123",
            coverageAmount: 5000000,
            expirationDate: new Date("2026-12-31T00:00:00.000Z"),
          },
        ],
      }),
    );
    expect(cert.disclosures.a8_insurance).toHaveLength(1);
    expect(cert.disclosures.a8_insurance[0]).toMatchObject({
      policyType: "master",
      carrier: "Travelers",
      coverageAmount: 5000000,
      expirationDate: "2026-12-31",
    });
  });
});

// ── §47-270(a)(9) ────────────────────────────────────────────────────────────
describe("§47-270(a)(9) — restrictions on proceeds (sale/condemnation/casualty)", () => {
  it("alienation-proceeds restrictions present", () => {
    const cert = buildResaleCertificateDocument(
      baseInputs({ alienationProceedsRestrictions: ["Casualty proceeds payable to association trustee"] }),
    );
    expect(cert.disclosures.a9_alienationProceedsRestrictions).toEqual([
      "Casualty proceeds payable to association trustee",
    ]);
  });
});

// ── §47-270(a)(10) ───────────────────────────────────────────────────────────
describe("§47-270(a)(10) — cooperative accountant tax-deductibility statement", () => {
  it("present only for cooperatives", () => {
    const coop = buildResaleCertificateDocument(
      baseInputs({
        association: { name: "Co-op Gardens", isIncorporated: true, isCooperative: true },
        cooperativeTaxDeductibilityStatement: "Per CPA letter dated 2026-01-15, 62% deductible.",
      }),
    );
    expect(coop.disclosures.a10_cooperativeTaxDeductibility).toContain("62% deductible");

    const condo = buildResaleCertificateDocument(baseInputs()); // not a co-op
    expect(condo.disclosures.a10_cooperativeTaxDeductibility).toBeNull();
  });
});

// ── §47-270(a)(11) ───────────────────────────────────────────────────────────
describe("§47-270(a)(11) — statutory agent (unincorporated only)", () => {
  it("applies only when association is unincorporated", () => {
    const unincorporated = buildResaleCertificateDocument(
      baseInputs({
        association: { name: "Maple Court Association", isIncorporated: false, statutoryAgentName: "Atty. R. Agent" },
      }),
    );
    expect(unincorporated.disclosures.a11_statutoryAgent).toMatchObject({
      applies: true,
      name: "Atty. R. Agent",
    });

    const incorporated = buildResaleCertificateDocument(baseInputs());
    expect(incorporated.disclosures.a11_statutoryAgent.applies).toBe(false);
    expect(incorporated.disclosures.a11_statutoryAgent.name).toBeNull();
  });
});

// ── §47-270(a)(12) ───────────────────────────────────────────────────────────
describe("§47-270(a)(12) — pending sale/encumbrance of common elements", () => {
  it("field present", () => {
    const cert = buildResaleCertificateDocument(
      baseInputs({ pendingCommonElementSalesOrEncumbrances: ["Sale of parking lot parcel pending"] }),
    );
    expect(cert.disclosures.a12_pendingCommonElementSalesOrEncumbrances).toHaveLength(1);
  });
});

// ── §47-270(a)(13) ───────────────────────────────────────────────────────────
describe("§47-270(a)(13) — use/occupancy restrictions", () => {
  it("field present", () => {
    const cert = buildResaleCertificateDocument(
      baseInputs({ useOrOccupancyRestrictions: ["No short-term rentals under 30 days"] }),
    );
    expect(cert.disclosures.a13_useOrOccupancyRestrictions).toEqual(["No short-term rentals under 30 days"]);
  });
});

// ── §47-270(a)(14) ───────────────────────────────────────────────────────────
describe("§47-270(a)(14) — units 60+ days delinquent", () => {
  it("60+ day delinquent count correct", () => {
    const cert = buildResaleCertificateDocument(baseInputs({ unitsSixtyPlusDaysDelinquent: 3 }));
    expect(cert.disclosures.a14_unitsSixtyPlusDaysDelinquent).toBe(3);
  });
});

// ── §47-270(a)(15) ───────────────────────────────────────────────────────────
describe("§47-270(a)(15) — foreclosures in past 12 months", () => {
  it("foreclosures-12mo field", () => {
    const cert = buildResaleCertificateDocument(baseInputs({ foreclosureActionsPastTwelveMonths: 1 }));
    expect(cert.disclosures.a15_foreclosuresPastTwelveMonths).toBe(1);
  });
});

// ── §47-270(c) ───────────────────────────────────────────────────────────────
describe("§47-270(c) — accuracy / purchaser-liability note", () => {
  it("accuracy note surfaced + cites §47-270(c)", () => {
    const cert = buildResaleCertificateDocument(baseInputs());
    expect(cert.accuracyNote).toContain("§47-270(c)");
    expect(cert.accuracyNote.toLowerCase()).toContain("not liable");
  });
});

// ── Attestation ──────────────────────────────────────────────────────────────
describe("attestation — board signature + validity period", () => {
  it("attestation + validity present", () => {
    const cert = buildResaleCertificateDocument(baseInputs());
    expect(cert.attestation.boardMemberName).toBe("Chris Chair");
    expect(cert.attestation.attestedAt).toBe(REQ_AT.toISOString());
    expect(cert.attestation.validUntil).not.toBeNull();
    // 30-day validity from generation.
    expect(cert.attestation.validUntil!.slice(0, 10)).toBe("2026-07-05");
  });
});

// ── Jurisdiction guard ───────────────────────────────────────────────────────
describe("jurisdiction — CT only", () => {
  it("throws for a non-CT state (DE downstream, not implemented)", () => {
    expect(() => buildResaleCertificateDocument(baseInputs({ state: "DE" }))).toThrow(
      ResaleCertificateUnsupportedStateError,
    );
  });

  it("statute citation is CGS §47-270", () => {
    const cert = buildResaleCertificateDocument(baseInputs());
    expect(cert.statuteCitation).toBe("CGS §47-270");
  });
});
