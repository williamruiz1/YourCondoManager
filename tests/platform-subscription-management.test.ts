/**
 * Platform subscription management — source-scan tests for founder-os#1147.
 *
 * Verifies that the new endpoints and webhook handlers added for the
 * platform subscription billing build are mounted, authenticated, and
 * gated to platform-admin where applicable. Same source-scan pattern as
 * tests/billing-portal-session.test.ts — no DB or HTTP required.
 *
 * Endpoints under test:
 *   GET    /api/platform/subscriptions
 *   POST   /api/admin/platform/subscriptions
 *   POST   /api/admin/platform/subscriptions/:id/cancel
 *   POST   /api/webhooks/platform/stripe   (new invoice.paid alias)
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";

const routesSource = fs.readFileSync("server/routes.ts", "utf8");

function handlerRegion(anchor: string, before = 0, after = 1200): string {
  const idx = routesSource.indexOf(anchor);
  if (idx < 0) return "";
  return routesSource.substring(Math.max(0, idx - before), idx + after);
}

describe("GET /api/platform/subscriptions (founder portfolio list, founder-os#1147)", () => {
  const anchor = '"/api/platform/subscriptions"';
  const handler = handlerRegion(anchor, 80, 1400);

  it("mounts at GET /api/platform/subscriptions", () => {
    expect(routesSource).toMatch(/app\.get\(\s*"\/api\/platform\/subscriptions"/);
  });

  it("applies requireAdmin + platform-admin role gate", () => {
    expect(handler).toMatch(/requireAdmin\s*,\s*requireAdminRole\(\[\s*"platform-admin"\s*\]\)/);
  });

  it("returns a subscriptions array shape", () => {
    expect(handler).toMatch(/subscriptions:\s*rows/);
  });
});

describe("POST /api/admin/platform/subscriptions (create, founder-os#1147)", () => {
  const anchor = '"/api/admin/platform/subscriptions"';
  const handler = handlerRegion(anchor, 80, 4500);

  it("mounts at POST /api/admin/platform/subscriptions", () => {
    expect(routesSource).toMatch(/app\.post\(\s*\n?\s*"\/api\/admin\/platform\/subscriptions"/);
  });

  it("applies requireAdmin + platform-admin role gate", () => {
    expect(handler).toMatch(/requireAdmin\s*,\s*\n?\s*requireAdminRole\(\[\s*"platform-admin"\s*\]\)/);
  });

  it("validates body with zod (associationId, plan, adminEmail)", () => {
    // The schema is defined just above the route mount — search the whole
    // source rather than only the post-anchor region.
    expect(routesSource).toContain("createPlatformSubSchema");
    expect(routesSource).toMatch(/createPlatformSubSchema\s*=\s*z\.object\(\{/);
    expect(routesSource).toMatch(/createPlatformSubSchema[\s\S]{0,400}associationId:\s*z\.string/);
    expect(routesSource).toMatch(/createPlatformSubSchema[\s\S]{0,800}adminEmail:\s*z\.string\(\)\.email/);
    expect(routesSource).toMatch(/createPlatformSubSchema[\s\S]{0,400}plan:\s*z\.enum/);
  });

  it("returns 409 when an active subscription already exists", () => {
    expect(handler).toContain("SUBSCRIPTION_EXISTS");
  });

  it("creates a Stripe customer + subscription via stripeRequest", () => {
    expect(handler).toMatch(/stripeRequest\("POST",\s*"\/customers"/);
    expect(handler).toMatch(/stripeRequest\("POST",\s*"\/subscriptions"/);
  });

  it("persists via storage.createPlatformSubscription or update", () => {
    expect(handler).toMatch(/storage\.(create|update)PlatformSubscription/);
  });
});

describe("POST /api/admin/platform/subscriptions/:id/cancel (founder-os#1147)", () => {
  const anchor = '"/api/admin/platform/subscriptions/:id/cancel"';
  const handler = handlerRegion(anchor, 80, 1600);

  it("mounts at POST /api/admin/platform/subscriptions/:id/cancel", () => {
    expect(routesSource).toMatch(/app\.post\(\s*\n?\s*"\/api\/admin\/platform\/subscriptions\/:id\/cancel"/);
  });

  it("applies requireAdmin + platform-admin role gate", () => {
    expect(handler).toMatch(/requireAdmin\s*,\s*\n?\s*requireAdminRole\(\[\s*"platform-admin"\s*\]\)/);
  });

  it("supports cancel_at_period_end via Stripe (default behavior)", () => {
    expect(handler).toContain("cancel_at_period_end");
  });

  it("supports immediate cancel via DELETE /subscriptions/:id", () => {
    expect(handler).toMatch(/stripeRequest\("DELETE",\s*`\/subscriptions\//);
  });
});

describe("Webhook: invoice.paid handling (founder-os#1147)", () => {
  // The platform Stripe webhook handler is at /api/webhooks/platform/stripe;
  // this confirms the new invoice.paid alias is wired alongside the legacy
  // invoice.payment_succeeded event.
  it("handles both invoice.payment_succeeded and invoice.paid", () => {
    expect(routesSource).toMatch(
      /eventType\s*===\s*"invoice\.payment_succeeded"\s*\|\|\s*eventType\s*===\s*"invoice\.paid"/,
    );
  });

  it("still handles invoice.payment_failed (regression guard)", () => {
    expect(routesSource).toContain('eventType === "invoice.payment_failed"');
  });

  it("still handles customer.subscription.updated/deleted (regression guard)", () => {
    expect(routesSource).toContain('eventType === "customer.subscription.updated"');
    expect(routesSource).toContain('eventType === "customer.subscription.deleted"');
  });
});
