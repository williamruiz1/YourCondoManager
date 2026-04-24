// @zone: (cross-cutting)
//
// 1.3 Breadcrumb routing table — single source of truth for
// `route → breadcrumb trail` mapping. Populated per-zone in the
// zone-landing PRs (Phases 12–16 of the platform overhaul plan).
//
// Phase 6 establishes only the file structure, types, and the
// label-rule helper. Do NOT add per-route paths for the 37 audited
// surfaces here yet — they land with their zone PR.
//
// Spec anchors:
//  - decisions/1.3-breadcrumb-label-audit.md (Q1–Q7)
//  - decisions/1.1-zone-taxonomy-corrections.md (canonical zone labels)
//  - decisions/1.4-page-title-consistency.md (leaf == page title)
//  - plan: /home/runner/.claude/plans/floofy-hopping-dusk.md Phase 6
//
// Invariants enforced by this module and consumers:
//  - ≤ 3 segments per trail (1.3 Q4).
//  - Root is association-name or zone label, never "Dashboard"/"App".
//    "Home" is permitted as a root only when it is the Home-zone label
//    (per 1.3 Q1 amendment 2026-04-23 + 1.1 Q3 — see /app/portfolio).
//    (1.3 Q1). The `{associationName}` sentinel is substituted at resolve time.
//  - Exactly two valid patterns (1.3 Q2):
//      association-scoped:  Association Name > Zone Label > Page Title
//      portfolio-scoped:                      Zone Label > Page Title
//  - Hub pages are two-level with the leaf non-linked (1.3 Q3).
//  - Breadcrumbs are persona-invariant (1.3 Q6). No role conditional here.
//
// TODO(phase-12 Financials):    add /app/financials/* routes.
// TODO(phase-13 Operations):    add /app/operations/*, /app/work-orders, etc.
// TODO(phase-14 Governance):    add /app/governance/*, /app/board, etc.
// TODO(phase-15 Communications): add /app/communications/*, /app/announcements.
// TODO(phase-16 Platform):      add /app/platform/*, /app/admin/*, /app/ai/*.
// TODO(phase-17 retrofit):      backfill anything missed by zone PRs.

/**
 * A single breadcrumb segment. `href` is omitted (or undefined) for the
 * current-page indicator, which must be the last segment.
 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Ordered list of breadcrumb segments, root first. Readonly to prevent
 * accidental mutation by consumers.
 */
export type BreadcrumbTrail = ReadonlyArray<BreadcrumbItem>;

/**
 * Runtime context used to substitute dynamic labels (e.g. the active
 * association name) into a trail template.
 */
export interface BreadcrumbContext {
  /**
   * Active association display name, from `useActiveAssociation()`.
   * Required for association-scoped trails.
   */
  associationName?: string;
}

/**
 * Sentinel label substituted with the active association name at resolve
 * time. Using a sentinel (rather than hard-coding names in the table)
 * keeps the table persona-invariant and static.
 */
export const ASSOCIATION_NAME_SENTINEL = "{associationName}";

/**
 * Forbidden root labels per 1.3 Q1. Never used as a breadcrumb root.
 * Exported so downstream lint/test hooks can assert against it.
 *
 * Per the 1.3 Q1 amendment (2026-04-23), "Home" is permitted as a root
 * when it is the Home-zone label per 1.1 Q3 (e.g., `/app/portfolio` →
 * `Home > Portfolio Health`). "Home" is therefore NOT listed here;
 * generic/placeholder "Home" uses are caught at code review + via zone-tag
 * alignment, not by this list. "Dashboard" and "App" remain categorically
 * forbidden.
 */
export const FORBIDDEN_ROOT_LABELS: ReadonlyArray<string> = Object.freeze([
  "Dashboard",
  "App",
]);

/**
 * Maximum breadcrumb depth per 1.3 Q4 (≤ 3).
 */
export const MAX_BREADCRUMB_DEPTH = 3;

/**
 * Route → trail mapping. Populated per-zone in Phases 12–16.
 *
 * Seeded with a minimal set of entries that exercise each allowed
 * pattern so the component and helper have something real to render
 * before the zone PRs land. These seeds are intentional reference
 * examples — they will be superseded (or confirmed) by the zone PR
 * that owns the route.
 *
 * Pattern legend:
 *   - Portfolio-scoped hub (zone label alone, non-linked):
 *       [{ label: "Home" }]
 *   - Portfolio-scoped leaf (zone > page):
 *       [{ label: "Home", href: "/app" }, { label: "Portfolio Health" }]
 *   - Association-scoped leaf (assoc > zone > page):
 *       [{ label: ASSOCIATION_NAME_SENTINEL, href: "/app" },
 *        { label: "Operations", href: "/app/operations" },
 *        { label: "Operations Overview" }]
 */
export const BREADCRUMB_PATHS: Readonly<Record<string, BreadcrumbTrail>> = Object.freeze({
  // Seed — portfolio-scoped Home hub. The Home zone label is the
  // current-page indicator (hub, per 1.3 Q3), not a root-of-chain.
  "/app": [{ label: "Home" }],

  // Seed — portfolio-scoped Operations overview (zone > page). Lands
  // with 0.1 (`/app/operations/dashboard` renamed to "Operations
  // Overview" per 0.1 Q1) and demonstrates the portfolio-scoped
  // two-segment pattern.
  "/app/operations/dashboard": [
    { label: "Operations", href: "/app/operations" },
    { label: "Operations Overview" },
  ],

  // Seed — portfolio-scoped Portfolio Health (Home > Portfolio Health).
  // Per 1.3 Q1 amendment (2026-04-23): "Home" is permitted as a root
  // label when it refers to the Home-zone label per 1.1 Q3. Portfolio
  // Health sits in the Home zone, so the canonical trail is
  // `Home > Portfolio Health`.
  "/app/portfolio": [
    { label: "Home", href: "/app" },
    { label: "Portfolio Health" },
  ],

  // 4.1 Wave 4 — Central inbox (Communications > Inbox). Lives under the
  // Communications zone per 4.1 Q4 resolution (2026-04-21) and 1.1 Q3
  // (Communications zone owns "updates inbox"). Sub-page pattern:
  // portfolio-scoped leaf with zone-label root and leaf = page title.
  "/app/communications/inbox": [
    { label: "Communications", href: "/app/communications" },
    { label: "Inbox" },
  ],

  // 4.3 Wave 8 — Consolidated Assessment Rules surface. Portfolio-scoped
  // zone > leaf. Financials is the zone label (per 1.1 Q3 Financials
  // zone). Leaf is the page title (per 1.4 Q1). See
  // docs/projects/platform-overhaul/decisions/4.3-recurring-assessment-rules-engine.md#q9.
  "/app/financial/rules": [
    { label: "Financials", href: "/app/financial/foundation" },
    { label: "Assessment Rules" },
  ],
});

/**
 * Substitute the association-name sentinel and freeze the result.
 * Internal: callers should use {@link getBreadcrumbTrail}.
 */
function hydrateTrail(
  template: BreadcrumbTrail,
  context?: BreadcrumbContext,
): BreadcrumbTrail {
  const associationName = context?.associationName?.trim();
  const hydrated = template.map((segment) => {
    if (segment.label !== ASSOCIATION_NAME_SENTINEL) {
      return segment;
    }
    // If no association name is available, the caller has rendered a
    // portfolio-scoped shell for an association-scoped route — drop the
    // root silently. Per 1.3 Q1: "If no association context exists, the
    // breadcrumb starts at the zone label."
    if (!associationName) {
      return null;
    }
    return { ...segment, label: associationName };
  });
  return hydrated.filter((segment): segment is BreadcrumbItem => segment !== null);
}

/**
 * Resolve a route to its breadcrumb trail.
 *
 * Returns an empty trail for unknown routes — callers should render no
 * breadcrumb rather than guess a chain. (Per the decision doc, every
 * page must have a trail post-implementation; returning empty surfaces
 * missing-entry bugs in Phase 10 parity tests.)
 *
 * Enforces 1.3 Q4 (`≤ ${MAX_BREADCRUMB_DEPTH}` segments). A template that
 * exceeds the cap is truncated to the last {@link MAX_BREADCRUMB_DEPTH}
 * segments — this keeps rendering safe even if a zone PR seeds an
 * invalid trail, while surfacing the violation to the unit test.
 *
 * Persona-invariant (1.3 Q6): takes no role / persona argument.
 */
export function getBreadcrumbTrail(
  route: string,
  context?: BreadcrumbContext,
): BreadcrumbTrail {
  const template = BREADCRUMB_PATHS[route];
  if (!template) {
    return [];
  }
  const hydrated = hydrateTrail(template, context);
  if (hydrated.length <= MAX_BREADCRUMB_DEPTH) {
    return hydrated;
  }
  // Trim to the last N segments so the leaf (current page) is always
  // preserved. Drop-from-root aligns with 1.3 Q4 flattening guidance:
  // "drop intermediate levels, keeping only: association name (if
  // applicable), zone label, and the immediate page title."
  return hydrated.slice(hydrated.length - MAX_BREADCRUMB_DEPTH);
}

/**
 * Convenience helper: true if the trail is a hub-style trail (one or
 * two segments, last segment non-linked). Used by the renderer and
 * tests to assert 1.3 Q3.
 */
export function isHubTrail(trail: BreadcrumbTrail): boolean {
  if (trail.length === 0 || trail.length > 2) return false;
  const leaf = trail[trail.length - 1];
  return leaf.href === undefined;
}
