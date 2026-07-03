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
 *   Σ dueNowDues        === owner-wide dues-due   (Σ positive charge+late-fee)
 *   Σ dueNowAssessment  === owner-wide installment-due (the upcoming
 *                            special-assessment installment(s))
 *   Σ balanceTotal      === owner-wide balance
 *
 * ── Why the installment lands on ONE unit ──────────────────────────────────
 * The owner-portal endpoint computes the upcoming special-assessment
 * installment for the owner's PRIMARY unit only (`req.portalUnitId`) — the
 * installments carry no per-unit attribution and are NOT re-scoped across
 * every owned unit (doing so would change the owner-wide "due now" total,
 * which is out of scope for a read-only display change). So the installment
 * total is attributed to that primary unit; the owner's other units show $0
 * installment due now. This keeps the per-unit sums reconciled to exactly the
 * figure the owner already sees on the top card.
 */

export interface PerUnitByCategoryInput {
  unitId: string;
  unitLabel: string;
  /** Net ledger amount per entry category (charge/assessment/payment/…). */
  byCategory: Partial<Record<string, number>>;
  /** Net ledger balance for the unit (sum of all its entries). */
  total: number;
}

export interface UpcomingInstallmentInput {
  installmentAmount: number;
}

export interface PerUnitBreakdown {
  unitId: string;
  unitLabel: string;
  /** HOA dues due now = positive `charge` + `late-fee` for the unit. */
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
 * Build the per-unit breakdown from the owner-wide `byUnit` grouping + the
 * upcoming special-assessment installments + the owner's primary unit id.
 *
 * Reconciles by construction: the installment total is attributed to a single
 * unit that is present in `units`, and every other figure is a straight
 * partition of `byUnit`.
 */
export function buildPerUnitBreakdown(
  units: PerUnitByCategoryInput[],
  upcomingInstallments: UpcomingInstallmentInput[],
  primaryUnitId: string | null,
): PerUnitBreakdown[] {
  const totalInstallmentDueNow = upcomingInstallments.reduce(
    (sum, i) => sum + (i.installmentAmount ?? 0),
    0,
  );

  // Attribute the installment total to the owner's primary unit so the
  // per-unit sums reconcile to the owner-wide "due now" total. If the primary
  // unit has no ledger rows (so it's absent from `units`), fall back to the
  // first (highest-balance) unit so the total is never dropped.
  const installmentUnitId =
    primaryUnitId && units.some((u) => u.unitId === primaryUnitId)
      ? primaryUnitId
      : (units[0]?.unitId ?? primaryUnitId);

  return units.map((u) => {
    const dueNowDues =
      Math.max(0, u.byCategory.charge ?? 0) +
      Math.max(0, u.byCategory["late-fee"] ?? 0);
    const dueNowAssessment =
      u.unitId === installmentUnitId ? totalInstallmentDueNow : 0;
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
