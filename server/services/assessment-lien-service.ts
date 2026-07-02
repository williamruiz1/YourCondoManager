/**
 * Statutory assessment-lien service — CT CGS §47-258 / DE §81-316 — BUILD #8014
 *
 * Connecticut General Statutes §47-258 gives a common-interest community an
 * AUTOMATIC lien on a unit for unpaid common-expense assessments, with a
 * 9-month SUPER-PRIORITY over a first mortgage. Delaware §81-316 carries the
 * same 9-month super-priority, so the super-priority calculation is written to
 * be state-portable (the `monthsOfPriority` + `statuteSection` params default
 * to the CT/DE 9-month rule but are overridable).
 *
 * ## Design — pure functions + thin DB glue
 *
 * Per the repo's test reality (no live DB — every test mocks `../db`), ALL
 * statutory LOGIC lives in PURE FUNCTIONS in this file. They are the actual
 * code paths the storage/route glue calls, and they are what the unit tests
 * exercise. The DB-orchestration helpers at the bottom are thin glue
 * (typecheck-validated, not unit-tested) that wrap the pure functions around
 * Drizzle inserts/updates — exactly the pattern used for the §47-261e build.
 *
 * The lien is the statutory lifecycle object; it sits OVER the existing
 * delinquency / escalation / notice engine and does not replace it.
 *
 * Statutory map:
 *   §47-258(a) — lien arises automatically on the unpaid assessment (arose-date).
 *   §47-258(b) — 9-month super-priority over a first mortgage.
 *   §47-258(d) — no separate recording is required to make the lien enforceable.
 *   §47-258(e) — a 3-year statute of limitations runs from the arose-date.
 *   §47-258(m)(1) — a 2-month + board-vote/standard-policy + written-demand-
 *                   with-simultaneous-mortgagee-copy GATE precedes foreclosure.
 *   §47-258(m)(2) — a 60-day pre-foreclosure notice itemizing the debt, fees,
 *                   intent, and payment instructions, copied to the mortgagee.
 *
 * OUT OF SCOPE (do not build here): the actual foreclosure filing / legal
 * action, and legal sign-off.
 */

import { and, eq } from "drizzle-orm";
import { db } from "../db";
import {
  assessmentLiens,
  assessmentLienPreforeclosures,
  noticeSends,
  type AssessmentLien,
  type AssessmentLienPreforeclosure,
  type InsertAssessmentLien,
} from "@shared/schema";

// ===========================================================================
// Constants
// ===========================================================================

/** §47-258(e): the statutory limitations period (years) for lien enforcement. */
export const ASSESSMENT_LIEN_SOL_YEARS = 3;

/**
 * §47-258(b) / DE §81-316: months of common-expense assessments that take
 * super-priority over a first mortgage. CT and DE both use 9.
 */
export const SUPER_PRIORITY_MONTHS_DEFAULT = 9;

/** §47-258(m)(1): minimum months owed before the foreclosure path may open. */
export const PRE_FORECLOSURE_MIN_MONTHS_OWED = 2;

/** §47-258(m)(2): pre-foreclosure notice window (days). */
export const PRE_FORECLOSURE_NOTICE_DAYS = 60;

// ===========================================================================
// Pure date helpers
// ===========================================================================

/** Add `years` calendar years to a date (UTC-stable for whole years). */
export function addYears(date: Date, years: number): Date {
  const d = new Date(date.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
}

/** Add `months` calendar months to a date. */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/** Add `days` days to a date. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// ===========================================================================
// §47-258(a) — lien arises automatically on the unpaid assessment
// ===========================================================================

export interface BuildAssessmentLienInput {
  associationId: string;
  unitId: string;
  personId?: string | null;
  escalationId?: string | null;
  sourceReference?: string | null;
  /** §47-258(a): arose-date = the date the assessment became due. */
  aroseDate: Date;
  /** Principal unpaid common-expense assessment the lien secures. */
  principalAmount: number;
  /** Per-month common charge — drives the §47-258(b) super-priority calc. */
  monthlyCommonExpense?: number;
  /** "47-258" (CT, default) | "81-316" (DE). */
  statuteSection?: string;
  /** §47-258(e) SOL window (years). Default 3. */
  solYears?: number;
}

/**
 * §47-258(a) + (e): build a lien insert payload. The lien ARISES on the
 * arose-date (no creation event needed — it is automatic), and its
 * `expiresAt` is the arose-date + the statutory SOL window.
 *
 * Pure — returns the Drizzle insert payload; the DB write is done by the
 * thin glue `createAssessmentLien` below.
 */
export function buildAssessmentLien(
  input: BuildAssessmentLienInput,
): InsertAssessmentLien {
  if (!(input.aroseDate instanceof Date) || Number.isNaN(input.aroseDate.getTime())) {
    throw new Error("aroseDate must be a valid Date");
  }
  if (!Number.isFinite(input.principalAmount) || input.principalAmount < 0) {
    throw new Error("principalAmount must be a non-negative number");
  }
  const solYears = input.solYears ?? ASSESSMENT_LIEN_SOL_YEARS;
  return {
    associationId: input.associationId,
    unitId: input.unitId,
    personId: input.personId ?? null,
    escalationId: input.escalationId ?? null,
    sourceReference: input.sourceReference ?? null,
    aroseDate: input.aroseDate,
    principalAmount: input.principalAmount,
    monthlyCommonExpense: input.monthlyCommonExpense ?? 0,
    statuteSection: input.statuteSection ?? "47-258",
    status: "active",
    expiresAt: addYears(input.aroseDate, solYears),
  };
}

// ===========================================================================
// §47-258(d) — automatic; no separate recording required
// ===========================================================================

/**
 * §47-258(d): a §47-258 assessment lien is enforceable WITHOUT a separate
 * recording in the land records — the lien is automatic. This helper documents
 * that invariant: enforceability never depends on a recording record, only on
 * the lien being active AND within its statutory limitations window.
 */
export function lienRequiresRecording(): boolean {
  // §47-258(d): no separate recording is required. Always false.
  return false;
}

// ===========================================================================
// §47-258(b) — 9-month super-priority over a first mortgage (state-portable)
// ===========================================================================

export interface SuperPriorityInput {
  /** Per-month common-expense charge that accrues the super-priority. */
  monthlyCommonExpense: number;
  /** Total unpaid lien amount (super-priority + subordinate portions). */
  totalLienAmount: number;
  /** Date enforcement/foreclosure is instituted — anchors the priority window. */
  enforcementDate: Date;
  /** Months of priority. Default 9 (CT §47-258(b) AND DE §81-316). */
  monthsOfPriority?: number;
  /** Statute asserted under. "47-258" (CT, default) | "81-316" (DE). */
  statuteSection?: string;
}

export interface SuperPriorityResult {
  statuteSection: string;
  monthsOfPriority: number;
  /** enforcementDate − monthsOfPriority (the start of the priority window). */
  windowStart: Date;
  /** enforcementDate (the end of the priority window). */
  windowEnd: Date;
  /**
   * The portion of the lien that is SUPER-PRIORITY (ahead of a first mortgage)
   * = monthlyCommonExpense × monthsOfPriority, capped at the total lien amount.
   */
  superPriorityAmount: number;
  /** The remaining portion of the lien, subordinate to a first mortgage. */
  subordinateAmount: number;
}

/**
 * §47-258(b) / DE §81-316: compute the 9-month super-priority window + amount.
 *
 * The super-priority portion is the common-expense assessments that would have
 * become due during the `monthsOfPriority` months immediately preceding
 * enforcement. State-portable: pass `monthsOfPriority`/`statuteSection` to
 * reuse for Delaware §81-316 (also 9 months) or any other UCIOA state.
 *
 * Pure.
 */
export function computeSuperPriority(
  input: SuperPriorityInput,
): SuperPriorityResult {
  const months = input.monthsOfPriority ?? SUPER_PRIORITY_MONTHS_DEFAULT;
  if (!Number.isFinite(input.monthlyCommonExpense) || input.monthlyCommonExpense < 0) {
    throw new Error("monthlyCommonExpense must be a non-negative number");
  }
  if (!Number.isFinite(input.totalLienAmount) || input.totalLienAmount < 0) {
    throw new Error("totalLienAmount must be a non-negative number");
  }
  if (!(input.enforcementDate instanceof Date) || Number.isNaN(input.enforcementDate.getTime())) {
    throw new Error("enforcementDate must be a valid Date");
  }

  const rawPriority = Number((input.monthlyCommonExpense * months).toFixed(2));
  const superPriorityAmount = Math.min(rawPriority, input.totalLienAmount);
  const subordinateAmount = Number(
    Math.max(0, input.totalLienAmount - superPriorityAmount).toFixed(2),
  );

  return {
    statuteSection: input.statuteSection ?? "47-258",
    monthsOfPriority: months,
    windowStart: addMonths(input.enforcementDate, -months),
    windowEnd: input.enforcementDate,
    superPriorityAmount,
    subordinateAmount,
  };
}

// ===========================================================================
// §47-258(e) — 3-year statute-of-limitations clock
// ===========================================================================

/** §47-258(e): the date the lien becomes unenforceable = arose-date + SOL. */
export function computeLienExpiry(
  aroseDate: Date,
  solYears: number = ASSESSMENT_LIEN_SOL_YEARS,
): Date {
  if (!(aroseDate instanceof Date) || Number.isNaN(aroseDate.getTime())) {
    throw new Error("aroseDate must be a valid Date");
  }
  return addYears(aroseDate, solYears);
}

/**
 * §47-258(e): is the lien still enforceable as of `asOf`? A lien is
 * enforceable while `asOf <= aroseDate + SOL`. Enforcement attempted after the
 * 3-year window is blocked.
 *
 * Pure.
 */
export function isLienEnforceable(
  aroseDate: Date,
  asOf: Date,
  solYears: number = ASSESSMENT_LIEN_SOL_YEARS,
): boolean {
  const expiry = computeLienExpiry(aroseDate, solYears);
  return asOf.getTime() <= expiry.getTime();
}

// ===========================================================================
// Release / lifecycle — lien released on payment in full
// ===========================================================================

export type AssessmentLienLifecycleStatus = "active" | "released" | "expired";

/**
 * Resolve the lien status after a payment is applied.
 *   - paid-in-full (amountPaid >= principal)        → "released"
 *   - else, past the SOL window (asOf > expiry)      → "expired"
 *   - else                                           → "active"
 *
 * Pure.
 */
export function resolveLienStatusAfterPayment(params: {
  principalAmount: number;
  amountPaid: number;
  aroseDate: Date;
  asOf?: Date;
  solYears?: number;
}): AssessmentLienLifecycleStatus {
  const asOf = params.asOf ?? new Date();
  if (params.amountPaid >= params.principalAmount) {
    return "released";
  }
  if (!isLienEnforceable(params.aroseDate, asOf, params.solYears)) {
    return "expired";
  }
  return "active";
}

// ===========================================================================
// §47-258(m)(1) — pre-foreclosure GATE
// ===========================================================================

export interface PreForeclosureGateInput {
  /** §47-258(m)(1): the unit must owe at least 2 months of assessments. */
  monthsOwed: number;
  /**
   * §47-258(m)(1): the board must have voted to commence foreclosure on this
   * specific unit, OR the association has a standard board-adopted collection
   * policy authorizing it. Either attestation satisfies the gate.
   */
  boardVoteOrPolicyAttested: boolean;
  /** §47-258(m)(1): a written demand for payment was sent to the owner. */
  writtenDemandSent: boolean;
  /**
   * §47-258(m)(1): a copy of the written demand was sent to the mortgagee
   * SIMULTANEOUSLY with the demand to the owner.
   */
  mortgageeCopySent: boolean;
  /** Optional §47-258(e) SOL check — supply both to also gate on enforceability. */
  aroseDate?: Date;
  asOf?: Date;
  /** Override the 2-month minimum if a stricter policy applies. */
  minMonthsOwed?: number;
  solYears?: number;
}

export type PreForeclosureBlockReason =
  | "months_owed_below_minimum"
  | "board_vote_or_policy_attestation_missing"
  | "written_demand_missing"
  | "mortgagee_copy_missing"
  | "lien_unenforceable_sol_expired";

export interface PreForeclosureGateResult {
  allowed: boolean;
  blockReasons: PreForeclosureBlockReason[];
  minMonthsOwed: number;
  statuteSection: "47-258(m)(1)";
}

/**
 * §47-258(m)(1): evaluate whether the foreclosure path may open. ALL of the
 * following must hold or the gate BLOCKS:
 *   - ≥2 months owed (or `minMonthsOwed`),
 *   - board-vote / standard-policy attestation present,
 *   - a written demand was sent, AND
 *   - a copy of that demand went to the mortgagee simultaneously.
 * If `aroseDate`+`asOf` are supplied, the lien must also be within its SOL.
 *
 * Pure. Never performs the foreclosure — only authorizes the path.
 */
export function evaluatePreForeclosureGate(
  input: PreForeclosureGateInput,
): PreForeclosureGateResult {
  const minMonthsOwed = input.minMonthsOwed ?? PRE_FORECLOSURE_MIN_MONTHS_OWED;
  const blockReasons: PreForeclosureBlockReason[] = [];

  if (!(input.monthsOwed >= minMonthsOwed)) {
    blockReasons.push("months_owed_below_minimum");
  }
  if (!input.boardVoteOrPolicyAttested) {
    blockReasons.push("board_vote_or_policy_attestation_missing");
  }
  if (!input.writtenDemandSent) {
    blockReasons.push("written_demand_missing");
  }
  if (!input.mortgageeCopySent) {
    blockReasons.push("mortgagee_copy_missing");
  }
  if (input.aroseDate && input.asOf) {
    if (!isLienEnforceable(input.aroseDate, input.asOf, input.solYears)) {
      blockReasons.push("lien_unenforceable_sol_expired");
    }
  }

  return {
    allowed: blockReasons.length === 0,
    blockReasons,
    minMonthsOwed,
    statuteSection: "47-258(m)(1)",
  };
}

// ===========================================================================
// §47-258(m)(2) — 60-day pre-foreclosure notice (copy to mortgagee)
// ===========================================================================

export interface PreForeclosureNoticeInput {
  ownerName: string;
  unitNumber: string;
  associationName: string;
  /** Principal unpaid common-expense assessment. */
  principalDebt: number;
  /** Late fees + interest accrued. */
  fees: number;
  /** Collection / attorney costs, if any. */
  attorneyCosts?: number;
  issuedAt: Date;
  /** Payment instructions (how/where to pay to cure). */
  paymentInstructions: string;
  /** §47-258(m)(2): the notice window (days). Default 60. */
  noticeDays?: number;
  /** Mortgagee that must receive a copy of the notice. */
  mortgageeName?: string | null;
  mortgageeContact?: string | null;
  statuteSection?: string;
}

export interface PreForeclosureNoticeRequiredItems {
  /** Itemized debt (principal). */
  debt: number;
  /** Itemized fees. */
  fees: number;
  /** Itemized attorney/collection costs. */
  attorneyCosts: number;
  /** Total due to cure. */
  total: number;
  /** Statement of intent to foreclose. */
  intent: string;
  /** Payment instructions. */
  paymentInstructions: string;
}

export interface PreForeclosureNoticeResult {
  subject: string;
  body: string;
  totalDue: number;
  issuedAt: Date;
  /** issuedAt + noticeDays. */
  deadlineAt: Date;
  noticeDays: number;
  statuteSection: string;
  requiredItems: PreForeclosureNoticeRequiredItems;
  /** The simultaneous copy that must be sent to the mortgagee, if known. */
  mortgageeCopy: { recipient: string; contact: string | null; subject: string; body: string } | null;
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

/**
 * §47-258(m)(2): build the 60-day pre-foreclosure notice. The notice itemizes
 * the debt, fees, and costs, states the intent to foreclose, gives payment
 * instructions, and computes the 60-day cure deadline. A copy of the notice is
 * generated for the mortgagee (the simultaneous copy required by §47-258(m)).
 *
 * Pure — returns the rendered notice; the noticeSends wiring is the thin glue
 * `issuePreForeclosureNotice` below.
 */
export function buildPreForeclosureNotice(
  input: PreForeclosureNoticeInput,
): PreForeclosureNoticeResult {
  if (!(input.issuedAt instanceof Date) || Number.isNaN(input.issuedAt.getTime())) {
    throw new Error("issuedAt must be a valid Date");
  }
  const noticeDays = input.noticeDays ?? PRE_FORECLOSURE_NOTICE_DAYS;
  const section = input.statuteSection ?? "47-258";
  const attorneyCosts = input.attorneyCosts ?? 0;
  const totalDue = Number(
    (input.principalDebt + input.fees + attorneyCosts).toFixed(2),
  );
  const deadlineAt = addDays(input.issuedAt, noticeDays);

  const intent =
    `If the total amount due is not paid within ${noticeDays} days of the date of ` +
    `this notice, the Association intends to enforce its statutory assessment lien ` +
    `and may commence a foreclosure action against Unit ${input.unitNumber} ` +
    `pursuant to Conn. Gen. Stat. §${section}.`;

  const itemizedBlock =
    `ITEMIZED AMOUNT DUE (Conn. Gen. Stat. §${section}(m)(2)):\n` +
    `  Unpaid common-expense assessments (principal): ${money(input.principalDebt)}\n` +
    `  Late fees / interest: ${money(input.fees)}\n` +
    `  Collection / attorney costs: ${money(attorneyCosts)}\n` +
    `  TOTAL DUE TO CURE: ${money(totalDue)}`;

  const subject =
    `60-Day Pre-Foreclosure Notice — Unit ${input.unitNumber} — ${input.associationName}`;

  const body =
    `Dear ${input.ownerName},\n\n` +
    `${input.associationName} has an unpaid assessment balance secured by a ` +
    `statutory lien on Unit ${input.unitNumber} under Conn. Gen. Stat. §${section}.\n\n` +
    `${itemizedBlock}\n\n` +
    `PAYMENT INSTRUCTIONS: ${input.paymentInstructions}\n\n` +
    `${intent}\n\n` +
    `Cure deadline: ${deadlineAt.toISOString().slice(0, 10)}.\n\n` +
    `A copy of this notice has been sent to your mortgage holder as required by ` +
    `Conn. Gen. Stat. §${section}(m).\n\n` +
    `Sincerely,\n${input.associationName}`;

  const mortgageeCopy = input.mortgageeName
    ? {
        recipient: input.mortgageeName,
        contact: input.mortgageeContact ?? null,
        subject: `COPY — ${subject}`,
        body:
          `To ${input.mortgageeName} (first mortgagee of Unit ${input.unitNumber}):\n\n` +
          `This is the statutorily required copy of the §${section}(m) ` +
          `pre-foreclosure notice issued to the unit owner ${input.ownerName}.\n\n` +
          `${itemizedBlock}\n\n` +
          `Cure deadline: ${deadlineAt.toISOString().slice(0, 10)}.\n\n` +
          `${input.associationName}`,
      }
    : null;

  return {
    subject,
    body,
    totalDue,
    issuedAt: input.issuedAt,
    deadlineAt,
    noticeDays,
    statuteSection: section,
    requiredItems: {
      debt: input.principalDebt,
      fees: input.fees,
      attorneyCosts,
      total: totalDue,
      intent,
      paymentInstructions: input.paymentInstructions,
    },
    mortgageeCopy,
  };
}

// ===========================================================================
// Thin DB glue — typecheck-validated (not unit-tested; see header)
// ===========================================================================

/** §47-258(a): persist a newly-arisen lien (built by `buildAssessmentLien`). */
export async function createAssessmentLien(
  input: BuildAssessmentLienInput,
): Promise<AssessmentLien> {
  const payload = buildAssessmentLien(input);
  const [row] = await db.insert(assessmentLiens).values(payload).returning();
  return row;
}

/** Fetch all liens for an association (association-scoped). */
export async function listAssessmentLiens(
  associationId: string,
): Promise<AssessmentLien[]> {
  return db
    .select()
    .from(assessmentLiens)
    .where(eq(assessmentLiens.associationId, associationId));
}

/**
 * Apply a payment to a lien and update its lifecycle status. Paid-in-full
 * → "released"; past SOL → "expired"; otherwise stays "active".
 */
export async function applyPaymentToAssessmentLien(params: {
  lienId: string;
  associationId: string;
  amountPaid: number;
  asOf?: Date;
}): Promise<AssessmentLien | null> {
  const [lien] = await db
    .select()
    .from(assessmentLiens)
    .where(
      and(
        eq(assessmentLiens.id, params.lienId),
        eq(assessmentLiens.associationId, params.associationId),
      ),
    )
    .limit(1);
  if (!lien) return null;

  const status = resolveLienStatusAfterPayment({
    principalAmount: lien.principalAmount,
    amountPaid: params.amountPaid,
    aroseDate: lien.aroseDate,
    asOf: params.asOf,
  });

  const now = params.asOf ?? new Date();
  const [updated] = await db
    .update(assessmentLiens)
    .set({
      status,
      releasedAt: status === "released" ? now : lien.releasedAt,
      releaseReason: status === "released" ? "paid_in_full" : lien.releaseReason,
      updatedAt: now,
    })
    .where(eq(assessmentLiens.id, params.lienId))
    .returning();
  return updated;
}

/**
 * §47-258(m): evaluate the pre-foreclosure gate, and if it passes, build +
 * issue the 60-day notice (owner + mortgagee copy via noticeSends), recording
 * the whole evaluation in `assessment_lien_preforeclosures`.
 */
export async function issuePreForeclosureNotice(params: {
  associationId: string;
  lienId: string;
  unitId: string;
  personId?: string | null;
  recipientEmail: string;
  mortgageeEmail?: string | null;
  gate: PreForeclosureGateInput;
  notice: PreForeclosureNoticeInput;
}): Promise<AssessmentLienPreforeclosureOutcome> {
  const gateResult = evaluatePreForeclosureGate(params.gate);

  if (!gateResult.allowed) {
    const [record] = await db
      .insert(assessmentLienPreforeclosures)
      .values({
        associationId: params.associationId,
        lienId: params.lienId,
        unitId: params.unitId,
        personId: params.personId ?? null,
        monthsOwed: params.gate.monthsOwed,
        boardVoteOrPolicyAttested: params.gate.boardVoteOrPolicyAttested ? 1 : 0,
        writtenDemandSent: params.gate.writtenDemandSent ? 1 : 0,
        mortgageeCopySent: params.gate.mortgageeCopySent ? 1 : 0,
        gateResult: "blocked",
        gateBlockReasonsJson: gateResult.blockReasons,
      })
      .returning();
    return { gate: gateResult, notice: null, record };
  }

  const notice = buildPreForeclosureNotice(params.notice);

  // Owner notice send.
  const [ownerSend] = await db
    .insert(noticeSends)
    .values({
      associationId: params.associationId,
      recipientEmail: params.recipientEmail,
      recipientPersonId: params.personId ?? null,
      subjectRendered: notice.subject,
      bodyRendered: notice.body,
      status: "queued",
      provider: "internal-mock",
      metadataJson: {
        kind: "pre_foreclosure_notice",
        statuteSection: notice.statuteSection,
        deadlineAt: notice.deadlineAt.toISOString(),
        lienId: params.lienId,
      },
    })
    .returning();

  // Mortgagee copy (simultaneous, per §47-258(m)).
  let mortgageeSendId: string | null = null;
  if (notice.mortgageeCopy && params.mortgageeEmail) {
    const [mortgageeSend] = await db
      .insert(noticeSends)
      .values({
        associationId: params.associationId,
        recipientEmail: params.mortgageeEmail,
        subjectRendered: notice.mortgageeCopy.subject,
        bodyRendered: notice.mortgageeCopy.body,
        status: "queued",
        provider: "internal-mock",
        metadataJson: {
          kind: "pre_foreclosure_notice_mortgagee_copy",
          statuteSection: notice.statuteSection,
          lienId: params.lienId,
        },
      })
      .returning();
    mortgageeSendId = mortgageeSend.id;
  }

  const [record] = await db
    .insert(assessmentLienPreforeclosures)
    .values({
      associationId: params.associationId,
      lienId: params.lienId,
      unitId: params.unitId,
      personId: params.personId ?? null,
      monthsOwed: params.gate.monthsOwed,
      boardVoteOrPolicyAttested: params.gate.boardVoteOrPolicyAttested ? 1 : 0,
      writtenDemandSent: params.gate.writtenDemandSent ? 1 : 0,
      mortgageeCopySent: params.gate.mortgageeCopySent ? 1 : 0,
      gateResult: "allowed",
      gateBlockReasonsJson: [],
      noticeSendId: ownerSend.id,
      mortgageeNoticeSendId: mortgageeSendId,
      noticeIssuedAt: notice.issuedAt,
      noticeDeadlineAt: notice.deadlineAt,
      noticeDays: notice.noticeDays,
      totalDue: notice.totalDue,
    })
    .returning();

  return { gate: gateResult, notice, record };
}

export interface AssessmentLienPreforeclosureOutcome {
  gate: PreForeclosureGateResult;
  notice: PreForeclosureNoticeResult | null;
  record: AssessmentLienPreforeclosure;
}
