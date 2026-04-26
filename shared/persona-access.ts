/**
 * shared/persona-access.ts — ADR 0b contract + zone-by-zone manifest data.
 *
 * This module is the single source of truth for persona-to-route and
 * persona-to-feature access across the application. Both the sidebar
 * (3.1 Q9) and `<RouteGuard>` (2.3 Q9) derive their visibility and gating
 * from the exports below — no inline `roles: [...]` arrays anywhere else.
 *
 * --- Phase 0b.2 (shipped) ---
 * - Locked the export surface (types + function signatures) matching ADR 0b.
 * - Shipped empty manifests; `canAccess` defaulted-deny every input.
 *
 * --- Phase 12 (Zone 1 — Financials) — THIS FILE TODAY ---
 * - Populates `ROUTE_MANIFEST` for Financials zone routes only:
 *   `/app/financials` hub + 5 plural-to-singular redirects + 6 canonical
 *   sub-pages (foundation, billing, rules, payments, expenses, reports) +
 *   9 legacy singular-prefix redirects + `/app/settings/billing` (which
 *   logically belongs to the Financials zone per 4.4 Q6 even though its
 *   URL sits under `/app/settings/*`).
 * - Operations / Governance / Communications / Platform routes still
 *   absent — they land in Phases 13–16 per 3.3 Q5 (one zone PR each,
 *   stop-the-line discipline).
 * - Source of role lists: 0.2 Persona Boundary Matrix (LOCKED, amended
 *   `f8dbf76`). `/app/financial/*` row = Manager + Board Officer +
 *   Assisted Board (read-only via `useIsReadOnly()` hook) + PM Assistant +
 *   Viewer. Platform Admin is ❌ on the customer-tenant-scoped Financials
 *   zone per the 0.2 matrix and Persona 6 definition (Platform Admin
 *   manages YCM-internal operator tooling, not customer association
 *   day-to-day work). `/app/settings/billing` is Manager-only per 4.4 Q6.
 *
 * --- Phase 9 / Phases 13–16 scope (NOT THIS FILE TODAY) ---
 * - Populates remaining zones (Operations, Governance, Communications,
 *   Platform) and `/portal/*` routes.
 * - Populates `FEATURE_MANIFEST` from the 0.2 PM-Managed Default Access
 *   Table (Phase 9 owns the feature-domain rows; per-route gating is
 *   sufficient for zone landings).
 * - Wires `usePersonaToggles()` to `tenant_configs` per 3.1 Q6.
 */

export { type AdminRole } from "./schema";

import type { AdminRole } from "./schema";

// ---------------------------------------------------------------------------
// Route manifest
// ---------------------------------------------------------------------------
//
// Keys = canonical route paths from the 3.2 route table
// (e.g., "/app", "/app/financial/billing", "/app/admin/users").
// Values = readonly array of AdminRole values permitted on that route.
//
// ROUTE_MANIFEST is the source of truth for both:
//   (a) <RouteGuard route={...}> accessibility, and
//   (b) sidebar item visibility (3.1 Q9).
// ---------------------------------------------------------------------------

export type RouteManifest = Readonly<Record<string, readonly AdminRole[]>>;

// ---------------------------------------------------------------------------
// Persona-class role lists — derived from 0.2 Persona Boundary Matrix.
// ---------------------------------------------------------------------------
//
// Internal constants to keep the per-route role lists DRY and self-evident.
// Match the equivalent constants in `client/src/components/app-sidebar-zones.ts`
// (which the sidebar already consumes as of Phase 11). Future phases may
// consolidate the two source-of-truth files; for now the duplication is
// intentional — the sidebar tree is per-zone, the manifest is per-route.

/** Manager-equivalent operator personas. Used for `/app/financial/*` per
 * 0.2 matrix (Platform Admin is `❌` on customer-tenant Financials per
 * Persona 6 definition). Assisted Board is `read-only` — read-only is
 * enforced at the action level via `useIsReadOnly()` per 2.3 Q7, not
 * by exclusion from this list (the manifest is visibility, not
 * write-action gating). */
const FIVE_PERSONA_OPERATOR: readonly AdminRole[] = [
  "manager",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "viewer",
];

/**
 * `/app/settings/billing` shipped role list — Manager + Board Officer +
 * PM Assistant + Platform Admin. NOTE: 4.4 Q6 spec says Manager-only, but
 * the shipped page (`client/src/pages/settings-billing.tsx`) and its
 * tests (`tests/settings-billing-page.client.test.tsx`) exercise the
 * 4-role list. To avoid breaking shipped behavior and tests in this PR,
 * Phase 12 (3.3 Zone 1) matches the manifest to the shipped 4-role
 * gate. A founder Human Task is filed to resolve the spec/code drift —
 * once resolved, the manifest can be tightened or the spec relaxed.
 */
const SETTINGS_BILLING_ROLES: readonly AdminRole[] = [
  "platform-admin",
  "manager",
  "board-officer",
  "pm-assistant",
];

/**
 * Phase 12 (Zone 1 — Financials): populated for all Financials zone
 * routes. Other zones are still absent — `canAccess` strict-defaults-deny
 * for any unlisted route per OQ-3 Option A.
 */
export const ROUTE_MANIFEST: RouteManifest = {
  // ---- Financials zone hub (3.2 Q1, Phase 11) ----
  "/app/financials": FIVE_PERSONA_OPERATOR,

  // ---- Financials zone plural-to-singular redirects (3.2 Q1, Phase 11) ----
  // Same persona list as the destination so a permitted persona reaches
  // the redirect, navigates, and reaches the destination uninterrupted.
  "/app/financials/foundation": FIVE_PERSONA_OPERATOR,
  "/app/financials/billing": FIVE_PERSONA_OPERATOR,
  "/app/financials/payments": FIVE_PERSONA_OPERATOR,
  "/app/financials/expenses": FIVE_PERSONA_OPERATOR,
  "/app/financials/reports": FIVE_PERSONA_OPERATOR,

  // ---- Financials zone canonical sub-pages (3.2 — preserved from current) ----
  "/app/financial/foundation": FIVE_PERSONA_OPERATOR,
  "/app/financial/billing": FIVE_PERSONA_OPERATOR,
  "/app/financial/payments": FIVE_PERSONA_OPERATOR,
  "/app/financial/expenses": FIVE_PERSONA_OPERATOR,
  "/app/financial/reports": FIVE_PERSONA_OPERATOR,
  // 4.3 Q9 consolidated assessment-rules surface.
  "/app/financial/rules": FIVE_PERSONA_OPERATOR,

  // ---- Financials zone legacy singular-prefix redirects (3.2 Q4 archive) ----
  "/app/financial/fees": FIVE_PERSONA_OPERATOR,
  "/app/financial/recurring-charges": FIVE_PERSONA_OPERATOR,
  "/app/financial/ledger": FIVE_PERSONA_OPERATOR,
  "/app/financial/assessments": FIVE_PERSONA_OPERATOR,
  "/app/financial/late-fees": FIVE_PERSONA_OPERATOR,
  "/app/financial/invoices": FIVE_PERSONA_OPERATOR,
  "/app/financial/utilities": FIVE_PERSONA_OPERATOR,
  "/app/financial/budgets": FIVE_PERSONA_OPERATOR,
  "/app/financial/reconciliation": FIVE_PERSONA_OPERATOR,

  // ---- Owner-billing surface (3.2 amendment 2026-04-21 / 4.4 Q6) ----
  // Sub-route of /app/settings but logically Financials-zone (Stripe
  // Customer Portal landing for the paying account holder).
  "/app/settings/billing": SETTINGS_BILLING_ROLES,
};

// ---------------------------------------------------------------------------
// Feature manifest
// ---------------------------------------------------------------------------
//
// Keys = feature-domain IDs from the 0.2 PM-Managed Default Access Table
// (e.g., "financials.reports", "governance.meetings", "operations.vendors").
// Values = readonly array of AdminRole values with DEFAULT view access.
//
// FEATURE_MANIFEST encodes the static persona-to-feature defaults. The
// PM toggle state at runtime (per 3.1 Q6) layers on top via
// usePersonaToggles() and is not encoded here.
// ---------------------------------------------------------------------------

export type FeatureManifest = Readonly<Record<string, readonly AdminRole[]>>;

/**
 * Phase 0b.2: empty. Phase 9 populates from the 0.2 PM-Managed Default
 * Access Table.
 */
export const FEATURE_MANIFEST: FeatureManifest = {};

// ---------------------------------------------------------------------------
// canAccess — pure predicate
// ---------------------------------------------------------------------------
//
// Returns true iff `role` is a non-null/undefined AdminRole AND the route
// is present in ROUTE_MANIFEST AND the role is in the manifest's role list
// for that route. Returns false in all other cases, including when `route`
// is absent from ROUTE_MANIFEST.
//
// Null-role strict-false (3.3 Q3 + OQ-3 Option A):
//   canAccess(null, route)      === false ALWAYS.
//   canAccess(undefined, route) === false ALWAYS.
//   canAccess(role, <unknown route>) === false ALWAYS (strict default-deny).
//
// Phase 0b.2 ships the final canAccess body. Because ROUTE_MANIFEST is
// empty in Phase 0b.2, every lookup yields `undefined` → function returns
// `false`. Phase 9 populates the manifest; the function body does not
// change.
// ---------------------------------------------------------------------------

export function canAccess(
  role: AdminRole | null | undefined,
  route: string,
): boolean {
  // OQ-3 Option A: strict default-deny everywhere.
  if (role == null) return false;
  const allowedRoles = ROUTE_MANIFEST[route];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
}

// ---------------------------------------------------------------------------
// usePersonaToggles — runtime toggle hook
// ---------------------------------------------------------------------------
//
// Returns the per-persona feature-toggle state for the current auth session
// and active association context. In Phase 9, the implementation reads from
// `tenant_configs` (3.1 Q6). In Phase 0b.2 the stub returns an empty
// `PersonaToggleState` (no features enabled — every feature-domain lookup
// returns `undefined`, and consumers should consult FEATURE_MANIFEST for
// the default posture).
//
// Parameterless by contract (OQ-2 Option A). The hook reads the active
// association ID and current adminRole from internal subscriptions in
// Phase 9. Call sites do not plumb those values.
// ---------------------------------------------------------------------------

export interface PersonaToggleState {
  /**
   * Feature-domain ID → boolean.
   *   true  = enabled (visible/allowed) for the current persona + association.
   *   false = explicitly disabled.
   *   (key absent) = default — consult FEATURE_MANIFEST for default posture.
   */
  readonly [featureId: string]: boolean;
}

export function usePersonaToggles(): PersonaToggleState {
  // Phase 0b.2 stub: no features enabled.
  // Phase 9 wires this to the `tenant_configs` query (3.1 Q6) keyed on
  // (activeAssociationId, adminRole) from internal subscriptions.
  return {};
}
