/**
 * Payment edge-case math — partial / overpayment / refund on the owner ledger
 * (readiness P2-1 / Issue #216).
 *
 * DB-FREE on purpose, mirroring `account-statement-math.ts`: the allocation +
 * reversal logic is pure over its inputs (current ledger rows + an incoming
 * payment, or a payment row to reverse), so it can be unit-tested without a
 * Postgres connection. A DB-backed caller can layer on top of these functions
 * to actually insert the rows it returns.
 *
 * ── The ledger model (source of truth: `owner_ledger_entries`) ───────────────
 *
 * Amounts are SIGNED dollars:
 *   - charge / assessment / late-fee  → POSITIVE  (owner owes more)
 *   - payment / credit / adjustment   → NEGATIVE  (owner owes less)
 *
 * The owner's balance is the simple signed sum of all entries — exactly as
 * `getOwnerLedgerSummary` (storage.ts) and `computeStatement`
 * (account-statement-math.ts) compute it (`balance += entry.amount`):
 *
 *     balance > 0  → owner owes the association (open receivable)
 *     balance = 0  → owner is square
 *     balance < 0  → owner has a CREDIT balance (association owes the owner;
 *                    carries forward against the next charge)
 *
 * There is no per-charge allocation table in this schema: a payment is a single
 * negative row that reduces the running balance. That makes the three edge
 * cases fall out of the signed-sum invariant, which is what this module makes
 * explicit and provable:
 *
 *   PARTIAL     payment < balance owed → balance stays positive (remaining due).
 *   EXACT       payment == balance owed → balance goes to 0.
 *   OVERPAYMENT payment > balance owed → balance goes NEGATIVE (a credit that
 *               carries forward). The "credit portion" is surfaced explicitly
 *               so callers/UI can show "$X applied, $Y credit on account".
 *   REFUND      reverse a prior payment/credit cleanly → restore the balance by
 *               posting an equal-and-opposite `adjustment` row (forward-only;
 *               we never delete or mutate the original row, mirroring the
 *               forward-only GL convention).
 *
 * The invariant every function preserves:
 *
 *     newBalance === priorBalance + Σ(returned entry amounts)
 */

export type LedgerEntryType =
  | "charge"
  | "assessment"
  | "payment"
  | "late-fee"
  | "credit"
  | "adjustment";

/** The charge-side entry types (POSITIVE — owner owes more). */
export const CHARGE_TYPES: ReadonlySet<string> = new Set([
  "charge",
  "assessment",
  "late-fee",
]);

/** The credit-side entry types (NEGATIVE — owner owes less). */
export const CREDIT_TYPES: ReadonlySet<string> = new Set([
  "payment",
  "credit",
  "adjustment",
]);

/**
 * Minimal ledger-entry shape the edge-case math needs. Structural (not the
 * full Drizzle row) so the pure computation stays decoupled from the schema —
 * same approach as `StatementLedgerEntry`.
 */
export interface LedgerEntryLike {
  id: string;
  entryType: LedgerEntryType | string;
  amount: number; // signed dollars
  postedAt: Date;
  description?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
}

/**
 * A row this module proposes the caller INSERT. No `id`/`createdAt` — the DB
 * assigns those. `amount` is already signed per the ledger convention
 * (payments/credits/adjustments negative; charge-side positive).
 */
export interface ProposedLedgerEntry {
  entryType: LedgerEntryType;
  amount: number; // signed dollars
  postedAt: Date;
  description: string;
  referenceType: string;
  referenceId: string;
}

const ROUND = (n: number): number => Math.round(n * 100) / 100;

/**
 * The owner's CURRENT balance = signed sum of all entries.
 *   > 0 owes; = 0 square; < 0 credit on account.
 */
export function computeBalance(entries: LedgerEntryLike[]): number {
  let balance = 0;
  for (const e of entries) balance += Number(e.amount) || 0;
  return ROUND(balance);
}

// ── Apply an incoming payment ────────────────────────────────────────────────

export type PaymentApplicationKind = "partial" | "exact" | "overpayment";

export interface ApplyPaymentResult {
  /** Classification of how the payment lands against the prior balance. */
  kind: PaymentApplicationKind;
  /** Owner balance BEFORE this payment (signed; >0 owed, <0 credit). */
  priorBalance: number;
  /** Amount that actually retired open receivable (>= 0, <= payment). */
  appliedToBalance: number;
  /**
   * Portion of the payment that exceeds what was owed and becomes a credit
   * carried forward (>= 0). For partial/exact this is 0.
   */
  creditCreated: number;
  /** Owner balance AFTER this payment (signed). Negative === credit on account. */
  newBalance: number;
  /** Remaining open receivable after this payment (>= 0; 0 once square/credit). */
  remainingDue: number;
  /** The single ledger row to insert for this payment. */
  entry: ProposedLedgerEntry;
}

/**
 * Apply an incoming payment of `paymentAmount` (a POSITIVE dollar figure — the
 * money received) against the owner's current ledger.
 *
 * Returns the (single) `payment` row to insert plus a full breakdown of how it
 * lands: how much retired open balance, how much became a carry-forward credit
 * (overpayment), and the resulting balance.
 *
 * Edge cases handled:
 *   - PARTIAL: paymentAmount < amount owed → remainingDue > 0.
 *   - EXACT: paymentAmount == amount owed → newBalance 0.
 *   - OVERPAYMENT: paymentAmount > amount owed → creditCreated > 0,
 *     newBalance < 0 (carries forward against the next charge automatically,
 *     since balance is a running signed sum).
 *   - Paying INTO an existing credit (priorBalance <= 0): the entire payment is
 *     "overpayment" (creditCreated == paymentAmount; nothing was owed).
 */
export function applyPayment(params: {
  entries: LedgerEntryLike[];
  paymentAmount: number;
  postedAt: Date;
  description?: string;
  /** entryType for the row — defaults to "payment". Use "credit" for non-cash credits. */
  entryType?: "payment" | "credit";
  referenceType?: string;
  referenceId?: string;
}): ApplyPaymentResult {
  // Require a POSITIVE, finite figure. Callers pass the money received as a
  // positive dollar amount; a negative/zero/NaN input is a caller error we
  // refuse rather than silently coerce (money correctness > convenience).
  if (!(Number.isFinite(params.paymentAmount) && params.paymentAmount > 0)) {
    throw new Error("paymentAmount must be a positive, finite dollar figure");
  }
  const amount = ROUND(params.paymentAmount);

  const priorBalance = computeBalance(params.entries);
  // Open receivable that this payment can retire (never negative — if the owner
  // already has a credit, nothing is owed).
  const owed = Math.max(0, priorBalance);
  const appliedToBalance = ROUND(Math.min(amount, owed));
  const creditCreated = ROUND(amount - appliedToBalance);
  // Payments are stored NEGATIVE per the ledger convention.
  const newBalance = ROUND(priorBalance - amount);
  const remainingDue = ROUND(Math.max(0, newBalance));

  let kind: PaymentApplicationKind;
  if (creditCreated > 0) kind = "overpayment";
  else if (newBalance === 0) kind = "exact";
  else kind = "partial";

  const entryType = params.entryType ?? "payment";
  const entry: ProposedLedgerEntry = {
    entryType,
    amount: ROUND(-amount), // negative — credit against charges
    postedAt: params.postedAt,
    description:
      params.description ??
      (kind === "overpayment"
        ? `Payment $${amount.toFixed(2)} ($${appliedToBalance.toFixed(2)} applied, $${creditCreated.toFixed(2)} credit on account)`
        : kind === "partial"
          ? `Partial payment $${amount.toFixed(2)} ($${remainingDue.toFixed(2)} remaining)`
          : `Payment $${amount.toFixed(2)}`),
    referenceType: params.referenceType ?? `${entryType}-edge-case`,
    referenceId: params.referenceId ?? "-",
  };

  return {
    kind,
    priorBalance,
    appliedToBalance,
    creditCreated,
    newBalance,
    remainingDue,
    entry,
  };
}

// ── Refund / reversal of a prior payment or credit ───────────────────────────

export interface RefundResult {
  /** Owner balance BEFORE the reversal (signed). */
  priorBalance: number;
  /** The original entry being reversed (echoed for the caller's audit trail). */
  reversedEntryId: string;
  /** Positive dollar figure restored to the balance (the magnitude reversed). */
  amountReversed: number;
  /** Owner balance AFTER the reversal (signed). */
  newBalance: number;
  /** The equal-and-opposite `adjustment` row to insert (forward-only). */
  entry: ProposedLedgerEntry;
}

/**
 * Reverse a prior payment/credit by posting an equal-and-opposite `adjustment`
 * row (forward-only — the original row is NEVER deleted or mutated, mirroring
 * the GL forward-only convention).
 *
 * A refund of a $200 payment (stored as `payment` amount −200) posts a +200
 * `adjustment`, restoring the balance the owner owed. The pair nets to zero, so
 * the ledger reflects "money was received then returned" without losing
 * history.
 *
 * @param target  The original payment/credit entry being refunded. MUST be a
 *                credit-side row (payment/credit) with a negative amount.
 * @param amount  Optional partial-refund magnitude (positive dollars). When
 *                omitted, the FULL original amount is reversed. Must not exceed
 *                the magnitude of the original entry.
 */
export function reversePayment(params: {
  entries: LedgerEntryLike[];
  target: LedgerEntryLike;
  amount?: number;
  postedAt: Date;
  description?: string;
  referenceType?: string;
  referenceId?: string;
}): RefundResult {
  const { target } = params;
  if (!CREDIT_TYPES.has(target.entryType)) {
    throw new Error(
      `Can only reverse a credit-side entry (payment/credit/adjustment); got "${target.entryType}"`,
    );
  }
  const originalMagnitude = ROUND(Math.abs(Number(target.amount) || 0));
  if (!(originalMagnitude > 0)) {
    throw new Error("Target entry has no reversible amount");
  }
  // A credit-side payment/credit must be negative to be reversible as a refund
  // (a positive "adjustment" is a charge-side correction, not a refundable
  // receipt). Guard against reversing the wrong sign.
  if ((Number(target.amount) || 0) > 0) {
    throw new Error(
      "Target entry amount is positive (a charge-side correction); not a refundable receipt",
    );
  }

  const amountReversed = ROUND(
    params.amount !== undefined ? Math.abs(params.amount) : originalMagnitude,
  );
  if (!(amountReversed > 0)) {
    throw new Error("Refund amount must be positive");
  }
  if (amountReversed > originalMagnitude + 1e-9) {
    throw new Error(
      `Refund amount $${amountReversed.toFixed(2)} exceeds original $${originalMagnitude.toFixed(2)}`,
    );
  }

  const priorBalance = computeBalance(params.entries);
  // Reversing a credit ADDS back to the balance (owner owes again / credit shrinks).
  const newBalance = ROUND(priorBalance + amountReversed);

  const entry: ProposedLedgerEntry = {
    entryType: "adjustment",
    amount: ROUND(amountReversed), // POSITIVE — reverses the negative receipt
    postedAt: params.postedAt,
    description:
      params.description ??
      (amountReversed < originalMagnitude
        ? `Partial refund $${amountReversed.toFixed(2)} of ${target.entryType} (reverses entry ${target.id})`
        : `Refund $${amountReversed.toFixed(2)} — reversal of ${target.entryType} (entry ${target.id})`),
    referenceType: params.referenceType ?? "refund-reversal",
    // Tie the reversal back to the original entry so the audit trail links the pair.
    referenceId: params.referenceId ?? target.id,
  };

  return {
    priorBalance,
    reversedEntryId: target.id,
    amountReversed,
    newBalance,
    entry,
  };
}

// ── Convenience: full picture after applying a proposed entry ─────────────────

/**
 * Verify the core invariant for a proposed entry against a set of priors:
 *   newBalance === priorBalance + entry.amount
 * Returns the recomputed balance so callers/tests can assert it.
 */
export function balanceAfter(
  entries: LedgerEntryLike[],
  proposed: ProposedLedgerEntry,
): number {
  return ROUND(computeBalance(entries) + proposed.amount);
}
