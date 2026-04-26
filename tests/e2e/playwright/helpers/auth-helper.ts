// Wave 16a — Playwright auth helpers.
//
// The real YCM auth flow is OAuth-only (Google) for Manager and OTP
// (email-code) for Owner — neither lends itself to a deterministic
// real-server test. We instead install Playwright `route` handlers that
// return canned auth responses, so the React frontend behaves as if a
// real session exists. This is the same approach the Wave-15b spec
// authorised for Stripe ("mock via route.fulfill"), extended to auth.
//
// Each helper is idempotent: it installs handlers on the page's `route`
// table and returns a teardown handle. The Playwright fixture lifecycle
// closes the page (and therefore the route table) at the end of the
// test, so callers do not need to call the teardown themselves unless
// they want to swap roles mid-test.

import type { Page, Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Wave 16d — real-session helper APIs.
//
// These run alongside the route-mock helpers below. They hit the
// dev-server's `/api/auth/test-login` (manager) and the OTP request +
// `/api/__test/last-otp` capture (portal) so the session cookie /
// portal access id are issued by the REAL handlers — only the OAuth /
// email-delivery legs are bypassed. Use these for regression-net specs
// that need to exercise passport + express-session round-trips and the
// portal OTP flow end-to-end.
//
// Both helpers REQUIRE the dev server to be running with NODE_ENV=test
// AND PLAYWRIGHT_TEST_MODE=1. The harness `npm run test:playwright:test-mode`
// sets both. Without those env vars, the test-only endpoints 404 and
// these helpers will throw (production cannot be hit by accident).
// ---------------------------------------------------------------------------

export type ManagerSession = {
  userId: string;
  email: string;
  adminId: string;
  associationId: string;
  role: "platform-admin" | "manager" | "board-officer";
};

export type OwnerSession = {
  portalAccessId: string;
  associationId: string;
  unitId: string;
  email: string;
  firstName: string;
  lastName: string;
};

const DEFAULT_MANAGER: ManagerSession = {
  userId: "auth-user-mgr-1",
  email: "manager@e2e.test",
  adminId: "admin-mgr-1",
  associationId: "assoc-e2e-1",
  role: "manager",
};

const DEFAULT_OWNER: OwnerSession = {
  portalAccessId: "portal-access-owner-1",
  associationId: "assoc-e2e-1",
  unitId: "unit-101",
  email: "owner@e2e.test",
  firstName: "Pat",
  lastName: "Owner",
};

/**
 * Install handlers that make the manager-side `/api/auth/me` and the
 * common workspace bootstrap endpoints return an authenticated payload.
 *
 * After this runs, navigating to `/app` will pass the workspace gate
 * (`authSession?.authenticated && authSession.admin`).
 */
export async function loginAsManager(
  page: Page,
  overrides: Partial<ManagerSession> = {},
): Promise<ManagerSession> {
  const session: ManagerSession = { ...DEFAULT_MANAGER, ...overrides };

  await page.route("**/api/auth/me", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        user: {
          id: session.userId,
          email: session.email,
          adminUserId: session.adminId,
        },
        admin: {
          id: session.adminId,
          email: session.email,
          role: session.role,
        },
      }),
    });
  });

  // The workspace shell fetches a small set of bootstrap endpoints on
  // first load. Stub them with empty / safe defaults so a navigation
  // to `/app` does not 401-cascade into a guest router.
  await page.route("**/api/associations**", async (route: Route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: session.associationId,
            name: "E2E Test Association",
            amenitiesEnabled: 1,
          },
        ]),
      });
      return;
    }
    await route.fallback();
  });

  await page.route("**/api/onboarding/signup-checklist", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        associationDetailsComplete: true,
        boardOfficerInvited: true,
        unitsAdded: true,
        firstDocumentUploaded: true,
        dismissed: true,
        dismissedAt: new Date().toISOString(),
      }),
    });
  });

  return session;
}

/**
 * Install handlers that satisfy the owner portal session gate. Sets the
 * `portalAccessId` localStorage key (the PortalShell reads from it on
 * first render) and stubs the `/api/portal/me` query.
 *
 * Caller must navigate to a `/portal/*` URL after invoking this so the
 * `addInitScript` runs before React mounts.
 */
export async function loginAsOwner(
  page: Page,
  overrides: Partial<OwnerSession> = {},
): Promise<OwnerSession> {
  const session: OwnerSession = { ...DEFAULT_OWNER, ...overrides };

  await page.addInitScript(({ portalAccessId }) => {
    window.localStorage.setItem("portalAccessId", portalAccessId);
  }, { portalAccessId: session.portalAccessId });

  await page.route("**/api/portal/me", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: session.portalAccessId,
        associationId: session.associationId,
        unitId: session.unitId,
        email: session.email,
        firstName: session.firstName,
        lastName: session.lastName,
        role: "owner",
        effectiveRole: "owner",
        hasBoardAccess: false,
        boardRoleId: null,
        unitNumber: "101",
        building: "Building A",
        phone: null,
        mailingAddress: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        contactPreference: null,
        smsOptIn: 0,
      }),
    });
  });

  await page.route("**/api/portal/my-associations", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { associationId: session.associationId, associationName: "E2E Test Association" },
      ]),
    });
  });

  // Counts that PortalShell fetches for the nav badges.
  await page.route("**/api/portal/maintenance-requests", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
  await page.route("**/api/portal/notices", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  return session;
}

/**
 * Install a 401 handler for the current page. Used by tests that want
 * to assert the unauthenticated state explicitly.
 */
export async function loginAsGuest(page: Page): Promise<void> {
  await page.route("**/api/auth/me", async (route: Route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: false }),
    });
  });
}

// ---------------------------------------------------------------------------
// Wave 16d — real-session helpers. Both REQUIRE the dev server to be
// running under NODE_ENV=test AND PLAYWRIGHT_TEST_MODE=1 (the harness
// `npm run test:playwright:test-mode` sets both). See server/test-routes.ts
// for the gate definition + security audit.
// ---------------------------------------------------------------------------

/**
 * Real-session admin login. Hits POST /api/auth/test-login which calls
 * passport.serializeUser + req.login — the response sets a real
 * express-session cookie that Playwright stores on the BrowserContext.
 * The email MUST correspond to an existing admin_users row.
 */
export async function realAdminLogin(page: Page, email: string): Promise<void> {
  const response = await page.request.post("/api/auth/test-login", {
    data: { email },
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(
      `realAdminLogin: /api/auth/test-login → ${response.status()} for ${email}. ` +
      `Body: ${body}. Is the dev server running under NODE_ENV=test AND PLAYWRIGHT_TEST_MODE=1?`,
    );
  }
}

/**
 * Real-session portal owner login via OTP. Triggers the production
 * /api/portal/request-login flow, polls /api/__test/last-otp for the
 * captured 6-digit code, then submits it via /api/portal/verify-login.
 * The returned portalAccessId is injected into localStorage on the page
 * (PortalShell sends it as `x-portal-access-id` — portal auth is
 * header-based, not cookie-based, in YCM).
 */
export async function realPortalLogin(page: Page, email: string): Promise<void> {
  const requestRes = await page.request.post("/api/portal/request-login", {
    data: { email },
    headers: { "Content-Type": "application/json" },
  });
  if (!requestRes.ok()) {
    throw new Error(`realPortalLogin: request-login → ${requestRes.status()}: ${await requestRes.text()}`);
  }

  let otp: string | null = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const lookup = await page.request.get(`/api/__test/last-otp?email=${encodeURIComponent(email)}`);
    if (lookup.ok()) {
      const body = await lookup.json() as { otp?: string };
      if (typeof body.otp === "string" && /^\d{6}$/.test(body.otp)) {
        otp = body.otp;
        break;
      }
    } else if (lookup.status() !== 404) {
      throw new Error(
        `realPortalLogin: last-otp → ${lookup.status()}: ${await lookup.text()}. ` +
        `Is the dev server running under NODE_ENV=test AND PLAYWRIGHT_TEST_MODE=1?`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!otp) {
    throw new Error(`realPortalLogin: timed out waiting for OTP capture for ${email}.`);
  }

  const verifyRes = await page.request.post("/api/portal/verify-login", {
    data: { email, otp },
    headers: { "Content-Type": "application/json" },
  });
  if (!verifyRes.ok()) {
    throw new Error(`realPortalLogin: verify-login → ${verifyRes.status()}: ${await verifyRes.text()}`);
  }
  const verifyBody = await verifyRes.json() as { portalAccessId?: string; associations?: unknown[] };
  if (!verifyBody.portalAccessId) {
    throw new Error(
      `realPortalLogin: verify-login did not return a portalAccessId. ` +
      `(Multi-association picker not supported by this helper — pre-seed a single portal_access row.) ` +
      `Body: ${JSON.stringify(verifyBody)}`,
    );
  }
  const portalAccessId = verifyBody.portalAccessId;
  await page.addInitScript((id: string) => {
    window.localStorage.setItem("portalAccessId", id);
  }, portalAccessId);
}
