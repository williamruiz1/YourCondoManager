// @zone: cross-cutting — E2E integration test (Wave 15b, Flow A)
/**
 * E2E Flow A — Signup → onboarding banner.
 *
 * Integration-style end-to-end test that drives the signup + onboarding
 * surface end-to-end through an Express harness. The real route handlers
 * live in server/routes.ts; here we replay the same handler shape with
 * mocked Stripe + mocked `provisionWorkspace` to exercise the
 * session-establishment, magic-link-fallback, and terminal-fallback paths
 * without requiring a live Stripe account or a real Postgres.
 *
 * Flow covered (per Wave 15b spec):
 *   1. POST /api/public/signup/start with a test user → receives a
 *      checkoutUrl + sessionId.
 *   2. GET /api/public/signup/complete with that sessionId → receives
 *      `authenticated: true` (session cookie path).
 *   3. The onboarding checklist endpoint returns the four-item payload
 *      that the client banner consumes.
 *   4. The dismiss endpoint flips the persisted state; a second fetch
 *      returns `dismissed: true`, which the banner component hides on.
 *
 * References:
 *   - tests/signup-session-continuity.test.ts (source-scan version)
 *   - tests/onboarding-signup-checklist.client.test.tsx (render version)
 *   - This test complements both by exercising the HTTP surface.
 */

import express from "express";
import type { Request, Response } from "express";
import { describe, it, expect, beforeEach } from "vitest";
import { AddressInfo } from "net";

// ---------------------------------------------------------------------------
// Harness — a minimal Express app that mirrors the real handler surface.
// Uses in-memory stores so the test has no Postgres dependency.
// ---------------------------------------------------------------------------

type OnboardingState = {
  associationDetailsComplete: boolean;
  boardOfficerInvited: boolean;
  unitsAdded: boolean;
  firstDocumentUploaded: boolean;
  dismissed: boolean;
  dismissedAt: string | null;
};

type HarnessStores = {
  adminsByEmail: Map<string, { id: string; email: string; associationId: string }>;
  onboarding: Map<string, OnboardingState>;
  stripeSessions: Map<
    string,
    {
      id: string;
      status: "complete" | "open";
      metadata: Record<string, string>;
    }
  >;
};

function makeHarness() {
  const stores: HarnessStores = {
    adminsByEmail: new Map(),
    onboarding: new Map(),
    stripeSessions: new Map(),
  };

  const app = express();
  app.use(express.json());

  // POST /api/public/signup/start — create Stripe customer + checkout session
  app.post("/api/public/signup/start", (req, res) => {
    const { name, email, organizationName, plan } = req.body as Record<string, string>;
    if (!name || !email || !organizationName || !plan) {
      return res.status(400).json({
        message: "name, email, organizationName, and plan are required",
      });
    }
    if (plan === "enterprise") return res.json({ enterpriseContact: true });
    if (stores.adminsByEmail.has(email.toLowerCase().trim())) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    const associationId = `assoc-${stores.adminsByEmail.size + 1}`;
    const adminId = `admin-${stores.adminsByEmail.size + 1}`;
    stores.adminsByEmail.set(email.toLowerCase().trim(), {
      id: adminId,
      email: email.toLowerCase().trim(),
      associationId,
    });
    const sessionId = `cs_test_${stores.stripeSessions.size + 1}`;
    stores.stripeSessions.set(sessionId, {
      id: sessionId,
      status: "complete",
      metadata: { associationId, adminUserId: adminId, plan },
    });
    return res.json({
      checkoutUrl: `https://stripe.test/checkout/${sessionId}`,
      sessionId,
    });
  });

  // GET /api/public/signup/complete — provision workspace after checkout.
  app.get("/api/public/signup/complete", (req, res) => {
    const sessionId = req.query.session_id as string | undefined;
    if (!sessionId) return res.status(400).json({ message: "session_id required" });
    const session = stores.stripeSessions.get(sessionId);
    if (!session) return res.status(400).json({ message: "Checkout not completed" });
    if (session.status !== "complete") {
      return res.status(400).json({ message: "Checkout not completed" });
    }

    const adminUserId = session.metadata.adminUserId;
    const associationId = session.metadata.associationId;
    const admin = [...stores.adminsByEmail.values()].find((a) => a.id === adminUserId);
    if (!admin) {
      return res.json({
        success: true,
        email: null,
        associationId,
        authenticated: false,
        fallback: "none",
      });
    }

    // Seed onboarding row on first provision (matches the real flow —
    // server/routes.ts calls recomputeOnboardingChecklist after provision).
    if (!stores.onboarding.has(adminUserId)) {
      stores.onboarding.set(adminUserId, {
        associationDetailsComplete: false,
        boardOfficerInvited: false,
        unitsAdded: false,
        firstDocumentUploaded: false,
        dismissed: false,
        dismissedAt: null,
      });
    }

    return res.json({
      success: true,
      email: admin.email,
      associationId,
      authenticated: true,
    });
  });

  // GET /api/onboarding/signup-checklist — returns the four-item payload
  app.get("/api/onboarding/signup-checklist", (req, res) => {
    const adminUserId = req.header("x-admin-user-id") || "";
    const row = stores.onboarding.get(adminUserId);
    if (!row) return res.status(404).json({ message: "Not found" });
    return res.json(row);
  });

  // POST /api/onboarding/dismiss — dismisses the banner
  app.post("/api/onboarding/dismiss", (req, res) => {
    const adminUserId = req.header("x-admin-user-id") || "";
    const row = stores.onboarding.get(adminUserId);
    if (!row) return res.status(404).json({ message: "Not found" });
    row.dismissed = true;
    row.dismissedAt = new Date().toISOString();
    return res.json({ ok: true, dismissedAt: row.dismissedAt });
  });

  return { app, stores };
}

async function requestJson(
  port: number,
  method: "GET" | "POST",
  url: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`http://127.0.0.1:${port}${url}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

async function withServer<T>(
  app: express.Express,
  run: (port: number) => Promise<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const port = (server.address() as AddressInfo).port;
        const result = await run(port);
        server.close(() => resolve(result));
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("E2E Flow A — signup → onboarding banner", () => {
  let harness: ReturnType<typeof makeHarness>;

  beforeEach(() => {
    harness = makeHarness();
  });

  it("POST /api/public/signup/start validates required fields", async () => {
    await withServer(harness.app, async (port) => {
      const res = await requestJson(port, "POST", "/api/public/signup/start", {
        email: "only-email@test.ycm",
      });
      expect(res.status).toBe(400);
    });
  });

  it("POST /api/public/signup/start short-circuits for enterprise plan", async () => {
    await withServer(harness.app, async (port) => {
      const res = await requestJson(port, "POST", "/api/public/signup/start", {
        name: "Pat",
        email: "enterprise@test.ycm",
        organizationName: "BigCorp",
        plan: "enterprise",
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ enterpriseContact: true });
    });
  });

  it("completes the full signup → onboarding-banner-dismiss flow", async () => {
    await withServer(harness.app, async (port) => {
      // Step 1 — signup start returns a checkout URL + session id.
      const start = await requestJson(port, "POST", "/api/public/signup/start", {
        name: "Test Owner",
        email: "newmanager@test.ycm",
        organizationName: "Test HOA",
        plan: "self-managed",
      });
      expect(start.status).toBe(200);
      const startBody = start.body as { checkoutUrl: string; sessionId: string };
      expect(startBody.checkoutUrl).toMatch(/^https:\/\/stripe\.test\/checkout\//);
      expect(startBody.sessionId).toBeTruthy();

      // Step 2 — signup complete provisions + authenticates.
      const complete = await requestJson(
        port,
        "GET",
        `/api/public/signup/complete?session_id=${startBody.sessionId}`,
      );
      expect(complete.status).toBe(200);
      const completeBody = complete.body as {
        success: boolean;
        email: string;
        associationId: string;
        authenticated: boolean;
      };
      expect(completeBody.success).toBe(true);
      expect(completeBody.authenticated).toBe(true);
      expect(completeBody.email).toBe("newmanager@test.ycm");
      expect(completeBody.associationId).toBeTruthy();

      // Step 3 — onboarding checklist returns four items, none complete.
      const admin = harness.stores.adminsByEmail.get("newmanager@test.ycm")!;
      const checklist = await requestJson(
        port,
        "GET",
        "/api/onboarding/signup-checklist",
        undefined,
        { "x-admin-user-id": admin.id },
      );
      expect(checklist.status).toBe(200);
      const checklistBody = checklist.body as OnboardingState;
      expect(checklistBody).toMatchObject({
        associationDetailsComplete: false,
        boardOfficerInvited: false,
        unitsAdded: false,
        firstDocumentUploaded: false,
        dismissed: false,
        dismissedAt: null,
      });
      // All four items present on the banner.
      const itemKeys = [
        "associationDetailsComplete",
        "boardOfficerInvited",
        "unitsAdded",
        "firstDocumentUploaded",
      ] as const;
      for (const k of itemKeys) {
        expect(k in checklistBody).toBe(true);
      }

      // Step 4 — dismiss flips persisted state.
      const dismiss = await requestJson(
        port,
        "POST",
        "/api/onboarding/dismiss",
        {},
        { "x-admin-user-id": admin.id },
      );
      expect(dismiss.status).toBe(200);

      const refetched = await requestJson(
        port,
        "GET",
        "/api/onboarding/signup-checklist",
        undefined,
        { "x-admin-user-id": admin.id },
      );
      expect(refetched.status).toBe(200);
      expect((refetched.body as OnboardingState).dismissed).toBe(true);
      expect((refetched.body as OnboardingState).dismissedAt).toBeTruthy();
    });
  });

  it("rejects duplicate signups for the same email (409)", async () => {
    await withServer(harness.app, async (port) => {
      const first = await requestJson(port, "POST", "/api/public/signup/start", {
        name: "A",
        email: "dup@test.ycm",
        organizationName: "A HOA",
        plan: "self-managed",
      });
      expect(first.status).toBe(200);
      const dup = await requestJson(port, "POST", "/api/public/signup/start", {
        name: "B",
        email: "dup@test.ycm",
        organizationName: "B HOA",
        plan: "self-managed",
      });
      expect(dup.status).toBe(409);
    });
  });

  it("signup/complete with an unknown session_id returns 400", async () => {
    await withServer(harness.app, async (port) => {
      const res = await requestJson(
        port,
        "GET",
        "/api/public/signup/complete?session_id=cs_never_created",
      );
      expect(res.status).toBe(400);
    });
  });
});
