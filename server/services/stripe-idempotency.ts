/**
 * Stripe Idempotency-Key helpers (payment-correctness hardening 2026-06-30).
 *
 * Every Stripe POST that CREATES or MOVES money must carry a stable
 * `Idempotency-Key` so a network retry returns the original result instead of
 * creating a second charge / refund / session. Stripe stores the result of the
 * first request keyed by the header for 24h and replays it on a retry.
 *
 * The keys are DETERMINISTIC per logical operation so that an automatic retry
 * (same operation, same inputs) collapses to one money movement:
 *   - checkout session  → keyed by the YCM transaction id (one session per txn)
 *   - off-session charge → keyed by the YCM transaction id (one intent per txn)
 *   - payment intent     → keyed by assoc + unit + period + amount (one intent
 *                          per dues period per unit)
 *   - refund             → keyed by charge + amount (one refund of a given
 *                          magnitude on a given charge)
 *
 * SAFETY: a distinct logical operation must produce a DISTINCT key, otherwise
 * Stripe would replay a stale result. We therefore include the amount in every
 * key so a *different* amount (e.g. a partial refund vs full) is a new key.
 *
 * Keys are <= 255 chars (Stripe limit) and contain only url-safe characters.
 */

const PREFIX = "ycm";

/** Sanitize a key segment to url-safe chars and bound its length. */
function seg(value: string | number | null | undefined): string {
  return String(value ?? "none")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 64);
}

function join(parts: Array<string | number | null | undefined>): string {
  const key = [PREFIX, ...parts.map(seg)].join(":");
  // Stripe caps Idempotency-Key at 255 chars.
  return key.slice(0, 255);
}

/** Checkout session create — one hosted session per logical transaction. */
export function checkoutSessionKey(transactionId: string): string {
  return join(["checkout", transactionId]);
}

/**
 * Owner payment-LINK hosted checkout — one session per (link, amount, period).
 * A partial-pay link can be paid for different amounts, so amount is part of the
 * grain; a network retry of the SAME amount in the SAME period collapses.
 */
export function paymentLinkCheckoutKey(params: {
  linkToken: string;
  amountCents: number;
  period: string;
}): string {
  return join([
    "linkco",
    params.linkToken,
    params.amountCents,
    params.period,
  ]);
}

/** Off-session charge (autopay / retry) — one intent per logical transaction. */
export function offSessionChargeKey(transactionId: string): string {
  return join(["charge", transactionId]);
}

/**
 * Payment intent create — keyed by the dues grain so a retry of the same
 * period+unit+amount collapses. Period is an ISO month (e.g. "2026-06").
 */
export function paymentIntentKey(params: {
  associationId: string;
  unitId: string;
  period: string;
  amountCents: number;
}): string {
  return join([
    "pi",
    params.associationId,
    params.unitId,
    params.period,
    params.amountCents,
  ]);
}

/**
 * Refund — keyed by the charge + an optional per-refund-request disambiguator.
 *
 * A true NETWORK RETRY of a single logical refund passes the SAME `requestId`
 * (or omits it and repeats the same charge+amount) → the key collapses and
 * Stripe replays the first refund. Two LEGITIMATELY DISTINCT refunds of the same
 * charge and the same magnitude (e.g. refund $25, then a separate $25 later)
 * within Stripe's ~24h idempotency window are DISTINCT operations — the caller
 * supplies a distinct `requestId` (a per-refund-request id / attempt nonce) so
 * they produce DISTINCT keys and Stripe issues both (A-STRIPE-005).
 *
 * `amountCents` null = full refund (use "full" sentinel so it's stable). When no
 * `requestId` is supplied the key degrades to the legacy charge+amount grain
 * (a retry-collapse of one logical refund) — back-compatible.
 */
export function refundKey(params: {
  chargeId: string;
  amountCents: number | null | undefined;
  /**
   * Per-refund-request disambiguator. Same value across a retry of ONE logical
   * refund (collapse); distinct value for a distinct refund operation (both
   * succeed). Omit for the legacy charge+amount retry-collapse grain.
   */
  requestId?: string | null;
}): string {
  return join([
    "refund",
    params.chargeId,
    params.amountCents == null ? "full" : params.amountCents,
    ...(params.requestId ? [params.requestId] : []),
  ]);
}

/**
 * Amenity deposit FORFEIT (capture-the-hold → income). Keyed by the reservation
 * + the captured amount so a network retry of the same forfeit collapses to one
 * capture, while distinct partial forfeits of DIFFERENT amounts are distinct
 * keys (A-STRIPE-001). A same-amount second forfeit of one reservation is
 * blocked at the service layer by the unresolved-deposit invariant.
 */
export function amenityForfeitKey(params: { reservationId: string; amountCents: number }): string {
  return join(["amn-forfeit", params.reservationId, params.amountCents]);
}

/**
 * Amenity deposit REFUND (cancel/release the uncaptured hold). Keyed by the
 * reservation + the released amount so a network retry collapses to one release
 * (A-STRIPE-001).
 */
export function amenityRefundKey(params: { reservationId: string; amountCents: number }): string {
  return join(["amn-refund", params.reservationId, params.amountCents]);
}
