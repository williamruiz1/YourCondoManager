/**
 * Tenant sending alias resolver (feature: per-HOA / per-PM sending identity).
 *
 * Lets owner-facing email be sent FROM a recognizable per-association alias on
 * the verified `yourcondomanager.org` domain — e.g.
 *   "Cherry Hill Court" <cherryhill@yourcondomanager.org>
 * with a Reply-To pointing at the tenant's real support inbox — instead of the
 * generic system `noreply@yourcondomanager.org`.
 *
 * SECURITY (load-bearing — see docs/operations/tenant-sending-alias-spec.md §4):
 *   - The From address is ALWAYS server-derived from `associationId`. No caller
 *     ever supplies a from-address, so one tenant can never send as another's.
 *   - `email_slug` is GLOBALLY UNIQUE (DB partial unique index), so the alias is
 *     a 1:1 binding to its association.
 *   - Reserved system local-parts (support/privacy/legal/noreply/…) can never be
 *     claimed by a tenant — protects the legal + system aliases.
 *
 * REVERSIBILITY:
 *   - Gated by `TENANT_SENDING_ALIAS_ENABLED` (default OFF). Flag off, or no slug
 *     configured for the association → the GLOBAL default From is returned, so
 *     existing behavior is unchanged.
 *
 * This file deliberately splits PURE logic (slug gen/validate, From composition)
 * — unit-testable with no DB — from the DB-backed `resolveTenantSender`.
 */

import { eq, and, ne, isNotNull } from "drizzle-orm";
import { db } from "../db.js";
import { tenantConfigs } from "@shared/schema";

/** The single verified sending domain. */
export const SENDING_DOMAIN = "yourcondomanager.org";

/**
 * Local-parts that a tenant may NEVER claim as a sending alias. Protects the
 * system addresses and the legal/policy aliases (support@, privacy@, legal@)
 * that the privacy policy + terms reference, plus standard RFC mailbox roles.
 */
export const RESERVED_LOCAL_PARTS: ReadonlySet<string> = new Set([
  "noreply",
  "no-reply",
  "support",
  "contact",
  "privacy",
  "legal",
  "security",
  "sales",
  "admin",
  "info",
  "postmaster",
  "abuse",
  "hostmaster",
  "webmaster",
  "mailer-daemon",
  "bounce",
  "bounces",
  "dmarc",
  "www",
  "mail",
]);

const SLUG_MIN = 3;
const SLUG_MAX = 40;
const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export type SlugValidation =
  | { ok: true; slug: string }
  | { ok: false; reason: string };

/** Is the tenant-alias feature globally enabled? (default OFF / reversible) */
export function isTenantAliasEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.TENANT_SENDING_ALIAS_ENABLED ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(raw);
}

/**
 * Derive a candidate slug from an association name. Lowercases, keeps only
 * [a-z0-9-], collapses runs of '-', trims leading/trailing '-', and clamps to
 * SLUG_MAX. Returns "" if nothing usable remains (caller falls back).
 */
export function slugifyAssociationName(name: string): string {
  const base = (name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, ""); // re-trim if the slice landed on a '-'
  return base;
}

/**
 * Validate a (already-lowercased-intent) candidate slug against the format,
 * length, and reserved-list rules. Does NOT check DB uniqueness (that is the
 * resolver's job, since it needs the DB).
 */
export function validateSlug(candidate: string): SlugValidation {
  const slug = (candidate ?? "").trim().toLowerCase();
  if (slug.length < SLUG_MIN) {
    return { ok: false, reason: `Alias must be at least ${SLUG_MIN} characters.` };
  }
  if (slug.length > SLUG_MAX) {
    return { ok: false, reason: `Alias must be at most ${SLUG_MAX} characters.` };
  }
  if (!SLUG_RE.test(slug)) {
    return {
      ok: false,
      reason:
        "Alias may contain only lowercase letters, numbers, and hyphens, and may not start or end with a hyphen.",
    };
  }
  if (RESERVED_LOCAL_PARTS.has(slug)) {
    return { ok: false, reason: `"${slug}" is a reserved address and cannot be used as a tenant alias.` };
  }
  return { ok: true, slug };
}

/**
 * Compose the canonical alias address from a validated slug.
 * e.g. "cherryhill" → "cherryhill@yourcondomanager.org"
 */
export function aliasAddress(slug: string): string {
  return `${slug}@${SENDING_DOMAIN}`;
}

/**
 * Compose the RFC 5322 From header from a display name + alias address.
 * Quotes the display name and strips control chars / quotes that could break
 * the header (defense-in-depth; the display name is admin-controlled).
 */
export function composeFromHeader(displayName: string | null | undefined, address: string): string {
  const clean = (displayName ?? "")
    .replace(/["\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return address;
  return `"${clean}" <${address}>`;
}

export type TenantSender = {
  /** Full From header, e.g. `"Cherry Hill Court" <cherryhill@yourcondomanager.org>`. */
  fromHeader: string;
  /** Just the address, e.g. `cherryhill@yourcondomanager.org`. */
  fromAddress: string;
  /** Friendly display name (may be null when falling back to the global default). */
  fromName: string | null;
  /** Reply-To address owners' replies should reach. */
  replyTo: string | null;
  /** Where the sender resolved from. */
  source: "tenant-alias" | "global-default";
};

/** The global fallback sender (current behavior). */
export function globalDefaultSender(env: NodeJS.ProcessEnv = process.env): TenantSender {
  const fromAddress =
    env.EMAIL_FROM_ADDRESS?.trim() ||
    env.EMAIL_FROM?.trim() ||
    `noreply@${SENDING_DOMAIN}`;
  const fromName = env.EMAIL_FROM_NAME?.trim() || null;
  const replyTo = env.EMAIL_REPLY_TO?.trim() || null;
  // EMAIL_FROM may already be a composed "Name <addr>" header — keep it whole.
  const fromHeader = fromName ? composeFromHeader(fromName, fromAddress) : fromAddress;
  return { fromHeader, fromAddress, fromName, replyTo, source: "global-default" };
}

/**
 * Compose a tenant sender from already-loaded config fields (PURE — no DB).
 * Returns null when the tenant has no valid alias configured, so the caller
 * falls back to the global default.
 */
export function composeTenantSender(
  cfg: {
    emailSlug?: string | null;
    emailDisplayName?: string | null;
    emailReplyToOverride?: string | null;
    supportEmail?: string | null;
  } | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): TenantSender | null {
  const slug = cfg?.emailSlug?.trim().toLowerCase();
  if (!slug) return null;
  // Re-validate on read: a slug that somehow became invalid (e.g. a reserved
  // word added to the list later) must NOT be used to send.
  const v = validateSlug(slug);
  if (!v.ok) return null;

  const fromAddress = aliasAddress(v.slug);
  const fromName = cfg?.emailDisplayName?.trim() || null;
  const replyTo =
    cfg?.emailReplyToOverride?.trim() ||
    cfg?.supportEmail?.trim() ||
    env.EMAIL_REPLY_TO?.trim() ||
    null;
  return {
    fromHeader: composeFromHeader(fromName, fromAddress),
    fromAddress,
    fromName,
    replyTo,
    source: "tenant-alias",
  };
}

/**
 * DB-backed resolver. Given an associationId, return the tenant sender (alias)
 * when the feature is enabled AND the tenant has a valid alias; otherwise the
 * global default. NEVER throws on a missing tenant — falls back safely.
 *
 * The lookup is BY associationId, so it can only ever return THAT association's
 * alias — the core anti-spoofing guarantee at the resolve boundary.
 */
export async function resolveTenantSender(
  associationId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): Promise<TenantSender> {
  if (!associationId || !isTenantAliasEnabled(env)) {
    return globalDefaultSender(env);
  }
  try {
    const [cfg] = await db
      .select({
        emailSlug: tenantConfigs.emailSlug,
        emailDisplayName: tenantConfigs.emailDisplayName,
        emailReplyToOverride: tenantConfigs.emailReplyToOverride,
        supportEmail: tenantConfigs.supportEmail,
      })
      .from(tenantConfigs)
      .where(eq(tenantConfigs.associationId, associationId));
    const tenant = composeTenantSender(cfg, env);
    return tenant ?? globalDefaultSender(env);
  } catch (err) {
    // Resolver is on the send hot-path; a config-read failure must never block
    // a send. Fall back to the global default.
    console.warn("[tenant-sender] resolve failed; using global default", err);
    return globalDefaultSender(env);
  }
}

/**
 * Is `slug` available to claim for `associationId`? Checks the global-uniqueness
 * constraint at the application layer (the DB also enforces it via the partial
 * unique index — this gives a friendly 400 instead of a constraint error).
 * A slug already owned by the SAME association is "available" (no-op rename).
 */
export async function isSlugAvailable(
  slug: string,
  associationId: string,
): Promise<boolean> {
  const v = validateSlug(slug);
  if (!v.ok) return false;
  const rows = await db
    .select({ associationId: tenantConfigs.associationId })
    .from(tenantConfigs)
    .where(
      and(
        eq(tenantConfigs.emailSlug, v.slug),
        isNotNull(tenantConfigs.emailSlug),
        ne(tenantConfigs.associationId, associationId),
      ),
    );
  return rows.length === 0;
}
