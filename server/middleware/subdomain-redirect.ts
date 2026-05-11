// Subdomain-aware routing middleware — per Issue #434.
//
// Splits the YCM HTTP surface across two host-scopes:
//   - `yourcondomanager.org` + `www.yourcondomanager.org` → marketing surface
//   - `app.yourcondomanager.org` → authenticated product
//
// Behavior:
//   1. `www.` → apex 301 (canonicalize).
//   2. `yourcondomanager.org` (root) + `/app/*` or `/portal/dashboard*` →
//      301 to `app.yourcondomanager.org` (app-only paths shouldn't live on
//      the marketing host).
//   3. `app.yourcondomanager.org` (logged out) hitting marketing paths
//      (`/`, `/pricing`, `/solutions`, `/privacy-policy`, `/terms-of-service`)
//      → 302 to apex.
//   4. Everything else: `next()`.
//
// Exclusions (NEVER redirect):
//   - `/api/*` — clients use specific host; redirecting would break them.
//   - `/api/auth/google/callback` — OAuth client is registered with a
//     specific URI; redirecting would break the callback flow.
//   - `/api/webhooks/*` — Stripe, Plaid, push webhooks point at specific
//     hostnames; redirecting would break webhook delivery.
//   - `/portal/login`, `/portal/verify` — owner OTP login should work on
//     either host until login completes.
//
// Logged-in detection: the middleware checks `req.user` (passport-populated)
// AND `req.session?.portalAccessId` (portal-OTP-populated) — if EITHER is
// set, treat as logged-in (don't bounce off the app subdomain).
//
// IMPORTANT — cookie domain caveat: as of 2026-05-11 the session cookie
// in server/index.ts is host-scoped (no explicit `domain` field). That
// means a session created on `app.yourcondomanager.org` is NOT visible on
// `yourcondomanager.org` (and vice versa). For the "logged-in user keeps
// navigating across hosts" path of this middleware to work correctly, a
// follow-on PR must set `domain: ".yourcondomanager.org"` on the session
// cookie. Until then, the middleware's logged-in detection works WITHIN
// a single host but cross-host navigation forces a re-login. Surfaced in
// PR description as a Phase-1.5 follow-up.

import type { Request, Response, NextFunction } from "express";

// Hostnames recognized as the YCM surface. Production-only; dev/preview
// hosts (e.g. `localhost`, `*.fly.dev` preview URLs) bypass the redirects
// entirely so local development isn't affected.
const APEX_HOST = "yourcondomanager.org";
const WWW_HOST = `www.${APEX_HOST}`;
const APP_HOST = `app.${APEX_HOST}`;

// Marketing pages that should live on the apex; bouncing logged-out users
// off `app.` and back to apex. Logged-in users keep navigating freely.
const MARKETING_PATHS = new Set<string>([
  "/",
  "/pricing",
  "/solutions",
  "/privacy",
  "/terms",
  "/privacy-policy",
  "/terms-of-service",
]);

// App-only prefixes that should not live on the marketing host. Hitting any
// of these on apex/www → 301 to app subdomain.
const APP_ONLY_PREFIXES = ["/app/", "/portal/dashboard"];

// Paths the middleware MUST NEVER redirect — regardless of host. Tested as
// prefixes (not equality) so all sub-paths under `/api/` etc are covered.
const NO_REDIRECT_PREFIXES = [
  "/api/", // all API endpoints — host-agnostic; clients use specific host
  "/api/auth/google/callback", // OAuth callback URI is registered with one host
  "/api/webhooks/", // Stripe/Plaid/push webhooks pointed at one host
];

// OTP login paths that should work on EITHER host until the session lands.
// After login the redirect logic kicks in normally.
const OTP_LOGIN_PATHS = new Set<string>(["/portal/login", "/portal/verify"]);

export type RedirectDecision =
  | { kind: "continue" }
  | { kind: "redirect"; status: 301 | 302; target: string };

/**
 * Pure decision function — exported for unit tests. Decides whether to
 * redirect (and where) based on host, path, and authenticated state. Does
 * NOT touch req/res; the caller wraps it in Express middleware below.
 */
export function decideSubdomainRedirect(opts: {
  host: string;
  originalUrl: string;
  path: string;
  isAuthenticated: boolean;
}): RedirectDecision {
  const { host, originalUrl, path, isAuthenticated } = opts;

  // Bypass for non-production hosts (localhost, preview, etc.).
  if (host !== APEX_HOST && host !== WWW_HOST && host !== APP_HOST) {
    return { kind: "continue" };
  }

  // NEVER redirect API / OAuth callback / webhooks / OTP login paths.
  for (const prefix of NO_REDIRECT_PREFIXES) {
    if (path.startsWith(prefix)) return { kind: "continue" };
  }
  if (OTP_LOGIN_PATHS.has(path)) return { kind: "continue" };

  // 1. www → apex canonicalization (highest priority — affects all paths).
  if (host === WWW_HOST) {
    return { kind: "redirect", status: 301, target: `https://${APEX_HOST}${originalUrl}` };
  }

  // 2. App-only paths from apex → app subdomain.
  if (host === APEX_HOST) {
    for (const prefix of APP_ONLY_PREFIXES) {
      if (path.startsWith(prefix)) {
        return { kind: "redirect", status: 301, target: `https://${APP_HOST}${originalUrl}` };
      }
    }
  }

  // 3. Marketing paths on app subdomain (logged out only) → apex.
  if (host === APP_HOST && !isAuthenticated && MARKETING_PATHS.has(path)) {
    return { kind: "redirect", status: 302, target: `https://${APEX_HOST}${originalUrl}` };
  }

  return { kind: "continue" };
}

/**
 * Express middleware wrapping `decideSubdomainRedirect`. Wires into the
 * Express app in server/index.ts BEFORE the SPA-shell fallback so the
 * redirects happen at HTTP-layer, not after the SPA renders.
 */
export function subdomainRedirectMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Express normalises req.hostname for proxy-style trusted proxies.
  // `proxy: true` is set on the session, so we trust X-Forwarded-Host.
  const host = req.hostname?.toLowerCase() ?? "";
  const path = req.path;
  const originalUrl = req.originalUrl;

  // Authenticated state: passport's req.user OR portal's session-stored
  // portalAccessId. The portal path stores access state on the session
  // directly (per server/routes.ts portal-OTP flow) rather than via
  // passport's req.user.
  const sessionAny = req.session as unknown as { portalAccessId?: unknown } | undefined;
  const isAuthenticated = Boolean(req.user) || Boolean(sessionAny?.portalAccessId);

  const decision = decideSubdomainRedirect({ host, originalUrl, path, isAuthenticated });
  if (decision.kind === "redirect") {
    res.redirect(decision.status, decision.target);
    return;
  }
  next();
}
