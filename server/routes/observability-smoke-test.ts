// Observability smoke-test route (Issue founder-os#1030).
//
// Platform-admin-only endpoint that intentionally emits a known Sentry
// event + GA4-trackable signal so William can verify the observability
// pipeline end-to-end after the production deploy. Audit-trail: every
// hit is logged with the admin email so accidental smoke tests are
// traceable.
//
// Registered in server/routes.ts. Not surfaced in the client UI on
// purpose — discoverable only via the runbook URL.

import type { Express, Request, Response } from "express";

import type { AdminRole } from "@shared/schema";
import { captureServerError, isServerObservabilityInitialized } from "../observability";
import { log } from "../logger";

type RouteMiddleware = (req: Request, res: Response, next: (err?: unknown) => void) => unknown;
type RoleMiddlewareFactory = (roles: AdminRole[]) => RouteMiddleware;

type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
};

export function registerObservabilitySmokeTestRoutes(
  app: Express,
  requireAdmin: RouteMiddleware,
  requireAdminRole: RoleMiddlewareFactory,
): void {
  // GET /api/admin/observability-smoke-test
  //
  // Platform-admin only. Emits:
  //   1. A `[smoke-test]` log line for Fly logs
  //   2. A captured Sentry exception (only when Sentry is initialized)
  //   3. A response payload caller can verify in browser/curl
  //
  // Caller also gets back the GA4 measurement-id env var status so they
  // can correlate browser-side gtag firing with the server hit.
  app.get(
    "/api/admin/observability-smoke-test",
    requireAdmin,
    requireAdminRole(["platform-admin"]),
    async (req: AdminRequest, res: Response) => {
      const ts = new Date().toISOString();
      const admin = req.adminUserEmail ?? req.adminUserId ?? "unknown-admin";
      log(`[smoke-test] observability triggered by ${admin} at ${ts}`);

      const sentryActive = isServerObservabilityInitialized();
      if (sentryActive) {
        // Capture, don't throw — we want the route to return 200 with the
        // payload so the caller can confirm both surfaces fired.
        captureServerError(new Error(`Observability smoke test (${ts})`), {
          source: "smoke-test-route",
          admin,
          timestamp: ts,
        });
      }

      res.json({
        ok: true,
        timestamp: ts,
        admin,
        sentry: {
          initialized: sentryActive,
          dsnConfigured: Boolean(process.env.SENTRY_DSN),
        },
        ga4: {
          // Client-side build-arg presence — server can see whether the
          // build embedded the measurement-id, helps debug missing pixel.
          measurementIdConfigured: Boolean(
            process.env.VITE_GA_MEASUREMENT_ID ?? process.env.GA_MEASUREMENT_ID,
          ),
        },
        nextStep: sentryActive
          ? "Verify the event landed in the Sentry dashboard within 5 minutes (event title: 'Observability smoke test')."
          : "SENTRY_DSN not set on this deploy — set the Fly secret + redeploy + re-run this smoke test.",
      });
    },
  );
}
