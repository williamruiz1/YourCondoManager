// Subdomain-aware redirect middleware (Issue #434).
//
// YCM serves the same React SPA at three hostnames (Fly.io, Let's Encrypt
// certs issued 2026-05-11):
//
//   yourcondomanager.org       (apex; marketing surface)
//   www.yourcondomanager.org   (alias; canonicalized to apex)
//   app.yourcondomanager.org   (authenticated product)
//
// This middleware enforces the marketing/app split (Stripe/Linear style):
//
//   - www → apex redirect (301)
//   - app-only paths from root → app subdomain (301)
//   - marketing paths from app subdomain (logged-out) → root (302)
//   - api / webhook / oauth-callback / portal-login paths → never redirect
//
// Logged-in users on `app.` see no marketing-path redirects — they may have
// arrived there via a stale bookmark and we don't want to bounce them out
// of the app. Session detection is via the `sid` cookie name (matches the
// session config in server/index.ts).

import type { Request, Response, NextFunction } from "express";

const APEX_HOST = "yourcondomanager.org";
const WWW_HOST = "www.yourcondomanager.org";
const APP_HOST = "app.yourcondomanager.org";

// Marketing paths that should bounce from `app.` to apex when the visitor
// has no authenticated session. Anything not on this list is left alone on
// either host (the SPA's client-side router resolves it).
const MARKETING_PATHS = new Set<string>([
  "/",
  "/pricing",
  "/solutions",
  "/privacy-policy",
  "/terms-of-service",
  "/cookie-policy",
]);

// App-only path prefixes that should bounce from root/www to `app.`.
// `/app/*` covers the authenticated admin surface; `/portal/dashboard`
// is the post-login owner portal (the OTP-request and verify endpoints
// stay on either host until login completes).
const APP_PATH_PREFIXES = [
  "/app/",
  "/portal/dashboard",
];

// Paths that must NEVER be redirected — they're host-agnostic by contract
// or have specific URI registrations with external services.
const NEVER_REDIRECT_PREFIXES = [
  "/api/",                    // API is host-agnostic; redirecting would break clients
  "/api/auth/google/callback", // OAuth callback URI is registered with Google
  "/api/webhooks/",           // Stripe / Plaid / push webhooks point at specific URLs
];

// Owner portal login surfaces (request OTP + verify) must work on either
// host until the session is established. After login the user is on `app.`
// via normal navigation.
const NEVER_REDIRECT_EXACT = new Set<string>([
  "/portal/login",
  "/portal/verify",
]);

// The session cookie name; matches server/index.ts session({ name }) — kept
// here as a const rather than imported to avoid a circular dependency on
// the index module that wires this middleware in.
const SESSION_COOKIE_NAME = "sid";

function hasValidSession(req: Request): boolean {
  // Cookie-presence check only — we don't validate the session here; that
  // would require an async DB lookup and we want this middleware to stay
  // synchronous + fast. False positives (expired cookies that still exist)
  // are acceptable: they mean a logged-out user with a stale cookie won't
  // get bounced from `app.` to root. The worst case is the user lands on
  // the app shell and sees the login screen — which is correct behavior.
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return false;
  // Cookie header format: "name1=v1; name2=v2; ..." — match `sid=` after
  // start or "; ". Avoids the false-positive where a cookie's VALUE happens
  // to contain "sid=" as a substring.
  return /(^|;\s*)sid=/.test(cookieHeader);
}

function isNeverRedirect(path: string): boolean {
  if (NEVER_REDIRECT_EXACT.has(path)) return true;
  for (const prefix of NEVER_REDIRECT_PREFIXES) {
    if (path.startsWith(prefix)) return true;
  }
  return false;
}

function isAppPath(path: string): boolean {
  for (const prefix of APP_PATH_PREFIXES) {
    if (path === prefix || path.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Express middleware. Place AFTER `app.set("trust proxy", true)` (so
 * `req.hostname` reflects the original Host header behind Fly's proxy)
 * and BEFORE any body-parsing or route handlers (so we don't waste cycles
 * parsing a body for a request we're about to redirect).
 */
export function subdomainRedirect(req: Request, res: Response, next: NextFunction): void {
  const host = req.hostname; // requires trust proxy = true behind Fly
  const path = req.path;

  // Never redirect API / webhook / OAuth-callback / portal-login surfaces.
  if (isNeverRedirect(path)) return next();

  // www → apex canonicalization. 301 (permanent) so SEO + browsers cache.
  // This branch must run BEFORE the root/app split below so a www request
  // for an app-only path lands on apex first, then gets a second redirect
  // to app — clean SEO trail vs a single www→app redirect that crosses
  // two subdomain boundaries.
  if (host === WWW_HOST) {
    return res.redirect(301, `https://${APEX_HOST}${req.originalUrl}`);
  }

  const isAppHost = host === APP_HOST;
  const isRootHost = host === APEX_HOST;

  // App-only paths arriving on root → bounce to app subdomain. 301 because
  // these URLs should never have been on root in the first place; permanent
  // redirect lets browsers and SEO crawlers update their references.
  if (isRootHost && isAppPath(path)) {
    return res.redirect(301, `https://${APP_HOST}${req.originalUrl}`);
  }

  // Marketing paths arriving on app subdomain, logged out → bounce to apex.
  // 302 because the user may legitimately want to view marketing from the
  // app subdomain in the future (e.g., once we add an in-app "back to
  // marketing site" link); we don't want to permanently teach browsers
  // that these URLs live only on root.
  if (isAppHost && MARKETING_PATHS.has(path) && !hasValidSession(req)) {
    return res.redirect(302, `https://${APEX_HOST}${req.originalUrl}`);
  }

  // Everything else falls through to the SPA + route handlers unchanged.
  next();
}

// Exported for unit tests — these are intentionally NOT part of the public
// middleware API but tests need to assert on the same constants the
// middleware uses so the test contract is the actual contract.
export const _testing = {
  APEX_HOST,
  WWW_HOST,
  APP_HOST,
  MARKETING_PATHS,
  APP_PATH_PREFIXES,
  NEVER_REDIRECT_PREFIXES,
  NEVER_REDIRECT_EXACT,
  SESSION_COOKIE_NAME,
  hasValidSession,
  isNeverRedirect,
  isAppPath,
};
