// Community-hub public-URL slug generation (founder-os: trustworthy community URLs).
//
// Each association gets a clean, human-recognizable public URL of the form
//   https://yourcondomanager.org/community/<slug>
// resolving to its branded community hub (server: GET /api/hub/:identifier/public,
// client route: /community/:identifier). The slug is stored on
// hub_page_configs.slug (1:1 with the association's hub config; unique index
// `hub_page_configs_slug_uq`).
//
// Trust hinges on the slug being SHORT, CLEAN, RECOGNIZABLE, and UNAMBIGUOUS —
// "cherryhill" reads as an obviously-trustworthy community URL, where
// "cherry-hill-court-condominiums-llc" does not. This module is the single
// canonical source of slug rules so the API, the auto-populate path, and any
// future admin "edit slug" surface all agree.

/**
 * Words that must NEVER be used as a community slug. Two classes:
 *   1. Route/namespace words that would confuse a reader about where they are
 *      (even though /community/<slug> is namespaced and can't collide with a
 *      top-level route, "community/admin" or "community/login" looks like a
 *      system page and erodes the very trust the URL exists to build).
 *   2. Generic stop-words that produce a non-distinctive slug.
 * Comparison is case-insensitive against the final slug.
 */
export const RESERVED_COMMUNITY_SLUGS = new Set<string>([
  // route / API / system namespaces
  "api",
  "app",
  "admin",
  "portal",
  "public",
  "community",
  "login",
  "logout",
  "signup",
  "signin",
  "auth",
  "onboarding",
  "dashboard",
  "pricing",
  "solutions",
  "privacy",
  "terms",
  "support",
  "help",
  "about",
  "contact",
  "www",
  "static",
  "assets",
  "health",
  "status",
  "vendor",
  "vendors",
  "webhooks",
  "webhook",
  // too-generic / non-distinctive
  "hoa",
  "condo",
  "condos",
  "association",
  "associations",
  "home",
  "test",
  "demo",
  "new",
  "edit",
]);

/**
 * Legal/structure suffix words to drop when deriving a community slug from an
 * association's legal name. "Cherry Hill Court Condominiums" → "cherryhill"
 * reads far more trustworthy than the full legal name. Order doesn't matter;
 * any token matching one of these (case-insensitive) is dropped, BUT we never
 * drop so many tokens that nothing distinctive is left (see slugifyCommunityName).
 */
const STRUCTURE_WORDS = new Set<string>([
  "condominium",
  "condominiums",
  "condo",
  "condos",
  "association",
  "associations",
  "assoc",
  "hoa",
  "homeowners",
  "homeowner",
  "owners",
  "community",
  "communities",
  "court",
  "courts",
  "place",
  "estates",
  "estate",
  "village",
  "villas",
  "villa",
  "gardens",
  "garden",
  "commons",
  "common",
  "the",
  "of",
  "at",
  "and",
  "llc",
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "ltd",
]);

const MAX_SLUG_LEN = 40;

/** Normalize a raw string to lowercase ascii words: strips accents, lowercases,
 * splits on any non-alphanumeric run. */
function toWords(input: string): string[] {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Derive a clean, short, recognizable BASE slug from an association name.
 * Strategy:
 *   1. Tokenize into ascii words.
 *   2. Drop legal/structure stop-words (Condominiums, Association, Court, LLC…)
 *      — but only if at least one DISTINCTIVE word remains.
 *   3. Concatenate the distinctive words with NO separators ("cherryhill") for
 *      the cleanest, most memorable form. If that exceeds MAX_SLUG_LEN, fall
 *      back to a hyphenated form truncated to length.
 *
 * This does NOT guarantee uniqueness or reserved-word safety — pass the result
 * through ensureUniqueSlug() (or sanitizeSlug for a user-supplied slug).
 *
 * Examples:
 *   "Cherry Hill Court Condominiums"      -> "cherryhill"
 *   "The Oaks at Riverside HOA"           -> "oaksriverside"
 *   "Maple Grove Condominium Association" -> "maplegrove"
 *   "123 Main"                            -> "123main"
 */
export function slugifyCommunityName(name: string): string {
  const allWords = toWords(name);
  if (allWords.length === 0) return "";

  const distinctive = allWords.filter((w) => !STRUCTURE_WORDS.has(w));
  // Keep distinctive words if any survived; otherwise the name WAS entirely
  // structure words (e.g. "The Condominium Association") — fall back to all
  // words so we still produce something rather than an empty slug.
  const chosen = distinctive.length > 0 ? distinctive : allWords;

  const joined = chosen.join("");
  if (joined.length > 0 && joined.length <= MAX_SLUG_LEN) {
    return joined;
  }
  // Long name: hyphenate + truncate (cleaner to read than a giant run-on).
  const hyphenated = chosen.join("-").slice(0, MAX_SLUG_LEN).replace(/-+$/g, "");
  return hyphenated;
}

/**
 * Sanitize an arbitrary user-supplied slug into the canonical slug shape:
 * lowercase, ascii alphanumerics + single hyphens, no leading/trailing hyphen,
 * length-capped. Returns "" if nothing usable remains.
 */
export function sanitizeSlug(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LEN)
    .replace(/-+$/g, "");
}

/** True if `slug` is on the reserved list (case-insensitive, exact match). */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_COMMUNITY_SLUGS.has(slug.toLowerCase());
}

export interface EnsureUniqueSlugOptions {
  /** The desired base slug (already produced by slugifyCommunityName / sanitizeSlug). */
  base: string;
  /**
   * Async predicate: resolves true if `candidate` is ALREADY TAKEN by a
   * DIFFERENT association (the caller queries hub_page_configs.slug). The
   * caller is responsible for excluding the current association's own row so
   * re-saving an unchanged slug doesn't bump the suffix.
   */
  isTaken: (candidate: string) => Promise<boolean>;
  /** Fallback seed (e.g. association id) used if the base is empty/reserved. */
  fallbackSeed?: string;
  /** Max numeric suffix attempts before giving up and appending a short random tail. */
  maxAttempts?: number;
}

/**
 * Produce a FINAL, unique, reserved-word-safe slug.
 *  - Reserved or empty base → prefix the base (or fallbackSeed) to escape the
 *    reserved word (e.g. "portal" -> "portal-community").
 *  - Collisions → append "-2", "-3", … up to maxAttempts.
 *  - Exhausted → append a short random base-36 tail (last-resort, still clean).
 */
export async function ensureUniqueSlug(opts: EnsureUniqueSlugOptions): Promise<string> {
  const maxAttempts = opts.maxAttempts ?? 50;
  let base = sanitizeSlug(opts.base);

  if (!base) {
    base = sanitizeSlug(opts.fallbackSeed || "") || "community";
  }
  // Escape reserved words by suffixing a stable, still-clean token.
  if (isReservedSlug(base)) {
    base = `${base}-community`;
  }
  // Re-cap after any prefix/suffix mutation.
  base = base.slice(0, MAX_SLUG_LEN).replace(/-+$/g, "");

  if (!(await opts.isTaken(base))) {
    return base;
  }
  for (let n = 2; n <= maxAttempts; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, MAX_SLUG_LEN - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!(await opts.isTaken(candidate))) {
      return candidate;
    }
  }
  // Last resort: short random tail. Extremely unlikely to be reached.
  const tail = `-${Math.random().toString(36).slice(2, 6)}`;
  return `${base.slice(0, MAX_SLUG_LEN - tail.length).replace(/-+$/g, "")}${tail}`;
}
