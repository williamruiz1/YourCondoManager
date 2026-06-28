/**
 * Connecticut resale certificate / "6(d)" generator — pure-module unit tests
 * (founder-os#8013). Statutory basis: Conn. Gen. Stat. §47-270.
 *
 * These tests map 1:1 to the dispatch acceptance criteria (OP #79 — the
 * extracted requirements ARE the definition of done). `assembleResaleCertificate`,
 * the SLA math, the fee constant, and the §47-270(c) accuracy note are pure over
 * their inputs, so no DB is needed.
 *
 *   AC1 — generator produces all §47-270(a) fields
 *   AC2 — 10-business-day SLA timer + $185 fee on the request workflow
 *   AC3 — §47-270(c) accuracy note surfaced (purchaser-not-liable-beyond-cert)
 *   AC4 — §-numbers cited in the implementation
 */
import { describe, expect, it } from "vitest";
import {
  assembleResaleCertificate,
  buildResaleCertFields,
  businessDaysUntil,
  computeSlaDueDate,
  getResaleCertStatuteParams,
  isBusinessDay,
  CT_STATUTORY_FEE_CENTS,
  CT_ACCURACY_NOTE_47_270_C,
  type ResaleCertFieldInput,
} from "../server/services/resale-certificate-template";

const FIELD_INPUT: ResaleCertFieldInput = {
  periodicAssessment: 350,
  unpaidAssessment: 700,
  otherFees: 75,
  capitalExpenditureHints: [{ name: "Roof replacement", amount: 42000 }],
  reservesTotal: null, // delegated to reserve-disclosure (#8016)
  operatingBudgetTotal: 120000,
  insuranceSummary: "master: Travelers #M-1 — $5,000,000 (exp 2026-12-31)",
  unitsDelinquent60Plus: 3,
};

function assemble(overrides: Partial<typeof FIELD_INPUT> = {}, state = "CT") {
  return assembleResaleCertificate({
    state,
    associationId: "assoc-1",
    associationName: "Cherry Hill Court Condominium Association",
    unitId: "unit-1",
    unitNumber: "4B",
    building: "A",
    generatedAt: new Date("2026-06-28T12:00:00.000Z"),
    fieldInput: { ...FIELD_INPUT, ...overrides },
  });
}

// ── AC1 — all §47-270(a) fields produced ─────────────────────────────────────
describe("AC1 — §47-270(a) field coverage", () => {
  it("emits every §47-270(a) subsection the dispatch requires", () => {
    const cert = assemble();
    const keys = cert.fields.map((f) => f.key);
    // (a)(2)–(a)(15), including the audit-flagged (a)(9)–(13) placeholders.
    for (const k of [
      "a2", "a3", "a4", "a5", "a6", "a7", "a8",
      "a9", "a10", "a11", "a12", "a13", "a14", "a15",
    ]) {
      expect(keys).toContain(k);
    }
    expect(cert.fields.length).toBe(14);
  });

  it("populates derived fields from live data (a2/a3/a6/a8/a14)", () => {
    const cert = assemble();
    const byKey = Object.fromEntries(cert.fields.map((f) => [f.key, f]));
    expect(byKey.a2.completeness).toBe("derived");
    expect(byKey.a3.value).toBe(75);
    expect(byKey.a6.value).toBe(120000);
    expect(byKey.a6.source).toBe("budget");
    expect(byKey.a8.completeness).toBe("derived");
    expect(byKey.a14.value).toBe(3);
    expect(byKey.a14.source).toBe("delinquency");
  });

  it("marks no-structured-source fields as board-attestation, never falsely $0 (completeness honesty)", () => {
    const cert = assemble();
    const byKey = Object.fromEntries(cert.fields.map((f) => [f.key, f]));
    // (a)(7) judgments/suits + (a)(15) foreclosures + (a)(9)–(13) audit-flagged.
    for (const k of ["a7", "a15", "a9", "a10", "a11", "a12", "a13"]) {
      expect(byKey[k].source).toBe("board-attestation");
      expect(byKey[k].completeness).toBe("attestation-required");
      expect(byKey[k].value).toBeNull();
    }
    // (a)(5) reserves delegated to the reserve-disclosure generator (#8016).
    expect(byKey.a5.source).toBe("reserve-disclosure");
    expect(byKey.a5.completeness).toBe("see-reserve-disclosure");
  });

  it("rolls up completeness and is NOT ready-to-deliver while attestations pending", () => {
    const cert = assemble();
    expect(cert.completeness.total).toBe(14);
    expect(cert.completeness.attestationRequired).toBeGreaterThan(0);
    expect(cert.completeness.readyToDeliver).toBe(false);
  });

  it("a4 capital-expenditure hint surfaces budget lines > $1,000 for board confirmation", () => {
    const cert = assemble();
    const a4 = cert.fields.find((f) => f.key === "a4")!;
    expect(a4.value).toContain("Roof replacement");
    expect(a4.completeness).toBe("attestation-required");
  });
});

// ── AC2 — 10-business-day SLA + $185 fee ─────────────────────────────────────
describe("AC2 — §47-270(b) SLA timer + §47-270(b)(1) $185 fee", () => {
  it("CT statutory fee is exactly $185 (18500 cents)", () => {
    expect(CT_STATUTORY_FEE_CENTS).toBe(18_500);
    const cert = assemble();
    expect(cert.statutoryFeeCents).toBe(18_500);
    expect(getResaleCertStatuteParams("CT").statutoryFeeCents).toBe(18_500);
  });

  it("SLA is 10 business days", () => {
    expect(getResaleCertStatuteParams("CT").slaBusinessDays).toBe(10);
    const cert = assemble();
    expect(cert.slaBusinessDays).toBe(10);
  });

  it("computeSlaDueDate skips weekends — a Monday request lands 2 weeks out", () => {
    // 2026-06-01 is a Monday. 10 business days, no holiday in window → 2026-06-15.
    const due = computeSlaDueDate(new Date("2026-06-01T09:00:00.000Z"), 10);
    expect(due.toISOString().slice(0, 10)).toBe("2026-06-15");
  });

  it("computeSlaDueDate skips a CT weekday holiday (Juneteenth 2026-06-19)", () => {
    // Request 2026-06-12 (Fri). Without holiday: +10 biz days = 2026-06-26 (Fri).
    // 2026-06-19 (Juneteenth, a Fri) is a holiday → pushes one more day → 2026-06-29 (Mon).
    const due = computeSlaDueDate(new Date("2026-06-12T09:00:00.000Z"), 10);
    expect(due.toISOString().slice(0, 10)).toBe("2026-06-29");
  });

  it("computeSlaDueDate returns an end-of-day instant (same-day delivery is on time)", () => {
    const due = computeSlaDueDate(new Date("2026-06-01T09:00:00.000Z"), 10);
    expect(due.getUTCHours()).toBe(23);
    expect(due.getUTCMinutes()).toBe(59);
  });

  it("isBusinessDay treats weekends + CT holidays as non-business", () => {
    expect(isBusinessDay(new Date("2026-06-01"))).toBe(true); // Monday
    expect(isBusinessDay(new Date("2026-06-06"))).toBe(false); // Saturday
    expect(isBusinessDay(new Date("2026-06-07"))).toBe(false); // Sunday
    expect(isBusinessDay(new Date("2026-06-19"))).toBe(false); // Juneteenth
  });

  it("businessDaysUntil is positive before the deadline, negative when overdue", () => {
    const due = computeSlaDueDate(new Date("2026-06-01T09:00:00.000Z"), 10); // 2026-06-15
    expect(businessDaysUntil(new Date("2026-06-08T09:00:00Z"), due)).toBeGreaterThan(0);
    expect(businessDaysUntil(new Date("2026-06-22T09:00:00Z"), due)).toBeLessThan(0);
  });
});

// ── AC3 — §47-270(c) accuracy note surfaced ──────────────────────────────────
describe("AC3 — §47-270(c) purchaser-not-liable accuracy note", () => {
  it("every certificate carries the §47-270(c) accuracy note", () => {
    const cert = assemble();
    expect(cert.accuracyNote).toBe(CT_ACCURACY_NOTE_47_270_C);
    expect(cert.accuracyNote).toContain("§47-270(c)");
    expect(cert.accuracyNote.toLowerCase()).toContain("not liable");
    expect(cert.accuracyNote.toLowerCase()).toContain("greater than");
  });
});

// ── AC4 — §-numbers cited ────────────────────────────────────────────────────
describe("AC4 — §-number citations", () => {
  it("every field cites its §47-270(a) subsection", () => {
    const cert = assemble();
    for (const f of cert.fields) {
      expect(f.statuteCitation).toMatch(/^§47-270\(a\)\(\d+\)$/);
    }
  });

  it("the certificate cites the governing statute (CGS §47-270)", () => {
    const cert = assemble();
    expect(cert.statuteCitation).toBe("CGS §47-270");
  });
});

// ── State parameterization (CT live; DE downstream stub) ─────────────────────
describe("state parameterization", () => {
  it("CT is live", () => {
    const p = getResaleCertStatuteParams("CT");
    expect(p.live).toBe(true);
    expect(p.statuteCitation).toBe("CGS §47-270");
  });

  it("DE is a defined-but-not-live downstream stub (§81-409)", () => {
    const p = getResaleCertStatuteParams("DE");
    expect(p.live).toBe(false);
    expect(p.statuteCitation).toContain("§81-409");
    expect(p.state).toBe("DE");
  });

  it("unknown/empty state defaults to CT (the live target)", () => {
    expect(getResaleCertStatuteParams(null).state).toBe("CT");
    expect(getResaleCertStatuteParams("").state).toBe("CT");
    expect(getResaleCertStatuteParams("XX").state).toBe("CT");
  });

  it("a DE certificate reports stateLive=false", () => {
    const cert = assemble({}, "DE");
    expect(cert.stateLive).toBe(false);
    expect(cert.state).toBe("DE");
  });
});

// ── buildResaleCertFields — unavailable vs derived ───────────────────────────
describe("buildResaleCertFields — unavailable handling", () => {
  it("marks a derived field 'unavailable' (not falsely $0) when its source has no data", () => {
    const fields = buildResaleCertFields({
      ...FIELD_INPUT,
      operatingBudgetTotal: null,
      insuranceSummary: null,
      unitsDelinquent60Plus: null,
    });
    const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
    expect(byKey.a6.completeness).toBe("unavailable");
    expect(byKey.a8.completeness).toBe("unavailable");
    expect(byKey.a14.completeness).toBe("unavailable");
  });
});
