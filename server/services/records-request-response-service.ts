/**
 * Records-request response generator (founder-os#9483).
 *
 * PURE, DB-free. Produces the §47-260 response packet an association furnishes
 * to a unit owner who has requested to inspect records: the response-due date
 * (5 business days per §47-260(b)), the two exam dates (when offered), the
 * disclosed-vs-withheld classification (§47-260(c) mandatory / (d) permissive),
 * and the reasonable copy fee (§47-260(e)).
 *
 * REUSES the existing §47-260 engine (`records-retention-service`) as the single
 * source of truth for the response clock, withholding classification, and copy
 * fee — this module only assembles the response DOCUMENT. Where a full §47-260
 * records-request lifecycle already exists (the `recordsRequests` table), the
 * statutory-records layer links to it; this generator can also stand alone for
 * an ad-hoc closing/records intake.
 */
import {
  computeResponseDueDate,
  computeCopyFeeCents,
  filterDisclosableRecords,
  RECORDS_RESPONSE_BUSINESS_DAYS,
  type WithholdableRecord,
} from "./records-retention-service";

export const RECORDS_REQUEST_STATUTE_CITATION = "CGS §47-260";

export interface RecordsRequestResponseInputs {
  state: string; // "CT" only (validated by caller)
  association: { name: string };
  requesterName: string;
  requesterEmail?: string | null;
  /** §47-260(b) — the records reasonably identified in the owner's request. */
  recordsRequested: string;
  receivedAt: Date;
  /** Optional two exam dates offered within the 5-business-day window. */
  examDate1?: Date | null;
  examDate2?: Date | null;
  /** Candidate records with §47-260(c)/(d) withholding classes. */
  candidateRecords?: (WithholdableRecord & { label: string })[];
  /** §47-260(e) copy-fee inputs (when copies are being furnished). */
  copyFee?: { pageCount: number; perPageCents?: number; supervisionFeeCents?: number };
  generatedAt: Date;
}

export interface RecordsRequestResponseDocument {
  statuteCitation: string;
  state: string;
  generatedAt: string; // ISO
  association: { name: string };
  requester: { name: string; email: string | null };
  recordsRequested: string;
  receivedAt: string;
  responseDueAt: string;
  responseSlaBusinessDays: number;
  examDatesOffered: string[];
  disclosure: {
    disclosed: { label: string }[];
    withheld: { label: string; class: "mandatory" | "permissive" }[];
  };
  copyFeeCents: number | null;
  statutoryNote: string;
}

export class RecordsRequestUnsupportedStateError extends Error {
  constructor(state: string) {
    super(`Records-request response generation is only implemented for CT (CGS §47-260); got state="${state}".`);
    this.name = "RecordsRequestUnsupportedStateError";
  }
}

/** Build the §47-260 records-request response document. Pure, deterministic. */
export function buildRecordsRequestResponse(
  inputs: RecordsRequestResponseInputs,
): RecordsRequestResponseDocument {
  if (inputs.state !== "CT") {
    throw new RecordsRequestUnsupportedStateError(inputs.state);
  }

  const responseDueAt = computeResponseDueDate(inputs.receivedAt);

  const examDatesOffered = [inputs.examDate1, inputs.examDate2]
    .filter((d): d is Date => d instanceof Date)
    .map((d) => d.toISOString());

  const candidates = inputs.candidateRecords ?? [];
  const { disclosed, withheld } = filterDisclosableRecords(candidates);

  const copyFeeCents = inputs.copyFee
    ? computeCopyFeeCents({
        pageCount: inputs.copyFee.pageCount,
        perPageCents: inputs.copyFee.perPageCents,
        supervisionFeeCents: inputs.copyFee.supervisionFeeCents,
      })
    : null;

  const statutoryNote =
    "Pursuant to CGS §47-260(b), the association must make the requested records " +
    "available for examination not later than " + RECORDS_RESPONSE_BUSINESS_DAYS +
    " business days after receiving the owner's request. Records identified in " +
    "§47-260(c) are withheld as required by law; records identified in §47-260(d) " +
    "may be withheld at the association's discretion.";

  return {
    statuteCitation: RECORDS_REQUEST_STATUTE_CITATION,
    state: inputs.state,
    generatedAt: inputs.generatedAt.toISOString(),
    association: { name: inputs.association.name },
    requester: { name: inputs.requesterName, email: inputs.requesterEmail ?? null },
    recordsRequested: inputs.recordsRequested,
    receivedAt: inputs.receivedAt.toISOString(),
    responseDueAt: responseDueAt.toISOString(),
    responseSlaBusinessDays: RECORDS_RESPONSE_BUSINESS_DAYS,
    examDatesOffered,
    disclosure: {
      disclosed: disclosed.map((r) => ({ label: r.label })),
      withheld: withheld.map((w) => ({ label: w.record.label, class: w.class })),
    },
    copyFeeCents,
    statutoryNote,
  };
}
