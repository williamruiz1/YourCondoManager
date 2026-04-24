/**
 * 4.3 Q5 — Per-owner assessment portion calc.
 *
 * Pure, unit-testable module that derives the owner's portion of a
 * `specialAssessments` row given the assessment, the target unit, total
 * active unit count, and (for methods that need them) the full list of
 * active units in the association.
 *
 * Resolution anchor:
 *   docs/projects/platform-overhaul/decisions/4.3-recurring-assessment-rules-engine.md
 *   (Hypothesis B + owner-facing assessment detail).
 *
 * Input shape is deliberately narrow — accepts only the fields needed so
 * the caller can pass a `SpecialAssessment` row directly, plus the unit
 * rows from `units`, without dragging additional Drizzle types into this
 * module. The entire module has zero DB / network dependencies so it can
 * run in a vitest unit-test environment at ≥ 90 % line coverage.
 */

export type AssessmentAllocationMethod =
  | "per-unit-equal"
  | "per-sq-ft"
  | "per-ownership-share"
  | "custom";

export type AssessmentForOwnerPortion = {
  id: string;
  totalAmount: number;
  installmentCount: number;
  interestRatePercent: number | null;
  termMonths: number | null;
  allocationMethod: AssessmentAllocationMethod | null | undefined;
  allocationCustomJson: Record<string, number> | null | undefined;
};

export type UnitForOwnerPortion = {
  id: string;
  squareFootage: number | null;
  ownershipPercent?: number | null; // preferred canonical name
  ownershipPercentage?: number | null; // fallback alias
};

export type OwnerPortion = {
  principal: number;
  interest: number;
  total: number;
  installmentAmount: number;
  remainingInstallments: number;
  allocationReason: string;
};

// Tolerance for custom-allocation sum-to-100% validation and for the
// currency rounding we do at the penny grain. Kept close to the callers
// via an explicit export so tests can reference the exact value.
export const CUSTOM_ALLOCATION_TOLERANCE = 0.01;

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function readUnitOwnershipPercent(unit: UnitForOwnerPortion): number | null {
  // Prefer the canonical `ownershipPercent` spelling; fall back to the
  // `ownershipPercentage` alias used by some existing join results
  // (`ownerships.ownershipPercentage`). Returns null when neither is a
  // positive finite number — callers treat null as "fallback to
  // per-unit-equal".
  const candidates = [unit.ownershipPercent, unit.ownershipPercentage];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return null;
}

function computePerUnitEqualPrincipal(
  totalAmount: number,
  totalActiveUnitCount: number,
): number {
  if (!Number.isFinite(totalActiveUnitCount) || totalActiveUnitCount <= 0) {
    return 0;
  }
  return totalAmount / totalActiveUnitCount;
}

function computePerSqFtPrincipal(
  totalAmount: number,
  unit: UnitForOwnerPortion,
  allUnits: ReadonlyArray<UnitForOwnerPortion>,
): { principal: number; fallback: true } | { principal: number; fallback: false } {
  if (typeof unit.squareFootage !== "number" || unit.squareFootage <= 0) {
    return { principal: 0, fallback: true };
  }
  const totalSqFt = allUnits.reduce((sum, u) => {
    if (typeof u.squareFootage === "number" && u.squareFootage > 0) {
      return sum + u.squareFootage;
    }
    return sum;
  }, 0);
  if (totalSqFt <= 0) {
    return { principal: 0, fallback: true };
  }
  return { principal: totalAmount * (unit.squareFootage / totalSqFt), fallback: false };
}

function computePerOwnershipSharePrincipal(
  totalAmount: number,
  unit: UnitForOwnerPortion,
  allUnits: ReadonlyArray<UnitForOwnerPortion>,
): { principal: number; fallback: true } | { principal: number; fallback: false } {
  const share = readUnitOwnershipPercent(unit);
  if (share === null) {
    return { principal: 0, fallback: true };
  }
  const totalShare = allUnits.reduce((sum, u) => {
    const pct = readUnitOwnershipPercent(u);
    return pct !== null ? sum + pct : sum;
  }, 0);
  if (totalShare <= 0) {
    return { principal: 0, fallback: true };
  }
  return { principal: totalAmount * (share / totalShare), fallback: false };
}

/**
 * Throws a RangeError when `allocationMethod === "custom"` and the sum of
 * percentages across `allocationCustomJson` is not 100 ± 0.01. The caller
 * (portal endpoint) is expected to catch this and surface a structured
 * validation error so the Manager can fix the rule. Surfacing as a throw
 * keeps the happy-path return tight.
 */
function validateCustomAllocationSum(custom: Record<string, number>): void {
  const sum = Object.values(custom).reduce((acc, v) => {
    return typeof v === "number" && Number.isFinite(v) ? acc + v : acc;
  }, 0);
  if (Math.abs(sum - 100) > CUSTOM_ALLOCATION_TOLERANCE) {
    throw new RangeError(
      `allocationCustomJson must sum to 100 ± ${CUSTOM_ALLOCATION_TOLERANCE} (got ${sum.toFixed(4)})`,
    );
  }
}

function computeCustomPrincipal(
  totalAmount: number,
  unit: UnitForOwnerPortion,
  allocationCustomJson: Record<string, number> | null | undefined,
): { principal: number; fallback: true } | { principal: number; fallback: false } {
  if (!allocationCustomJson || Object.keys(allocationCustomJson).length === 0) {
    return { principal: 0, fallback: true };
  }
  validateCustomAllocationSum(allocationCustomJson);
  const raw = allocationCustomJson[unit.id];
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return { principal: 0, fallback: true };
  }
  return { principal: totalAmount * (raw / 100), fallback: false };
}

/**
 * Standard amortization — returns { interest, total } given a principal,
 * annual interest rate (percent), and term in months. When the rate is 0
 * or either input is missing, returns { interest: 0, total: principal }.
 *
 * Formula:
 *   monthlyRate = (annualRate / 100) / 12
 *   monthlyPayment = principal * monthlyRate / (1 - (1 + monthlyRate)^-term)
 *   totalPaid = monthlyPayment * term
 *   interest  = totalPaid - principal
 *
 * For rate = 0, monthlyPayment = principal / term so totalPaid = principal
 * and interest = 0 — covered by the early return.
 */
function computeAmortizedInterest(
  principal: number,
  interestRatePercent: number | null | undefined,
  termMonths: number | null | undefined,
): { interest: number; total: number } {
  if (
    principal <= 0 ||
    interestRatePercent === null ||
    interestRatePercent === undefined ||
    !Number.isFinite(interestRatePercent) ||
    interestRatePercent <= 0 ||
    termMonths === null ||
    termMonths === undefined ||
    !Number.isFinite(termMonths) ||
    termMonths <= 0
  ) {
    return { interest: 0, total: principal };
  }
  const monthlyRate = interestRatePercent / 100 / 12;
  const monthlyPayment =
    (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
  const totalPaid = monthlyPayment * termMonths;
  const interest = totalPaid - principal;
  return {
    interest: round2(interest),
    total: round2(principal + interest),
  };
}

export type ComputeOwnerPortionInput = {
  assessment: AssessmentForOwnerPortion;
  unit: UnitForOwnerPortion;
  totalActiveUnitCount: number;
  allUnits: ReadonlyArray<UnitForOwnerPortion>;
  /**
   * Count of installments already posted to this unit for this assessment.
   * The caller counts `ownerLedgerEntries` rows with
   *   referenceType = 'special_assessment_installment'
   *   AND referenceId LIKE '${assessmentId}:%:${unitId}'
   * so this module stays DB-free. Defaults to 0.
   */
  installmentsPosted?: number;
};

/**
 * Compute the per-owner portion of a special assessment.
 *
 * Returns an `OwnerPortion` with derived principal, interest, total,
 * installment amount, remaining installments, and a human-readable
 * `allocationReason` that identifies which allocation method produced the
 * number (or why a fallback was used). The reason is surfaced in the
 * portal detail surface so owners can understand how their portion was
 * derived.
 */
export function computeOwnerPortion(input: ComputeOwnerPortionInput): OwnerPortion {
  const {
    assessment,
    unit,
    totalActiveUnitCount,
    allUnits,
    installmentsPosted = 0,
  } = input;

  const rawMethod: AssessmentAllocationMethod =
    (assessment.allocationMethod as AssessmentAllocationMethod | null | undefined) ??
    "per-unit-equal";

  const totalAmount = Number.isFinite(assessment.totalAmount) ? assessment.totalAmount : 0;

  let principalRaw = 0;
  let allocationReason = "";

  switch (rawMethod) {
    case "per-unit-equal":
      principalRaw = computePerUnitEqualPrincipal(totalAmount, totalActiveUnitCount);
      allocationReason = "per-unit-equal";
      break;

    case "per-sq-ft": {
      const result = computePerSqFtPrincipal(totalAmount, unit, allUnits);
      if (result.fallback) {
        principalRaw = computePerUnitEqualPrincipal(totalAmount, totalActiveUnitCount);
        allocationReason = "per-sq-ft fallback: unit squareFootage missing";
      } else {
        principalRaw = result.principal;
        allocationReason = "per-sq-ft";
      }
      break;
    }

    case "per-ownership-share": {
      const result = computePerOwnershipSharePrincipal(totalAmount, unit, allUnits);
      if (result.fallback) {
        principalRaw = computePerUnitEqualPrincipal(totalAmount, totalActiveUnitCount);
        allocationReason = "per-ownership-share fallback: unit ownershipPercent missing";
      } else {
        principalRaw = result.principal;
        allocationReason = "per-ownership-share";
      }
      break;
    }

    case "custom": {
      const result = computeCustomPrincipal(
        totalAmount,
        unit,
        assessment.allocationCustomJson,
      );
      if (result.fallback) {
        principalRaw = computePerUnitEqualPrincipal(totalAmount, totalActiveUnitCount);
        allocationReason =
          "custom fallback: allocationCustomJson missing entry for unit";
      } else {
        principalRaw = result.principal;
        allocationReason = "custom";
      }
      break;
    }

    default: {
      // Defensive — unknown method value falls through to per-unit-equal.
      principalRaw = computePerUnitEqualPrincipal(totalAmount, totalActiveUnitCount);
      allocationReason = `unknown allocationMethod '${String(rawMethod)}' — defaulted to per-unit-equal`;
      break;
    }
  }

  const principal = round2(principalRaw);
  const { interest, total } = computeAmortizedInterest(
    principal,
    assessment.interestRatePercent,
    assessment.termMonths,
  );

  const installmentCount =
    Number.isFinite(assessment.installmentCount) && assessment.installmentCount > 0
      ? assessment.installmentCount
      : 1;
  const installmentAmount = round2(total / installmentCount);

  const postedClamped = Math.max(0, Math.min(installmentsPosted, installmentCount));
  const remainingInstallments = installmentCount - postedClamped;

  return {
    principal,
    interest,
    total,
    installmentAmount,
    remainingInstallments,
    allocationReason,
  };
}
