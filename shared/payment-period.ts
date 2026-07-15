// shared/payment-period.ts
//
// Plan-aware "Amount due this period" resolver (founder-os live session
// 2026-05-25 — William verbatim: *"if it's on the quarterly plan, then it
// shouldn't show due until that quarter is up"*).
//
// Why this exists
// ----------------
// The owner-portal /portal/finances was surfacing one CTA — "Pay $5,618.61"
// — against the owner's TOTAL outstanding balance. That's not what's
// actually due RIGHT NOW if the owner is on a payment plan: on a monthly
// plan, the per-period installment is what's due; on a quarterly plan,
// the installment is due only when the current quarter is closing — NOT
// perpetually between quarters.
//
// This module is the single source of truth for the "what's due this
// period" question. It's a pure function — no DB, no React — so we can
// unit-test the quarterly-edge-case in isolation, and either the server
// (in /api/portal/financial-dashboard) or a client-side hook can call it
// from the same source.
//
// Inputs
// ------
// - `plan` — the owner's active payment plan (monthly / quarterly / other)
// - `now`  — the resolution date (parameterized for testability)
//
// Output
// ------
// - `AmountDueResolution` describing:
//   - whether anything is due this period (`due`)
//   - the dollar amount (`amount`)
//   - the human label for the period ("May 2026" / "Q2 2026")
//   - the period close date the UI can render as a countdown
//   - the reason if NOT due (e.g. "quarter-not-closing")
//
// Behavior
// --------
// 1. **No active plan**: returns `{ due: false, reason: 'no-plan' }`. The
//    UI should fall back to the legacy "Pay full balance" CTA.
// 2. **Monthly plan**: ALWAYS due in the current calendar month. The
//    period label is the calendar month (e.g. "May 2026"); the period
//    end is the last day of that month.
// 3. **Quarterly plan with grace window**: due ONLY when `now` is inside
//    the last `DEFAULT_QUARTERLY_GRACE_DAYS` of the quarter (default 30).
//    Outside that window, returns `{ due: false, reason: 'quarter-not-closing' }`.
//    Per William: between quarters, the owner should NOT see a
//    perpetual "amount due" — wait until the quarter is actually closing.
// 4. **Plan with explicit `nextDueDate`**: when the plan supplies a
//    `nextDueDate`, that wins over computed period boundaries. The "due"
//    flag is true when `nextDueDate <= now + grace`; otherwise false with
//    reason `'before-next-due-date'`.
// 5. **Plan completed (`status !== 'active'`)**: not due, reason `'plan-inactive'`.
//
// Tests live at `tests/payment-period.test.ts` — covering monthly,
// quarterly edge cases, and the "no plan" fallback.

export type PaymentPlanFrequency = "monthly" | "quarterly" | "annual" | string;

export interface PaymentPlanInput {
  status: string; // "active" | "completed" | "cancelled" | ...
  installmentAmount: number; // dollars
  installmentFrequency: PaymentPlanFrequency;
  nextDueDate?: Date | string | null;
  startDate?: Date | string | null;
}

export type AmountDueReason =
  | "no-plan"
  | "plan-inactive"
  | "quarter-not-closing"
  | "before-next-due-date"
  | "due";

export interface AmountDueResolution {
  /** TRUE when the UI should render a primary "Pay $X due this period" CTA. */
  due: boolean;
  /** Dollar amount due this period (0 when `due` is false). */
  amount: number;
  /** Human label of the current period, e.g. "May 2026" or "Q2 2026". */
  periodLabel: string | null;
  /** When the current period closes (last day of month, last day of quarter). ISO. */
  periodEnd: string | null;
  /** Frequency of the active plan. `null` when no plan. */
  frequency: PaymentPlanFrequency | null;
  /** Reason code for telemetry / debugging. */
  reason: AmountDueReason;
}

/**
 * Default grace window for quarterly plans: the "amount due" surfaces
 * only when the resolution date is within this many days of quarter-end.
 * 30 days is a sensible default — owners get a month-long visible window
 * to pay the quarterly installment.
 */
export const DEFAULT_QUARTERLY_GRACE_DAYS = 30;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function endOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
}

function monthLabel(now: Date): string {
  return now.toLocaleString("en-US", { month: "long", year: "numeric" });
}

/** 0-indexed quarter (0=Q1, 1=Q2, 2=Q3, 3=Q4). */
function quarterIndex(now: Date): number {
  return Math.floor(now.getMonth() / 3);
}

function endOfQuarter(now: Date): Date {
  const q = quarterIndex(now);
  // Quarter end month: 2 (Mar) / 5 (Jun) / 8 (Sep) / 11 (Dec).
  const endMonth = q * 3 + 2;
  return new Date(now.getFullYear(), endMonth + 1, 0, 23, 59, 59, 999);
}

function quarterLabel(now: Date): string {
  const q = quarterIndex(now) + 1;
  return `Q${q} ${now.getFullYear()}`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Resolve "amount due this period" for an owner against a payment plan.
 *
 * Pure function. Safe to call from server or client; identical output for
 * identical input. `now` is parameterized so tests can simulate
 * mid-quarter / quarter-end / no-plan scenarios deterministically.
 */
export function resolveAmountDue(
  plan: PaymentPlanInput | null | undefined,
  now: Date = new Date(),
  options: { quarterlyGraceDays?: number } = {},
): AmountDueResolution {
  const graceDays = options.quarterlyGraceDays ?? DEFAULT_QUARTERLY_GRACE_DAYS;

  // No plan at all → fall back to "pay full balance" path in the UI.
  if (!plan) {
    return {
      due: false,
      amount: 0,
      periodLabel: null,
      periodEnd: null,
      frequency: null,
      reason: "no-plan",
    };
  }

  // Plan exists but is not active (completed, cancelled, defaulted).
  if (plan.status !== "active") {
    return {
      due: false,
      amount: 0,
      periodLabel: null,
      periodEnd: null,
      frequency: plan.installmentFrequency,
      reason: "plan-inactive",
    };
  }

  const explicitNextDue = toDate(plan.nextDueDate ?? null);
  const installmentAmount = Math.max(0, Number(plan.installmentAmount) || 0);

  // Quarterly is the special case William called out — "shouldn't show due
  // until that quarter is up." We compute the quarter end and only flip
  // `due` when `now` is inside the grace window.
  if (plan.installmentFrequency === "quarterly") {
    const periodEnd = endOfQuarter(now);
    const label = quarterLabel(now);
    const daysUntilEnd = daysBetween(now, periodEnd);

    // Explicit nextDueDate takes precedence over computed quarter math.
    if (explicitNextDue) {
      const dueWithinGrace = explicitNextDue.getTime() - now.getTime() <= graceDays * 24 * 60 * 60 * 1000;
      if (!dueWithinGrace) {
        return {
          due: false,
          amount: 0,
          periodLabel: label,
          periodEnd: periodEnd.toISOString(),
          frequency: "quarterly",
          reason: "before-next-due-date",
        };
      }
      return {
        due: true,
        amount: installmentAmount,
        periodLabel: label,
        periodEnd: explicitNextDue.toISOString(),
        frequency: "quarterly",
        reason: "due",
      };
    }

    // No explicit nextDueDate — use the grace-window heuristic.
    if (daysUntilEnd > graceDays) {
      return {
        due: false,
        amount: 0,
        periodLabel: label,
        periodEnd: periodEnd.toISOString(),
        frequency: "quarterly",
        reason: "quarter-not-closing",
      };
    }

    return {
      due: true,
      amount: installmentAmount,
      periodLabel: label,
      periodEnd: periodEnd.toISOString(),
      frequency: "quarterly",
      reason: "due",
    };
  }

  // Monthly is the canonical / default case. Always due in the current
  // calendar month; the period closes at end-of-month.
  if (plan.installmentFrequency === "monthly") {
    const periodEnd = endOfMonth(now);
    return {
      due: true,
      amount: installmentAmount,
      periodLabel: monthLabel(now),
      periodEnd: (explicitNextDue ?? periodEnd).toISOString(),
      frequency: "monthly",
      reason: "due",
    };
  }

  // Annual / other — fall back to explicit nextDueDate within grace, else
  // treat as "not due until period close" with a 30-day grace.
  const periodEnd = explicitNextDue ?? endOfMonth(now);
  if (explicitNextDue) {
    const dueWithinGrace = explicitNextDue.getTime() - now.getTime() <= graceDays * 24 * 60 * 60 * 1000;
    if (!dueWithinGrace) {
      return {
        due: false,
        amount: 0,
        periodLabel: explicitNextDue.toLocaleDateString(),
        periodEnd: explicitNextDue.toISOString(),
        frequency: plan.installmentFrequency,
        reason: "before-next-due-date",
      };
    }
  }
  return {
    due: true,
    amount: installmentAmount,
    periodLabel: explicitNextDue ? explicitNextDue.toLocaleDateString() : monthLabel(now),
    periodEnd: periodEnd.toISOString(),
    frequency: plan.installmentFrequency,
    reason: "due",
  };
}

// ---------------------------------------------------------------------------
// Arrears — "overdue from prior periods" (2026-07-14 My Finances redesign)
// ---------------------------------------------------------------------------
//
// `resolveAmountDue` above answers "what's due THIS period" — it never asks
// whether PRIOR periods were actually paid. An owner on a monthly plan who
// missed the last two installments still sees "due: true, amount:
// installmentAmount" (one month) with no signal that they're two months
// behind. `computeArrears` is the sibling pure function that answers the
// other half of the question: how much, if anything, is owed from periods
// that have already closed.
//
// Method: count the number of FULL periods (calendar months / calendar
// quarters) that have elapsed since the plan's `startDate`, up to but not
// including the period `now` falls in (the current period is "due this
// period", handled by `resolveAmountDue` — never double-counted here).
// Multiply by `installmentAmount` to get the cumulative amount that SHOULD
// have been paid by now, cap it at the plan's `totalAmount`, and compare
// against `amountPaid` (the plan's running total, tracked on the
// `payment_plans` row). Any shortfall is the arrears.
//
// Pure function — no DB, no React — parameterized on `now` for deterministic
// tests (missed prior month, quarterly plan, paid-in-full, partial payment).

export interface ArrearsInput extends PaymentPlanInput {
  /** Total amount owed under the plan (principal, and interest if any). */
  totalAmount: number;
  /** Cumulative amount the owner has actually paid against the plan so far. */
  amountPaid: number;
}

export interface ArrearsResolution {
  /** Dollars overdue from periods BEFORE the current one. Never negative. */
  overdueAmount: number;
  /** Whole installments' worth of the overdue amount (for "N payments past due"). */
  overdueInstallments: number;
  /** Cumulative amount that should have been paid by `now`, capped at totalAmount. */
  expectedPaidByNow: number;
}

const ZERO_ARREARS: ArrearsResolution = {
  overdueAmount: 0,
  overdueInstallments: 0,
  expectedPaidByNow: 0,
};

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Number of FULL periods elapsed from `start`'s period up to (but not
 * including) `now`'s period — i.e. periods that have fully closed. The
 * period `start` falls in is period #1 (it was "due this period" the moment
 * the plan began), so a plan that started this month has 0 prior completed
 * periods; a plan that started 2 months ago has 2.
 */
function completedPeriodsSince(
  frequency: PaymentPlanFrequency,
  start: Date,
  now: Date,
): number {
  if (frequency === "quarterly") {
    const startIndex = start.getFullYear() * 4 + quarterIndex(start);
    const nowIndex = now.getFullYear() * 4 + quarterIndex(now);
    return Math.max(0, nowIndex - startIndex);
  }
  if (frequency === "monthly") {
    const startIndex = start.getFullYear() * 12 + start.getMonth();
    const nowIndex = now.getFullYear() * 12 + now.getMonth();
    return Math.max(0, nowIndex - startIndex);
  }
  // Annual / unknown frequency — no canonical period length we can trust for
  // an arrears projection without risking a false positive. Conservatively
  // report no elapsed periods (0 arrears) rather than guess a cadence.
  return 0;
}

/**
 * Resolve "overdue from prior periods" for an owner's payment plan. Sibling
 * of `resolveAmountDue` — together they answer the two distinct questions
 * the redesigned My Finances banner needs: what's due NOW vs. what's
 * OVERDUE from before now.
 */
export function computeArrears(
  plan: ArrearsInput | null | undefined,
  now: Date = new Date(),
): ArrearsResolution {
  if (!plan || plan.status !== "active") return ZERO_ARREARS;

  const installmentAmount = Math.max(0, Number(plan.installmentAmount) || 0);
  if (installmentAmount <= 0) return ZERO_ARREARS;

  const start = toDate(plan.startDate) ?? now;
  const totalAmount = Math.max(0, Number(plan.totalAmount) || 0);
  const amountPaid = Math.max(0, Number(plan.amountPaid) || 0);

  const periodsElapsed = completedPeriodsSince(plan.installmentFrequency, start, now);
  const rawExpected = installmentAmount * periodsElapsed;
  const expectedPaidByNow = round2(totalAmount > 0 ? Math.min(rawExpected, totalAmount) : rawExpected);

  const overdueAmount = round2(Math.max(0, expectedPaidByNow - amountPaid));
  const overdueInstallments =
    overdueAmount > 0 ? Math.max(1, Math.round(overdueAmount / installmentAmount)) : 0;

  return { overdueAmount, overdueInstallments, expectedPaidByNow };
}

// Wire shape for the API surface — what /api/portal/financial-dashboard
// returns under `overdueFromPriorPeriods`. `null` when nothing is overdue,
// so the client can render an honest "nothing overdue" state without
// special-casing a zero-amount object.
export interface OverdueFromPriorPeriods {
  amount: number;
  installmentsOverdue: number;
}

/** Project arrears output to the API shape, or null when nothing is overdue. */
export function toOverdueFromPriorPeriods(
  res: ArrearsResolution,
): OverdueFromPriorPeriods | null {
  if (res.overdueAmount <= 0) return null;
  return { amount: res.overdueAmount, installmentsOverdue: res.overdueInstallments };
}

// Wire shape for the API surface — what /api/portal/financial-dashboard
// returns under `amountDueThisPeriod`. Distinct from `AmountDueResolution`
// because the API only ships when something is due (or explicitly null).
export interface AmountDueThisPeriod {
  amount: number;
  periodLabel: string;
  periodEnd: string;
  frequency: PaymentPlanFrequency;
  reason: AmountDueReason;
}

/** Project resolver output to the API shape, or null when not due. */
export function toAmountDueThisPeriod(
  res: AmountDueResolution,
): AmountDueThisPeriod | null {
  if (!res.due || !res.periodLabel || !res.periodEnd || !res.frequency) return null;
  return {
    amount: res.amount,
    periodLabel: res.periodLabel,
    periodEnd: res.periodEnd,
    frequency: res.frequency,
    reason: res.reason,
  };
}
