// Issue #447 — session cookie parent-domain scoping resolver.
//
// Extracted as a named helper so unit tests can pin the production default
// (`.yourcondomanager.org`), the env override (`SESSION_COOKIE_DOMAIN`),
// and the dev/preview host-only fallback behavior without booting the app.
//
// Behavior contract:
//   - In NON-production environments (NODE_ENV !== "production"): always
//     returns `undefined` (host-only cookie scope; dev uses `sid_dev` and
//     cross-host persistence is not a concern at localhost or *.fly.dev
//     preview URLs).
//   - In production:
//     - When env var is unset (`undefined`): defaults to
//       `.yourcondomanager.org` per RFC 6265 parent-domain pattern that
//       covers the apex + every subdomain.
//     - When env var is an explicit empty string after trimming: returns
//       `undefined` (host-only). Escape hatch for emergency host-only
//       rollback without re-deploying.
//     - When env var is any other non-empty string: returns the trimmed
//       value verbatim. Allows preview deploys or future domain changes.

const DEFAULT_PRODUCTION_DOMAIN = ".yourcondomanager.org";

export function resolveSessionCookieDomain(
  isProduction: boolean,
  envOverride: string | undefined,
): string | undefined {
  if (!isProduction) return undefined;
  const raw = (envOverride ?? DEFAULT_PRODUCTION_DOMAIN).trim();
  return raw === "" ? undefined : raw;
}

export const _testing = {
  DEFAULT_PRODUCTION_DOMAIN,
};
