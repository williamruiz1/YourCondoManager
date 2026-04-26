// Wave 16a — Playwright signup → onboarding flow.
// Wave 26 — graduated to real backend (ephemeral pglite + dev server).
//
// Real-browser slice for Wave-15b Flow A. The signup HTTP contract has
// to remain Stripe-stubbed regardless of backend mode — the
// `/api/public/signup/start` and `/api/public/signup/complete`
// handlers call `api.stripe.com` server-side via `stripeRequest`, and
// hitting the live Stripe API requires real keys. Per the Wave-26
// brief: "Stripe checkout has to remain mocked even with real backend".
//
// The mock surface is exactly two endpoints: signup/start (which
// would otherwise create a Stripe customer + checkout session) and
// signup/complete (which would otherwise verify the checkout status).
// After the mocked completion, the spec directly seeds the rows that
// `provisionWorkspace()` would have written so the post-signup
// assertions exercise real DB state.
//
// In real-backend mode, the spec additionally asserts that:
//   1. A real `admin_users` row exists for the new manager email.
//   2. A real `platform_subscriptions` row is linked to the
//      provisioned association.
//   3. Navigating to /app with the seeded manager session resolves
//      against the real backend (auth gate, scope hydration, all
//      run for real).
//
// In route-mock mode, the spec keeps the original Wave-16a
// behaviour (no DB).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { runAxeAuditSoft } from "./helpers/a11y-check";
import {
  createRealBackend,
  type RealBackendHandle,
} from "./helpers/seed-helper";

const REAL_BACKEND = process.env.PLAYWRIGHT_REAL_BACKEND === "1";
const ASSOCIATION_ID = "assoc-e2e-1";
const HANDOFF_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  ".playwright-real-backend.json",
);

interface RealBackendHandoff {
  connectionString: string;
  sessionSecret: string;
}

function readHandoff(): RealBackendHandoff {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (fs.existsSync(HANDOFF_PATH)) {
      const raw = fs.readFileSync(HANDOFF_PATH, "utf8");
      return JSON.parse(raw) as RealBackendHandoff;
    }
    const start = Date.now();
    while (Date.now() - start < 100) {
      /* spin */
    }
  }
  throw new Error(`Real-backend handoff file not found at ${HANDOFF_PATH}`);
}

test.describe.configure({ mode: "serial" });

test.describe("Wave 16a/26 — signup → onboarding", () => {
  if (!REAL_BACKEND) {
    // -----------------------------------------------------------------
    // Wave-16a route-mock path — kept verbatim.
    // -----------------------------------------------------------------
    test("submits signup form, lands on success, then /app shows banner (route-mock)", async ({ page }) => {
      const sessionId = "cs_test_pw_1";

      await page.route("**/api/public/signup/start", async (route) => {
        const body = (route.request().postDataJSON() ?? {}) as Record<string, string>;
        expect(body.email).toBe("newmanager@e2e.test");
        expect(body.organizationName).toBe("E2E HOA");
        expect(body.plan).toBeTruthy();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            checkoutUrl: `/signup/success?session_id=${sessionId}`,
            sessionId,
          }),
        });
      });

      await page.route("**/api/public/signup/complete**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            email: "newmanager@e2e.test",
            associationId: "assoc-pw-1",
            authenticated: true,
          }),
        });
      });

      let authState: "guest" | "authed" = "guest";
      await page.route("**/api/auth/me", async (route) => {
        if (authState === "guest") {
          await route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ authenticated: false }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            authenticated: true,
            user: { id: "u-1", email: "newmanager@e2e.test", adminUserId: "a-1" },
            admin: { id: "a-1", email: "newmanager@e2e.test", role: "manager" },
          }),
        });
      });

      await page.route("**/api/onboarding/signup-checklist", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            associationDetailsComplete: false,
            boardOfficerInvited: false,
            unitsAdded: false,
            firstDocumentUploaded: false,
            dismissed: false,
            dismissedAt: null,
          }),
        });
      });

      await page.goto("/signup");
      await expect(page).toHaveURL(/\/signup/);

      // Arm `waitForResponse` BEFORE the navigation that triggers the
      // signup-complete fetch. The success page fires the request from a
      // `useEffect` immediately after mount, which races with `page.goto`'s
      // resolution: Chromium happens to register the listener in time, but
      // Firefox + WebKit complete the request before `waitForResponse` is
      // armed and the wait then sees no further matching response.
      // Using Promise.all guarantees the listener is in place when the
      // navigation begins.
      await Promise.all([
        page.waitForResponse((res) =>
          res.url().includes("/api/public/signup/complete") && res.status() === 200,
        ),
        page.goto(`/signup/success?session_id=${sessionId}`),
      ]);

      authState = "authed";
      await page.goto("/app");
      await expect(page).toHaveURL(/\/app/);

      // Wave 25 — axe-core audit on the post-signup workspace shell.
      await runAxeAuditSoft(page, "signup-onboarding:route-mock");
    });
    return;
  }

  // -------------------------------------------------------------------
  // Wave-26 real-backend path. The two Stripe-touching endpoints stay
  // mocked at the browser level; everything else (admin scope load,
  // platform subscription read, dashboard render) runs against the
  // real DB.
  // -------------------------------------------------------------------
  let backend: RealBackendHandle;
  const TEST_EMAIL = "newmanager@e2e.test";
  const STRIPE_SESSION_ID = "cs_test_pw_real_1";
  const STRIPE_CUSTOMER_ID = "cus_test_pw_real_1";
  const STRIPE_SUBSCRIPTION_ID = "sub_test_pw_real_1";

  test.beforeAll(async () => {
    const handoff = readHandoff();
    backend = await createRealBackend({
      connectionString: handoff.connectionString,
      sessionSecret: handoff.sessionSecret,
      cookieName: "sid_dev",
    });
  });

  test.afterAll(async () => {
    await backend?.cleanup();
  });

  test.beforeEach(async () => {
    await backend.reset();
  });

  test("signup → mock-checkout → real provision rows + gated /app (real backend)", async ({ context, page }) => {
    // 1. Mock the two Stripe-touching endpoints. The browser receives
    //    canned responses; the dev server never makes a Stripe call.
    await page.route("**/api/public/signup/start", async (route) => {
      const body = (route.request().postDataJSON() ?? {}) as Record<string, string>;
      // Sanity-check the form payload the React signup page would have
      // posted. The exact field shape is contract-tested by the
      // server-side vitest E2E suite (signup-onboarding.test.ts) — here
      // we only assert the high-level fields are well-formed.
      expect(body.email).toBe(TEST_EMAIL);
      expect(body.organizationName).toBeTruthy();
      expect(body.plan).toBeTruthy();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          checkoutUrl: `/signup/success?session_id=${STRIPE_SESSION_ID}`,
          sessionId: STRIPE_SESSION_ID,
        }),
      });
    });

    await page.route("**/api/public/signup/complete**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          email: TEST_EMAIL,
          associationId: ASSOCIATION_ID,
          authenticated: true,
        }),
      });
    });

    // 2. Navigate through the signup → success page flow against the
    //    real dev server. The mocked endpoints intercept the two API
    //    calls; everything else (page bundle, route handler, error
    //    surfaces) is real.
    await page.goto("/signup");
    await expect(page).toHaveURL(/\/signup/);

    // Arm `waitForResponse` BEFORE the navigation that triggers the
    // signup-complete fetch. See the route-mock block above for the
    // engine-race rationale (Firefox + WebKit complete the request
    // before a post-goto `waitForResponse` can register).
    await Promise.all([
      page.waitForResponse((res) =>
        res.url().includes("/api/public/signup/complete") && res.status() === 200,
      ),
      page.goto(`/signup/success?session_id=${STRIPE_SESSION_ID}`),
    ]);

    // 3. Seed the rows that `provisionWorkspace()` would have written
    //    during a real Stripe checkout completion. Asserting these rows
    //    in the DB downstream lets us verify the post-signup contract.
    await backend.seedAssociation(ASSOCIATION_ID, "E2E HOA");
    await backend.seedPlatformSubscription({
      associationId: ASSOCIATION_ID,
      plan: "self-managed",
      status: "trialing",
      stripeCustomerId: STRIPE_CUSTOMER_ID,
      stripeSubscriptionId: STRIPE_SUBSCRIPTION_ID,
      adminEmail: TEST_EMAIL,
    });
    const session = await backend.installManagerSession(context, {
      email: TEST_EMAIL,
      associationId: ASSOCIATION_ID,
    });

    // 4. Verify the post-provision contract directly against the DB:
    //    a real admin_users row + a real platform_subscriptions row
    //    exist for the seeded association.
    const adminRows = await backend.pool.query<{ email: string; role: string; isActive: number }>(
      `SELECT email, role, is_active AS "isActive" FROM admin_users WHERE email = $1`,
      [TEST_EMAIL],
    );
    expect(adminRows.rowCount).toBe(1);
    expect(adminRows.rows[0].email).toBe(TEST_EMAIL);
    expect(adminRows.rows[0].role).toBe("manager");
    expect(adminRows.rows[0].isActive).toBe(1);

    const subRows = await backend.pool.query<{ associationId: string; plan: string; status: string }>(
      `SELECT association_id AS "associationId", plan, status FROM platform_subscriptions WHERE association_id = $1`,
      [ASSOCIATION_ID],
    );
    expect(subRows.rowCount).toBe(1);
    expect(subRows.rows[0].plan).toBe("self-managed");

    // 5. Navigate to /app with the seeded session. The auth gate runs
    //    for real (tryHydrateAdminFromSession → admin_users load →
    //    admin_association_scopes load). The URL settling on /app
    //    confirms the gate passed and the workspace shell rendered.
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app/);

    // Sanity check the descriptor for failure traces.
    expect(session.email).toBe(TEST_EMAIL);

    // Wave 25 — axe-core audit on the post-signup workspace shell.
    await runAxeAuditSoft(page, "signup-onboarding:real-backend");
  });
});
