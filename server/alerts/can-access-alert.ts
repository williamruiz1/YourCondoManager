/**
 * 4.1 Wave 2 — `canAccessAlert` predicate.
 *
 * Spec: docs/projects/platform-overhaul/decisions/4.1-cross-association-alert-engine.md
 * Q5 "feature-domain filtering required."
 *
 * Decision: server-side `canAccessAlert(persona, featureDomain, toggles)`
 * is evaluated BEFORE the alert payload leaves the server. Clients never
 * see alerts they are not permitted to act on.
 *
 * Wave 2 scope: the 0.2 PM-Managed Default Access Table is the only
 * input. Per the handoff brief for this wave:
 *   "For this wave: simple zone + featureDomain check driven from a
 *   static feature-domain→role table. See 0.2 PM-Managed Default Access
 *   Table for the mapping; if ambiguous, gate on role only
 *   (Manager / Platform-Admin full, others denied) and note the TODO."
 *
 * The runtime PM toggle model (3.1 Q6 / 0.2 PM Toggle Configuration
 * Model) is wired through the `personaToggles` argument but the handoff
 * spec for Wave 2 does NOT require toggle-driven overrides — if the
 * default access table permits or denies a featureDomain, the decision
 * is final. Wave 3+ (when the toggle-config UI lands) will layer toggle
 * overrides on top of the defaults below.
 */

import type { AdminRole } from "@shared/schema";
import type { PersonaToggleState } from "@shared/persona-access";
import { FEATURE_DOMAINS, type FeatureDomain } from "./types";

// ---------------------------------------------------------------------------
// Default feature-domain → role access table
// ---------------------------------------------------------------------------
//
// Transcribed from 0.2 PM-Managed Default Access Table
// (`docs/projects/platform-overhaul/decisions/0.2-persona-map.md:117-131`).
//
// Manager and Platform-Admin have full access across every Tier 1 feature
// domain. Assisted-Board follows the PM-Managed Default Access Table
// exactly. PM-Assistant is "configured subset of Manager" per 0.2 §Persona
// 4 — the Wave 2 default grants all operational feature domains (same as
// Manager); toggle-driven restriction is a Wave 3+ concern. Board-Officer
// (self-managed association) mirrors Manager for the default read surface
// per the Persona Boundary Matrix. Viewer is read-only across all domains.
// ---------------------------------------------------------------------------

const DEFAULT_ALERT_ACCESS: Readonly<Record<FeatureDomain, readonly AdminRole[]>> = {
  // "Financials — reports & statements" — ✅ View for Assisted Board.
  [FEATURE_DOMAINS.FINANCIALS_REPORTS]: [
    "platform-admin",
    "manager",
    "board-officer",
    "assisted-board",
    "pm-assistant",
    "viewer",
  ],
  // "Financials — delinquency" is not an explicit row in 0.2 but is
  // downstream of "Financials — reports & statements" + "Violations —
  // view & appeals" (both Assisted Board ✅ View). Treated as viewable
  // by the same set.
  [FEATURE_DOMAINS.FINANCIALS_DELINQUENCY]: [
    "platform-admin",
    "manager",
    "board-officer",
    "assisted-board",
    "pm-assistant",
    "viewer",
  ],
  // "Maintenance requests — view only" — ✅ View for Assisted Board.
  [FEATURE_DOMAINS.OPERATIONS_MAINTENANCE_REQUESTS]: [
    "platform-admin",
    "manager",
    "board-officer",
    "assisted-board",
    "pm-assistant",
    "viewer",
  ],
  // Work orders are PM-operational. The 0.2 table rows closest to work
  // orders are "Maintenance requests — view only" (Assisted Board ✅)
  // and "Unit management" (Assisted Board ❌). Per the Q5 AC example
  // in the 4.1 spec — "Assisted Board seeing maintenance-request alerts
  // but not unit-management alerts" — work-order alerts are denied to
  // Assisted Board by default (PM surface, not board oversight).
  [FEATURE_DOMAINS.OPERATIONS_WORK_ORDERS]: [
    "platform-admin",
    "manager",
    "board-officer",
    "pm-assistant",
  ],
  // "Governance documents (bylaws, rules, resolutions)" — ✅ View.
  [FEATURE_DOMAINS.GOVERNANCE_DOCUMENTS]: [
    "platform-admin",
    "manager",
    "board-officer",
    "assisted-board",
    "pm-assistant",
    "viewer",
  ],
  // "Meetings & minutes" / elections — ✅ View + ✅ Write for board.
  [FEATURE_DOMAINS.GOVERNANCE_ELECTIONS]: [
    "platform-admin",
    "manager",
    "board-officer",
    "assisted-board",
    "pm-assistant",
    "viewer",
  ],
  // Tier 2 (Wave 3 — Tier 2 alert sources PR).
  // "Vendors" is PM-operational: approvals, contract lifecycle, renewals.
  // Not an explicit row in 0.2; treated like work orders — PM + platform
  // admin + board officers (self-managed need vendor visibility).
  // Assisted Board is DENIED: the Wave-2 0.2 example specifically put
  // unit-management & vendor-management alerts outside Assisted-Board
  // scope.
  [FEATURE_DOMAINS.VENDORS]: [
    "platform-admin",
    "manager",
    "board-officer",
    "pm-assistant",
  ],
  // "Governance-compliance" covers insurance, compliance filings, etc.
  // Same access surface as governance.documents — board-level oversight
  // plus PM operational roles.
  [FEATURE_DOMAINS.GOVERNANCE_COMPLIANCE]: [
    "platform-admin",
    "manager",
    "board-officer",
    "assisted-board",
    "pm-assistant",
    "viewer",
  ],
};

/**
 * Predicate: does this persona see alerts in this feature domain?
 *
 * Returns `true` iff:
 *   1. `persona` is a recognised AdminRole,
 *   2. `featureDomain` is present in the Wave 2 default access table, AND
 *   3. `persona` is in the table's role list for that domain.
 *
 * Manager and Platform-Admin always return `true` for any Tier 1
 * featureDomain (per handoff brief). If `featureDomain` is NOT in the
 * default table at all (i.e. a future-tier domain), the function falls
 * back to role-only gating: Manager / Platform-Admin get through,
 * everyone else is denied, matching the conservative default in the
 * handoff brief.
 *
 * The `personaToggles` argument is accepted to honour the 4.1 spec
 * signature but is NOT applied in Wave 2 — see TODO below.
 */
export function canAccessAlert(
  persona: AdminRole,
  featureDomain: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  personaToggles: PersonaToggleState,
): boolean {
  // Platform-admin and Manager have full access by convention (0.2 §Persona 1/6).
  if (persona === "platform-admin" || persona === "manager") {
    return true;
  }

  const allowedRoles = DEFAULT_ALERT_ACCESS[featureDomain as FeatureDomain];
  if (!allowedRoles) {
    // TODO (Wave 3+): once the PM toggle-configuration UI lands, unknown
    // feature-domains should consult `personaToggles` for an explicit
    // allow. For Wave 2 we fall back to role-only gating per the
    // handoff brief: Manager / Platform-Admin already returned true
    // above, so any other persona hitting this branch is denied.
    return false;
  }

  return allowedRoles.includes(persona);
}
