/**
 * Refund Service — Connect direct-charge refunds with proportional
 * application-fee refund (payment-correctness hardening 2026-06-30, issue #286).
 *
 * CRITICAL Connect best-practice finding:
 *   On Connect DIRECT charges, refunding does NOT automatically refund the
 *   application fee. Refunding an HOA dues charge WITHOUT `refund_application_fee`
 *   silently makes the HOA eat YCM's platform fee (the 1% app fee stays on the
 *   platform balance while the HOA balance is debited the full refund).
 *
 *   Therefore: refunds default to `refund_application_fee=true`, so Stripe
 *   refunds the application fee PROPORTIONALLY with the refund amount and the
 *   HOA never loses YCM's fee on a refund.
 *
 * SAFETY:
 *   - Gated by REFUNDS_ENABLED (default OFF) — a money-moving path stays
 *     reversible until explicitly turned on.
 *   - Only runs against a connected account with ACTIVE Connect routing; if the
 *     association has no active routing, the refund is REJECTED (never silently
 *     refunded on the wrong account).
 *   - Idempotency-Key keyed by charge+amount so a retry can't double-refund.
 *   - Never logs or returns the platform secret key.
 */

import { resolveConnectChargeRouting } from "./stripe-connect-resolver";
import { callPlatformStripe } from "./stripe-connect";
import { refundKey } from "./stripe-idempotency";

/** REFUNDS_ENABLED feature flag — DEFAULT OFF (reversible). */
export function isRefundsEnabled(): boolean {
  const raw = (process.env.REFUNDS_ENABLED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export interface RefundConnectChargeParams {
  associationId: string;
  /** The Stripe charge id (`ch_…` or `py_…`) on the connected account. */
  chargeId: string;
  /** Optional partial-refund amount in cents. Omit for a full refund. */
  amountCents?: number | null;
  /** Optional Stripe refund reason: duplicate | fraudulent | requested_by_customer. */
  reason?: "duplicate" | "fraudulent" | "requested_by_customer" | null;
  /**
   * Whether to refund the application fee proportionally with the refund.
   * DEFAULT true — so the HOA never loses YCM's platform fee on a refund.
   */
  refundApplicationFee?: boolean;
  /**
   * A-STRIPE-005: optional per-refund-request disambiguator for the Stripe
   * Idempotency-Key. STABLE across network retries of the SAME refund request
   * (so a true retry still collapses), DISTINCT per new refund action (so two
   * equal-amount partial refunds of one charge don't collapse into one). When
   * omitted, the key keeps the prior (charge, amount) grain.
   */
  refundRequestId?: string | null;
}

export interface RefundResult {
  refundId: string;
  status: string | null;
  amountCents: number | null;
  applicationFeeRefunded: boolean;
  /** The connected account the refund was issued against. */
  connectedAccountId: string;
}

/**
 * Issue a refund on a Connect direct charge with proportional app-fee refund.
 *
 * @throws if REFUNDS_ENABLED is off, or the association has no active Connect
 *         routing, or Stripe rejects the refund.
 */
export async function refundConnectCharge(
  params: RefundConnectChargeParams,
): Promise<RefundResult> {
  if (!isRefundsEnabled()) {
    throw new Error("Refunds are disabled (REFUNDS_ENABLED is off)");
  }
  if (!params.chargeId) {
    throw new Error("chargeId is required");
  }
  if (params.amountCents != null && params.amountCents <= 0) {
    throw new Error("Refund amount must be positive");
  }

  // Refund MUST be issued on the connected account that took the charge,
  // authenticated with the PLATFORM key (Stripe-Account header). If the
  // association has no active Connect routing, we cannot safely refund.
  const routing = await resolveConnectChargeRouting(params.associationId);
  if (!routing) {
    throw new Error(
      "No active Stripe Connect account for this association — cannot issue a Connect refund",
    );
  }

  const refundApplicationFee = params.refundApplicationFee !== false; // default true

  const body = new URLSearchParams();
  body.set("charge", params.chargeId);
  if (params.amountCents != null) {
    body.set("amount", String(params.amountCents));
  }
  if (params.reason) {
    body.set("reason", params.reason);
  }
  // Proportional application-fee refund — the load-bearing correctness fix.
  // Stripe refunds the app fee in proportion to the refund amount when true.
  body.set("refund_application_fee", refundApplicationFee ? "true" : "false");

  const refund = await callPlatformStripe<{
    id: string;
    status?: string;
    amount?: number;
  }>({
    method: "POST",
    path: "/refunds",
    body,
    stripeAccount: routing.stripeAccountHeader,
    idempotencyKey: refundKey({
      chargeId: params.chargeId,
      amountCents: params.amountCents,
      refundRequestId: params.refundRequestId,
    }),
  });

  return {
    refundId: refund.id,
    status: typeof refund.status === "string" ? refund.status : null,
    amountCents: typeof refund.amount === "number" ? refund.amount : params.amountCents ?? null,
    applicationFeeRefunded: refundApplicationFee,
    connectedAccountId: routing.stripeAccountHeader,
  };
}
