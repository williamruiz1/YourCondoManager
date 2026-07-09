/**
 * Estoppel certificate generator (founder-os#9483).
 *
 * PURE, DB-free. An "estoppel certificate" is the association's statement, given
 * to a closing agent, of exactly what a unit owes and whether the owner is in
 * good standing — the money-owed subset a title/closing company relies on so the
 * association is later estopped from claiming more than the certificate states.
 *
 * ── Grounding / scope honesty ────────────────────────────────────────────────
 * In Connecticut the STATUTORY closing instrument is the §47-270 resale
 * certificate; "estoppel certificate" is the term used in other jurisdictions
 * (e.g. Florida §718.116(8), §720.30851). We therefore do NOT re-implement a
 * separate statutory disclosure engine here — the estoppel packet REUSES the
 * §47-270 money-owed computation (`computeAmountsDue`) as its core and frames it
 * as the closing account-status certificate. Multi-state estoppel-specific
 * statutory fields (e.g. FL's prescribed form + fee caps) are DEFERRED until a
 * non-CT association surfaces; this module produces the CT account-status
 * estoppel grounded in the live owner ledger + association data. The §47-270(c)
 * cap on purchaser liability is carried through as the accuracy note.
 */
import {
  computeAmountsDue,
  type ResaleCertificateLedgerEntry,
  type ResaleCertificateMoneyOwed,
} from "./resale-certificate-service";

export const ESTOPPEL_CERTIFICATE_STATUTE_CITATION = "CGS §47-270 (closing account-status subset)";

export interface EstoppelCertificateInputs {
  state: string; // "CT" only (validated by caller)
  association: { name: string };
  unit: { unitNumber: string; building?: string | null };
  sellingOwnerName: string;
  purchaserName?: string | null;
  /** The recurring periodic common-expense assessment (e.g. monthly dues). */
  periodicCommonExpenseAssessment: number;
  /** The selling owner's ledger for this unit (partitioned by the pure fn). */
  ownerLedger: ResaleCertificateLedgerEntry[];
  /** Board-declared reserve figure (informational on an estoppel). */
  reserveForCapitalExpendituresUsd?: number | null;
  /** Any transfer / capital-contribution fee due at closing. */
  transferFeeUsd?: number | null;
  attestation: { boardMemberName: string; validityDays?: number };
  generatedAt: Date;
}

export interface EstoppelCertificateDocument {
  statuteCitation: string;
  state: string;
  generatedAt: string; // ISO
  association: { name: string };
  unit: { unitNumber: string; building: string | null };
  sellingOwnerName: string;
  purchaserName: string | null;
  /** The account status a closing agent relies on. */
  accountStatus: {
    periodicCommonExpenseAssessment: number;
    amountsDue: ResaleCertificateMoneyOwed;
    reserveForCapitalExpendituresUsd: number | null;
    transferFeeUsd: number | null;
    /** Total the closing must collect for the association. */
    totalDueAtClosing: number;
    /** No amounts currently due. */
    inGoodStanding: boolean;
  };
  accuracyNote: string;
  attestation: { boardMemberName: string; attestedAt: string; validUntil: string | null };
}

export class EstoppelCertificateUnsupportedStateError extends Error {
  constructor(state: string) {
    super(`Estoppel certificate generation is only implemented for CT; got state="${state}".`);
    this.name = "EstoppelCertificateUnsupportedStateError";
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Build the estoppel (closing account-status) certificate. Pure, deterministic. */
export function buildEstoppelCertificateDocument(
  inputs: EstoppelCertificateInputs,
): EstoppelCertificateDocument {
  if (inputs.state !== "CT") {
    throw new EstoppelCertificateUnsupportedStateError(inputs.state);
  }

  const { amounts } = computeAmountsDue(inputs.periodicCommonExpenseAssessment, inputs.ownerLedger);
  const transferFeeUsd = inputs.transferFeeUsd != null ? round2(inputs.transferFeeUsd) : null;
  const totalDueAtClosing = round2(amounts.totalCurrentlyDue + (transferFeeUsd ?? 0));
  const inGoodStanding = amounts.totalCurrentlyDue === 0;

  const validUntil =
    inputs.attestation.validityDays && inputs.attestation.validityDays > 0
      ? new Date(inputs.generatedAt.getTime() + inputs.attestation.validityDays * 24 * 60 * 60 * 1000)
      : null;

  const accuracyNote =
    "This estoppel certificate states the amounts due to the association from the " +
    "unit as of " + inputs.generatedAt.toISOString().slice(0, 10) + ", drawn from the " +
    "association's books and records. Pursuant to CGS §47-270(c), a purchaser of this " +
    "unit is not liable for any unpaid assessment or fee against the unit greater than " +
    "the amount set forth herein.";

  return {
    statuteCitation: ESTOPPEL_CERTIFICATE_STATUTE_CITATION,
    state: inputs.state,
    generatedAt: inputs.generatedAt.toISOString(),
    association: { name: inputs.association.name },
    unit: { unitNumber: inputs.unit.unitNumber, building: inputs.unit.building ?? null },
    sellingOwnerName: inputs.sellingOwnerName,
    purchaserName: inputs.purchaserName ?? null,
    accountStatus: {
      periodicCommonExpenseAssessment: amounts.periodicCommonExpenseAssessment,
      amountsDue: amounts,
      reserveForCapitalExpendituresUsd:
        inputs.reserveForCapitalExpendituresUsd != null
          ? round2(inputs.reserveForCapitalExpendituresUsd)
          : null,
      transferFeeUsd,
      totalDueAtClosing,
      inGoodStanding,
    },
    accuracyNote,
    attestation: {
      boardMemberName: inputs.attestation.boardMemberName,
      attestedAt: inputs.generatedAt.toISOString(),
      validUntil: validUntil ? validUntil.toISOString() : null,
    },
  };
}
