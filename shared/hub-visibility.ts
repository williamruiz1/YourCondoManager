// @zone: (cross-cutting — hub visibility translation)
// Dual-vocab translation helper for the `hub_visibility_level` enum and the
// `community_announcements.visibility_level` text column during the 1.5
// Hub Visibility Rename parity window.
//
// Spec: docs/projects/platform-overhaul/decisions/1.5-hub-visibility-rename.md
//
// Lifecycle:
//   - HV-1 (this wave) — additive: helper ships, but no caller is migrated.
//     The schema enum now accepts both old and new values; writes stay old.
//   - HV-2 — backfill + dual-read: callers normalize inputs with
//     `normalizeHubVisibility` and (per-association, flag-gated) begin
//     emitting new vocab on write.
//   - HV-3 — this file is deleted after old enum values are dropped and
//     every call site uses new vocab exclusively.
//
// Mapping table (from the 1.5 decision doc):
//   | Old      | New           |
//   | -------- | ------------- |
//   | public   | public        | (preserved verbatim — public-API safe)
//   | resident | residents     |
//   | owner    | unit-owners   |
//   | board    | board-only    |
//   | admin    | operator-only |

/** Old, role-coupled vocabulary. Legal today; retired in HV-3. */
export type HubVisibilityOld =
  | "public"
  | "resident"
  | "owner"
  | "board"
  | "admin";

/** New, role-agnostic vocabulary (per 2.1 Q11). Target of the rename. */
export type HubVisibilityNew =
  | "public"
  | "residents"
  | "unit-owners"
  | "board-only"
  | "operator-only";

/** Union accepted anywhere during the HV-1 + HV-2 parity window. */
export type HubVisibility = HubVisibilityOld | HubVisibilityNew;

/**
 * Ordered list of all legal values (old ∪ new) for use in zod `z.enum([...])`.
 * Exported so CRUD validators can accept both vocabularies without having to
 * hard-code the full list in every call site.
 *
 * Order matters for zod error messages; we list old first (current on-the-wire
 * reality) then new (destination).
 */
export const HUB_VISIBILITY_ALL_VALUES = [
  "public",
  "resident",
  "owner",
  "board",
  "admin",
  "residents",
  "unit-owners",
  "board-only",
  "operator-only",
] as const satisfies readonly HubVisibility[];

/** Old → new lookup. `public` is preserved verbatim. */
const OLD_TO_NEW: Record<HubVisibilityOld, HubVisibilityNew> = {
  public: "public",
  resident: "residents",
  owner: "unit-owners",
  board: "board-only",
  admin: "operator-only",
};

const NEW_VALUES = new Set<HubVisibilityNew>([
  "public",
  "residents",
  "unit-owners",
  "board-only",
  "operator-only",
]);

/**
 * Map a value from either vocabulary to the NEW vocabulary.
 *
 * - Old values map per the 1.5 decision-doc table.
 * - New values pass through unchanged (already in target form).
 * - `null` passes through unchanged. The `community_announcements.visibility_level`
 *   column allows NULL, and the public-read path treats NULL as "public-ish"
 *   (see `server/routes.ts` — `isNull || eq "public"`). Preserving NULL is
 *   load-bearing for that contract; HV-2 backfill must NOT convert NULLs.
 *
 * @throws never — this helper is total over the documented union. An unknown
 *   string that slips past the type system falls through to being returned as
 *   a `HubVisibilityNew` cast, which is a programmer bug elsewhere; callers
 *   should validate with the zod schema before calling.
 */
export function toNewVocab(
  v: HubVisibility | null,
): HubVisibilityNew | null {
  if (v === null || v === undefined) return null;
  if (NEW_VALUES.has(v as HubVisibilityNew)) {
    return v as HubVisibilityNew;
  }
  // At this point `v` is either an old value or an unknown string. Look it up
  // in the old→new map; if it matches, return the new value. Otherwise return
  // it unchanged (the caller validated, or failed to — not this helper's job).
  const mapped = OLD_TO_NEW[v as HubVisibilityOld];
  return mapped ?? (v as HubVisibilityNew);
}

/**
 * Accept either vocabulary and emit new. Callers that read from storage (where
 * both vocabs may be present during HV-2) should pipe the value through this
 * before comparing or rendering. Semantically identical to `toNewVocab`; kept
 * as a named export so intent reads clearly at call sites:
 *
 *   const canonical = normalizeHubVisibility(row.visibilityLevel);
 */
export function normalizeHubVisibility(
  v: HubVisibility | null,
): HubVisibilityNew | null {
  return toNewVocab(v);
}
