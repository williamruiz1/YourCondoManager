/**
 * CT CGS §47-260 — Association records: statutory retention engine + owner
 * records-request workflow + mandatory/permissive withholding. (founder-os#8017)
 *
 * Connecticut's Common Interest Ownership Act (CIOA) §47-260 requires a condo
 * association to keep specific records, lets unit owners inspect/copy them for a
 * reasonable fee, and defines what MUST and what MAY be withheld.
 *
 * ## Statutory anchors (verified against CGS §47-260 — FindLaw / Justia, 2024)
 *
 *   §47-260(a)(5)  — "All financial statements and tax returns of the
 *                    association for the past THREE years." → 3-year retention.
 *   §47-260(a)(11) — "Ballots, proxies and other records related to voting by
 *                    unit owners for ONE year after the election" to which they
 *                    relate. → 1-year retention.
 *   §47-260(b)     — Records are available on THIRTY days' notice from the owner
 *                    "in a record reasonably identifying the specific records
 *                    requested"; the association must, "not later than FIVE
 *                    BUSINESS DAYS following the date of receiving such notice,
 *                    provide ... two dates on which the records may be examined."
 *                    → response-due = receivedAt + 5 BUSINESS days.  ◀ VERIFIED
 *   §47-260(c)     — MANDATORY withholding: personnel, salary and medical
 *                    records; any unredacted ballot or proxy form.
 *   §47-260(d)     — PERMISSIVE withholding: contracts/commercial transactions
 *                    currently being negotiated; existing or potential
 *                    litigation/mediation; communications with the association's
 *                    attorney; executive-session records; other owners' files.
 *   §47-260(e)     — The association "may charge a reasonable fee for providing
 *                    copies of any records ... and for supervising the unit
 *                    owner's inspection."
 *
 * ## Design — statutory LOGIC is PURE
 *
 * Per the repo's test reality (no live DB; every test mocks `../db`), all
 * statutory logic lives here as PURE functions over plain inputs, with NO DB
 * import. Storage/routes are thin glue that call these. The pure functions are
 * unit-tested in tests/records-retention-47-260.test.ts (same pattern as the
 * §47-261e / §47-258 builds).
 */

import type { RecordType, RecordsWithholdingClass } from "@shared/schema";

// ---------------------------------------------------------------------------
// §47-260(b) — records-request RESPONSE TIMING  (VERIFIED, see header)
// ---------------------------------------------------------------------------

/**
 * §47-260(b): the association must provide two examination dates "not later than
 * five business days following the date of receiving such notice."
 *
 * VERIFIED against the statute text (header). It is exposed as a named constant
 * (not an inline magic number) so the one place the deadline lives is auditable.
 */
export const RECORDS_RESPONSE_BUSINESS_DAYS = 5;

/** §47-260(b): the owner's advance-notice period before records must be made
 * available. Verified ("thirty days' notice"). Informational — surfaced in the
 * UI; the response-due clock keys off receipt + 5 business days. */
export const RECORDS_REQUEST_OWNER_NOTICE_DAYS = 30;

/** True for Sat/Sun (UTC). §47-260(b) counts BUSINESS days. */
function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Add `n` business days to `start`, skipping weekends. Used to compute the
 * §47-260(b) response-due date. The start day itself is not counted; the result
 * is the date of the Nth business day after `start`.
 *
 * (Federal/state holidays are not modeled — CGS §47-260(b) speaks only of
 * "business days"; weekend-only skipping is the conservative, deterministic
 * interpretation. A holiday calendar can be layered later without changing the
 * call sites.)
 */
export function addBusinessDays(start: Date, n: number): Date {
  const result = new Date(start.getTime());
  let added = 0;
  while (added < n) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (!isWeekend(result)) added++;
  }
  return result;
}

/**
 * §47-260(b) — compute the date by which the association must offer two
 * examination dates: `receivedAt` + 5 business days.
 *
 * `businessDays` defaults to the verified statutory constant; it is a parameter
 * only so the rule is testable on the configured value.
 */
export function computeResponseDueDate(
  receivedAt: Date,
  businessDays: number = RECORDS_RESPONSE_BUSINESS_DAYS,
): Date {
  return addBusinessDays(receivedAt, businessDays);
}

// ---------------------------------------------------------------------------
// §47-260(a)(5) + (a)(11) — statutory RETENTION engine
// ---------------------------------------------------------------------------

/**
 * Record-type → statutory retention period in YEARS. `null` means there is no
 * §47-260 expiry (the record is kept for the life of the association / has no
 * statutory destruction date).
 *
 *   §47-260(a)(5)  financial_statement, tax_return            → 3
 *   §47-260(a)(11) ballot, proxy, voting_record               → 1
 */
export const RECORD_RETENTION_YEARS: Record<RecordType, number | null> = {
  financial_statement: 3, // §47-260(a)(5)
  tax_return: 3,          // §47-260(a)(5)
  ballot: 1,              // §47-260(a)(11)
  proxy: 1,               // §47-260(a)(11)
  voting_record: 1,       // §47-260(a)(11)
  receipts_expenditures: null, // §47-260(a)(1) — no statutory expiry
  meeting_minutes: null,       // §47-260(a)(2)
  owner_roster: null,          // §47-260(a)(3)
  organizational_docs: null,   // §47-260(a)(4)
  contract: null,
  other: null,
};

/** §47-260(a) — statutory retention period (years) for a record type, or null
 * if the statute prescribes no destruction date. */
export function retentionPeriodYears(recordType: RecordType): number | null {
  return RECORD_RETENTION_YEARS[recordType];
}

/**
 * The date a record may be destroyed under §47-260(a): `createdAt` + the
 * statutory retention period. Returns `null` for record types with no statutory
 * expiry (must be retained indefinitely).
 */
export function retentionExpiryDate(
  createdAt: Date,
  recordType: RecordType,
): Date | null {
  const years = retentionPeriodYears(recordType);
  if (years === null) return null;
  const expiry = new Date(createdAt.getTime());
  expiry.setUTCFullYear(expiry.getUTCFullYear() + years);
  return expiry;
}

/**
 * Whether a record's statutory retention period has elapsed as of `now`.
 * Records with no statutory expiry (null) are NEVER expired (kept indefinitely).
 */
export function isRetentionExpired(
  createdAt: Date,
  recordType: RecordType,
  now: Date = new Date(),
): boolean {
  const expiry = retentionExpiryDate(createdAt, recordType);
  if (expiry === null) return false;
  return now.getTime() >= expiry.getTime();
}

// ---------------------------------------------------------------------------
// §47-260(e) — reasonable COPY FEE
// ---------------------------------------------------------------------------

/** Default per-page copy charge (cents). Configurable per association; the
 * statute requires only that the fee be "reasonable" (§47-260(e)). */
export const DEFAULT_COPY_FEE_PER_PAGE_CENTS = 25;

export interface CopyFeeInput {
  /** Number of pages copied. */
  pageCount: number;
  /** Per-page charge in cents (defaults to DEFAULT_COPY_FEE_PER_PAGE_CENTS). */
  perPageCents?: number;
  /** §47-260(e) — flat supervision fee in cents for supervising the inspection. */
  supervisionFeeCents?: number;
}

/**
 * §47-260(e) — compute the reasonable copy fee in cents:
 *   (pageCount × perPageCents) + supervisionFeeCents
 *
 * Negative inputs are clamped to 0. The result is an integer (cents).
 */
export function computeCopyFeeCents(input: CopyFeeInput): number {
  const pages = Math.max(0, Math.trunc(input.pageCount));
  const perPage = Math.max(0, Math.trunc(input.perPageCents ?? DEFAULT_COPY_FEE_PER_PAGE_CENTS));
  const supervision = Math.max(0, Math.trunc(input.supervisionFeeCents ?? 0));
  return pages * perPage + supervision;
}

// ---------------------------------------------------------------------------
// §47-260(c)/(d) — mandatory & permissive WITHHOLDING
// ---------------------------------------------------------------------------

/**
 * A record being considered for inclusion in an owner records-request response.
 * Each carries its §47-260(c)/(d) classification. `permissiveWithheld` only
 * matters when `withholdingClass === "permissive"`: the association elects
 * whether to withhold a permissive-class record on this request.
 */
export interface WithholdableRecord {
  id?: string;
  label?: string;
  recordType?: RecordType;
  withholdingClass: RecordsWithholdingClass;
  /** When true, a permissive-class record is being withheld on THIS request. */
  permissiveWithheld?: boolean;
}

export interface DisclosureResult<T extends WithholdableRecord> {
  /** Records disclosed to the owner. */
  disclosed: T[];
  /** Records withheld, each with the statutory reason class. */
  withheld: Array<{ record: T; class: "mandatory" | "permissive" }>;
}

/**
 * §47-260(c) MANDATORY / §47-260(d) PERMISSIVE — decide whether a single record
 * is disclosed to the requesting owner:
 *
 *   - mandatory  → ALWAYS withheld (§47-260(c)). The association has no
 *                  discretion; included can never be 1.
 *   - permissive → withheld ONLY when `permissiveWithheld` is set
 *                  (§47-260(d) — discretionary); otherwise disclosed.
 *   - none       → disclosed.
 *
 * Returns true when the record should be INCLUDED (disclosed) in the response.
 */
export function isRecordDisclosable(record: WithholdableRecord): boolean {
  switch (record.withholdingClass) {
    case "mandatory":
      return false; // §47-260(c) — never disclosed
    case "permissive":
      return record.permissiveWithheld !== true; // §47-260(d) — withheld only when elected
    case "none":
    default:
      return true;
  }
}

/**
 * §47-260(c)/(d) — partition a candidate record set into what is disclosed to
 * the owner and what is withheld (with the statutory reason class).
 *
 *   - §47-260(c) mandatory-withhold records are EXCLUDED from the owner response.
 *   - §47-260(d) permissive-withhold records are honored when elected
 *     (`permissiveWithheld`), and included when not.
 */
export function filterDisclosableRecords<T extends WithholdableRecord>(
  records: T[],
): DisclosureResult<T> {
  const disclosed: T[] = [];
  const withheld: Array<{ record: T; class: "mandatory" | "permissive" }> = [];
  for (const record of records) {
    if (isRecordDisclosable(record)) {
      disclosed.push(record);
    } else {
      withheld.push({
        record,
        class: record.withholdingClass === "mandatory" ? "mandatory" : "permissive",
      });
    }
  }
  return { disclosed, withheld };
}

// ---------------------------------------------------------------------------
// Helpers shared by storage glue
// ---------------------------------------------------------------------------

/**
 * Build the `included` flag (1/0) a recordsRequestItems row should carry, given
 * its withholding class and whether a permissive record is being withheld.
 * Thin convenience over `isRecordDisclosable` for the storage layer.
 */
export function computeIncludedFlag(
  withholdingClass: RecordsWithholdingClass,
  permissiveWithheld?: boolean,
): number {
  return isRecordDisclosable({ withholdingClass, permissiveWithheld }) ? 1 : 0;
}
