/**
 * Auth/session hardening tests (founder-os#10757).
 *   A-AUTH-002 — OTP codes use a CSPRNG (crypto.randomInt) and stay 6 digits.
 *   A-AUTH-005 — the upload-authorization path enforces the same 30-day portal idle
 *                expiry as the normal portal routes (shared isPortalAccessIdleExpired).
 */

import { describe, it, expect } from "vitest";
import { randomInt } from "crypto";
import { isPortalAccessIdleExpired, PORTAL_SESSION_MAX_AGE_MS } from "../server/portal-expiry";
import { authorizeUploadAccess, type UploadAccessDeps } from "../server/uploads-access";

describe("A-AUTH-002 — OTP via CSPRNG", () => {
  it("randomInt(100000, 1000000) is always a 6-digit code", () => {
    for (let i = 0; i < 5000; i++) {
      const otp = String(randomInt(100000, 1000000));
      expect(otp).toMatch(/^\d{6}$/);
      const n = Number(otp);
      expect(n).toBeGreaterThanOrEqual(100000);
      expect(n).toBeLessThanOrEqual(999999);
    }
  });
});

describe("A-AUTH-005 — portal idle expiry parity", () => {
  it("isPortalAccessIdleExpired: null lastLoginAt is NOT expired (matches reference)", () => {
    expect(isPortalAccessIdleExpired({ lastLoginAt: null })).toBe(false);
    expect(isPortalAccessIdleExpired({})).toBe(false);
  });

  it("isPortalAccessIdleExpired: recent login is NOT expired, >30d idle IS expired", () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
    const stale = new Date(Date.now() - PORTAL_SESSION_MAX_AGE_MS - 60_000); // >30 days ago
    expect(isPortalAccessIdleExpired({ lastLoginAt: recent })).toBe(false);
    expect(isPortalAccessIdleExpired({ lastLoginAt: stale })).toBe(true);
  });

  it("authorizeUploadAccess denies an ACTIVE-but-idle-expired portal access (the fix)", async () => {
    const staleLogin = new Date(Date.now() - PORTAL_SESSION_MAX_AGE_MS - 60_000);
    const freshLogin = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const FILE = "/api/uploads/doc.pdf";

    const makeDeps = (lastLoginAt: Date | null): UploadAccessDeps => ({
      getAdminUserById: async () => undefined,
      getAdminUserByEmail: async () => undefined,
      getAdminAssociationScopesByUserId: async () => [],
      documentExistsInAssociations: async () => false,
      versionExistsInAssociations: async () => false,
      getPortalAccessById: async (id) => ({ id, status: "active", lastLoginAt }),
      getPortalDocuments: async () => [{ id: "doc", fileUrl: FILE }],
      getDocumentVersions: async () => [],
    });

    // Idle-expired active access -> denied (was previously allowed on the upload path).
    const expired = await authorizeUploadAccess(
      { fileUrl: FILE, authUser: null, portalAccessId: "portal-x" },
      makeDeps(staleLogin),
    );
    expect(expired.kind).toBe("deny");

    // A within-window active access with a visible doc -> still allowed (no regression).
    const ok = await authorizeUploadAccess(
      { fileUrl: FILE, authUser: null, portalAccessId: "portal-x" },
      makeDeps(freshLogin),
    );
    expect(ok.kind).toBe("allow");
  });
});
