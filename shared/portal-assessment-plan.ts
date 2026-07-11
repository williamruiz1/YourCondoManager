/**
 * Owner-portal special-assessment PAYMENT-PLAN progress (2026-07-09 redesign).
 *
 * William, repeatedly: a special assessment is paid over time in INSTALLMENTS,
 * so the owner portal must show it as a PLAN (total · paid-to-date · remaining
 * "over time" · installments paid/total · progress · next installment), never
 * as a big red "balance due now". This module is the SHARED, pure contract:
 *
 *   - `AssessmentPlanProgress` — the raw progress the server computes from real
 *     ledger + schedule data (server/portal-assessment-detail.ts). No fabrication:
 *     every field is derived from `computeOwnerPortion` + the assessment's
 *     `installmentCount` + the count of posted installments. It RECONCILES by
 *     construction:  paidToDate + remaining === total  and
 *     installmentsPaid + installmentsRemaining === installmentCount.
 *
 *   - `deriveAssessmentPlanView` — a pure display derivation (progress %, on-track
 *     vs genuinely past-due, plain-English installment label). Testable without
 *     rendering; used by the owner-portal finances page.
 *
 * DISPLAY ONLY — this module moves no money and reads no ledger; it is a pure
 * projection of figures the dashboard endpoint already computes.
 */

export interface AssessmentPlanProgress {
  assessmentId: string;
  assessmentName: string;
  /** Owner's TOTAL portion of this assessment (principal + interest). */
  total: number;
  /** Amount of the owner's portion already worked down (total − remaining). */
  paidToDate: number;
  /** Remaining owner portion, paid over time in future installments. */
  remaining: number;
  /** Total number of installments in the assessment schedule (0 when unknown). */
  installmentCount: number;
  /** Installments already posted (paid on schedule) so far. */
  installmentsPaid: number;
  /** Per-installment amount for the owner's portion. */
  installmentAmount: number;
  /** The next installment's amount, or null when the plan is fully paid. */
  nextInstallmentAmount: number | null;
  /** The next installment's due date (ISO), or null when fully paid. */
  nextInstallmentDueDate: string | null;
  /** 1-based number of the next installment, or null when fully paid. */
  nextInstallmentNumber: number | null;
}

export interface AssessmentPlanView {
  /** 0–100, clamped. Share of the owner's portion paid so far. */
  pctPaid: number;
  /** Plain-English "N of M installments paid" (or "N installments paid" when the
   *  schedule length is unknown). */
  installmentsLabel: string;
  /** True when the assessment carries a known installment schedule length. */
  hasSchedule: boolean;
  /** True ONLY when the next installment's due date has already passed (the one
   *  case that warrants RED, per William: red is reserved for genuinely
   *  past-due). */
  isPastDue: boolean;
  /** True when the plan still has a balance and is NOT past due. */
  isOnTrack: boolean;
  /** True when the owner's portion is fully paid off. */
  isPaidOff: boolean;
}

function clampPct(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n >= 100) return 100;
  return Math.round(n);
}

/**
 * Pure display derivation over a raw `AssessmentPlanProgress`. `now` is injected
 * so tests can pin "past-due" deterministically; defaults to the current time.
 */
export function deriveAssessmentPlanView(
  plan: AssessmentPlanProgress,
  now: Date = new Date(),
): AssessmentPlanView {
  const hasSchedule = plan.installmentCount > 0;
  const pctPaid =
    plan.total > 0 ? clampPct((plan.paidToDate / plan.total) * 100) : 0;
  const isPaidOff = plan.remaining <= 0.005;
  const isPastDue =
    !isPaidOff &&
    plan.nextInstallmentDueDate != null &&
    new Date(plan.nextInstallmentDueDate).getTime() < now.getTime();
  const isOnTrack = !isPaidOff && !isPastDue;
  const installmentsLabel = hasSchedule
    ? `${plan.installmentsPaid} of ${plan.installmentCount} installments paid`
    : `${plan.installmentsPaid} installment${plan.installmentsPaid === 1 ? "" : "s"} paid`;
  return { pctPaid, installmentsLabel, hasSchedule, isPastDue, isOnTrack, isPaidOff };
}
