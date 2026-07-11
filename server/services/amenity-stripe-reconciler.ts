/**
 * Amenity deposit — Stripe-truth reconciler (A-STRIPE-002).
 *
 * The amenity money loop writes the DB money columns AFTER the Stripe op
 * succeeds, in a separate non-atomic step. A DB failure or crash between a
 * successful Stripe op and the column write leaves money MOVED (captured /
 * released) but the reservation columns unwritten (e.g. still 0). This module
 * reads Stripe truth for the deposit-hold PaymentIntent — located
 * DETERMINISTICALLY by the id persisted at hold time (A-STRIPE-003) — and repairs
 * the columns to match, and never double-writes when they already agree.
 *
 * The core mapping (pure, unit-tested) is `reconcileAmenityDepositColumns`; the
 * live scan that loads reservations, reads their intents, and applies repairs is
 * a thin orchestrator layered on top (deps injected so it stays testable and the
 * live wiring — a route / scheduled reconcile — can land as the follow-on).
 */

/** The Stripe deposit-hold PaymentIntent truth used to derive the columns. */
export interface AmenityDepositIntentSnapshot {
  /** PaymentIntent status: requires_capture | succeeded | canceled | processing | … */
  status: string;
  /** Originally authorized (held) amount, cents. */
  amountCents: number;
  /** Amount actually captured (forfeited → income), cents. 0 for an unresolved/released hold. */
  amountCapturedCents: number;
}

/** The subset of reservation money columns this reconciler owns. */
export interface AmenityDepositColumns {
  depositHeldCents: number;
  depositRefundedCents: number;
  depositForfeitedCents: number;
}

export interface ReconcileResult {
  /** True when the DB columns disagree with Stripe truth and must be written. */
  needsRepair: boolean;
  /** The corrected columns (identical to the input when no repair is needed). */
  columns: AmenityDepositColumns;
  /** Human-readable classification of what was found. */
  reason: string;
}

/**
 * Derive the money columns a deposit-hold PaymentIntent implies, and compare to
 * what the DB currently holds. Pure + deterministic.
 *
 *   requires_capture → authorized, unresolved: held=amount, refunded=0, forfeited=0
 *   succeeded        → captured: forfeited=captured; any un-captured remainder is
 *                      auto-released by Stripe → refunded=amount-captured
 *   canceled         → released entirely: refunded=amount, forfeited=0
 *   other (processing/requires_action/…) → indeterminate, no repair
 */
export function reconcileAmenityDepositColumns(
  current: AmenityDepositColumns,
  intent: AmenityDepositIntentSnapshot,
): ReconcileResult {
  const held = intent.amountCents;
  let truth: AmenityDepositColumns | null = null;

  switch (intent.status) {
    case "requires_capture":
      truth = { depositHeldCents: held, depositRefundedCents: 0, depositForfeitedCents: 0 };
      break;
    case "succeeded": {
      const forfeited = Math.min(intent.amountCapturedCents, held);
      truth = {
        depositHeldCents: held,
        depositForfeitedCents: forfeited,
        // A partial capture auto-releases the remainder of the auth.
        depositRefundedCents: held - forfeited,
      };
      break;
    }
    case "canceled":
      truth = { depositHeldCents: held, depositRefundedCents: held, depositForfeitedCents: 0 };
      break;
    default:
      // Indeterminate (still processing / requires action). Never repair on a
      // non-terminal state — repairing here could race the resolution.
      return { needsRepair: false, columns: current, reason: `indeterminate-status-${intent.status}` };
  }

  const agrees =
    current.depositHeldCents === truth.depositHeldCents &&
    current.depositRefundedCents === truth.depositRefundedCents &&
    current.depositForfeitedCents === truth.depositForfeitedCents;

  if (agrees) {
    return { needsRepair: false, columns: current, reason: `columns-match-${intent.status}` };
  }
  return { needsRepair: true, columns: truth, reason: `repaired-from-${intent.status}` };
}

/** Deps for the live orchestrator — injected so it's testable without live Stripe/db. */
export interface AmenityReconcileDeps {
  /** Read the deposit-hold PaymentIntent truth by its stored id (strongly consistent). */
  readIntent(intentId: string): Promise<AmenityDepositIntentSnapshot | null>;
  /** Persist the repaired columns for a reservation. */
  writeColumns(reservationId: string, columns: AmenityDepositColumns): Promise<void>;
}

/**
 * Reconcile ONE reservation's deposit columns against Stripe truth. Deterministic:
 * uses the stored hold-intent id (no eventually-consistent search). Returns the
 * result; only writes when a repair is needed (never double-writes).
 */
export async function reconcileReservationDeposit(
  reservation: { id: string; depositHoldIntentId: string | null } & AmenityDepositColumns,
  deps: AmenityReconcileDeps,
): Promise<ReconcileResult> {
  if (!reservation.depositHoldIntentId) {
    return {
      needsRepair: false,
      columns: {
        depositHeldCents: reservation.depositHeldCents,
        depositRefundedCents: reservation.depositRefundedCents,
        depositForfeitedCents: reservation.depositForfeitedCents,
      },
      reason: "no-stored-intent-id",
    };
  }

  const intent = await deps.readIntent(reservation.depositHoldIntentId);
  if (!intent) {
    return {
      needsRepair: false,
      columns: {
        depositHeldCents: reservation.depositHeldCents,
        depositRefundedCents: reservation.depositRefundedCents,
        depositForfeitedCents: reservation.depositForfeitedCents,
      },
      reason: "intent-not-found",
    };
  }

  const result = reconcileAmenityDepositColumns(
    {
      depositHeldCents: reservation.depositHeldCents,
      depositRefundedCents: reservation.depositRefundedCents,
      depositForfeitedCents: reservation.depositForfeitedCents,
    },
    intent,
  );

  if (result.needsRepair) {
    await deps.writeColumns(reservation.id, result.columns);
  }
  return result;
}
