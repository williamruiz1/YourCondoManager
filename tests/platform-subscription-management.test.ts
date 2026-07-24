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
  // Window widened 4500 -> 7000 (founder-os#10752): the Stripe idempotency
  // hardening pass added explanatory comments ahead of the persist calls,
  // pushing storage.createPlatformSubscription/updatePlatformSubscription
  // past the old 4500-char window. 7000 comfortably covers the full handler
  // body (measured ~6409 chars from anchor to the next route mount).
  const handler = handlerRegion(anchor, 80, 7000);

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

describe("Webhook: payment-succeeded receipt email (founder-os#1147)", () => {
  // The invoice.paid / invoice.payment_succeeded branch sends a branded
  // receipt email to the association admin. Best-effort + non-crashing,
  // mirroring the payment-failed dunning email.
  const anchor = 'eventType === "invoice.payment_succeeded" || eventType === "invoice.paid"';
  // The branch runs until the next else-if (payment_failed). Slice the whole
  // branch so long bodies aren't truncated by a fixed window.
  function region(): string {
    const idx = routesSource.indexOf(anchor);
    if (idx < 0) return "";
    const endIdx = routesSource.indexOf('eventType === "invoice.payment_failed"', idx);
    return routesSource.substring(idx, endIdx > idx ? endIdx : idx + 3000);
  }

  it("sends a receipt email in the payment-succeeded branch", () => {
    const r = region();
    expect(r).toContain("sendPlatformEmail");
    expect(r).toMatch(/Payment received/i);
  });

  it("is best-effort (does not crash the webhook on email failure)", () => {
    const r = region();
    expect(r).toContain("sendPlatformEmail");
    expect(r).toMatch(/\}\)\.catch\(\(\)\s*=>\s*\{\}\)/);
  });

  it("only emails on a real charge (amountPaid > 0)", () => {
    const r = region();
    expect(r).toMatch(/amountPaid\s*&&\s*amountPaid\s*>\s*0/);
  });
});

describe("Webhook: Sentry capture on failure (founder-os#1147, per #1030)", () => {
  // The webhook catch block forwards the error to Sentry via
  // captureServerError and records the failure on the webhook-event row.
  it("imports captureServerError from observability", () => {
    expect(routesSource).toMatch(/import\s*\{\s*captureServerError\s*\}\s*from\s*"\.\/observability"/);
  });

  it("calls captureServerError in the webhook catch block", () => {
    expect(routesSource).toMatch(/captureServerError\(e,\s*\{\s*scope:\s*"platform-stripe-webhook"/);
  });

  it("records the failure on the webhook-event row (status: failed)", () => {
    // Anchor on the webhook catch block, not the elsewhere-used table update.
    const idx = routesSource.indexOf('captureServerError(e, { scope: "platform-stripe-webhook"');
    const r = idx >= 0 ? routesSource.substring(idx, idx + 700) : "";
    expect(r).toMatch(/status:\s*"failed"/);
    expect(r).toContain("errorMessage");
  });
});

describe("Webhook: trial-ending email — customer.subscription.trial_will_end (founder-os#1147, #9260)", () => {
  // Acceptance criterion #8: transactional emails include trial-ending. Stripe
  // fires `customer.subscription.trial_will_end` ~3 days before the trial ends —
  // the canonical Stripe reminder pattern (no custom scheduler for the D-3 touch).
  it("handles the customer.subscription.trial_will_end event", () => {
    expect(routesSource).toContain('eventType === "customer.subscription.trial_will_end"');
  });

  it("sends a trial-ending email in that branch", () => {
    const idx = routesSource.indexOf('eventType === "customer.subscription.trial_will_end"');
    expect(idx).toBeGreaterThan(-1);
    const region = routesSource.substring(idx, idx + 2400);
    expect(region).toContain("sendPlatformEmail");
    expect(region).toMatch(/trial is ending/i);
    // Best-effort + non-crashing, mirroring the other platform emails.
    expect(region).toContain(".catch(() => {})");
  });
});

describe("Webhook: plan-changed email — customer.subscription.updated (founder-os#1147, #9260)", () => {
  // Acceptance criterion #8: transactional emails include plan-changed. Fired only
  // on a genuine plan move, detected via Stripe's `previous_attributes` (items/plan).
  it("captures previous_attributes on the event", () => {
    expect(routesSource).toContain("previous_attributes");
    expect(routesSource).toMatch(/const previousAttributes/);
  });

  it("gates the plan-changed email on a real plan change (previous_attributes items/plan)", () => {
    const idx = routesSource.indexOf('eventType === "customer.subscription.updated" || eventType === "customer.subscription.deleted"');
    expect(idx).toBeGreaterThan(-1);
    const region = routesSource.substring(idx, idx + 2600);
    expect(region).toMatch(/planChanged/);
    expect(region).toMatch(/previousAttributes, "items"/);
    expect(region).toContain("sendPlatformEmail");
    expect(region).toMatch(/plan was updated/i);
  });
});

describe("Webhook: Sentry capture on failure (founder-os#1147, #9260 regression guard)", () => {
  // Acceptance criterion #7: Sentry error capture on every Stripe Billing webhook
  // failure. Present in main; guarded here so it can't silently regress.
  it("calls captureServerError in the webhook catch with scope metadata", () => {
    expect(routesSource).toMatch(/captureServerError\([\s\S]*?scope:\s*"platform-stripe-webhook"/);
  });
});
