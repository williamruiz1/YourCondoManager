// Unit tests for the subdomain-aware routing decision logic (Issue #434).
// Exercises the pure `decideSubdomainRedirect` helper against the spec's
// 9-row test matrix + edge cases.

import { describe, it, expect } from "vitest";
import { decideSubdomainRedirect } from "../server/middleware/subdomain-redirect";

describe("decideSubdomainRedirect — Issue #434 §5 test matrix", () => {
  it("www → apex 301 (canonicalize)", () => {
    expect(
      decideSubdomainRedirect({
        host: "www.yourcondomanager.org",
        originalUrl: "/pricing",
        path: "/pricing",
        isAuthenticated: false,
      }),
    ).toEqual({
      kind: "redirect",
      status: 301,
      target: "https://yourcondomanager.org/pricing",
    });
  });

  it("logged-out app subdomain hitting root → 302 to apex", () => {
    expect(
      decideSubdomainRedirect({
        host: "app.yourcondomanager.org",
        originalUrl: "/",
        path: "/",
        isAuthenticated: false,
      }),
    ).toEqual({
      kind: "redirect",
      status: 302,
      target: "https://yourcondomanager.org/",
    });
  });

  it("logged-in app subdomain hitting root → no redirect (let them navigate)", () => {
    expect(
      decideSubdomainRedirect({
        host: "app.yourcondomanager.org",
        originalUrl: "/",
        path: "/",
        isAuthenticated: true,
      }),
    ).toEqual({ kind: "continue" });
  });

  it("apex hitting /app/dashboard → 301 to app subdomain", () => {
    expect(
      decideSubdomainRedirect({
        host: "yourcondomanager.org",
        originalUrl: "/app/dashboard?tab=billing",
        path: "/app/dashboard",
        isAuthenticated: false,
      }),
    ).toEqual({
      kind: "redirect",
      status: 301,
      target: "https://app.yourcondomanager.org/app/dashboard?tab=billing",
    });
  });

  it("apex hitting /portal/dashboard → 301 to app subdomain", () => {
    expect(
      decideSubdomainRedirect({
        host: "yourcondomanager.org",
        originalUrl: "/portal/dashboard",
        path: "/portal/dashboard",
        isAuthenticated: false,
      }),
    ).toEqual({
      kind: "redirect",
      status: 301,
      target: "https://app.yourcondomanager.org/portal/dashboard",
    });
  });

  it("apex hitting /api/health → no redirect (API exclusion)", () => {
    expect(
      decideSubdomainRedirect({
        host: "yourcondomanager.org",
        originalUrl: "/api/health",
        path: "/api/health",
        isAuthenticated: false,
      }),
    ).toEqual({ kind: "continue" });
  });

  it("app subdomain /api/auth/google/callback → no redirect (OAuth callback exclusion)", () => {
    expect(
      decideSubdomainRedirect({
        host: "app.yourcondomanager.org",
        originalUrl: "/api/auth/google/callback?code=...",
        path: "/api/auth/google/callback",
        isAuthenticated: false,
      }),
    ).toEqual({ kind: "continue" });
  });

  it("app subdomain /api/webhooks/payments → no redirect (webhook exclusion)", () => {
    expect(
      decideSubdomainRedirect({
        host: "app.yourcondomanager.org",
        originalUrl: "/api/webhooks/payments",
        path: "/api/webhooks/payments",
        isAuthenticated: false,
      }),
    ).toEqual({ kind: "continue" });
  });

  it("apex /portal/login (logged-out OTP) → no redirect (OTP exclusion)", () => {
    expect(
      decideSubdomainRedirect({
        host: "yourcondomanager.org",
        originalUrl: "/portal/login",
        path: "/portal/login",
        isAuthenticated: false,
      }),
    ).toEqual({ kind: "continue" });
  });
});

describe("decideSubdomainRedirect — additional edge cases", () => {
  it("apex hitting /pricing (marketing on marketing host) → no redirect", () => {
    expect(
      decideSubdomainRedirect({
        host: "yourcondomanager.org",
        originalUrl: "/pricing",
        path: "/pricing",
        isAuthenticated: false,
      }),
    ).toEqual({ kind: "continue" });
  });

  it("logged-out app subdomain hitting /pricing → 302 to apex", () => {
    expect(
      decideSubdomainRedirect({
        host: "app.yourcondomanager.org",
        originalUrl: "/pricing",
        path: "/pricing",
        isAuthenticated: false,
      }),
    ).toEqual({
      kind: "redirect",
      status: 302,
      target: "https://yourcondomanager.org/pricing",
    });
  });

  it("logged-in app subdomain hitting /pricing → no redirect (logged-in users keep navigating)", () => {
    expect(
      decideSubdomainRedirect({
        host: "app.yourcondomanager.org",
        originalUrl: "/pricing",
        path: "/pricing",
        isAuthenticated: true,
      }),
    ).toEqual({ kind: "continue" });
  });

  it("logged-out app subdomain hitting /privacy → 302 to apex", () => {
    expect(
      decideSubdomainRedirect({
        host: "app.yourcondomanager.org",
        originalUrl: "/privacy",
        path: "/privacy",
        isAuthenticated: false,
      }),
    ).toEqual({
      kind: "redirect",
      status: 302,
      target: "https://yourcondomanager.org/privacy",
    });
  });

  it("apex hitting /app deep path with query string → preserves originalUrl in redirect", () => {
    const r = decideSubdomainRedirect({
      host: "yourcondomanager.org",
      originalUrl: "/app/financial/bank-connections?tab=accounts",
      path: "/app/financial/bank-connections",
      isAuthenticated: false,
    });
    expect(r).toEqual({
      kind: "redirect",
      status: 301,
      target: "https://app.yourcondomanager.org/app/financial/bank-connections?tab=accounts",
    });
  });

  it("localhost (dev) → no redirect (bypass for non-prod hosts)", () => {
    expect(
      decideSubdomainRedirect({
        host: "localhost",
        originalUrl: "/app/dashboard",
        path: "/app/dashboard",
        isAuthenticated: false,
      }),
    ).toEqual({ kind: "continue" });
  });

  it("fly preview host → no redirect", () => {
    expect(
      decideSubdomainRedirect({
        host: "yourcondomanager-pr-123.fly.dev",
        originalUrl: "/",
        path: "/",
        isAuthenticated: false,
      }),
    ).toEqual({ kind: "continue" });
  });

  it("www → apex preserves /app prefix path (single 301, not chained)", () => {
    // www + /app/dashboard hits the www-canonicalization rule FIRST (priority);
    // landing on apex, the next request will then bounce to app-subdomain.
    // We don't optimize that into a single 301 — keeps the truth table simple.
    expect(
      decideSubdomainRedirect({
        host: "www.yourcondomanager.org",
        originalUrl: "/app/dashboard",
        path: "/app/dashboard",
        isAuthenticated: false,
      }),
    ).toEqual({
      kind: "redirect",
      status: 301,
      target: "https://yourcondomanager.org/app/dashboard",
    });
  });
});
