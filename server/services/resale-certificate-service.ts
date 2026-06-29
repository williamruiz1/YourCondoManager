/**
 * Connecticut resale / "6(d)" certificate generator — CGS §47-270 (founder-os#8013).
 *
 * PURE, DB-free computation engine. `buildResaleCertificateDocument` takes a
 * fully-gathered `ResaleCertificateInputs` bundle (live ledger / budget /
 * insurance / delinquency data, plus board-supplied attestation inputs) and
 * produces the structured `ResaleCertificateDocument` — every disclosure
 * required by CGS §47-270(a)(1)-(15) plus the (b) SLA/fee metadata and the (c)
 * accuracy note. The data-gathering glue (`resale-certificate.ts`) and the
 * storage/routes layers query the DB and call into here; ALL §47-270 logic
 * lives in this file so it is unit-testable without a database — mirroring the
 * `account-statement-math.ts` pure-function pattern (PRs #288/#290/#293).
 *
 * ── Statute (verified 2026-06-28 against the CT General Assembly / Justia /
 *    FindLaw text of CGS §47-270, as amended by Public Act 23-18) ─────────────
 *
 * §47-270(a): the resale certificate must contain —
 *   (1)  effect of any right of first refusal / restraint on free alienability
 *        of the unit held by the association;
 *   (2)  the periodic common-expense assessment AND any unpaid common-expense or
 *        special assessment currently due and payable from the SELLING owner;
 *   (3)  any other fees payable by the owner of the unit being sold;
 *   (4)  any capital expenditures in excess of $1,000 approved by the executive
 *        board for the current and next succeeding fiscal year;
 *   (5)  the amount of any reserves for capital expenditures;          ← INPUT param
 *   (6)  the current operating budget of the association;
 *   (7)  any unsatisfied judgments against the association + any pending suits;
 *   (8)  the insurance coverage provided for the benefit of unit owners,
 *        including any schedule;
 *   (9)  any restrictions in the declaration affecting the amount that may be
 *        received by a unit owner on sale, condemnation, or casualty loss;
 *   (10) in a cooperative, an accountant's statement (if any was prepared) as to
 *        the deductibility for federal income-tax purposes;
 *   (11) if the association is unincorporated, the name of the statutory agent
 *        for service of process filed with the Secretary of the State;
 *   (12) any pending sale or encumbrance of common elements;
 *   (13) the effect on the unit to be conveyed of any restrictions on the
 *        owner's right to use or occupy the unit;
 *   (14) the number of units whose owners are at least sixty days' delinquent in
 *        paying their common charges;
 *   (15) the number of foreclosure actions brought by the association during the
 *        past twelve months.
 *
 * §47-270(b)(1): the association must furnish the certificate NOT LATER THAN TEN
 *   BUSINESS DAYS after receipt of a request in a record + payment of a fee of
 *   ONE HUNDRED EIGHTY-FIVE DOLLARS ($185), as adjusted per §47-213 (CPI for
 *   Urban Wage Earners and Clerical Workers). An ADDITIONAL fee of not more than
 *   TEN DOLLARS ($10) may be charged for EXPEDITED preparation when furnished
 *   within THREE BUSINESS DAYS. (Per PA 23-18 the base fee rose from $125→$185.)
 * §47-270(b)(2): the owner is not liable to the purchaser for erroneous
 *   information provided BY THE ASSOCIATION in the certificate.
 * §47-270(c): a purchaser is NOT LIABLE for any unpaid assessment or fee greater
 *   than the amount set forth in the certificate prepared by the association.
 *
 * Out of scope (per dispatch): legal sign-off; non-CT certificates (DE §81-409
 * is a downstream parameterization, not built here). `state` is carried through
 * but only "CT" is implemented.
 */

// ── Statutory constants (CGS §47-270(b)(1)) ──────────────────────────────────
// These are citation-anchored. The base fee is CPI-adjusted per §47-213; the
// value below is the current statutory figure (PA 23-18, $185). Treat as a
// configurable constant — if a future CPI adjustment changes it, update here
// with the new public-act / §47-213 citation rather than scattering literals.
export const RESALE_CERTIFICATE_FEE_USD = 185;
export const RESALE_CERTIFICATE_SLA_BUSINESS_DAYS = 10;
export const RESALE_CERTIFICATE_EXPEDITE_FEE_USD = 10; // §47-270(b)(1): "not more than ten dollars"
export const RESALE_CERTIFICATE_EXPEDITE_SLA_BUSINESS_DAYS = 3;
export const RESALE_CERTIFICATE_CAPEX_DISCLOSURE_THRESHOLD_USD = 1000; // §47-270(a)(4): "in excess of one thousand dollars"
export const RESALE_CERTIFICATE_DELINQUENCY_DISCLOSURE_DAYS = 60; // §47-270(a)(14): "at least sixty days' delinquent"
export const RESALE_CERTIFICATE_FORECLOSURE_LOOKBACK_MONTHS = 12; // §47-270(a)(15): "during the past twelve months"
export const RESALE_CERTIFICATE_STATUTE_CITATION = "CGS §47-270";

/** Total fee due for a request (base + expedite when applicable). */
export function resaleCertificateFeeUsd(expedited: boolean): number {
  return expedited
    ? RESALE_CERTIFICATE_FEE_USD + RESALE_CERTIFICATE_EXPEDITE_FEE_USD
    : RESALE_CERTIFICATE_FEE_USD;
}

// ── §47-270(b)(1) SLA clock — business-day arithmetic ────────────────────────
/**
 * Add `n` business days (Mon-Fri; weekends skipped) to `start`. Day 0 is the
 * request-receipt day; the first business day counted is the next calendar day.
 * Federal/state holidays are NOT subtracted here (the statute says "business
 * days"; a holiday calendar can be layered later) — documented as a known
 * conservative simplification: we never under-state the owner's deadline by
 * counting a holiday, but we may count one. TODO(#8013): wire a CT holiday
 * calendar for exact business-day computation.
 */
export function addBusinessDays(start: Date, n: number): Date {
  const out = new Date(start.getTime());
  let added = 0;
  while (added < n) {
    out.setUTCDate(out.getUTCDate() + 1);
    const dow = out.getUTCDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) added += 1;
  }
  return out;
}

/** §47-270(b)(1) due date: 10 business days (3 if expedited) after receipt. */
export function computeResaleCertificateDue(requestReceivedAt: Date, expedited: boolean): Date {
  return addBusinessDays(
    requestReceivedAt,
    expedited
      ? RESALE_CERTIFICATE_EXPEDITE_SLA_BUSINESS_DAYS
      : RESALE_CERTIFICATE_SLA_BUSINESS_DAYS,
  );
}

// ── Input bundle (gathered live by the storage/glue layer) ───────────────────

export interface ResaleCertificateLedgerEntry {
  entryType: "charge" | "assessment" | "payment" | "late-fee" | "credit" | "adjustment";
  amount: number;
  description: string | null;
  /** referenceType helps classify "periodic" vs "special" vs "other fee". */
  referenceType?: string | null;
}

export interface ResaleCertificateBudgetLine {
  lineItemName: string;
  plannedAmount: number;
}

export interface ResaleCertificateCapexItem {
  description: string;
  amount: number;
  fiscalYear: number;
}

export interface ResaleCertificateInsurancePolicy {
  policyType: string;
  carrier: string;
  policyNumber: string | null;
  coverageAmount: number | null;
  expirationDate: Date | null;
}

export interface ResaleCertificateInputs {
  state: string; // "CT" only (validated by caller)
  association: {
    name: string;
    /** true ⇒ §47-270(a)(11) statutory-agent disclosure applies. */
    isIncorporated: boolean;
    statutoryAgentName?: string | null;
    isCooperative?: boolean;
  };
  unit: { unitNumber: string; building?: string | null };
  sellingOwnerName: string;
  purchaserName?: string | null;

  request: {
    requestedAt: Date;
    expedited: boolean;
  };

  // §47-270(a)(1): rights of first refusal / restraints on free alienability of
  // the unit held by the association (from the recorded declaration). Empty ⇒
  // none apply.
  rightsOfFirstRefusalOrRestraints: string[];

  // §47-270(a)(2)-(3): the selling owner's ledger (the function partitions it).
  /** The recurring periodic common-expense assessment amount (e.g. monthly). */
  periodicCommonExpenseAssessment: number;
  ownerLedger: ResaleCertificateLedgerEntry[];

  // §47-270(a)(4): capex > $1,000 approved for current + next FY.
  approvedCapitalExpenditures: ResaleCertificateCapexItem[];

  // §47-270(a)(5): reserves — INPUT PARAM (board-declared). NOT imported from
  // the unmerged #8016 reserve-disclosure work. The caller supplies the
  // board-declared reserve amount + the basis on which it was determined.
  // TODO(#8013): wire to #8016 reserveDisclosureDollars/reserveDisclosureBasis
  // once that work merges to main; until then the board supplies these directly.
  reserveForCapitalExpendituresUsd: number;
  reserveBasis?: string | null;

  // §47-270(a)(6): the current operating budget.
  currentOperatingBudget: {
    fiscalYear: number;
    lines: ResaleCertificateBudgetLine[];
    ratified: boolean;
  } | null;

  // §47-270(a)(7): unsatisfied judgments + pending suits (attestation input).
  unsatisfiedJudgments: string[];
  pendingSuits: string[];

  // §47-270(a)(8): insurance coverage (incl. schedule).
  insurancePolicies: ResaleCertificateInsurancePolicy[];

  // §47-270(a)(9): declaration restrictions on amount received on
  // sale/condemnation/casualty (attestation/declaration input).
  alienationProceedsRestrictions: string[];

  // §47-270(a)(10): cooperative accountant's tax-deductibility statement.
  cooperativeTaxDeductibilityStatement?: string | null;

  // §47-270(a)(12): pending sale or encumbrance of common elements.
  pendingCommonElementSalesOrEncumbrances: string[];

  // §47-270(a)(13): restrictions on the owner's right to use/occupy the unit.
  useOrOccupancyRestrictions: string[];

  // §47-270(a)(14): count of units 60+ days delinquent.
  unitsSixtyPlusDaysDelinquent: number;

  // §47-270(a)(15): foreclosure actions brought in the past 12 months.
  foreclosureActionsPastTwelveMonths: number;

  // Attestation block.
  attestation: {
    boardMemberName: string;
    /** Validity window in days from generation (association policy). */
    validityDays?: number;
  };

  /** Generation timestamp (defaults to request time in callers). */
  generatedAt: Date;
}

// ── Output document (stored as `resaleCertificates.payload`) ─────────────────

export interface ResaleCertificateMoneyOwed {
  periodicCommonExpenseAssessment: number;
  unpaidCommonExpense: number;
  unpaidSpecialAssessment: number;
  otherFees: { description: string; amount: number }[];
  totalCurrentlyDue: number;
}

export interface ResaleCertificateDocument {
  statuteCitation: string;
  state: string;
  generatedAt: string; // ISO
  association: { name: string; isIncorporated: boolean; isCooperative: boolean };
  unit: { unitNumber: string; building: string | null };
  sellingOwnerName: string;
  purchaserName: string | null;

  // §47-270(a) disclosures (keyed by subsection number).
  disclosures: {
    /** (1) right of first refusal / restraint on alienability. */
    a1_rightOfFirstRefusal: { applies: boolean; statement: string };
    /** (2) periodic assessment + unpaid common/special currently due. */
    a2_amountsDue: ResaleCertificateMoneyOwed;
    /** (3) other fees payable by the selling owner. */
    a3_otherFees: { description: string; amount: number }[];
    /** (4) approved capex > $1,000 for current + next FY. */
    a4_approvedCapitalExpenditures: ResaleCertificateCapexItem[];
    /** (5) reserves for capital expenditures (board-declared input). */
    a5_reservesForCapitalExpenditures: { amountUsd: number; basis: string | null };
    /** (6) current operating budget. */
    a6_currentOperatingBudget:
      | { fiscalYear: number; totalPlanned: number; lineCount: number; ratified: boolean }
      | null;
    /** (7) unsatisfied judgments + pending suits. */
    a7_judgmentsAndSuits: { unsatisfiedJudgments: string[]; pendingSuits: string[] };
    /** (8) insurance coverage incl. schedule. */
    a8_insurance: {
      policyType: string;
      carrier: string;
      policyNumber: string | null;
      coverageAmount: number | null;
      expirationDate: string | null;
    }[];
    /** (9) declaration restrictions on sale/condemnation/casualty proceeds. */
    a9_alienationProceedsRestrictions: string[];
    /** (10) cooperative accountant tax-deductibility statement. */
    a10_cooperativeTaxDeductibility: string | null;
    /** (11) statutory agent (only when unincorporated). */
    a11_statutoryAgent: { applies: boolean; name: string | null };
    /** (12) pending sale/encumbrance of common elements. */
    a12_pendingCommonElementSalesOrEncumbrances: string[];
    /** (13) restrictions on owner's use/occupancy. */
    a13_useOrOccupancyRestrictions: string[];
    /** (14) units 60+ days delinquent. */
    a14_unitsSixtyPlusDaysDelinquent: number;
    /** (15) foreclosure actions in past 12 months. */
    a15_foreclosuresPastTwelveMonths: number;
  };

  // §47-270(b)(1) request/SLA/fee metadata.
  request: {
    requestedAt: string;
    expedited: boolean;
    slaBusinessDays: number;
    dueAt: string;
    feeUsd: number;
  };

  // §47-270(c) accuracy / liability note.
  accuracyNote: string;

  // Attestation.
  attestation: { boardMemberName: string; attestedAt: string; validUntil: string | null };
}

// ── Classification helpers for §47-270(a)(2)-(3) ─────────────────────────────

const SPECIAL_ASSESSMENT_REFS = new Set(["special_assessment", "special-assessment", "assessment"]);

/**
 * A ledger entry is an outstanding *charge* the owner still owes when it
 * increases the balance (charge/assessment/late-fee/adjustment with amount>0).
 * Payments/credits reduce the balance. We compute the net amounts currently due
 * by class. NOTE: this is a snapshot classification; the true source-of-truth
 * remains the owner ledger (§47-270(c) caps purchaser liability at what the
 * certificate states, so we surface the live ledger totals, not estimates).
 */
function isChargeLike(e: ResaleCertificateLedgerEntry): boolean {
  return e.entryType === "charge" || e.entryType === "assessment" || e.entryType === "late-fee" || e.entryType === "adjustment";
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * §47-270(a)(2)-(3): partition the selling owner's ledger into the periodic
 * common-expense assessment, unpaid common-expense, unpaid special assessment,
 * and other fees. Payments/credits are netted against the charge total so we
 * never over-state what is "currently due and payable".
 */
export function computeAmountsDue(
  periodicCommonExpenseAssessment: number,
  ledger: ResaleCertificateLedgerEntry[],
): { amounts: ResaleCertificateMoneyOwed; otherFees: { description: string; amount: number }[] } {
  let unpaidCommonExpense = 0;
  let unpaidSpecialAssessment = 0;
  const otherFees: { description: string; amount: number }[] = [];

  // Net credits/payments reduce the outstanding common-expense balance.
  let creditsAndPayments = 0;
  for (const e of ledger) {
    if (e.entryType === "payment" || e.entryType === "credit") {
      creditsAndPayments += Math.abs(e.amount);
      continue;
    }
    if (!isChargeLike(e)) continue;
    if (e.amount <= 0) continue;

    const ref = (e.referenceType ?? "").toLowerCase();
    if (e.entryType === "assessment" && SPECIAL_ASSESSMENT_REFS.has(ref)) {
      unpaidSpecialAssessment += e.amount;
    } else if (e.entryType === "assessment" || e.entryType === "charge") {
      unpaidCommonExpense += e.amount;
    } else if (e.entryType === "late-fee") {
      otherFees.push({ description: e.description ?? "Late fee", amount: e.amount });
    } else {
      // adjustment
      otherFees.push({ description: e.description ?? "Adjustment", amount: e.amount });
    }
  }

  // Apply credits/payments against common expense first, then special.
  let remainingCredit = creditsAndPayments;
  const applyToCommon = Math.min(remainingCredit, unpaidCommonExpense);
  unpaidCommonExpense -= applyToCommon;
  remainingCredit -= applyToCommon;
  const applyToSpecial = Math.min(remainingCredit, unpaidSpecialAssessment);
  unpaidSpecialAssessment -= applyToSpecial;

  unpaidCommonExpense = round2(unpaidCommonExpense);
  unpaidSpecialAssessment = round2(unpaidSpecialAssessment);
  const otherFeesTotal = round2(otherFees.reduce((s, f) => s + f.amount, 0));

  const amounts: ResaleCertificateMoneyOwed = {
    periodicCommonExpenseAssessment: round2(periodicCommonExpenseAssessment),
    unpaidCommonExpense,
    unpaidSpecialAssessment,
    otherFees,
    totalCurrentlyDue: round2(unpaidCommonExpense + unpaidSpecialAssessment + otherFeesTotal),
  };
  return { amounts, otherFees };
}

// ── The generator ────────────────────────────────────────────────────────────

/** Thrown when inputs are not for an implemented jurisdiction. */
export class ResaleCertificateUnsupportedStateError extends Error {
  constructor(state: string) {
    super(`Resale certificate generation is only implemented for CT (CGS §47-270); got state="${state}".`);
    this.name = "ResaleCertificateUnsupportedStateError";
  }
}

/**
 * Build the full §47-270 resale certificate document from gathered inputs.
 * Pure — no DB, no I/O. Deterministic given its inputs.
 */
export function buildResaleCertificateDocument(inputs: ResaleCertificateInputs): ResaleCertificateDocument {
  if (inputs.state !== "CT") {
    throw new ResaleCertificateUnsupportedStateError(inputs.state);
  }

  const { amounts } = computeAmountsDue(inputs.periodicCommonExpenseAssessment, inputs.ownerLedger);

  const dueAt = computeResaleCertificateDue(inputs.request.requestedAt, inputs.request.expedited);
  const feeUsd = resaleCertificateFeeUsd(inputs.request.expedited);
  const slaBusinessDays = inputs.request.expedited
    ? RESALE_CERTIFICATE_EXPEDITE_SLA_BUSINESS_DAYS
    : RESALE_CERTIFICATE_SLA_BUSINESS_DAYS;

  // §47-270(a)(4): only capex strictly in excess of $1,000 is disclosed.
  const capex = inputs.approvedCapitalExpenditures.filter(
    (c) => c.amount > RESALE_CERTIFICATE_CAPEX_DISCLOSURE_THRESHOLD_USD,
  );

  const validUntil =
    inputs.attestation.validityDays && inputs.attestation.validityDays > 0
      ? new Date(inputs.generatedAt.getTime() + inputs.attestation.validityDays * 24 * 60 * 60 * 1000)
      : null;

  const isCooperative = Boolean(inputs.association.isCooperative);

  // §47-270(c) accuracy / liability note — purchaser not liable beyond the cert.
  const accuracyNote =
    "Pursuant to CGS §47-270(c), a purchaser of this unit is not liable for any " +
    "unpaid assessment or fee against the unit greater than the amount set forth " +
    "in this certificate prepared by the association. The amounts stated are as " +
    `of ${inputs.generatedAt.toISOString().slice(0, 10)} and are drawn from the ` +
    "association's books and records.";

  return {
    statuteCitation: RESALE_CERTIFICATE_STATUTE_CITATION,
    state: inputs.state,
    generatedAt: inputs.generatedAt.toISOString(),
    association: {
      name: inputs.association.name,
      isIncorporated: inputs.association.isIncorporated,
      isCooperative,
    },
    unit: { unitNumber: inputs.unit.unitNumber, building: inputs.unit.building ?? null },
    sellingOwnerName: inputs.sellingOwnerName,
    purchaserName: inputs.purchaserName ?? null,

    disclosures: {
      a1_rightOfFirstRefusal: {
        applies: inputs.rightsOfFirstRefusalOrRestraints.length > 0,
        statement:
          inputs.rightsOfFirstRefusalOrRestraints.length > 0
            ? "§47-270(a)(1): The following rights of first refusal or restraints " +
              "on the free alienability of this unit are held by the association: " +
              inputs.rightsOfFirstRefusalOrRestraints.join("; ") + "."
            : "§47-270(a)(1): The association holds no right of first refusal or " +
              "other restraint on the free alienability of this unit, except as may " +
              "be expressly stated in the recorded declaration.",
      },
      a2_amountsDue: amounts,
      a3_otherFees: amounts.otherFees,
      a4_approvedCapitalExpenditures: capex,
      a5_reservesForCapitalExpenditures: {
        amountUsd: round2(inputs.reserveForCapitalExpendituresUsd),
        basis: inputs.reserveBasis ?? null,
      },
      a6_currentOperatingBudget: inputs.currentOperatingBudget
        ? {
            fiscalYear: inputs.currentOperatingBudget.fiscalYear,
            totalPlanned: round2(
              inputs.currentOperatingBudget.lines.reduce((s, l) => s + l.plannedAmount, 0),
            ),
            lineCount: inputs.currentOperatingBudget.lines.length,
            ratified: inputs.currentOperatingBudget.ratified,
          }
        : null,
      a7_judgmentsAndSuits: {
        unsatisfiedJudgments: inputs.unsatisfiedJudgments,
        pendingSuits: inputs.pendingSuits,
      },
      a8_insurance: inputs.insurancePolicies.map((p) => ({
        policyType: p.policyType,
        carrier: p.carrier,
        policyNumber: p.policyNumber,
        coverageAmount: p.coverageAmount,
        expirationDate: p.expirationDate ? p.expirationDate.toISOString().slice(0, 10) : null,
      })),
      a9_alienationProceedsRestrictions: inputs.alienationProceedsRestrictions,
      a10_cooperativeTaxDeductibility: isCooperative
        ? inputs.cooperativeTaxDeductibilityStatement ?? null
        : null,
      a11_statutoryAgent: {
        // §47-270(a)(11) applies ONLY when the association is unincorporated.
        applies: !inputs.association.isIncorporated,
        name: inputs.association.isIncorporated ? null : inputs.association.statutoryAgentName ?? null,
      },
      a12_pendingCommonElementSalesOrEncumbrances: inputs.pendingCommonElementSalesOrEncumbrances,
      a13_useOrOccupancyRestrictions: inputs.useOrOccupancyRestrictions,
      a14_unitsSixtyPlusDaysDelinquent: inputs.unitsSixtyPlusDaysDelinquent,
      a15_foreclosuresPastTwelveMonths: inputs.foreclosureActionsPastTwelveMonths,
    },

    request: {
      requestedAt: inputs.request.requestedAt.toISOString(),
      expedited: inputs.request.expedited,
      slaBusinessDays,
      dueAt: dueAt.toISOString(),
      feeUsd,
    },

    accuracyNote,

    attestation: {
      boardMemberName: inputs.attestation.boardMemberName,
      attestedAt: inputs.generatedAt.toISOString(),
      validUntil: validUntil ? validUntil.toISOString() : null,
    },
  };
}
