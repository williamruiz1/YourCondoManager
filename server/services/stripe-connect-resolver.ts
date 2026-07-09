/**
 * Stripe Connect — charge-routing resolver.
 *
 * Single source of truth for "how should a dues charge for association X be
 * routed to Stripe?" There are two coexisting payment models in YCM:
 *
 *   1. CONNECT (Standard sub-merchant) — platform secret key + `Stripe-Account`
 *      header → a DIRECT charge on the HOA's connected account, with an
 *      `application_fee_amount` routed to the YCM platform balance (spec §1.1,
 *      §1.2). Money lands in the HOA's own Stripe balance and pays out to the
 *      HOA's own bank. This is the canonical platform model (founder-os/wiki/
 *      products/ycm/stripe-connect-spec.md §1).
 *
 *   2. MANUAL (bring-your-own-key) — the HOA pasted its OWN Stripe secret key
 *      into `payment_gateway_connections` (legacy / pre-Connect path). Charges
 *      go directly on the HOA's own Stripe account using that key. No platform
 *      header, no application fee.
 *
 * This resolver answers: for a given association, is there an ACTIVE Connect
 * sub-merchant we should route through? If yes, the caller charges via the
 * platform key + header (Connect). If no, the caller keeps its existing
 * manual-key behavior UNCHANGED. The resolver NEVER mutates Stripe state and
 * NEVER returns secret material in any log-safe shape it can leak.
 *
 * Reversibility: this is purely additive. A non-Connect association (the only
 * kind that exists today) resolves to `null` and the legacy manual-key path
 * runs exactly as before.
 */

import { assertStripeKeySafe } from "../staging-guard";
import { findConnectConnection, readConnectStateFromConnection } from "./stripe-connect-storage";
import { getSecret } from "../platform-secrets-store";

export interface ConnectChargeRouting {
  /** The connected account id (`acct_…`) to set in the `Stripe-Account` header. */
  stripeAccountHeader: string;
  /** The PLATFORM secret key (not the HOA's) used to authenticate the direct charge. */
  platformSecretKey: string;
  /** The connected account's current Connect status (always "active" when returned). */
  status: "active";
}

/**
 * Resolve Connect charge routing for an association.
 *
 * Returns the platform-key + connected-account header ONLY when the
 * association has a Connect connection whose status is `active`
 * (charges_enabled && payouts_enabled && details_submitted). In every other
 * case — no Connect row, pending/restricted/disabled onboarding, or platform
 * key not configured — returns `null` so the caller falls back to its existing
 * manual-key path.
 *
 * Why gate on `active`: routing a charge to a connected account that can't yet
 * accept charges (pending KYC) would fail at Stripe with a confusing error.
 * Falling back to manual until Connect is fully active is the safe default.
 */
export async function resolveConnectChargeRouting(
  associationId: string,
): Promise<ConnectChargeRouting | null> {
  if (!associationId) return null;

  const connection = await findConnectConnection(associationId);
  if (!connection?.providerAccountId) return null;

  const connectState = readConnectStateFromConnection(connection);
  if (!connectState || connectState.status !== "active") return null;

  const platformSecretKey = await getSecret(
    "PLATFORM_STRIPE_SECRET_KEY",
    "platform_stripe_secret_key",
  );
  if (!platformSecretKey) return null;
  assertStripeKeySafe(platformSecretKey); // founder-os#10193 F0 — refuse live Stripe key in staging

  return {
    stripeAccountHeader: connection.providerAccountId,
    platformSecretKey,
    status: "active",
  };
}
