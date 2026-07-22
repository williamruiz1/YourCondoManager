/**
 * William-only contextual feedback intake helpers.
 *
 * YCM is the only operational dependency: this module owns the server-side
 * identity allowlist, route sanitization, secret redaction, and stable retry
 * key used by the first-party Feedback Center.
 */

import { createHash } from "node:crypto";

const FOUNDER_FEEDBACK_ALLOWED_EMAILS = new Set(
  ["chcmgmt18@gmail.com", "yourcondomanagement@gmail.com"].map((email) => email.toLowerCase()),
);

export function isFounderFeedbackEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return FOUNDER_FEEDBACK_ALLOWED_EMAILS.has(email.trim().toLowerCase());
}

/**
 * Route context is useful; query strings and fragments are not. Strip them
 * before persistence or logging so magic-link tokens and other sensitive URL
 * parameters never enter the feedback ledger.
 */
export function sanitizeFounderFeedbackRoute(route: string): string {
  return route.split(/[?#]/, 1)[0] || "/";
}

const SECRET_PATTERNS: RegExp[] = [
  /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{12,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*\b/gi,
  /\b((?:api[_-]?key|token|secret|password|authorization)\s*[:=]\s*)[^\s,;]+/gi,
  /([?&](?:token|code|secret|key|signature|access_token)=)[^&#\s]+/gi,
];

export function redactFounderFeedbackText(value: string | null | undefined): string | null {
  if (value == null) return null;
  let redacted = value;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, (_match, prefix?: string) => `${prefix || ""}[REDACTED]`);
  }
  return redacted;
}

export function buildFounderFeedbackDedupeKey(input: {
  email: string;
  route: string;
  severity: string | null;
  note: string;
  createdAt: Date;
}): string {
  const tenMinuteBucket = Math.floor(input.createdAt.getTime() / 600_000);
  const normalized = [
    input.email.trim().toLowerCase(),
    sanitizeFounderFeedbackRoute(input.route),
    input.severity || "unspecified",
    input.note.trim().replace(/\s+/g, " ").toLowerCase(),
    tenMinuteBucket,
  ].join("\n");
  return createHash("sha256").update(normalized).digest("hex");
}

/** Fly injects FLY_IMAGE_REF, giving every intake record a deployed-version locator. */
export function resolveAppVersion(): string {
  return process.env.FLY_IMAGE_REF || process.env.npm_package_version || "unknown";
}
