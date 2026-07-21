/**
 * Per-unit owner-finances breakdown (2026-07-03).
 *
 * William finding: an owner who owns MULTIPLE units wants to see what's owed
 * PER UNIT, and within each unit see HOA DUES and SPECIAL ASSESSMENTS as
 * SEPARATE line items (assessments are not folded into recurring dues).
 *
 * This is a pure DISPLAY aggregation over data the financial-dashboard
 * endpoint already computes — it reads NOTHING new from the ledger and moves
 * NO money. It re-partitions the existing owner-wide figures per unit using
 * the SAME classification the owner-wide "What's due now" split already uses
 * (`computeDueNow` on the client), so the per-unit sums reconcile EXACTLY to
 * the owner-wide totals:
 *
 *   Σ dueNowDues        === owner-wide current-period HOA dues, net of
 *                            cleared current-period payments/credits
 *   Σ dueNowAssessment  === owner-wide scheduled assessment installments
 *                            due in the current calendar period
 *   Σ balanceTotal      === owner-wide balance
 *
 * Upcoming installments now carry unit attribution. The primary-unit fallback
 * remains only for older/cached payloads without `unitId`.
 */

export interface PerUnitByCategoryInput {
  unitId: string;
  unitLabel: string;
  /** Net ledger amount per entry category (charge/assessment/payment/…). */
  byCategory: Partial<Record<string, number>>;
  /** Net ledger balance for the unit (sum of all its entries). */
  total: number;
  /** Ledger rows used to resolve the current calendar period. */
  entries?: PeriodLedgerEntryInput[];
}

export interface UpcomingInstallmentInput {
  installmentAmount: number;
  unitId?: string | null;
  dueDate?: Date | string | null;
}

export interface PeriodLedgerEntryInput {
  entryType: string;
  amount: number;
  postedAt: Date | string | null;
  referenceType?: string | null;
}

export interface PerUnitBreakdown {
  unitId: string;
  unitLabel: string;
  /** Current-period HOA dues, net of cleared current-period payments/credits. */
  dueNowDues: number;
  /** Special-assessment INSTALLMENT due now (not the full lump). */
  dueNowAssessment: number;
  /** dueNowDues + dueNowAssessment. */
  dueNowTotal: number;
  /** Balance NOT attributable to a special assessment (dues, fees, payments…). */
  balanceDues: number;
  /** Balance attributable to special assessments (net `assessment` category). */
  balanceAssessment: number;
  /** Full net balance for the unit (= balanceDues + balanceAssessment). */
  balanceTotal: number;
}

/**
 * Build the per-unit breakdown from ledger rows + scheduled assessment
 * installments. Full balance and current-period obligation stay independent.
 *
 * Reconciles by construction: installments use their unit attribution (with a
 * primary-unit fallback for cached legacy payloads), and balances remain a
 * straight partition of `byUnit`.
 */
export function buildPerUnitBreakdown(
  units: PerUnitByCategoryInput[],
  upcomingInstallments: UpcomingInstallmentInput[],
  primaryUnitId: string | null,
  now = new Date(),
): PerUnitBreakdown[] {
  const periodStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const periodEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const isInCurrentPeriod = (value: Date | string | null | undefined): boolean => {
    if (!value) return true;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) && timestamp >= periodStart && timestamp < periodEnd;
  };

  const installmentsDueThisPeriod = upcomingInstallments.filter((installment) =>
    isInCurrentPeriod(installment.dueDate),
  );
  // Backward compatibility for an older installment payload with no unitId.
  const installmentUnitId =
    primaryUnitId && units.some((u) => u.unitId === primaryUnitId)
      ? primaryUnitId
      : (units[0]?.unitId ?? primaryUnitId);

  return units.map((u) => {
    const currentPeriodEntries = u.entries?.filter((entry) =>
      isInCurrentPeriod(entry.postedAt),
    );
    const grossDuesThisPeriod = currentPeriodEntries
      ? currentPeriodEntries
          .filter((entry) => entry.entryType === "charge" || entry.entryType === "late-fee")
          .reduce((sum, entry) => sum + Math.max(0, entry.amount), 0)
      : Math.max(0, u.byCategory.charge ?? 0) + Math.max(0, u.byCategory["late-fee"] ?? 0);
    const clearedPaymentsThisPeriod = currentPeriodEntries
      ? Math.abs(
          currentPeriodEntries
            .filter((entry) => entry.entryType === "payment" || entry.entryType === "credit")
            .reduce((sum, entry) => sum + Math.min(0, entry.amount), 0),
        )
      : 0;
    const unitInstallments = installmentsDueThisPeriod.filter((installment) =>
      installment.unitId
        ? installment.unitId === u.unitId
        : u.unitId === installmentUnitId,
    );
    const grossAssessmentThisPeriod = unitInstallments.reduce(
      (sum, installment) => sum + Math.max(0, installment.installmentAmount ?? 0),
      0,
    ) + (currentPeriodEntries
      ? currentPeriodEntries
          .filter(
            (entry) =>
              entry.entryType === "assessment" &&
              entry.referenceType === "special_assessment_installment",
          )
          .reduce((sum, entry) => sum + Math.max(0, entry.amount), 0)
      : 0);

    // A cleared unit payment first satisfies this period's recurring HOA
    // dues, then any scheduled assessment installment. Historical balances
    // remain visible below, but never inflate "due this period".
    const dueNowDues = Math.max(0, grossDuesThisPeriod - clearedPaymentsThisPeriod);
    const remainingPaymentCredit = Math.max(0, clearedPaymentsThisPeriod - grossDuesThisPeriod);
    const dueNowAssessment = Math.max(0, grossAssessmentThisPeriod - remainingPaymentCredit);
    const balanceAssessment = u.byCategory.assessment ?? 0;
    const balanceDues = u.total - balanceAssessment;
    return {
      unitId: u.unitId,
      unitLabel: u.unitLabel,
      dueNowDues,
      dueNowAssessment,
      dueNowTotal: dueNowDues + dueNowAssessment,
      balanceDues,
      balanceAssessment,
      balanceTotal: u.total,
    };
  });
}
