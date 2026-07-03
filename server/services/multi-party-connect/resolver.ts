/**
 * Multi-party Connect collection — routing resolver (Flows 2 + 3).
 *
 * Single source of truth for "how should this multi-party charge be routed to
 * Stripe?" Returns null whenever MULTI_PARTY_CONNECT_ENABLED is off, so every
 * existing caller falls through to the unchanged Flow 1 / manual-key path
 * (byte-identical live behavior).
 *
 * The resolver NEVER mutates Stripe state and NEVER returns secret material in
 * a log-safe shape it can leak (it returns only account ids + computed cents;
 * the platform secret key is fetched by the caller via the existing path).
 *
 * INVARIANT (money-transmitter avoidance): every routing produced here settles
 * the principal to the RIGHTFUL party's connected account. The principal NEVER
 * lands in, or passes through, a YCM-controlled balance. YCM only ever takes an
 * `application_fee_amount`. A second party's cut (Flow 3 PM fee) rides as a
 * separate Transfer straight to that party's account.
 */

import { isMultiPartyConnectEnabled } from "./flag";
import { findPmRelationship } from "./storage";
import { findConnectConnection, readConnectStateFromConnection } from "../stripe-connect-storage";
import { computeApplicationFeeCents } from "../stripe-charge-metadata";

/** Flow 2 — PM management fee charge routing. */
export interface Flow2Routing {
  flow: "pm-management-fee";
  /** The PM's connected account — the charge is a DIRECT charge here. */
  stripeAccountHeader: string;
  /** YCM platform fee (cents) attached as application_fee_amount. */
  applicationFeeCents: number;
}

/** Flow 3 — PM-collected owner dues (three-way split) charge routing. */
export interface Flow3Routing {
  flow: "pm-collected-dues";
  /**
   * The account the PRINCIPAL settles to — the charge is a DIRECT charge here.
   * For routing "hoa-direct": the HOA's own connected account.
   * For routing "trust-account": the designated segregated trust account.
   * In BOTH cases this is the rightful holder of the HOA's funds — NEVER YCM.
   */
  stripeAccountHeader: string;
  /** YCM platform fee (cents) attached as application_fee_amount. */
  applicationFeeCents: number;
  /**
   * The PM's cut (cents), to be moved by a SEPARATE Stripe Transfer with
   * `destination = pmTransferDestination`. Sourced from the settling account's
   * balance — never from a YCM balance. Zero when no PM fee is configured.
   */
  pmTransferCents: number;
  /** Destination of the PM transfer — the PM's connected account. */
  pmTransferDestination: string;
  /** Which fund-routing policy was applied (audit/compliance trail). */
  fundRouting: "hoa-direct" | "trust-account";
}

/**
 * Resolve Flow 2 — PM management fee.
 *
 * The PM bills a managed HOA for its management fee. The PM is the merchant of
 * record; the money is the PM's revenue and settles to the PM's connected
 * account via a direct charge + application fee (same shape as Flow 1).
 *
 * Returns null when: flag off, no PM relationship for the HOA, PM account
 * missing, or fee is non-positive.
 *
 * @param managedAssociationId  the HOA being billed (the payer)
 * @param feeAmountCents        the management-fee amount being charged
 */
export async function resolveFlow2ManagementFeeRouting(
  managedAssociationId: string,
  feeAmountCents: number,
): Promise<Flow2Routing | null> {
  if (!isMultiPartyConnectEnabled()) return null;
  if (!managedAssociationId) return null;
  if (!Number.isFinite(feeAmountCents) || feeAmountCents <= 0) return null;

  const rel = await findPmRelationship(managedAssociationId);
  if (!rel?.relationship.pmConnectedAccountId) return null;

  return {
    flow: "pm-management-fee",
    stripeAccountHeader: rel.relationship.pmConnectedAccountId,
    applicationFeeCents: computeApplicationFeeCents(feeAmountCents),
  };
}

/**
 * Resolve Flow 3 — PM collects owner dues on behalf of a managed HOA.
 *
 * Owners pay dues that BELONG to the HOA. The principal settles to the HOA's
 * own connected account (routing "hoa-direct") or a designated trust account
 * (routing "trust-account"); the PM's agreed cut is a separate Transfer to the
 * PM; YCM takes its platform fee. A three-way split that NEVER holds funds at
 * YCM.
 *
 * Returns null when: flag off, no PM relationship, the settling account is not
 * resolvable to an ACTIVE Connect account, trust-account routing selected but
 * no trust account configured, or dues amount is non-positive.
 *
 * @param managedAssociationId  the HOA whose owners pay dues
 * @param duesAmountCents       the dues amount being collected
 */
export async function resolveFlow3OwnerDuesRouting(
  managedAssociationId: string,
  duesAmountCents: number,
): Promise<Flow3Routing | null> {
  if (!isMultiPartyConnectEnabled()) return null;
  if (!managedAssociationId) return null;
  if (!Number.isFinite(duesAmountCents) || duesAmountCents <= 0) return null;

  const rel = await findPmRelationship(managedAssociationId);
  if (!rel?.relationship.pmConnectedAccountId) return null;
  const r = rel.relationship;

  // Determine the principal-settling account per the trust-account decision.
  let settleAccount: string | null = null;
  if (r.flow3Routing === "trust-account") {
    // Option B: the designated trust/escrow account holds the HOA's funds.
    // Hard requirement — never silently fall back to a different routing.
    if (!r.trustAccountId) return null;
    settleAccount = r.trustAccountId;
  } else {
    // Option A (default): dues settle to the HOA's OWN active Connect account.
    const connection = await findConnectConnection(managedAssociationId);
    const state = connection ? readConnectStateFromConnection(connection) : null;
    if (!connection?.providerAccountId || state?.status !== "active") return null;
    settleAccount = connection.providerAccountId;
  }
  if (!settleAccount) return null;

  // PM cut sized by the agreed basis points of the dues principal. Never let
  // the PM cut + the platform fee exceed the principal (degenerate guard).
  const applicationFeeCents = computeApplicationFeeCents(duesAmountCents);
  const pmTransferCents = computePmFeeCents(duesAmountCents, r.pmFeeBps, applicationFeeCents);

  return {
    flow: "pm-collected-dues",
    stripeAccountHeader: settleAccount,
    applicationFeeCents,
    pmTransferCents,
    pmTransferDestination: r.pmConnectedAccountId,
    fundRouting: r.flow3Routing,
  };
}

/**
 * Compute the PM's cut (cents) from basis points of the dues, bounded so that
 * the PM cut never drives (platform fee + PM cut) above the principal.
 *
 * @param duesAmountCents  the dues principal
 * @param pmFeeBps         PM fee in basis points (e.g. 500 = 5.00%); null/<=0 → 0
 * @param applicationFeeCents  YCM's platform fee already computed (reserved)
 */
export function computePmFeeCents(
  duesAmountCents: number,
  pmFeeBps: number | null | undefined,
  applicationFeeCents: number,
): number {
  if (!Number.isFinite(duesAmountCents) || duesAmountCents <= 0) return 0;
  if (typeof pmFeeBps !== "number" || !Number.isFinite(pmFeeBps) || pmFeeBps <= 0) return 0;
  const raw = Math.round((duesAmountCents * pmFeeBps) / 10_000);
  // Keep (platform fee + PM cut) strictly within the principal so the HOA never
  // ends up net-negative on its own dues.
  const headroom = Math.max(0, duesAmountCents - applicationFeeCents);
  return Math.max(0, Math.min(raw, headroom));
}
