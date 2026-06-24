/**
 * Multi-party Connect collection — shared types (Flows 2 + 3).
 *
 * Flow 2: PM collects ITS management fee FROM the HOAs it manages.
 *         Money is the PM's revenue → settles to the PM's connected account.
 * Flow 3: PM collects owner DUES on behalf of a managed HOA.
 *         Money belongs to the HOA → settles to the HOA's connected account;
 *         the PM's agreed fee is transferred to the PM; YCM takes its platform
 *         fee. A three-way split that NEVER lands funds in a YCM-held balance.
 *
 * No live schema migration: the PM relationship is persisted additively in the
 * managed HOA's `payment_gateway_connections.metadataJson._pmRelationship`
 * (mirrors how Connect state was added via `_connect` without a migration).
 */

/** How Flow-3 owner-dues principal is routed (the trust-account decision). */
export type Flow3FundRouting =
  // Option A (default): dues settle directly to the HOA's OWN connected account.
  // The PM never custodies the funds. PM fee is a separate transfer to the PM.
  | "hoa-direct"
  // Option B: dues settle into a designated trust/escrow connected account held
  // for the HOA (distinct from the PM's operating funds). PM fee swept to PM.
  // Requires a configured trust account id; NEVER a YCM-controlled balance.
  | "trust-account";

/**
 * The PM relationship persisted on a managed HOA's gateway row.
 * `metadataJson._pmRelationship`.
 */
export interface PmRelationshipState {
  mode: "pm-relationship";
  /** The PM's Stripe connected account (`acct_…`) — the PM's own account. */
  pmConnectedAccountId: string;
  /** Human label for the PM (for admin listings). */
  pmDisplayName: string | null;
  /**
   * The PM's agreed fee for THIS managed HOA, expressed as basis points of the
   * collected dues (e.g. 500 = 5.00%). Used in Flow 3 to size the PM transfer.
   * For Flow 2 (PM billing the HOA directly) the management-fee amount is the
   * charge itself, not a split, so this is unused there.
   */
  pmFeeBps: number | null;
  /**
   * Flow-3 fund-routing policy. Defaults to "hoa-direct" (Option A). When
   * "trust-account", `trustAccountId` must be set. The DEFAULT is conservative
   * and the build hardcodes NO compliance assumption — see the design doc.
   */
  flow3Routing: Flow3FundRouting;
  /**
   * For Flow3Routing = "trust-account": the designated segregated/trust
   * connected account (`acct_…`) that holds the HOA's funds, distinct from the
   * PM's operating account. NEVER a YCM-controlled balance.
   */
  trustAccountId: string | null;
  /** ISO timestamp of last write. */
  updatedAt: string;
}

/** Input to upsert a PM relationship onto a managed HOA. */
export interface UpsertPmRelationshipInput {
  /** The managed HOA's association id (the relationship is keyed to it). */
  managedAssociationId: string;
  pmConnectedAccountId: string;
  pmDisplayName?: string | null;
  pmFeeBps?: number | null;
  flow3Routing?: Flow3FundRouting;
  trustAccountId?: string | null;
}
