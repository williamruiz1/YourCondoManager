// Unit tests for subdomain-redirect middleware (Issue #434).
//
// Tests exercise the middleware against stubbed Express req/res/next
// triples — no actual Express server is booted. The middleware is
// synchronous so this is sufficient to lock the redirect contract.

import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { subdomainRedirect, _testing } from "../../server/middleware/subdomain-redirect";

const APEX = "yourcondomanager.org";
const WWW = "www.yourcondomanager.org";
const APP = "app.yourcondomanager.org";

function mkReq(opts: { host: string; path: string; originalUrl?: string; cookie?: string }): Request {
  return {
    hostname: opts.host,
    path: opts.path,
    originalUrl: opts.originalUrl ?? opts.path,
    headers: opts.cookie ? { cookie: opts.cookie } : {},
  } as unknown as Request;
}

function mkRes(): Response & { _redirect?: { status: number; url: string } } {
  const res = {
    _redirect: undefined as undefined | { status: number; url: string },
    redirect(status: number | string, url?: string) {
      // Express supports both res.redirect(url) and res.redirect(status, url).
      if (typeof status === "number" && typeof url === "string") {
        (this as any)._redirect = { status, url };
      } else {
        (this as any)._redirect = { status: 302, url: String(status) };
      }
    },
  };
  return res as unknown as Response & { _redirect?: { status: number; url: string } };
}

function run(req: Request) {
  const res = mkRes();
  const next = vi.fn() as unknown as NextFunction;
  subdomainRedirect(req, res, next);
  return { res, next };
}

// ---- www → apex canonicalization ----

describe("www → apex canonicalization (301)", () => {
  it("www marketing page → apex marketing page", () => {
    const { res, next } = run(mkReq({ host: WWW, path: "/pricing" }));
    expect(res._redirect).toEqual({ status: 301, url: `https://${APEX}/pricing` });
    expect(next).not.toHaveBeenCalled();
  });

  it("www app path → apex (lets next request bounce apex → app)", () => {
    // Two-redirect trail: www/app/x → apex/app/x → app./app/x. Cleaner SEO
    // signal than a single www → app cross-subdomain redirect.
    const { res } = run(mkReq({ host: WWW, path: "/app/dashboard" }));
    expect(res._redirect).toEqual({ status: 301, url: `https://${APEX}/app/dashboard` });
  });

  it("www root → apex root", () => {
    const { res } = run(mkReq({ host: WWW, path: "/" }));
    expect(res._redirect).toEqual({ status: 301, url: `https://${APEX}/` });
  });
});

// ---- app-only paths from apex → app subdomain ----

describe("apex app-only paths → app subdomain (301)", () => {
  it("apex /app/dashboard → app./app/dashboard", () => {
    const { res, next } = run(mkReq({ host: APEX, path: "/app/dashboard" }));
    expect(res._redirect).toEqual({ status: 301, url: `https://${APP}/app/dashboard` });
    expect(next).not.toHaveBeenCalled();
  });

  it("apex /portal/dashboard → app./portal/dashboard", () => {
    const { res } = run(mkReq({ host: APEX, path: "/portal/dashboard" }));
    expect(res._redirect).toEqual({ status: 301, url: `https://${APP}/portal/dashboard` });
  });

  it("apex /pricing (marketing path) does NOT redirect", () => {
    const { res, next } = run(mkReq({ host: APEX, path: "/pricing" }));
    expect(res._redirect).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("apex / (root) does NOT redirect", () => {
    const { res, next } = run(mkReq({ host: APEX, path: "/" }));
    expect(res._redirect).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});

// ---- marketing paths from app subdomain (logged out) → apex ----

describe("app marketing paths from app subdomain (302, logged-out only)", () => {
  it("app /pricing logged-out → apex /pricing", () => {
    const { res, next } = run(mkReq({ host: APP, path: "/pricing" }));
    expect(res._redirect).toEqual({ status: 302, url: `https://${APEX}/pricing` });
    expect(next).not.toHaveBeenCalled();
  });

  it("app /privacy-policy logged-out → apex /privacy-policy", () => {
    const { res } = run(mkReq({ host: APP, path: "/privacy-policy" }));
    expect(res._redirect).toEqual({ status: 302, url: `https://${APEX}/privacy-policy` });
  });

  it("app / logged-out → apex /", () => {
    const { res } = run(mkReq({ host: APP, path: "/" }));
    expect(res._redirect).toEqual({ status: 302, url: `https://${APEX}/` });
  });

  it("app /pricing LOGGED IN → no redirect", () => {
    // sid cookie indicates a session; logged-in users on `app.` may have
    // arrived at /pricing via a stale bookmark — let them stay rather than
    // bouncing them out of the app shell.
    const { res, next } = run(mkReq({ host: APP, path: "/pricing", cookie: "sid=abc123; other=foo" }));
    expect(res._redirect).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("app /app/dashboard logged-out → no redirect (app path stays on app host)", () => {
    const { res, next } = run(mkReq({ host: APP, path: "/app/dashboard" }));
    expect(res._redirect).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});

// ---- never-redirect paths (API / webhooks / OAuth callback / portal login) ----

describe("never-redirect paths bypass the entire middleware", () => {
  it("API call on apex → no redirect", () => {
    const { res, next } = run(mkReq({ host: APEX, path: "/api/health" }));
    expect(res._redirect).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("API call on www → no redirect (NOT even www→apex)", () => {
    // www→apex normally fires for marketing-style paths, but the API is
    // host-agnostic by contract — clients call by hostname they were
    // configured with, redirecting would break them.
    const { res, next } = run(mkReq({ host: WWW, path: "/api/something" }));
    expect(res._redirect).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("OAuth callback on apex → no redirect (URI registered with Google)", () => {
    const { res, next } = run(mkReq({ host: APEX, path: "/api/auth/google/callback" }));
    expect(res._redirect).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("Stripe webhook on app → no redirect (URI registered with Stripe)", () => {
    const { res, next } = run(mkReq({ host: APP, path: "/api/webhooks/payments" }));
    expect(res._redirect).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("Plaid webhook on app → no redirect", () => {
    const { res, next } = run(mkReq({ host: APP, path: "/api/webhooks/plaid" }));
    expect(res._redirect).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("Portal login OTP request on app → no redirect (session not yet established)", () => {
    const { res, next } = run(mkReq({ host: APP, path: "/portal/login" }));
    expect(res._redirect).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("Portal OTP verify on app → no redirect", () => {
    const { res, next } = run(mkReq({ host: APP, path: "/portal/verify" }));
    expect(res._redirect).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("Portal login on apex → no redirect (works on either host pre-session)", () => {
    const { res, next } = run(mkReq({ host: APEX, path: "/portal/login" }));
    expect(res._redirect).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});

// ---- session-presence detection ----

describe("hasValidSession cookie detection", () => {
  it("returns true when sid= is present at start of cookie header", () => {
    const req = mkReq({ host: APP, path: "/", cookie: "sid=abc; other=xyz" });
    expect(_testing.hasValidSession(req)).toBe(true);
  });

  it("returns true when sid= is present mid-cookie-header", () => {
    const req = mkReq({ host: APP, path: "/", cookie: "first=a; sid=abc; last=z" });
    expect(_testing.hasValidSession(req)).toBe(true);
  });

  it("returns false when sid is absent", () => {
    const req = mkReq({ host: APP, path: "/", cookie: "other=foo; another=bar" });
    expect(_testing.hasValidSession(req)).toBe(false);
  });

  it("returns false when cookie header is absent", () => {
    const req = mkReq({ host: APP, path: "/" });
    expect(_testing.hasValidSession(req)).toBe(false);
  });

  it("returns false when a different cookie's VALUE contains 'sid=' substring (no false positive)", () => {
    // The regex anchors `sid=` to start-of-header or after `; ` — a value
    // containing the substring shouldn't trigger.
    const req = mkReq({ host: APP, path: "/", cookie: "foo=somesid=value; bar=baz" });
    expect(_testing.hasValidSession(req)).toBe(false);
  });
});

// ---- originalUrl preservation (query strings + fragments) ----

describe("redirects preserve originalUrl including query string", () => {
  it("apex /app/dashboard?tab=billing → app preserves query", () => {
    const { res } = run(mkReq({
      host: APEX,
      path: "/app/dashboard",
      originalUrl: "/app/dashboard?tab=billing&open=1",
    }));
    expect(res._redirect?.url).toBe(`https://${APP}/app/dashboard?tab=billing&open=1`);
  });

  it("www /pricing?ref=tweet → apex preserves query", () => {
    const { res } = run(mkReq({
      host: WWW,
      path: "/pricing",
      originalUrl: "/pricing?ref=tweet",
    }));
    expect(res._redirect?.url).toBe(`https://${APEX}/pricing?ref=tweet`);
  });
});

// ---- non-matching hosts fall through unchanged ----

describe("unknown hosts fall through", () => {
  it("localhost (dev) → no redirect", () => {
    const { res, next } = run(mkReq({ host: "localhost", path: "/pricing" }));
    expect(res._redirect).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("preview deploy host → no redirect", () => {
    const { res, next } = run(mkReq({ host: "ycm-pr-99.fly.dev", path: "/pricing" }));
    expect(res._redirect).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
