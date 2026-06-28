/**
 * Connecticut resale certificate / "6(d)" generator — pure template + assembler.
 *
 * Statutory basis: Connecticut Common Interest Ownership Act (CIOA),
 * Conn. Gen. Stat. (CGS) §47-270 ("Resale of unit. Resale certificate.").
 *
 * Under CGS §47-270 a unit owner reselling a unit must furnish the purchaser a
 * resale certificate; the association MUST furnish that certificate within
 * 10 BUSINESS DAYS of a written request (§47-270(b)), for a statutory fee. A CT
 * unit legally cannot close a resale without it. Critically, §47-270(c) makes
 * the purchaser NOT liable for any unpaid common-expense / fee amount GREATER
 * than the amount the certificate states — so the certificate's accuracy binds
 * the association financially. That is why this generator must source its
 * numbers from the LIVE ledgers, not a stale snapshot.
 *
 * This module is DB-FREE on purpose (mirrors the account-statement-math.ts
 * split): the field map, fee/SLA constants, business-day SLA math, validity
 * window, the §47-270(c) accuracy note, and `assembleResaleCertificate` are all
 * pure over their inputs, so they are unit-testable without Postgres. The
 * DB-backed loader (`resale-certificate.ts`) pulls live ledger / budget /
 * insurance / delinquency / special-assessment data for a unit and calls the
 * assembler here.
 *
 * State-parameterized: CT is live (§47-270). Delaware's analogue is DUCIOA
 * §81-409 (different fee + field set) — defined as a downstream stub so the
 * surface is ready for it without re-architecting (out of scope per #8013).
 */

// ── Statutory constants (state-parameterized) ───────────────────────────────

/**
 * The two states whose resale-certificate statutes this generator knows about.
 * CT (§47-270) is live; DE (§81-409) is a downstream stub.
 */
export type ResaleCertState = "CT" | "DE";

/**
 * Per-state statutory parameters for the resale-certificate request workflow.
 *
 * `statutoryFeeCents` — the fee the association may charge for the certificate
 * (§47-270(b)(1) for CT). `slaBusinessDays` — the furnishing deadline measured
 * in BUSINESS days from a written request (§47-270(b)). `validityDays` — how
 * long the certificate's figures are treated as current before a refresh is
 * prudent (CIOA does not fix this; 30 days is the conventional treasurer
 * practice and is surfaced as a validity window, not a statutory claim).
 */
export interface ResaleCertStatuteParams {
  state: ResaleCertState;
  statuteCitation: string; // e.g. "CGS §47-270"
  /** Statutory certificate fee, in CENTS (avoids float drift on money). */
  statutoryFeeCents: number;
  /** Furnishing deadline in BUSINESS days from the written request. */
  slaBusinessDays: number;
  /** Conventional validity window (days) for the figures on the certificate. */
  validityDays: number;
  live: boolean; // false = downstream stub (DE)
}

/** CT statutory fee: $185.00 → 18500 cents (§47-270(b)(1)). */
export const CT_STATUTORY_FEE_CENTS = 18_500;

const STATUTE_PARAMS: Record<ResaleCertState, ResaleCertStatuteParams> = {
  CT: {
    state: "CT",
    statuteCitation: "CGS §47-270",
    statutoryFeeCents: CT_STATUTORY_FEE_CENTS, // §47-270(b)(1): $185
    slaBusinessDays: 10, // §47-270(b): 10 business days from written request
    validityDays: 30,
    live: true,
  },
  // Downstream stub — Delaware Uniform CIOA §81-409. Different fee + field set;
  // NOT implemented in #8013 (CT-only). Present so the surface is ready.
  DE: {
    state: "DE",
    statuteCitation: "6 Del. C. §81-409",
    statutoryFeeCents: 0, // TODO(downstream): DE fee schedule
    slaBusinessDays: 10,
    validityDays: 30,
    live: false,
  },
};

/** Resolve the statutory params for a state. Defaults to CT (the live target). */
export function getResaleCertStatuteParams(
  state: string | null | undefined,
): ResaleCertStatuteParams {
  const key = (state ?? "").trim().toUpperCase();
  if (key === "DE") return STATUTE_PARAMS.DE;
  return STATUTE_PARAMS.CT;
}

// ── Business-day SLA math (§47-270(b): 10 business days) ─────────────────────

/**
 * 2026 Connecticut state holidays that fall on a weekday and therefore extend a
 * business-day SLA. Kept small + explicit (no holiday library dependency). The
 * loader passes the request date; the few fixed-date CT holidays here cover the
 * realistic SLA window. Weekends are always skipped regardless of this list.
 *
 * Source: CGS §1-4 legal holidays (the business-day-bearing subset).
 */
const CT_FIXED_HOLIDAYS_2026: ReadonlySet<string> = new Set([
  "2026-01-01", // New Year's Day
  "2026-01-19", // Martin Luther King Jr. Day (3rd Mon Jan)
  "2026-02-16", // Washington's Birthday (3rd Mon Feb)
  "2026-05-25", // Memorial Day (last Mon May)
  "2026-06-19", // Juneteenth
  "2026-07-03", // Independence Day observed (Jul 4 is a Saturday → Fri obs.)
  "2026-09-07", // Labor Day (1st Mon Sep)
  "2026-11-11", // Veterans Day
  "2026-11-26", // Thanksgiving (4th Thu Nov)
  "2026-12-25", // Christmas Day
]);

/** yyyy-mm-dd in UTC. */
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** True if the date is a weekend (Sat/Sun) or a known CT weekday holiday. */
export function isBusinessDay(
  d: Date,
  holidays: ReadonlySet<string> = CT_FIXED_HOLIDAYS_2026,
): boolean {
  const dow = d.getUTCDay(); // 0 = Sun, 6 = Sat
  if (dow === 0 || dow === 6) return false;
  if (holidays.has(toIsoDate(d))) return false;
  return true;
}

/**
 * Compute the §47-270(b) furnishing deadline: `businessDays` business days
 * AFTER the request date (the request day itself is day 0). Weekends and CT
 * weekday holidays do not count. Returns the end-of-day instant on the due date
 * so a same-day delivery is on-time.
 *
 * Example: a request on Friday with a 10-business-day SLA lands two weeks out
 * (skipping both intervening weekends + any holiday).
 */
export function computeSlaDueDate(
  requestedAt: Date,
  businessDays: number,
  holidays: ReadonlySet<string> = CT_FIXED_HOLIDAYS_2026,
): Date {
  const cursor = new Date(
    Date.UTC(
      requestedAt.getUTCFullYear(),
      requestedAt.getUTCMonth(),
      requestedAt.getUTCDate(),
    ),
  );
  let counted = 0;
  while (counted < businessDays) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isBusinessDay(cursor, holidays)) counted += 1;
  }
  // End-of-day on the due date.
  cursor.setUTCHours(23, 59, 59, 999);
  return cursor;
}

/** Business days remaining until the SLA due date (negative = overdue). */
export function businessDaysUntil(
  now: Date,
  dueDate: Date,
  holidays: ReadonlySet<string> = CT_FIXED_HOLIDAYS_2026,
): number {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const end = new Date(
    Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()),
  );
  const sign = end.getTime() >= start.getTime() ? 1 : -1;
  const [from, to] = sign === 1 ? [start, end] : [end, start];
  let count = 0;
  const cursor = new Date(from);
  while (cursor.getTime() < to.getTime()) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isBusinessDay(cursor, holidays)) count += 1;
  }
  return sign * count;
}

// ── §47-270(a) field model ──────────────────────────────────────────────────

/**
 * Where a certificate field's value came from — drives the completeness signal
 * and tells the board which fields it must attest to vs which are auto-derived
 * from live data.
 */
export type ResaleFieldSource =
  | "owner-ledger" // pulled live from owner_ledger_entries
  | "budget" // pulled live from the ratified budget version
  | "insurance" // pulled live from association_insurance_policies
  | "delinquency" // derived live from association-wide ledger aging
  | "reserve-disclosure" // owned by the #8016 reserve-disclosure generator
  | "board-attestation"; // no structured source — board must input/attest

/**
 * Completeness of a field. Per the completeness-honesty discipline we NEVER
 * present a board-attestation field as if it were derived from live data.
 */
export type ResaleFieldCompleteness =
  | "derived" // value computed from live data, ready
  | "attestation-required" // board must supply / confirm this value
  | "see-reserve-disclosure" // delegated to the #8016 reserve-disclosure cert
  | "unavailable"; // data source exists but returned nothing for this scope

/** One §47-270(a) line on the certificate. */
export interface ResaleCertField {
  /** §47-270 subsection, e.g. "§47-270(a)(2)". Always present (AC4). */
  statuteCitation: string;
  /** Subsection key, e.g. "a2". Stable for client rendering. */
  key: string;
  /** Human label for the line. */
  label: string;
  /** Structured value (number = dollars, string = text, or null). */
  value: number | string | null;
  source: ResaleFieldSource;
  completeness: ResaleFieldCompleteness;
  /** Optional clarifying note (e.g. what the board must attest to). */
  note?: string;
}

/**
 * The §47-270(c) accuracy note — surfaced verbatim on every CT certificate
 * (AC3). Quoting the protective effect for the purchaser is the load-bearing
 * legal disclosure: it is WHY the figures must be exact.
 */
export const CT_ACCURACY_NOTE_47_270_C =
  "Per CGS §47-270(c), a purchaser is not liable for, and the purchaser's unit " +
  "is not subject to a lien for, any unpaid common-expense assessment or fee in " +
  "an amount GREATER than the amount set forth in this resale certificate as " +
  "prepared by the association. The association is bound by the figures stated " +
  "herein; they are sourced from live ledgers as of the generation timestamp.";

/** The full, ordered list of §47-270(a) subsection keys this cert covers. */
export interface ResaleCertFieldInput {
  /** (a)(2) current periodic assessment for the unit (dollars). */
  periodicAssessment: number | null;
  /** (a)(2) unpaid assessment currently due from the unit (dollars, >=0). */
  unpaidAssessment: number | null;
  /** (a)(3) other unpaid fees on the unit (late fees, charges) (dollars, >=0). */
  otherFees: number | null;
  /** (a)(4) candidate capital expenditures >$1,000 (board-attested). */
  capitalExpenditureHints: Array<{ name: string; amount: number }>;
  /** (a)(5) reserves — delegated to #8016 reserve-disclosure (dollars or null). */
  reservesTotal: number | null;
  /** (a)(6) current operating budget total (dollars). */
  operatingBudgetTotal: number | null;
  /** (a)(8) association master/liability insurance summary. */
  insuranceSummary: string | null;
  /** (a)(14) count of units 60+ days delinquent association-wide. */
  unitsDelinquent60Plus: number | null;
}

/**
 * Build the ordered §47-270(a) field list from pre-loaded values. Pure.
 *
 * Fields with no structured source in YCM today (judgments/suits §(a)(7),
 * foreclosures §(a)(15), and the audit-flagged §(a)(9)–(13)) are emitted as
 * explicit `board-attestation` / `attestation-required` lines so the
 * certificate is STRUCTURALLY COMPLETE and the board fills them in — never
 * silently omitted, never falsely shown as "$0 / none" derived from data.
 */
export function buildResaleCertFields(
  input: ResaleCertFieldInput,
): ResaleCertField[] {
  const fields: ResaleCertField[] = [];

  // (a)(2) — current periodic + unpaid assessment for the selling unit.
  fields.push({
    statuteCitation: "§47-270(a)(2)",
    key: "a2",
    label: "Current periodic common-expense assessment + any unpaid assessment due from the selling unit",
    value:
      input.periodicAssessment === null && input.unpaidAssessment === null
        ? null
        : `Periodic: ${fmtMoney(input.periodicAssessment)} / Unpaid due: ${fmtMoney(input.unpaidAssessment)}`,
    source: "owner-ledger",
    completeness:
      input.periodicAssessment === null && input.unpaidAssessment === null
        ? "unavailable"
        : "derived",
  });

  // (a)(3) — any other fees payable by the unit.
  fields.push({
    statuteCitation: "§47-270(a)(3)",
    key: "a3",
    label: "Any other fees currently payable by the unit (late fees, charges)",
    value: input.otherFees,
    source: "owner-ledger",
    completeness: input.otherFees === null ? "unavailable" : "derived",
  });

  // (a)(4) — capital expenditures > $1,000 approved this/next FY (board-attested;
  // candidate list derived from budget lines as a hint).
  fields.push({
    statuteCitation: "§47-270(a)(4)",
    key: "a4",
    label: "Capital expenditures > $1,000 approved by the association for the current and next fiscal year",
    value:
      input.capitalExpenditureHints.length > 0
        ? input.capitalExpenditureHints
            .map((h) => `${h.name}: ${fmtMoney(h.amount)}`)
            .join("; ")
        : null,
    source: "board-attestation",
    completeness: "attestation-required",
    note: "Candidate capital lines (>$1,000) derived from the ratified budget are shown as hints; the board must confirm which are formally approved capital expenditures.",
  });

  // (a)(5) — reserves. Owned by the #8016 reserve-disclosure generator.
  fields.push({
    statuteCitation: "§47-270(a)(5)",
    key: "a5",
    label: "Reserves for capital expenditures, and any portion designated for specified projects",
    value: input.reservesTotal,
    source: "reserve-disclosure",
    completeness:
      input.reservesTotal === null ? "see-reserve-disclosure" : "derived",
    note: "Reserve figures are produced by the §47-270 reserve-disclosure generator (founder-os#8016); attach that disclosure to this certificate.",
  });

  // (a)(6) — current operating budget.
  fields.push({
    statuteCitation: "§47-270(a)(6)",
    key: "a6",
    label: "Current operating budget of the association",
    value: input.operatingBudgetTotal,
    source: "budget",
    completeness:
      input.operatingBudgetTotal === null ? "unavailable" : "derived",
  });

  // (a)(7) — unsatisfied judgments + pending suits (no structured source).
  fields.push({
    statuteCitation: "§47-270(a)(7)",
    key: "a7",
    label: "Unsatisfied judgments against the association and the status of any pending suits to which the association is a party",
    value: null,
    source: "board-attestation",
    completeness: "attestation-required",
    note: "No litigation register exists in YCM today; the board/manager must attest to current judgments and pending suits.",
  });

  // (a)(8) — owner / association insurance.
  fields.push({
    statuteCitation: "§47-270(a)(8)",
    key: "a8",
    label: "Insurance coverage provided for the benefit of unit owners (association master / liability)",
    value: input.insuranceSummary,
    source: "insurance",
    completeness: input.insuranceSummary === null ? "unavailable" : "derived",
  });

  // (a)(9)–(13) — audit-flagged: verify full statutory contents directly. Emitted
  // as explicit board-attestation placeholders so the certificate is complete.
  for (const n of [9, 10, 11, 12, 13] as const) {
    fields.push({
      statuteCitation: `§47-270(a)(${n})`,
      key: `a${n}`,
      label: `§47-270(a)(${n}) statutory disclosure (verify full contents against the statute)`,
      value: null,
      source: "board-attestation",
      completeness: "attestation-required",
      note: "Flagged by the #1035 compliance audit for direct verification of the subsection's full statutory contents before delivery.",
    });
  }

  // (a)(14) — units 60+ days delinquent (association-wide).
  fields.push({
    statuteCitation: "§47-270(a)(14)",
    key: "a14",
    label: "Number of units in the association that are 60 or more days delinquent in payment of assessments",
    value: input.unitsDelinquent60Plus,
    source: "delinquency",
    completeness:
      input.unitsDelinquent60Plus === null ? "unavailable" : "derived",
  });

  // (a)(15) — foreclosures brought in the last 12 months (no structured source).
  fields.push({
    statuteCitation: "§47-270(a)(15)",
    key: "a15",
    label: "Foreclosure actions brought by the association in the preceding 12 months",
    value: null,
    source: "board-attestation",
    completeness: "attestation-required",
    note: "No foreclosure-action register exists in YCM today; the board/manager must attest to foreclosures brought in the last 12 months.",
  });

  return fields;
}

// ── The assembled certificate ────────────────────────────────────────────────

export interface ResaleCertificate {
  state: ResaleCertState;
  statuteCitation: string; // e.g. "CGS §47-270"
  associationId: string;
  associationName: string | null;
  unitId: string;
  unitNumber: string | null;
  building: string | null;
  generatedAt: string; // ISO-8601 — figures are current as of this instant
  validUntil: string; // ISO-8601 — generatedAt + validityDays
  statutoryFeeCents: number; // §47-270(b)(1)
  slaBusinessDays: number; // §47-270(b)
  /** §47-270(a) field list (AC1). */
  fields: ResaleCertField[];
  /** §47-270(c) accuracy / purchaser-not-liable note (AC3). */
  accuracyNote: string;
  /** Roll-up of how complete the certificate is. */
  completeness: {
    total: number;
    derived: number;
    attestationRequired: number;
    /** True only when every field is derived (no board attestation pending). */
    readyToDeliver: boolean;
  };
  /** True when generated from the live (CT) statute, false for stub states. */
  stateLive: boolean;
}

/**
 * Assemble a complete §47-270 resale certificate from pre-loaded data + the
 * statutory params. Pure over its inputs (no DB) so it is fully unit-testable.
 */
export function assembleResaleCertificate(input: {
  state: string | null | undefined;
  associationId: string;
  associationName: string | null;
  unitId: string;
  unitNumber: string | null;
  building: string | null;
  generatedAt: Date;
  fieldInput: ResaleCertFieldInput;
}): ResaleCertificate {
  const params = getResaleCertStatuteParams(input.state);
  const fields = buildResaleCertFields(input.fieldInput);

  const validUntil = new Date(input.generatedAt.getTime());
  validUntil.setUTCDate(validUntil.getUTCDate() + params.validityDays);

  const derived = fields.filter((f) => f.completeness === "derived").length;
  const attestationRequired = fields.filter(
    (f) =>
      f.completeness === "attestation-required" ||
      f.completeness === "see-reserve-disclosure",
  ).length;

  return {
    state: params.state,
    statuteCitation: params.statuteCitation,
    associationId: input.associationId,
    associationName: input.associationName,
    unitId: input.unitId,
    unitNumber: input.unitNumber,
    building: input.building,
    generatedAt: input.generatedAt.toISOString(),
    validUntil: validUntil.toISOString(),
    statutoryFeeCents: params.statutoryFeeCents,
    slaBusinessDays: params.slaBusinessDays,
    fields,
    accuracyNote: CT_ACCURACY_NOTE_47_270_C,
    completeness: {
      total: fields.length,
      derived,
      attestationRequired,
      readyToDeliver: attestationRequired === 0 && derived === fields.length,
    },
    stateLive: params.live,
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Format a dollar number as "$1,234.56", or "—" for null. */
function fmtMoney(n: number | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
