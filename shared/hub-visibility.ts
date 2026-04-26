// @zone: (cross-cutting — hub visibility)
// Hub visibility vocabulary helper for the `hub_visibility_level` enum and the
// `community_announcements.visibility_level` text column.
//
// Spec: docs/projects/platform-overhaul/decisions/1.5-hub-visibility-rename.md
//
// Lifecycle:
//   - HV-1 (Wave 17) — additive: helper introduced, schema enum extended to
//     accept both old and new values; writes stayed old. Zero behavior change.
//   - HV-2 (Wave 27) — code-only cutover: `HUB_VISIBILITY_RENAME` flag flipped
//     ON, every write path normalized through `normalizeHubVisibility()` to
//     emit new vocab. Reads still accepted both vocabs (parity window).
//   - HV-3 (Wave 36, this PR) — old enum values dropped via the
//     `0018_hub_visibility_rename_drop_old.sql` recreate-and-recast migration.
//     `HubVisibilityOld` type and `toNewVocab` mapping function are retired.
//     `normalizeHubVisibility` is kept as an identity shim for the immediate
//     follow-up wave to delete; this avoids touching all 19 call sites in
//     the same PR as the migration.
//
// Vocabulary (5 values, role-agnostic, 2.1 Q11 illustrative list):
//   public | residents | unit-owners | board-only | operator-only
//
// `public` is preserved verbatim for the anonymous public hub endpoint
// (server/routes.ts:`/api/hub/:identifier/public`); breaking that string would
// silently regress every external consumer keyed on it.

/** Canonical hub-visibility vocabulary (post-HV-3). */
export type HubVisibilityNew =
  | "public"
  | "residents"
  | "unit-owners"
  | "board-only"
  | "operator-only";

/**
 * Backwards-compatible alias. Pre-HV-3 the type was a discriminated union of
 * old + new vocab; HV-3 collapsed it to just the new vocab. Kept as a named
 * export so call sites that still import `HubVisibility` keep compiling.
 */
export type HubVisibility = HubVisibilityNew;

/**
 * Ordered list of all legal values, for use in zod `z.enum([...])`. Exported
 * so CRUD validators can accept the canonical vocabulary without hard-coding
 * the full list at every call site.
 *
 * Post-HV-3: 5 values, no old vocab. Any input outside this list is rejected
 * by the zod parser before the helper is reached.
 */
export const HUB_VISIBILITY_ALL_VALUES = [
  "public",
  "residents",
  "unit-owners",
  "board-only",
  "operator-only",
] as const satisfies readonly HubVisibilityNew[];

/**
 * Identity over the new vocabulary. Pre-HV-3 this also mapped old → new for
 * the dual-vocab parity window; the migration dropped that need. The function
 * is retained as a deprecation shim so we do not touch every call site in the
 * same PR as the schema change. A follow-up wave will delete this and inline
 * the value at every call site.
 *
 * NULLs pass through unchanged. The `community_announcements.visibility_level`
 * column allows NULL, and the public-read path treats NULL as "public-ish"
 * (see `server/routes.ts` — `isNull || eq "public"`). Preserving NULL is
 * load-bearing for that contract.
 *
 * @deprecated since HV-3 (Wave 36). Use the input value directly; this helper
 * is now an identity over `HubVisibilityNew | null`. Scheduled for removal in
 * a follow-up wave.
 */
export function normalizeHubVisibility(
  v: HubVisibilityNew | null | undefined,
): HubVisibilityNew | null {
  if (v === null || v === undefined) return null;
  return v;
}
