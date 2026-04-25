// zone: shared (i18n helper)
//
// 5.6 — i18n scaffolding (Wave 21).
//
// Spec: docs/projects/platform-overhaul/decisions/5.6-i18n-scaffolding.md
//
// Minimal lookup helper. By design Wave 21 ships:
//   - a single English registry (`strings.en.ts`)
//   - this `t()` function that looks up a key in that registry
//   - a safe fallback: missing keys return the key itself, so the page
//     never crashes if a string was accidentally removed.
//
// No interpolation, no plural rules, no locale switching. Those land in
// a follow-up wave when we commit to a translated release; the goal here
// is only to make the registry the single place strings live, so future
// translation is a mechanical refactor against this module.

import { strings, type StringKey } from "./strings.en";

/**
 * Look up a registered string by key.
 *
 * @example
 *   t("home.title")              // "Home"
 *   t("inbox.empty.unread")      // "No unread alerts — all caught up"
 *
 * Unknown keys return the key itself (safe fallback). The function is
 * typed so TypeScript will warn if a literal that isn't in the registry
 * is passed; the runtime fallback only matters if a dynamic value
 * sneaks through.
 */
export function t(key: StringKey): string {
  // The cast is a defensive narrowing: the type signature already
  // excludes unknown keys, but the registry is `as const` so reads
  // through `strings[key]` are safe at runtime even if a caller widens
  // the key type to plain string.
  const value = (strings as Record<string, string>)[key];
  return typeof value === "string" ? value : key;
}

/**
 * Hook form for parity with future i18next migration. Today it returns
 * the same `t` function on every render — there's no locale state to
 * subscribe to. Surfaces should prefer the hook so a later swap to a
 * locale-aware implementation is a one-line change.
 */
export function useStrings(): { t: typeof t } {
  return { t };
}

export type { StringKey };
