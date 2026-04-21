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
//   - PORTAL_ROLE_COLLAPSE: introduced Phase 8a (default OFF), removed Phase 8c.
//   - BOARD_SHUNT_ACTIVE:   introduced Phase 13 dark-launch (default ON), flipped
//                           OFF via follow-up PR after one clean release cycle,
//                           then removed entirely.
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
  // Phase 8a — default OFF; gates the portal-role enum collapse migration.
  // Phase 8c removes the flag from code (hardcoded as the "always true" path).
  | "PORTAL_ROLE_COLLAPSE"
  // Phase 13 dark-launch — default ON; when flipped OFF, board-officer /
  // assisted-board sessions fall through to WorkspaceShell + AppSidebar
  // instead of the shunt at client/src/App.tsx:1051-1057.
  | "BOARD_SHUNT_ACTIVE";

/**
 * Compile-time defaults. Used when no env override is present.
 */
const DEFAULTS: Record<FeatureFlagKey, boolean> = {
  PORTAL_ROLE_COLLAPSE: false,
  BOARD_SHUNT_ACTIVE: true,
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
 * Exposed for tests. NOT part of the public API — do not import from app code.
 */
export const __FEATURE_FLAG_DEFAULTS__ = DEFAULTS;
