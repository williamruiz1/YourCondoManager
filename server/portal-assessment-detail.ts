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

  const totalOwed = Math.max(0, ownerPortion.total - totalPaidAbs);

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
      totalPaid: Number(totalPaidAbs.toFixed(2)),
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
