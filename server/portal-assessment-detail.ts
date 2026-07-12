/**
 * 4.3 Q5 — Owner-portal assessment detail helpers.
 *
 * Thin DB-aware wrapper around the pure `computeOwnerPortion` calc. Shared
 * by:
 *   1. The portal financial-dashboard endpoint, which uses
 *      `getUpcomingInstallmentsForOwnerUnit` to return the
 *      `specialAssessmentUpcomingInstallments` array.
 *   2. The new `GET /api/portal/assessments/:assessmentId/detail`
 *      endpoint, which uses `buildAssessmentDetailForOwnerUnit` to return
 *      the full loan-style drill-in payload.
 *
 * Keeping both derivations in one module avoids drift between what the
 * dashboard surfaces as "next installment" and what the detail page
 * surfaces as the authoritative per-owner portion.
 *
 * Spec anchor:
 *   docs/projects/platform-overhaul/decisions/4.3-recurring-assessment-rules-engine.md
 *   — Q5 resolution.
 */

import { and, eq, like } from "drizzle-orm";

import {
  ownerLedgerEntries,
  ownerships,
  specialAssessments,
  units,
  type OwnerLedgerEntry,
  type SpecialAssessment,
} from "@shared/schema";
import { db } from "./db";
import { SPECIAL_ASSESSMENT_REFERENCE_TYPE } from "./assessment-execution";
import {
  computeOwnerPortion,
  type AssessmentForOwnerPortion,
  type OwnerPortion,
  type UnitForOwnerPortion,
} from "./assessment-ownership";
import type { AssessmentPlanProgress } from "@shared/portal-assessment-plan";

function toAssessmentInput(assessment: SpecialAssessment): AssessmentForOwnerPortion {
  return {
    id: assessment.id,
    totalAmount: assessment.totalAmount,
    installmentCount: assessment.installmentCount,
    interestRatePercent: assessment.interestRatePercent ?? null,
    termMonths: assessment.termMonths ?? null,
    allocationMethod: assessment.allocationMethod ?? "per-unit-equal",
    allocationCustomJson: assessment.allocationCustomJson ?? null,
  };
}

/**
 * Reduce the collection of ownership rows for a unit down to a single
 * ownershipPercent value. When the same unit has multiple active owners
 * we sum their percentages, which matches how special-assessment
 * installments are already attributed (the installment posts to the
 * "primary" ownership but the total share of the unit is the sum).
 */
function sumUnitOwnershipPercent(
  unitId: string,
  ownershipRows: Array<{ unitId: string; ownershipPercentage: number | null }>,
): number | null {
  const matched = ownershipRows.filter((r) => r.unitId === unitId);
  if (matched.length === 0) return null;
  const sum = matched.reduce((acc, r) => {
    return typeof r.ownershipPercentage === "number" ? acc + r.ownershipPercentage : acc;
  }, 0);
  return sum > 0 ? sum : null;
}

function addUtcMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(year, month + months, 1, 12, 0, 0, 0));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12, 0, 0, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

function isUnitIncluded(assessment: SpecialAssessment, unitId: string): boolean {
  const excluded = Array.isArray(assessment.excludedUnitIdsJson)
    ? assessment.excludedUnitIdsJson
    : [];
  return !excluded.includes(unitId);
}

function countPostedInstallments(
  ledgerEntries: ReadonlyArray<OwnerLedgerEntry>,
  assessmentId: string,
  unitId: string,
): number {
  const prefix = `${assessmentId}:`;
  const suffix = `:${unitId}`;
  let count = 0;
  for (const e of ledgerEntries) {
    if (e.referenceType !== SPECIAL_ASSESSMENT_REFERENCE_TYPE) continue;
    const ref = e.referenceId ?? "";
    if (ref.startsWith(prefix) && ref.endsWith(suffix)) {
      count += 1;
    }
  }
  return count;
}

export type AssessmentDetailPayload = {
  assessment: {
    id: string;
    name: string;
    totalAmount: number;
    startDate: string;
    endDate: string | null;
    installmentCount: number;
    interestRatePercent: number | null;
    termMonths: number | null;
    allocationMethod: string;
    paymentOptions: {
      lumpSumAllowed: boolean;
      lumpSumDiscountPercent: number | null;
      customInstallmentPlansAllowed: boolean;
    } | null;
  };
  ownerPortion: OwnerPortion;
  history: {
    installmentsPosted: number;
    totalPaid: number;
    totalOwed: number;
    ledgerEntries: Array<{
      id: string;
      postedAt: string;
      amount: number;
      balance: number;
    }>;
  };
};

export type UpcomingInstallment = {
  assessmentId: string;
  assessmentName: string;
  installmentNumber: number;
  installmentAmount: number;
  dueDate: string;
  remainingInstallments: number;
  allocationMethod: string;
  allocationReason: string;
};

/**
 * Load assessment + active-unit context for a specific owner's unit, then
 * return the owner-portion plus history payload used by the detail
 * endpoint. Returns `null` when the assessment does not affect the
 * supplied unit (so the caller can send 404).
 */
export async function buildAssessmentDetailForOwnerUnit(params: {
  associationId: string;
  unitId: string;
  personId: string;
  assessmentId: string;
}): Promise<AssessmentDetailPayload | null> {
  const { associationId, unitId, personId, assessmentId } = params;

  const [assessmentRow] = await db
    .select()
    .from(specialAssessments)
    .where(and(
      eq(specialAssessments.id, assessmentId),
      eq(specialAssessments.associationId, associationId),
    ))
    .limit(1);

  if (!assessmentRow) return null;
  if (!isUnitIncluded(assessmentRow, unitId)) return null;

  const unitRows = await db
    .select()
    .from(units)
    .where(eq(units.associationId, associationId));

  const myUnit = unitRows.find((u) => u.id === unitId) ?? null;
  if (!myUnit) return null;

  const excludedSet = new Set(
    Array.isArray(assessmentRow.excludedUnitIdsJson) ? assessmentRow.excludedUnitIdsJson : [],
  );
  const activeUnits = unitRows.filter((u) => !excludedSet.has(u.id));

  const ownershipRows = await db
    .select({
      unitId: ownerships.unitId,
      ownershipPercentage: ownerships.ownershipPercentage,
      endDate: ownerships.endDate,
    })
    .from(ownerships)
    .innerJoin(units, eq(ownerships.unitId, units.id))
    .where(eq(units.associationId, associationId));

  // Keep only active ownerships so allocations use the current population.
  const now = new Date();
  const activeOwnerships = ownershipRows.filter((r) => {
    return !r.endDate || new Date(r.endDate) > now;
  });

  const activeUnitsWithShare: UnitForOwnerPortion[] = activeUnits.map((u) => ({
    id: u.id,
    squareFootage: u.squareFootage ?? null,
    ownershipPercent: sumUnitOwnershipPercent(u.id, activeOwnerships),
  }));

  const myUnitForPortion = activeUnitsWithShare.find((u) => u.id === unitId) ?? {
    id: myUnit.id,
    squareFootage: myUnit.squareFootage ?? null,
    ownershipPercent: sumUnitOwnershipPercent(unitId, activeOwnerships),
  };

  // Pull this owner's posted installments for this assessment so we can
  // compute remaining installments + ledger history.
  const ledgerEntries = await db
    .select()
    .from(ownerLedgerEntries)
    .where(and(
      eq(ownerLedgerEntries.associationId, associationId),
      eq(ownerLedgerEntries.unitId, unitId),
      eq(ownerLedgerEntries.referenceType, SPECIAL_ASSESSMENT_REFERENCE_TYPE),
      like(ownerLedgerEntries.referenceId, `${assessmentId}:%`),
    ))
    .orderBy(ownerLedgerEntries.postedAt);

  const myLedgerEntries = ledgerEntries.filter((e) => e.personId === personId);
  const installmentsPosted = countPostedInstallments(
    myLedgerEntries,
    assessmentId,
    unitId,
  );

  const ownerPortion = computeOwnerPortion({
    assessment: toAssessmentInput(assessmentRow),
    unit: myUnitForPortion,
    totalActiveUnitCount: activeUnitsWithShare.length,
    allUnits: activeUnitsWithShare,
    installmentsPosted,
  });

  // Build running balance across this owner's posted entries.
  let running = 0;
  const ledgerEntriesView = myLedgerEntries.map((e) => {
    running += e.amount;
    return {
      id: e.id,
      postedAt: new Date(e.postedAt).toISOString(),
      amount: e.amount,
      balance: running,
    };
  });

  const totalPaidAbs = Math.abs(
    myLedgerEntries
      .filter((e) => e.entryType === "payment" || e.entryType === "credit")
      .reduce((acc, e) => acc + e.amount, 0),
  );

  // 2026-07-12 — same LEGACY-assessment ledger-truth treatment as
  // `getAssessmentPlansForOwnerUnit` (the owner-portal "My Finances" summary
  // card, fixed above). A non-auto-posted assessment (`autoPostEnabled !==
  // 1` — e.g. the Cherry Hill Court driveway assessment, imported before
  // tracked installment posting existed) can never accumulate a tracked
  // `SPECIAL_ASSESSMENT_REFERENCE_TYPE` ledger row, so `myLedgerEntries`
  // above is structurally always empty for it — which made `totalOwed`
  // collapse to the full theoretical per-unit-equal `ownerPortion.total`
  // (the observed bug: the drill-in reported $4,444.44 "Total owed" while
  // the just-fixed summary card, reading the real ledger, showed
  // $1,326.19). Use the REAL net "assessment"-category ledger balance for
  // this unit instead — the SAME figure the summary card + the rest of the
  // dashboard already treat as authoritative — so the two surfaces never
  // drift. Only trusted when this is the ONLY non-auto-posted assessment
  // applicable to this unit (a shared, untagged ledger balance can't be
  // safely attributed to a specific legacy assessment when more than one
  // applies — same ambiguity guard as the summary card); otherwise falls
  // back to the pre-existing theoretical calc below. Read-only — no ledger
  // write, no money movement.
  const isLegacy = assessmentRow.autoPostEnabled !== 1;
  let legacyLedgerRemaining: number | null = null;
  if (isLegacy) {
    const siblingAssessmentRows = await db
      .select()
      .from(specialAssessments)
      .where(and(
        eq(specialAssessments.associationId, associationId),
        eq(specialAssessments.isActive, 1),
      ));
    const legacyApplicableCount = siblingAssessmentRows.filter(
      (a) => isUnitIncluded(a, unitId) && a.autoPostEnabled !== 1,
    ).length;
    if (legacyApplicableCount === 1) {
      const rawAssessmentEntries = await db
        .select()
        .from(ownerLedgerEntries)
        .where(and(
          eq(ownerLedgerEntries.associationId, associationId),
          eq(ownerLedgerEntries.unitId, unitId),
          eq(ownerLedgerEntries.personId, personId),
          eq(ownerLedgerEntries.entryType, "assessment"),
        ));
      const untrackedEntries = rawAssessmentEntries.filter(
        (e) => e.referenceType !== SPECIAL_ASSESSMENT_REFERENCE_TYPE,
      );
      legacyLedgerRemaining = round2(
        Math.max(0, untrackedEntries.reduce((sum, e) => sum + e.amount, 0)),
      );
    }
  }

  // `totalOwed`/`totalPaid` reconcile to the SAME `total` the summary card
  // uses (`Math.max(theoretical portion, real ledger remaining)` — the
  // ledger remaining can exceed the naive per-unit-equal share once years
  // of real charges/payments are accounted for), so the two "Total owed" /
  // "Remaining" figures William sees never diverge between the summary card
  // and this drill-in.
  let totalOwed = Math.max(0, ownerPortion.total - totalPaidAbs);
  let totalPaidForHistory = totalPaidAbs;
  if (isLegacy && legacyLedgerRemaining != null) {
    const reconciledTotal = round2(Math.max(ownerPortion.total, legacyLedgerRemaining));
    totalOwed = legacyLedgerRemaining;
    totalPaidForHistory = round2(Math.max(0, reconciledTotal - legacyLedgerRemaining));
  }

  return {
    assessment: {
      id: assessmentRow.id,
      name: assessmentRow.name,
      totalAmount: assessmentRow.totalAmount,
      startDate: new Date(assessmentRow.startDate).toISOString(),
      endDate: assessmentRow.endDate ? new Date(assessmentRow.endDate).toISOString() : null,
      installmentCount: assessmentRow.installmentCount,
      interestRatePercent: assessmentRow.interestRatePercent ?? null,
      termMonths: assessmentRow.termMonths ?? null,
      allocationMethod: assessmentRow.allocationMethod ?? "per-unit-equal",
      paymentOptions: assessmentRow.paymentOptionsJson ?? null,
    },
    ownerPortion,
    history: {
      installmentsPosted,
      totalPaid: Number(totalPaidForHistory.toFixed(2)),
      totalOwed: Number(totalOwed.toFixed(2)),
      ledgerEntries: ledgerEntriesView,
    },
  };
}

/**
 * Derive upcoming installment entries for the owner's unit across every
 * active `specialAssessments` row in the association. Returned entries
 * describe the NEXT unposted installment only — the detail endpoint
 * carries the full history.
 */
export async function getUpcomingInstallmentsForOwnerUnit(params: {
  associationId: string;
  unitId: string | null;
  personId: string;
}): Promise<UpcomingInstallment[]> {
  const { associationId, unitId, personId } = params;
  if (!unitId) return [];

  const assessmentRows = await db
    .select()
    .from(specialAssessments)
    .where(and(
      eq(specialAssessments.associationId, associationId),
      eq(specialAssessments.isActive, 1),
    ));

  if (assessmentRows.length === 0) return [];

  // 2026-07-12 — a "next installment due" is only a trustworthy per-period
  // signal for assessments the unified execution orchestrator actually
  // posts on schedule (`autoPostEnabled === 1`; see
  // server/assessment-execution.ts). For a LEGACY assessment that was never
  // wired to that pipeline (`autoPostEnabled === 0` — e.g. the Cherry Hill
  // Court driveway assessment, imported as a single opening-balance ledger
  // charge with no tracked installment postings), `installmentsPosted` can
  // NEVER increase (nothing ever tags a ledger row with this assessment's
  // installment reference), so the derived "next installment" would always
  // collapse to installment #1 due at the assessment's `startDate` — which
  // for a multi-year-old legacy assessment reads as "the WHOLE remaining
  // balance is due, years past due" (the observed owner-portal bug: a
  // $4,444.44 lump shown as due 1/1/2021). Exclude non-auto-posted
  // assessments from the "due this period" feed entirely — their balance is
  // still shown to the owner via the assessment-plan card
  // (`getAssessmentPlansForOwnerUnit`, below) as an ongoing obligation with
  // no fabricated due date, never folded into "Pay this period."
  const applicable = assessmentRows.filter(
    (a) => isUnitIncluded(a, unitId) && a.autoPostEnabled === 1,
  );
  if (applicable.length === 0) return [];

  const unitRows = await db
    .select()
    .from(units)
    .where(eq(units.associationId, associationId));

  const ownershipRows = await db
    .select({
      unitId: ownerships.unitId,
      ownershipPercentage: ownerships.ownershipPercentage,
      endDate: ownerships.endDate,
    })
    .from(ownerships)
    .innerJoin(units, eq(ownerships.unitId, units.id))
    .where(eq(units.associationId, associationId));

  const now = new Date();
  const activeOwnerships = ownershipRows.filter((r) => {
    return !r.endDate || new Date(r.endDate) > now;
  });

  // Preload ALL special-assessment installment ledger entries scoped to
  // this owner's unit (single query) so we can derive `installmentsPosted`
  // per assessment without N+1.
  const ledgerEntries = await db
    .select()
    .from(ownerLedgerEntries)
    .where(and(
      eq(ownerLedgerEntries.associationId, associationId),
      eq(ownerLedgerEntries.unitId, unitId),
      eq(ownerLedgerEntries.referenceType, SPECIAL_ASSESSMENT_REFERENCE_TYPE),
    ));

  const myLedgerEntries = ledgerEntries.filter((e) => e.personId === personId);

  const result: UpcomingInstallment[] = [];
  for (const assessment of applicable) {
    const excludedSet = new Set(
      Array.isArray(assessment.excludedUnitIdsJson) ? assessment.excludedUnitIdsJson : [],
    );
    const activeUnits = unitRows.filter((u) => !excludedSet.has(u.id));

    const activeUnitsWithShare: UnitForOwnerPortion[] = activeUnits.map((u) => ({
      id: u.id,
      squareFootage: u.squareFootage ?? null,
      ownershipPercent: sumUnitOwnershipPercent(u.id, activeOwnerships),
    }));

    const myUnitForPortion = activeUnitsWithShare.find((u) => u.id === unitId);
    if (!myUnitForPortion) continue;

    const installmentsPosted = countPostedInstallments(
      myLedgerEntries,
      assessment.id,
      unitId,
    );

    let portion: OwnerPortion;
    try {
      portion = computeOwnerPortion({
        assessment: toAssessmentInput(assessment),
        unit: myUnitForPortion,
        totalActiveUnitCount: activeUnitsWithShare.length,
        allUnits: activeUnitsWithShare,
        installmentsPosted,
      });
    } catch {
      // Rule mis-configuration (e.g. custom allocation ≠ 100%). Skip from
      // the upcoming list — the manager will see the error in `/app/financial/rules`.
      continue;
    }

    if (portion.remainingInstallments <= 0) continue;

    const nextInstallmentNumber = installmentsPosted + 1;
    const dueDate = addUtcMonths(new Date(assessment.startDate), nextInstallmentNumber - 1);
    if (assessment.endDate && dueDate > new Date(assessment.endDate)) continue;

    result.push({
      assessmentId: assessment.id,
      assessmentName: assessment.name,
      installmentNumber: nextInstallmentNumber,
      installmentAmount: portion.installmentAmount,
      dueDate: dueDate.toISOString(),
      remainingInstallments: portion.remainingInstallments,
      allocationMethod: assessment.allocationMethod ?? "per-unit-equal",
      allocationReason: portion.allocationReason,
    });
  }

  return result.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
}

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * 2026-07-09 (owner-finances redesign) — special-assessment PAYMENT-PLAN
 * progress for the owner's unit, across every active assessment the unit is
 * part of. Returns the plan as it is PAID OVER TIME (total · paid-to-date ·
 * remaining · installments paid/total · next installment) so the owner portal
 * can render a plan card instead of an alarming "balance due now".
 *
 * Every field is derived from the SAME primitives as `getUpcomingInstallmentsForOwnerUnit`
 * (`computeOwnerPortion` + `countPostedInstallments` + `assessment.installmentCount`)
 * so the two surfaces never drift. Reconciles by construction:
 *   installmentsPaid + remainingInstallments === installmentCount
 *   paidToDate + remaining                    === total
 *
 * DISPLAY ONLY — no ledger write, no money movement. Assessments whose owner
 * portion is zero (unit excluded / mis-configured allocation) are skipped.
 */
export async function getAssessmentPlansForOwnerUnit(params: {
  associationId: string;
  unitId: string | null;
  personId: string;
}): Promise<AssessmentPlanProgress[]> {
  const { associationId, unitId, personId } = params;
  if (!unitId) return [];

  const assessmentRows = await db
    .select()
    .from(specialAssessments)
    .where(and(
      eq(specialAssessments.associationId, associationId),
      eq(specialAssessments.isActive, 1),
    ));
  if (assessmentRows.length === 0) return [];

  const applicable = assessmentRows.filter((a) => isUnitIncluded(a, unitId));
  if (applicable.length === 0) return [];

  const unitRows = await db
    .select()
    .from(units)
    .where(eq(units.associationId, associationId));

  const ownershipRows = await db
    .select({
      unitId: ownerships.unitId,
      ownershipPercentage: ownerships.ownershipPercentage,
      endDate: ownerships.endDate,
    })
    .from(ownerships)
    .innerJoin(units, eq(ownerships.unitId, units.id))
    .where(eq(units.associationId, associationId));

  const now = new Date();
  const activeOwnerships = ownershipRows.filter(
    (r) => !r.endDate || new Date(r.endDate) > now,
  );

  const ledgerEntries = await db
    .select()
    .from(ownerLedgerEntries)
    .where(and(
      eq(ownerLedgerEntries.associationId, associationId),
      eq(ownerLedgerEntries.unitId, unitId),
      eq(ownerLedgerEntries.referenceType, SPECIAL_ASSESSMENT_REFERENCE_TYPE),
    ));
  const myLedgerEntries = ledgerEntries.filter((e) => e.personId === personId);

  // 2026-07-12 — LEGACY assessments (`autoPostEnabled === 0`, e.g. the Cherry
  // Hill Court driveway assessment) were never wired to the unified
  // execution orchestrator, so they carry no tracked installment postings —
  // `installmentsPosted` above is structurally always 0 for them, which
  // makes `computeOwnerPortion`'s theoretical per-unit-equal SHARE (a naive
  // split of the assessment's ORIGINAL total, ignoring years of real
  // payment history) the wrong "remaining" figure, and its derived "next
  // installment due date" collapse to the assessment's `startDate` — read
  // as "the whole balance is years past due" (the observed owner-portal
  // bug). For these, use the REAL net "assessment"-category ledger balance
  // for this unit — the SAME ledger truth the rest of the dashboard already
  // treats as authoritative (`byUnit[].byCategory.assessment` /
  // `perUnit[].assessment`) — as the remaining amount instead. Only trusted
  // when there is exactly ONE such legacy assessment applicable to this
  // unit (otherwise a shared, untagged ledger balance can't be
  // unambiguously split between them, so we fall back to the theoretical
  // share below rather than guess). Excludes any ledger row tagged with the
  // real installment referenceType so a DIFFERENT, auto-posted assessment's
  // tracked postings are never double-counted into this legacy balance.
  // Read-only — no ledger write, no money movement.
  const legacyApplicable = applicable.filter((a) => a.autoPostEnabled !== 1);
  let legacyLedgerRemaining: number | null = null;
  if (legacyApplicable.length === 1) {
    const rawAssessmentEntries = await db
      .select()
      .from(ownerLedgerEntries)
      .where(and(
        eq(ownerLedgerEntries.associationId, associationId),
        eq(ownerLedgerEntries.unitId, unitId),
        eq(ownerLedgerEntries.personId, personId),
        eq(ownerLedgerEntries.entryType, "assessment"),
      ));
    const untrackedEntries = rawAssessmentEntries.filter(
      (e) => e.referenceType !== SPECIAL_ASSESSMENT_REFERENCE_TYPE,
    );
    legacyLedgerRemaining = round2(
      Math.max(0, untrackedEntries.reduce((sum, e) => sum + e.amount, 0)),
    );
  }

  const plans: AssessmentPlanProgress[] = [];
  for (const assessment of applicable) {
    const excludedSet = new Set(
      Array.isArray(assessment.excludedUnitIdsJson) ? assessment.excludedUnitIdsJson : [],
    );
    const activeUnits = unitRows.filter((u) => !excludedSet.has(u.id));
    const activeUnitsWithShare: UnitForOwnerPortion[] = activeUnits.map((u) => ({
      id: u.id,
      squareFootage: u.squareFootage ?? null,
      ownershipPercent: sumUnitOwnershipPercent(u.id, activeOwnerships),
    }));
    const myUnitForPortion = activeUnitsWithShare.find((u) => u.id === unitId);
    if (!myUnitForPortion) continue;

    const installmentsPosted = countPostedInstallments(myLedgerEntries, assessment.id, unitId);

    let portion: OwnerPortion;
    try {
      portion = computeOwnerPortion({
        assessment: toAssessmentInput(assessment),
        unit: myUnitForPortion,
        totalActiveUnitCount: activeUnitsWithShare.length,
        allUnits: activeUnitsWithShare,
        installmentsPosted,
      });
    } catch {
      // Rule mis-configuration (custom allocation ≠ 100%) — skip; the manager
      // sees the error in /app/financial/rules.
      continue;
    }

    if (portion.total <= 0) continue;

    const isLegacy = assessment.autoPostEnabled !== 1;

    if (isLegacy && legacyLedgerRemaining != null) {
      // No real schedule to reconcile against — present the assessment as
      // an ONGOING balance (paid over time, no fixed installment count/due
      // date), using the ledger-truth remaining amount. Never past-due
      // (`nextInstallmentDueDate: null`), never folded into "Pay this
      // period" (that feed already excludes non-auto-posted assessments —
      // see `getUpcomingInstallmentsForOwnerUnit`).
      const remaining = legacyLedgerRemaining;
      const total = round2(Math.max(portion.total, remaining));
      const paidToDate = round2(Math.max(0, total - remaining));
      if (total <= 0) continue;
      plans.push({
        assessmentId: assessment.id,
        assessmentName: assessment.name,
        total,
        paidToDate,
        remaining,
        installmentCount: 0,
        installmentsPaid: 0,
        installmentAmount: round2(portion.installmentAmount),
        nextInstallmentAmount: null,
        nextInstallmentDueDate: null,
        nextInstallmentNumber: null,
      });
      continue;
    }

    // Schedule-reconciled progress. `remainingInstallments` is the count of
    // future installments; `installmentCount` (schedule length) === posted +
    // remaining, so paidToDate + remaining === total by construction.
    const installmentCount = installmentsPosted + portion.remainingInstallments;
    const remaining = round2(portion.remainingInstallments * portion.installmentAmount);
    const paidToDate = round2(Math.max(0, portion.total - remaining));

    // A legacy assessment with no unambiguous ledger-truth override (2+
    // concurrent legacy assessments for this unit) still gets the due-date
    // suppression — we just can't safely attribute the ledger balance, so
    // the theoretical share is kept for `total`/`remaining` as before.
    const hasNext = !isLegacy && portion.remainingInstallments > 0;
    const nextInstallmentNumber = hasNext ? installmentsPosted + 1 : null;
    const nextDueDate =
      hasNext && nextInstallmentNumber != null
        ? addUtcMonths(new Date(assessment.startDate), nextInstallmentNumber - 1)
        : null;

    plans.push({
      assessmentId: assessment.id,
      assessmentName: assessment.name,
      total: round2(portion.total),
      paidToDate,
      remaining,
      installmentCount: isLegacy ? 0 : installmentCount,
      installmentsPaid: isLegacy ? 0 : installmentsPosted,
      installmentAmount: round2(portion.installmentAmount),
      nextInstallmentAmount: hasNext ? round2(portion.installmentAmount) : null,
      nextInstallmentDueDate: nextDueDate ? nextDueDate.toISOString() : null,
      nextInstallmentNumber,
    });
  }

  return plans.sort((a, b) => a.assessmentName.localeCompare(b.assessmentName));
}
