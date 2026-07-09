/**
 * Statutory-deadline computation for statutory records (founder-os#9483).
 *
 * PURE. Routes each statutory record type to its governing clock — reusing the
 * EXISTING per-statute business-day arithmetic rather than re-deriving it:
 *
 *   resale_certificate   → CGS §47-270(b)(1): 10 business days (3 if expedited).
 *                          Reuses `computeResaleCertificateDue` (#8013).
 *   estoppel_certificate → same closing window as the §47-270 resale certificate
 *                          (CT's statutory closing instrument IS §47-270; the
 *                          estoppel packet is the account-status subset furnished
 *                          on the same clock). Reuses `computeResaleCertificateDue`.
 *   records_request      → CGS §47-260(b): the association must respond (offer two
 *                          exam dates) not later than 5 business days after receipt.
 *                          Reuses `computeResponseDueDate` (records-retention).
 *
 * There is deliberately ONE source of truth per clock — this module never
 * re-implements business-day math; it dispatches to the statute's owner.
 */
import type { StatutoryRecordType } from "@shared/schema";
import {
  computeResaleCertificateDue,
  RESALE_CERTIFICATE_SLA_BUSINESS_DAYS,
  RESALE_CERTIFICATE_EXPEDITE_SLA_BUSINESS_DAYS,
  RESALE_CERTIFICATE_STATUTE_CITATION,
} from "./resale-certificate-service";
import {
  computeResponseDueDate,
  RECORDS_RESPONSE_BUSINESS_DAYS,
} from "./records-retention-service";

const RECORDS_REQUEST_STATUTE_CITATION = "CGS §47-260(b)";

export interface StatutoryDeadline {
  /** The pinned statutory deadline. */
  deadlineAt: Date;
  /** Business-day count applied (audit). */
  slaBusinessDays: number;
  /** The governing statute for THIS record type. */
  statuteCitation: string;
}

/**
 * Compute the pinned statutory deadline for a record type.
 *   - `receivedAt` is when the request landed (day 0).
 *   - `expedited` only affects resale/estoppel (§47-270(b)(1) 3-day option).
 */
export function computeStatutoryDeadline(
  recordType: StatutoryRecordType,
  receivedAt: Date,
  expedited = false,
): StatutoryDeadline {
  switch (recordType) {
    case "resale_certificate":
    case "estoppel_certificate": {
      const deadlineAt = computeResaleCertificateDue(receivedAt, expedited);
      const slaBusinessDays = expedited
        ? RESALE_CERTIFICATE_EXPEDITE_SLA_BUSINESS_DAYS
        : RESALE_CERTIFICATE_SLA_BUSINESS_DAYS;
      return { deadlineAt, slaBusinessDays, statuteCitation: RESALE_CERTIFICATE_STATUTE_CITATION };
    }
    case "records_request": {
      // §47-260(b) response window — expedite does not apply.
      const deadlineAt = computeResponseDueDate(receivedAt);
      return {
        deadlineAt,
        slaBusinessDays: RECORDS_RESPONSE_BUSINESS_DAYS,
        statuteCitation: RECORDS_REQUEST_STATUTE_CITATION,
      };
    }
    default: {
      // Exhaustiveness: a new record type must declare its clock here.
      const _exhaustive: never = recordType;
      throw new Error(`No statutory deadline clock defined for record type "${_exhaustive}".`);
    }
  }
}
