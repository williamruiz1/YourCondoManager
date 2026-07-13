/**
 * Pure-generator + deadline tests for statutory records production
 * (founder-os#9483). No DB — proves:
 *   R1  each record type produces the correct packet grounded in data.
 *   R2  the statutory deadline is computed correctly per type + queue-pins.
 * The L3-gate + persistence path is proven in statutory-records-flow.test.ts.
 */
import { describe, expect, it } from "vitest";
import { computeStatutoryDeadline } from "../statutory-deadline-service";
import {
  buildEstoppelCertificateDocument,
  EstoppelCertificateUnsupportedStateError,
} from "../estoppel-certificate-service";
import {
  buildRecordsRequestResponse,
  RecordsRequestUnsupportedStateError,
} from "../records-request-response-service";

// A Wednesday, so business-day math is easy to reason about.
const WED = new Date("2026-07-08T12:00:00.000Z"); // 2026-07-08 is a Wednesday

describe("computeStatutoryDeadline — per-type statutory clock", () => {
  it("resale_certificate → §47-270 10 business days", () => {
    const d = computeStatutoryDeadline("resale_certificate", WED, false);
    expect(d.slaBusinessDays).toBe(10);
    expect(d.statuteCitation).toBe("CGS §47-270");
    // 10 business days from Wed 07-08 = Wed 07-22 (skips 2 weekends).
    expect(d.deadlineAt.toISOString().slice(0, 10)).toBe("2026-07-22");
  });

  it("resale_certificate expedited → §47-270 3 business days", () => {
    const d = computeStatutoryDeadline("resale_certificate", WED, true);
    expect(d.slaBusinessDays).toBe(3);
    // Wed +3 business days = Mon 07-13.
    expect(d.deadlineAt.toISOString().slice(0, 10)).toBe("2026-07-13");
  });

  it("estoppel_certificate → same §47-270 closing window (10 business days)", () => {
    const d = computeStatutoryDeadline("estoppel_certificate", WED, false);
    expect(d.slaBusinessDays).toBe(10);
    expect(d.deadlineAt.toISOString().slice(0, 10)).toBe("2026-07-22");
  });

  it("records_request → §47-260(b) 5 business days", () => {
    const d = computeStatutoryDeadline("records_request", WED, false);
    expect(d.slaBusinessDays).toBe(5);
    expect(d.statuteCitation).toBe("CGS §47-260(b)");
    // Wed +5 business days = Wed 07-15.
    expect(d.deadlineAt.toISOString().slice(0, 10)).toBe("2026-07-15");
  });

  it("records_request ignores the expedite flag", () => {
    const normal = computeStatutoryDeadline("records_request", WED, false);
    const expedited = computeStatutoryDeadline("records_request", WED, true);
    expect(expedited.deadlineAt.getTime()).toBe(normal.deadlineAt.getTime());
  });
});

describe("buildEstoppelCertificateDocument — grounded closing account-status", () => {
  const base = {
    state: "CT",
    association: { name: "Cherry Hill Court" },
    unit: { unitNumber: "3B", building: "A" },
    sellingOwnerName: "Jane Owner",
    periodicCommonExpenseAssessment: 250,
    generatedAt: WED,
    attestation: { boardMemberName: "Board Treasurer", validityDays: 30 },
  };

  it("computes amounts owed from the live ledger and flags good standing when zero", () => {
    const doc = buildEstoppelCertificateDocument({
      ...base,
      ownerLedger: [
        { entryType: "assessment", amount: 250, description: "July dues", referenceType: null },
        { entryType: "payment", amount: 250, description: "July payment", referenceType: null },
      ],
    });
    expect(doc.accountStatus.amountsDue.totalCurrentlyDue).toBe(0);
    expect(doc.accountStatus.inGoodStanding).toBe(true);
    expect(doc.accountStatus.totalDueAtClosing).toBe(0);
    expect(doc.unit.unitNumber).toBe("3B");
    expect(doc.sellingOwnerName).toBe("Jane Owner");
    expect(doc.accuracyNote).toContain("§47-270(c)");
    expect(doc.attestation.validUntil).not.toBeNull();
  });

  it("surfaces outstanding balance + transfer fee in the total due at closing", () => {
    const doc = buildEstoppelCertificateDocument({
      ...base,
      transferFeeUsd: 100,
      ownerLedger: [
        { entryType: "assessment", amount: 250, description: "July dues", referenceType: null },
        { entryType: "late-fee", amount: 25, description: "Late fee", referenceType: null },
      ],
    });
    // 250 common + 25 other fee = 275 due; + 100 transfer = 375 at closing.
    expect(doc.accountStatus.amountsDue.unpaidCommonExpense).toBe(250);
    expect(doc.accountStatus.amountsDue.totalCurrentlyDue).toBe(275);
    expect(doc.accountStatus.transferFeeUsd).toBe(100);
    expect(doc.accountStatus.totalDueAtClosing).toBe(375);
    expect(doc.accountStatus.inGoodStanding).toBe(false);
  });

  it("refuses a non-CT state", () => {
    expect(() =>
      buildEstoppelCertificateDocument({ ...base, state: "DE", ownerLedger: [] }),
    ).toThrow(EstoppelCertificateUnsupportedStateError);
  });
});

describe("buildRecordsRequestResponse — §47-260 response packet", () => {
  const base = {
    state: "CT",
    association: { name: "Cherry Hill Court" },
    requesterName: "Owner Smith",
    recordsRequested: "Board meeting minutes for the past 12 months",
    receivedAt: WED,
    generatedAt: WED,
  };

  it("computes the §47-260(b) response-due date (5 business days)", () => {
    const doc = buildRecordsRequestResponse(base);
    expect(doc.responseSlaBusinessDays).toBe(5);
    expect(doc.responseDueAt.slice(0, 10)).toBe("2026-07-15");
    expect(doc.statuteCitation).toBe("CGS §47-260");
    expect(doc.recordsRequested).toContain("minutes");
  });

  it("classifies disclosed vs withheld records per §47-260(c)/(d)", () => {
    const doc = buildRecordsRequestResponse({
      ...base,
      candidateRecords: [
        { label: "Meeting minutes", withholdingClass: "none" },
        { label: "Attorney-client memo", withholdingClass: "mandatory" },
        { label: "Vendor bid under negotiation", withholdingClass: "permissive", permissiveWithheld: true },
      ],
      copyFee: { pageCount: 10, supervisionFeeCents: 500 },
    });
    expect(doc.disclosure.disclosed.map((d) => d.label)).toEqual(["Meeting minutes"]);
    expect(doc.disclosure.withheld.find((w) => w.class === "mandatory")?.label).toBe("Attorney-client memo");
    expect(doc.disclosure.withheld.find((w) => w.class === "permissive")?.label).toBe("Vendor bid under negotiation");
    // 10 pages × 25¢ + 500¢ supervision = 750¢.
    expect(doc.copyFeeCents).toBe(750);
  });

  it("refuses a non-CT state", () => {
    expect(() => buildRecordsRequestResponse({ ...base, state: "FL" })).toThrow(RecordsRequestUnsupportedStateError);
  });
});
