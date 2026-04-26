// @zone: (cross-cutting — infra)
// Central feature-flag helper. Phase 5b of Platform Overhaul.
//
// Reference:
//   - docs/projects/platform-overhaul/decisions/3.3-role-gating-corrections.md (Q2)
//   - Phase 5b amendment: typed flag helper, no UI, env-var-backed.
//
// Contract:
//   - Server context reads from process.env.FEATURE_FLAG_<KEY>.
//   - Client context (Vite bundle) reads from import.meta.env.VITE_FEATURE_FLAG_<KEY>.
//     Vite only inlines env vars prefixed with VITE_ (default envPrefix), so the
//     client must opt in explicitly by setting VITE_FEATURE_FLAG_<KEY> at build/dev time.
//   - Values are strings "true" | "false"; anything else falls through to DEFAULTS.
//   - DEFAULTS is the single source of truth for the compile-time default of each flag.
//
// Flag lifecycle (per Phase 5b plan):
//   - PORTAL_ROLE_COLLAPSE: introduced Phase 8b dark-launch (default OFF);
//                           flipped ON in Phase 8a alongside the enum-collapse
//                           migration (0014_portal_role_collapse.sql); removed
//                           entirely in Phase 8c (this flag is GONE — the
//                           always-on collapse behaviour is now hardcoded in
//                           `server/portal-role-collapse.ts`).
//   - BOARD_SHUNT_ACTIVE:   introduced Phase 13 dark-launch (default ON), flipped
//                           OFF via follow-up PR after one clean release cycle,
//                           then removed entirely.
//   - ASSESSMENT_EXECUTION_UNIFIED: introduced Wave 7 (default OFF) as a
//                           shadow-write parity window over the legacy per-
//                           subsystem posters (runDueRecurringCharges,
//                           processSpecialAssessmentInstallments). Wave 12
//                           (Phase 5.1 cleanup) flipped the default ON and
//                           deleted the legacy posters; the orchestrator
//                           (server/assessment-execution.ts) is now the sole
//                           path for real ledger posting. Per-association
//                           override is still supported via
//                           FEATURE_FLAG_ASSESSMENT_EXECUTION_UNIFIED_<associationId>
//                           so a specific association can be flipped OFF for
//                           debugging (which forces the orchestrator into dry-
//                           run mode for that scope, suppressing real ledger
//                           writes). Scheduled for full removal once every
//                           environment has run with the flag ON across at
//                           least one full monthly billing cycle.
//   - HUB_VISIBILITY_RENAME: introduced 1.5 HV-1 (default OFF), flipped to
//                            default ON in HV-2 alongside the code-only write
//                            cutover, and REMOVED in HV-3 (Wave 36) after the
//                            `0018_hub_visibility_rename_drop_old.sql`
//                            migration dropped the old enum values. Every
//                            write path now emits new vocab unconditionally;
//                            the flag had no remaining behavioral effect.
//
// Do NOT wire this helper into existing code yet. Phase 8a is the first consumer.

/**
 * Canonical feature-flag keys for the Platform Overhaul.
 *
 * Adding a key:
 *   1. Add the string literal here.
 *   2. Add its default to DEFAULTS below.
 *   3. Document its lifecycle (introduced / removed) in the comment above.
 */
export type FeatureFlagKey =
  // Phase 13 dark-launch — default ON; when flipped OFF, board-officer /
  // assisted-board sessions fall through to WorkspaceShell + AppSidebar
  // instead of the shunt at client/src/App.tsx:1051-1057.
  | "BOARD_SHUNT_ACTIVE"
  // Wave 7 (4.3 Q3) — introduced default OFF as a shadow-write parity window.
  // Wave 12 (Phase 5.1 cleanup) flipped the default to ON and deleted the
  // legacy posters. Per-association override still supported via
  // getFeatureFlagForAssociation().
  | "ASSESSMENT_EXECUTION_UNIFIED";

/**
 * Compile-time defaults. Used when no env override is present.
 */
const DEFAULTS: Record<FeatureFlagKey, boolean> = {
  BOARD_SHUNT_ACTIVE: true,
  ASSESSMENT_EXECUTION_UNIFIED: true,
};

/**
 * Read a Vite client-side env var without tripping non-Vite (Node / test) contexts.
 *
 * Vite replaces `import.meta.env.VITE_*` at build/dev time with literals. In a
 * Node context (server, tsx, vitest node env) `import.meta.env` is undefined,
 * and referencing it directly throws. We guard with a try/catch and return
 * undefined so callers can fall through to process.env / DEFAULTS.
 */
function readViteEnv(envKey: string): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = import.meta as any;
    const viteEnv = meta && meta.env;
    if (viteEnv && typeof viteEnv === "object") {
      const value = viteEnv[`VITE_${envKey}`];
      return typeof value === "string" ? value : undefined;
    }
  } catch {
    // import.meta.env is not available in this runtime — that's fine.
  }
  return undefined;
}

/**
 * Read a Node / server env var. process is undefined in strict browser builds.
 */
function readProcessEnv(envKey: string): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    const value = process.env[envKey];
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

/**
 * Resolve a feature flag to a boolean.
 *
 * Precedence:
 *   1. process.env.FEATURE_FLAG_<KEY>          (server / Node / tests)
 *   2. import.meta.env.VITE_FEATURE_FLAG_<KEY> (Vite client bundle)
 *   3. DEFAULTS[key]
 *
 * Only the literal strings "true" and "false" are respected; any other value
 * (including undefined, "1", "0", "yes") falls through to the next source.
 */
export function getFeatureFlag(key: FeatureFlagKey): boolean {
  const envKey = `FEATURE_FLAG_${key}`;

  const fromProcess = readProcessEnv(envKey);
  if (fromProcess === "true") return true;
  if (fromProcess === "false") return false;

  const fromVite = readViteEnv(envKey);
  if (fromVite === "true") return true;
  if (fromVite === "false") return false;

  return DEFAULTS[key];
}

/**
 * Per-association feature-flag resolution.
 *
 * Precedence (first explicit "true"/"false" wins, otherwise fall through):
 *   1. process.env.FEATURE_FLAG_<KEY>_<ASSOCIATION_ID>     (per-association)
 *   2. process.env.FEATURE_FLAG_<KEY>                      (global server)
 *   3. import.meta.env.VITE_FEATURE_FLAG_<KEY>             (client bundle)
 *   4. DEFAULTS[key]
 *
 * Association IDs are uuids containing hyphens; env-var names uppercase the
 * key and replace `-` with `_` in the association id, matching existing
 * docs/infra conventions.
 *
 * Use this for flags that support per-association rollout (e.g.
 * ASSESSMENT_EXECUTION_UNIFIED). For global-only flags, use getFeatureFlag.
 */
export function getFeatureFlagForAssociation(
  key: FeatureFlagKey,
  associationId: string,
): boolean {
  const safeId = (associationId ?? "").replace(/-/g, "_").toUpperCase();
  if (safeId) {
    const perAssociationEnvKey = `FEATURE_FLAG_${key}_${safeId}`;
    const perAssociationValue = readProcessEnv(perAssociationEnvKey);
    if (perAssociationValue === "true") return true;
    if (perAssociationValue === "false") return false;
  }
  return getFeatureFlag(key);
}

/**
 * Exposed for tests. NOT part of the public API — do not import from app code.
 */
export const __FEATURE_FLAG_DEFAULTS__ = DEFAULTS;
