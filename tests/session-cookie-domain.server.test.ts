// Unit tests for resolveSessionCookieDomain (Issue #447).
//
// Pins the production default + env override + dev/preview host-only
// behavior without booting the full app.

import { describe, it, expect } from "vitest";
import { resolveSessionCookieDomain, _testing } from "../server/session-cookie-domain";

describe("resolveSessionCookieDomain — production behavior", () => {
  it("defaults to .yourcondomanager.org when env var is undefined", () => {
    expect(resolveSessionCookieDomain(true, undefined)).toBe(".yourcondomanager.org");
  });

  it("honors SESSION_COOKIE_DOMAIN env override (custom domain)", () => {
    expect(resolveSessionCookieDomain(true, ".preview.example.com")).toBe(".preview.example.com");
  });

  it("trims whitespace from the env override", () => {
    expect(resolveSessionCookieDomain(true, "  .ycm.test  ")).toBe(".ycm.test");
  });

  it("treats explicit empty string env override as host-only fallback", () => {
    // Emergency host-only rollback path without re-deploying — set the env
    // var to empty string in production to revert to the pre-#447 behavior.
    expect(resolveSessionCookieDomain(true, "")).toBeUndefined();
  });

  it("treats whitespace-only env override as host-only fallback", () => {
    expect(resolveSessionCookieDomain(true, "   ")).toBeUndefined();
  });

  it("returns the trimmed verbatim value for any non-empty production override", () => {
    // No validation that the override is a valid domain — operator's
    // responsibility. Helper trusts the env input.
    expect(resolveSessionCookieDomain(true, "anything-goes")).toBe("anything-goes");
  });
});

describe("resolveSessionCookieDomain — non-production behavior", () => {
  it("always returns undefined when isProduction=false (no env override)", () => {
    expect(resolveSessionCookieDomain(false, undefined)).toBeUndefined();
  });

  it("ignores SESSION_COOKIE_DOMAIN when isProduction=false (env value present)", () => {
    // Belt-and-suspenders: even if the env var leaks into a dev environment,
    // we don't want a parent-domain cookie scope at localhost or *.fly.dev
    // preview URLs (where the dev cookie name is `sid_dev` anyway).
    expect(resolveSessionCookieDomain(false, ".yourcondomanager.org")).toBeUndefined();
    expect(resolveSessionCookieDomain(false, ".preview.example.com")).toBeUndefined();
  });

  it("ignores even an empty-string env override in non-production (host-only is correct anyway)", () => {
    expect(resolveSessionCookieDomain(false, "")).toBeUndefined();
  });
});

describe("DEFAULT_PRODUCTION_DOMAIN constant", () => {
  it("matches the documented production default", () => {
    expect(_testing.DEFAULT_PRODUCTION_DOMAIN).toBe(".yourcondomanager.org");
  });

  it("starts with a leading dot (parent-domain pattern per RFC 6265)", () => {
    expect(_testing.DEFAULT_PRODUCTION_DOMAIN.startsWith(".")).toBe(true);
  });
});
