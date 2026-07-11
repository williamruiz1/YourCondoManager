/**
 * Default (production) Stripe gateway for the amenity money loop.
 *
 * Dispatch:  founder-os#10181 (YCM #329) — the real-Stripe backing for
 *            amenity-money-service.ts's injectable `AmenityMoneyGateway`.
 *
 * Reuses the SAME Stripe PaymentIntent + Connect + application-fee pattern as
 * dues (server/services/payment-service.ts `chargeOffSession` + the connect
 * resolver). The four money ops map to Stripe as:
 *
 *   chargeFee      → PaymentIntent (immediate capture)              — usage fee → income
 *   holdDeposit    → PaymentIntent capture_method=manual (auth-hold) — refundable deposit
 *   refundDeposit  → cancel the uncaptured hold (releases the auth)  — clean checkout
 *   forfeitDeposit → capture the hold (amount_to_capture)            — damage/violation → income
 *
 * SAFETY: this gateway is resolved LAZILY and only ever runs for an association
 * that is already `isGlEnabledForAssociation`-gated by the caller (the amenity
 * money service short-circuits before this is even constructed for a
 * non-allowlisted association). If the resident has no active saved payment
 * method, or the association has no Stripe/Connect config, every op returns
 * `{ ok: false, reason: "payment-context-unavailable" }` — the money capture
 * becomes a clean no-op and the booking/resolution still succeeds. It NEVER
 * fabricates money movement.
 *
 * The deposit hold's PaymentIntent carries `metadata[amenityReservationId]` +
 * `metadata[amenityDepositHold]=true` so refund/forfeit can locate it without a
 * new schema column (forward-only: no migration).
 */

import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import { savedPaymentMethods } from "@shared/schema";
import { resolveConnectChargeRouting } from "./stripe-connect-resolver";
import { storage } from "../storage";
import { amenityForfeitKey, amenityRefundKey } from "./stripe-idempotency";
import type { AmenityMoneyGateway, AmenityGatewayResult } from "./amenity-money-service";

const STRIPE_API = "https://api.stripe.com/v1";
const UNAVAILABLE: AmenityGatewayResult = { ok: false, reason: "payment-context-unavailable" };

interface StripeContext {
  secretKey: string;
  stripeAccountHeader: string | null;
  customerId: string;
  paymentMethodId: string;
}

async function resolveStripeContext(associationId: string, personId: string): Promise<StripeContext | null> {
  // The resident's default active saved payment method (customer + method ids).
  const [method] = await db
    .select()
    .from(savedPaymentMethods)
    .where(
      and(
        eq(savedPaymentMethods.personId, personId),
        eq(savedPaymentMethods.associationId, associationId),
        eq(savedPaymentMethods.isActive, 1),
      ),
    )
    .orderBy(desc(savedPaymentMethods.isDefault))
    .limit(1);

  if (
    !method ||
    method.status !== "active" ||
    !method.providerCustomerId ||
    !method.providerPaymentMethodId
  ) {
    return null;
  }

  const connectRouting = await resolveConnectChargeRouting(associationId);
  const gateway = await storage.getActivePaymentGatewayConnection({ associationId });
  const secretKey = connectRouting?.platformSecretKey ?? gateway?.secretKey ?? null;
  if (!secretKey) return null;

  return {
    secretKey,
    stripeAccountHeader: connectRouting?.stripeAccountHeader ?? null,
    customerId: method.providerCustomerId,
    paymentMethodId: method.providerPaymentMethodId,
  };
}

function headers(ctx: StripeContext, idempotencyKey?: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${ctx.secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (ctx.stripeAccountHeader) h["Stripe-Account"] = ctx.stripeAccountHeader;
  if (idempotencyKey) h["Idempotency-Key"] = idempotencyKey;
  return h;
}

async function stripePost(
  path: string,
  ctx: StripeContext,
  params: URLSearchParams,
  idempotencyKey?: string,
): Promise<{ ok: boolean; body: Record<string, unknown> | null }> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: headers(ctx, idempotencyKey),
    body: params.toString(),
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: res.ok && !!body && typeof body.id === "string", body };
}

/**
 * Resolve the deposit-hold PaymentIntent id for a reservation.
 *
 * A-STRIPE-003: prefer the id PERSISTED at hold time (passed in by the caller) —
 * a strongly-consistent, direct reference. Fall back to the eventually-consistent
 * Stripe Search API only for legacy reservations that predate the stored column.
 */
async function resolveDepositHoldIntent(
  ctx: StripeContext,
  reservationId: string,
  storedIntentId?: string | null,
): Promise<string | null> {
  if (storedIntentId) return storedIntentId;
  const query = encodeURIComponent(
    `metadata['amenityReservationId']:'${reservationId}' AND metadata['amenityDepositHold']:'true'`,
  );
  const res = await fetch(`${STRIPE_API}/payment_intents/search?query=${query}`, {
    method: "GET",
    headers: headers(ctx),
  });
  const body = (await res.json().catch(() => null)) as { data?: Array<{ id: string }> } | null;
  const hit = body?.data?.[0];
  return hit?.id ?? null;
}

/**
 * Construct the production amenity Stripe gateway for one reservation's resident.
 * Every method degrades to `payment-context-unavailable` (a clean no-op) when the
 * resident has no active saved payment method or the association isn't Stripe-wired.
 */
export function createStripeAmenityGateway(opts: {
  associationId: string;
  personId: string;
}): AmenityMoneyGateway {
  const { associationId, personId } = opts;

  return {
    async chargeFee({ reservationId, amountCents }): Promise<AmenityGatewayResult> {
      const ctx = await resolveStripeContext(associationId, personId);
      if (!ctx) return UNAVAILABLE;
      const params = new URLSearchParams();
      params.set("amount", String(amountCents));
      params.set("currency", "usd");
      params.set("customer", ctx.customerId);
      params.set("payment_method", ctx.paymentMethodId);
      params.set("off_session", "true");
      params.set("confirm", "true");
      params.set("description", "Amenity usage fee");
      params.set("metadata[amenityReservationId]", reservationId);
      params.set("metadata[amenityFee]", "true");
      const { ok, body } = await stripePost("/payment_intents", ctx, params, `amn-fee-${reservationId}`);
      if (!ok) return { ok: false, reason: "fee-charge-failed" };
      const status = body?.status as string | undefined;
      return status === "succeeded"
        ? { ok: true, intentId: body!.id as string }
        : { ok: false, intentId: (body?.id as string) ?? null, reason: `fee-status-${status}` };
    },

    async holdDeposit({ reservationId, amountCents }): Promise<AmenityGatewayResult> {
      const ctx = await resolveStripeContext(associationId, personId);
      if (!ctx) return UNAVAILABLE;
      const params = new URLSearchParams();
      params.set("amount", String(amountCents));
      params.set("currency", "usd");
      params.set("customer", ctx.customerId);
      params.set("payment_method", ctx.paymentMethodId);
      params.set("capture_method", "manual"); // AUTH-AND-HOLD — money not yet moved.
      params.set("off_session", "true");
      params.set("confirm", "true");
      params.set("description", "Amenity refundable deposit (hold)");
      params.set("metadata[amenityReservationId]", reservationId);
      params.set("metadata[amenityDepositHold]", "true");
      const { ok, body } = await stripePost("/payment_intents", ctx, params, `amn-deposit-${reservationId}`);
      if (!ok) return { ok: false, reason: "deposit-hold-failed" };
      const status = body?.status as string | undefined;
      // A manual-capture hold sits at `requires_capture` once authorized.
      return status === "requires_capture" || status === "succeeded"
        ? { ok: true, intentId: body!.id as string }
        : { ok: false, intentId: (body?.id as string) ?? null, reason: `deposit-status-${status}` };
    },

    async refundDeposit({ reservationId, amountCents, holdIntentId }): Promise<AmenityGatewayResult> {
      const ctx = await resolveStripeContext(associationId, personId);
      if (!ctx) return UNAVAILABLE;
      const holdId = await resolveDepositHoldIntent(ctx, reservationId, holdIntentId);
      if (!holdId) return { ok: false, reason: "deposit-hold-not-found" };
      // Clean checkout: cancel the uncaptured auth-hold — releases the money,
      // never captured, nothing leaves the resident's account.
      // A-STRIPE-001: stable Idempotency-Key so a retry re-reads the release
      // rather than error-looping on an already-canceled intent.
      const { ok, body } = await stripePost(
        `/payment_intents/${holdId}/cancel`,
        ctx,
        new URLSearchParams(),
        amenityRefundKey({ reservationId, amountCents }),
      );
      if (!ok) return { ok: false, reason: "deposit-refund-failed" };
      return { ok: true, intentId: body!.id as string };
    },

    async forfeitDeposit({ reservationId, amountCents, holdIntentId }): Promise<AmenityGatewayResult> {
      const ctx = await resolveStripeContext(associationId, personId);
      if (!ctx) return UNAVAILABLE;
      const holdId = await resolveDepositHoldIntent(ctx, reservationId, holdIntentId);
      if (!holdId) return { ok: false, reason: "deposit-hold-not-found" };
      // Damage/violation: capture (some/all of) the hold → income.
      // A-STRIPE-001: stable Idempotency-Key so a retry does not double-capture.
      const params = new URLSearchParams();
      params.set("amount_to_capture", String(amountCents));
      const { ok, body } = await stripePost(
        `/payment_intents/${holdId}/capture`,
        ctx,
        params,
        amenityForfeitKey({ reservationId, amountCents }),
      );
      if (!ok) return { ok: false, reason: "deposit-forfeit-failed" };
      return { ok: true, intentId: body!.id as string };
    },
  };
}
