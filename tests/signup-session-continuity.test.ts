/**
 * Signup Session Continuity Tests — 4.4 Q7 (AC 18-22).
 *
 * Verifies the `/api/public/signup/complete` handler and `provisionWorkspace()`
 * wire up auto-authentication, magic-link fallback, and OAuth reconciliation
 * via source-scan (same pattern as tests/signup-role-assignment.test.ts —
 * integration harness is not yet wired for a full HTTP round-trip).
 *
 * References:
 *   - 4.4 Q7 AC 18: /api/public/signup/complete sets an authenticated admin
 *     session cookie on success.
 *   - 4.4 Q7 AC 20: on session-establishment failure, send a magic-link email
 *     (15-min TTL).
 *   - 4.4 Q7 AC 21: Google OAuth sessions established during signup are
 *     reconciled with the admin record — no duplicate authUsers.
 *   - 4.4 Q7 AC 22: no password fallback (OTP-first signup preserved).
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";

const routesSource = fs.readFileSync("server/routes.ts", "utf8");
const authSource = fs.readFileSync("server/auth.ts", "utf8");

function regionAround(source: string, anchor: string, before = 0, after = 8000): string {
  const idx = source.indexOf(anchor);
  if (idx < 0) return "";
  return source.substring(Math.max(0, idx - before), idx + after);
}

describe("Signup session continuity (4.4 Q7)", () => {
  describe("AC 18 — /api/public/signup/complete sets session cookie", () => {
    const completeHandler = regionAround(routesSource, 'app.get("/api/public/signup/complete"', 0, 4000);

    it("invokes provisionWorkspace with { req } to opt into session establishment", () => {
      expect(completeHandler).toMatch(/provisionWorkspace\(\s*session\s*,\s*\{\s*req\s*\}/);
    });

    it("provisionWorkspace helper accepts an optional req and calls req.login()", () => {
      const provision = regionAround(routesSource, "async function provisionWorkspace", 0, 6000);
      expect(provision).toMatch(/opts:\s*\{\s*req\?:\s*Request/);
      expect(provision).toContain("req.login(authUser");
    });

    it("provisionWorkspace ensures an authUsers row before calling req.login", () => {
      const provision = regionAround(routesSource, "async function provisionWorkspace", 0, 6000);
      expect(provision).toContain("getAuthUserByEmail");
      expect(provision).toContain("createAuthUser");
    });

    it("response indicates authenticated=true when session is established", () => {
      expect(completeHandler).toContain("authenticated: true");
    });
  });

  describe("AC 20 — magic-link fallback on session failure", () => {
    const completeHandler = regionAround(routesSource, 'app.get("/api/public/signup/complete"', 0, 4000);

    it("reuses createAuthRestoreToken for the 15-min-TTL magic token", () => {
      expect(routesSource).toContain('import { createAuthRestoreToken');
      expect(completeHandler).toContain("createAuthRestoreToken(");
    });

    it("sends the fallback email through sendPlatformEmail", () => {
      const helper = regionAround(routesSource, "async function sendSignupMagicLinkEmail", 0, 1500);
      expect(helper).toContain("sendPlatformEmail(");
      // Subject line includes the product name so the operator can confirm
      // the right template is in use.
      expect(helper).toContain("Sign in to Your Condo Manager");
    });

    it('response includes fallback: "magic-link" when session-establishment fails', () => {
      expect(completeHandler).toMatch(/fallback:\s*["']magic-link["']/);
    });

    it("registers GET /api/auth/magic/:token to consume the magic link", () => {
      expect(authSource).toContain('app.get("/api/auth/magic/:token"');
      expect(authSource).toContain("verifyAuthRestoreToken(");
      expect(authSource).toContain("req.login(user");
    });

    it("AUTH_RESTORE_TTL_SECONDS default is 15 minutes (AC 20)", () => {
      // auth.ts defines AUTH_RESTORE_TTL_SECONDS with a 15*60 default.
      expect(authSource).toMatch(/AUTH_RESTORE_TTL_SECONDS\s*=\s*Math\.max\(\s*60\s*,\s*Number\([^)]*\|\|\s*15\s*\*\s*60\s*\)/);
    });
  });

  describe("AC 21 — Google OAuth reconciliation", () => {
    const provision = regionAround(routesSource, "async function provisionWorkspace", 0, 6000);

    it("updates existing authUsers.adminUserId to link to the new admin", () => {
      // If getAuthUserByEmail returns a row (e.g. created by the Google OAuth
      // popup during signup), provisionWorkspace must relink it to the
      // freshly-provisioned admin — never create a duplicate.
      expect(provision).toContain("updateAuthUser");
      expect(provision).toMatch(/adminUserId:\s*adminUser\.id/);
    });

    it("does not insert a duplicate authUsers row when one already exists for the email", () => {
      // The ensure/link sequence is gated on the getAuthUserByEmail result:
      // only insert if missing.
      expect(provision).toMatch(/if\s*\(\s*!authUser\s*\)/);
    });
  });

  describe("AC 22 — no password fallback", () => {
    it("/api/public/signup/complete does not reference password setup", () => {
      const completeHandler = regionAround(routesSource, 'app.get("/api/public/signup/complete"', 0, 4000);
      expect(completeHandler).not.toMatch(/password/i);
    });

    it("sendSignupMagicLinkEmail does not mention password", () => {
      const helper = regionAround(routesSource, "async function sendSignupMagicLinkEmail", 0, 1500);
      expect(helper).not.toMatch(/password/i);
    });
  });

  describe("Webhook path stays session-less", () => {
    it("checkout.session.completed webhook calls provisionWorkspace without a req", () => {
      // Webhook has no HTTP response to attach a session cookie to — the
      // provisionWorkspace helper must default to no-session behaviour.
      // Scan the platform Stripe webhook handler specifically.
      const webhookHandler = regionAround(routesSource, 'app.post("/api/webhooks/platform/stripe"', 0, 6000);
      expect(webhookHandler).toContain("provisionWorkspace(eventObj)");
      // Must NOT pass `{ req }` in the webhook path.
      expect(webhookHandler).not.toMatch(/provisionWorkspace\(\s*eventObj\s*,\s*\{\s*req\s*\}/);
    });
  });
});
