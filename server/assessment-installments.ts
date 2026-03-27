import { and, eq, gte, isNull, or } from "drizzle-orm";
import { db } from "./db";
import { ownerLedgerEntries, ownerships, specialAssessments, units } from "@shared/schema";

export const SPECIAL_ASSESSMENT_REFERENCE_TYPE = "special_assessment_installment";

function addUtcMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(year, month + months, 1, 12, 0, 0, 0));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12, 0, 0, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

function getAssessmentDueInstallments(
  assessment: { startDate: Date | string; endDate: Date | string | null; installmentCount: number },
  asOf: Date,
): Array<{ installmentNumber: number; dueDate: Date }> {
  const startDate = new Date(assessment.startDate);
  if (!Number.isFinite(startDate.getTime()) || assessment.installmentCount < 1) {
    return [];
  }

  const endDate = assessment.endDate ? new Date(assessment.endDate) : null;
  if (endDate && !Number.isFinite(endDate.getTime())) {
    return [];
  }

  const dueInstallments: Array<{ installmentNumber: number; dueDate: Date }> = [];
  for (let installmentNumber = 1; installmentNumber <= assessment.installmentCount; installmentNumber++) {
    const dueDate = addUtcMonths(startDate, installmentNumber - 1);
    if (endDate && dueDate > endDate) {
      break;
    }
    if (dueDate > asOf) {
      break;
    }
    dueInstallments.push({ installmentNumber, dueDate });
  }
  return dueInstallments;
}

function getAssessmentInstallmentAmount(totalAmount: number, installmentCount: number, installmentNumber: number): number {
  const totalCents = Math.round(totalAmount * 100);
  const baseInstallmentCents = Math.floor(totalCents / installmentCount);
  if (installmentNumber < installmentCount) {
    return Number((baseInstallmentCents / 100).toFixed(2));
  }
  const allocatedBeforeFinal = baseInstallmentCents * (installmentCount - 1);
  return Number(((totalCents - allocatedBeforeFinal) / 100).toFixed(2));
}

type ProcessSpecialAssessmentOptions = {
  assessmentId?: string;
  automaticOnly?: boolean;
};

export async function processSpecialAssessmentInstallments(
  associationId: string,
  options: ProcessSpecialAssessmentOptions = {},
) {
  const now = new Date();
  const assessmentFilters = [
    eq(specialAssessments.associationId, associationId),
    eq(specialAssessments.isActive, 1),
  ];
  if (options.assessmentId) {
    assessmentFilters.push(eq(specialAssessments.id, options.assessmentId));
  }
  if (options.automaticOnly) {
    assessmentFilters.push(eq(specialAssessments.autoPostEnabled, 1));
  }

  const [assessments, associationUnits, ownershipRows, existingEntries] = await Promise.all([
    db.select().from(specialAssessments).where(and(...assessmentFilters)),
    db.select({ id: units.id }).from(units).where(eq(units.associationId, associationId)),
    db.select({
      unitId: ownerships.unitId,
      personId: ownerships.personId,
      ownershipPercentage: ownerships.ownershipPercentage,
      startDate: ownerships.startDate,
      endDate: ownerships.endDate,
    })
      .from(ownerships)
      .innerJoin(units, eq(ownerships.unitId, units.id))
      .where(and(
        eq(units.associationId, associationId),
        or(isNull(ownerships.endDate), gte(ownerships.endDate, now)),
      )),
    db.select({
      referenceId: ownerLedgerEntries.referenceId,
    })
      .from(ownerLedgerEntries)
      .where(and(
        eq(ownerLedgerEntries.associationId, associationId),
        eq(ownerLedgerEntries.referenceType, SPECIAL_ASSESSMENT_REFERENCE_TYPE),
      )),
  ]);

  const existingReferences = new Set(
    existingEntries
      .map((entry) => entry.referenceId)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  );

  let assessmentsProcessed = 0;
  let installmentsDue = 0;
  let entriesCreated = 0;
  let alreadyPosted = 0;
  let skippedUnits = 0;

  for (const assessment of assessments) {
    const dueInstallments = getAssessmentDueInstallments(assessment, now);
    if (!dueInstallments.length) {
      continue;
    }

    assessmentsProcessed += 1;
    installmentsDue += dueInstallments.length;

    for (const installment of dueInstallments) {
      const installmentAmount = getAssessmentInstallmentAmount(
        assessment.totalAmount,
        assessment.installmentCount,
        installment.installmentNumber,
      );
      const excludedUnitIds = new Set(Array.isArray(assessment.excludedUnitIdsJson) ? assessment.excludedUnitIdsJson : []);

      for (const unit of associationUnits) {
        if (excludedUnitIds.has(unit.id)) {
          skippedUnits += 1;
          continue;
        }
        const referenceId = `${assessment.id}:${installment.installmentNumber}:${unit.id}`;
        if (existingReferences.has(referenceId)) {
          alreadyPosted += 1;
          continue;
        }

        const ownership = ownershipRows
          .filter((row) => (
            row.unitId === unit.id
            && new Date(row.startDate) <= installment.dueDate
            && (!row.endDate || new Date(row.endDate) > installment.dueDate)
          ))
          .sort((a, b) => {
            const startDelta = new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
            if (startDelta !== 0) return startDelta;
            return (b.ownershipPercentage ?? 0) - (a.ownershipPercentage ?? 0);
          })[0];

        if (!ownership) {
          skippedUnits += 1;
          continue;
        }

        await db.insert(ownerLedgerEntries).values({
          associationId,
          unitId: unit.id,
          personId: ownership.personId,
          entryType: "assessment",
          amount: installmentAmount,
          postedAt: installment.dueDate,
          description: assessment.installmentCount > 1
            ? `${assessment.name} - installment ${installment.installmentNumber} of ${assessment.installmentCount}`
            : assessment.name,
          referenceType: SPECIAL_ASSESSMENT_REFERENCE_TYPE,
          referenceId,
        });

        existingReferences.add(referenceId);
        entriesCreated += 1;
      }
    }
  }

  return {
    assessmentsProcessed,
    installmentsDue,
    entriesCreated,
    alreadyPosted,
    skippedUnits,
  };
}

export async function runAutomaticSpecialAssessmentInstallments() {
  const automaticAssessments = await db.select({
    associationId: specialAssessments.associationId,
  }).from(specialAssessments).where(and(
    eq(specialAssessments.isActive, 1),
    eq(specialAssessments.autoPostEnabled, 1),
  ));

  const associationIds = Array.from(new Set(automaticAssessments.map((row) => row.associationId)));
  let assessmentsProcessed = 0;
  let installmentsDue = 0;
  let entriesCreated = 0;
  let alreadyPosted = 0;
  let skippedUnits = 0;

  for (const associationId of associationIds) {
    const result = await processSpecialAssessmentInstallments(associationId, { automaticOnly: true });
    assessmentsProcessed += result.assessmentsProcessed;
    installmentsDue += result.installmentsDue;
    entriesCreated += result.entriesCreated;
    alreadyPosted += result.alreadyPosted;
    skippedUnits += result.skippedUnits;
  }

  return {
    associationsProcessed: associationIds.length,
    assessmentsProcessed,
    installmentsDue,
    entriesCreated,
    alreadyPosted,
    skippedUnits,
  };
}
