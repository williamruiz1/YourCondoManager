/**
 * signup-plan-keys.ts — canonical mapping from a signup `?plan=` slug to the
 * pricing TRACK + the plan_catalog tier planKey it should resolve to.
 *
 * Shared by the signup page (client) and the signup/subscribe route (server) so
 * BOTH derive pricing the same way. Closes the "$30 stale fallback" bug: the old
 * signup page only knew `self-managed` / `property-manager` / `enterprise` and
 * fell back to the PM $30 per-complex price for any other slug — but the pricing
 * page's CTAs link with tier-specific slugs like `property-manager-starter`,
 * `property-manager-growth`, `property-manager-scale`. Those now map to their
 * real plan_catalog tiers instead of a stale fallback.
 *
 * Internal code identifiers / plan-keys are UNCHANGED — these are the route
 * slugs the marketing CTAs use, mapped to the canonical `plan_catalog.plan_key`.
 */

export type SignupTrack = "self-managed" | "property-manager" | "enterprise";

export interface ResolvedSignupPlan {
  /** The pricing TRACK the signup flow renders (self-managed / PM / enterprise). */
  track: SignupTrack;
  /**
   * The canonical `plan_catalog.plan_key` this slug pins to, when the slug names
   * a specific tier (e.g. PM Starter/Growth/Scale). `null` means "tier is derived
   * downstream" — self-managed derives its tier from the entered unit count;
   * PM with no explicit tier defaults to the entry tier (pm_starter).
   */
  planKey: string | null;
}

/**
 * Map a raw `?plan=` slug to its track + plan_catalog tier.
 *
 * Recognized slugs:
 *   self-managed                     → SM track, tier derived from unit count
 *   property-manager                 → PM track, defaults to pm_starter
 *   property-manager-starter         → PM track, pm_starter
 *   property-manager-growth          → PM track, pm_growth
 *   property-manager-scale           → PM track, pm_scale
 *   enterprise                       → enterprise (contact sales)
 *   <anything else>                  → self-managed (the SAFE default — never the
 *                                      stale PM $30 fallback)
 */
export function resolveSignupPlan(rawPlan: string | null | undefined): ResolvedSignupPlan {
  switch (rawPlan) {
    case "self-managed":
      return { track: "self-managed", planKey: null };
    case "property-manager":
      return { track: "property-manager", planKey: "pm_starter" };
    case "property-manager-starter":
      return { track: "property-manager", planKey: "pm_starter" };
    case "property-manager-growth":
      return { track: "property-manager", planKey: "pm_growth" };
    case "property-manager-scale":
      return { track: "property-manager", planKey: "pm_scale" };
    case "enterprise":
      return { track: "enterprise", planKey: null };
    default:
      // SAFE default — NEVER fall back to the stale PM $30 price. An unknown slug
      // routes to the self-managed track, whose price is derived from unit count.
      return { track: "self-managed", planKey: null };
  }
}
