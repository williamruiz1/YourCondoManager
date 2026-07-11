import { describe, it, expect } from "vitest";
import { isPortalAccessIdleExpired, PORTAL_SESSION_MAX_AGE_MS } from "./portal-session-expiry";

const DAY = 24 * 60 * 60 * 1000;

describe("isPortalAccessIdleExpired (A-AUTH-005 — shared 30-day idle expiry)", () => {
  it("is 30 days", () => {
    expect(PORTAL_SESSION_MAX_AGE_MS).toBe(30 * DAY);
  });

  it("null/absent lastLoginAt is NOT expired (matches resolvePortalAccessContext)", () => {
    expect(isPortalAccessIdleExpired({ lastLoginAt: null })).toBe(false);
    expect(isPortalAccessIdleExpired({})).toBe(false);
  });

  it("a login within 30 days is NOT expired", () => {
    expect(isPortalAccessIdleExpired({ lastLoginAt: new Date(Date.now() - 1 * DAY) })).toBe(false);
    expect(isPortalAccessIdleExpired({ lastLoginAt: new Date(Date.now() - 29 * DAY) })).toBe(false);
  });

  it("a login older than 30 days IS expired", () => {
    expect(isPortalAccessIdleExpired({ lastLoginAt: new Date(Date.now() - 31 * DAY) })).toBe(true);
    expect(isPortalAccessIdleExpired({ lastLoginAt: new Date(Date.now() - 400 * DAY) })).toBe(true);
  });

  it("accepts a string lastLoginAt", () => {
    const old = new Date(Date.now() - 60 * DAY).toISOString();
    expect(isPortalAccessIdleExpired({ lastLoginAt: old })).toBe(true);
  });
});
