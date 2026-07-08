/**
 * Security regression lock for #377 — webhook signature verification FAIL-CLOSED.
 *
 * THE VULN (before this fix): both webhook handlers failed OPEN — a forged event
 * with no / invalid signature (and no shared secret) fell THROUGH to the
 * ledger/billing mutation:
 *   • POST /api/webhooks/payments      → storage.processPaymentWebhookEvent(...)
 *       when NO signature header + PAYMENT_WEBHOOK_SHARED_SECRET unset, OR a
 *       signature was presented but no active signing secret existed for the
 *       association → execution fell through unauthenticated.
 *   • POST /api/webhooks/platform/stripe → provisionWorkspace(...) / subscription
 *       flips when the signature header was absent, the secret unset, or the
 *       signature unparseable.
 *
 * THE FIX (server/routes.ts): every path that reaches a mutation must have
 * positively validated a credential; otherwise → 403 BEFORE any mutation.
 *
 * Following the repo convention (webhook-payments-ack.test.ts /
 * plaid-route-security.test.ts / financial-security.test.ts), the inline
 * handlers in the monolithic registerRoutes are not exported, so these mini
 * apps reproduce the EXACT production verification precedence (branch-for-branch,
 * real HMAC crypto) against a real Express request/response cycle. A `mutations`
 * spy proves the money/billing path is NEVER reached on a forged request.
 * If the production branch shape changes, update this contract alongside it.
 */

import express, { type Request, type Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// ── Mutation spy (proves the ledger/billing path is or isn't reached) ─────────
const mutations = { payments: 0, platform: 0 };

// ── Helpers copied verbatim from server/routes.ts ─────────────────────────────
function parseStripeSignature(headerValue: string): { timestamp: string | null; signature: string | null } {
  const parts = headerValue.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2) || null;
  const signature = parts.find((part) => part.startsWith("v1="))?.slice(3) || null;
  return { timestamp, signature };
}
function isStripeEventPayload(value: unknown): value is { id: string; type: string; data: { object: Record<string, unknown> } } {
  return Boolean(
    value && typeof value === "object"
      && typeof (value as Record<string, unknown>).id === "string"
      && typeof (value as Record<string, unknown>).type === "string"
      && (value as Record<string, unknown>).data
      && typeof (value as Record<string, unknown>).data === "object",
  );
}
function normalizeStripeWebhookPayload(payload: unknown): { associationId: string | null; providerEventId: string | null; eventType: string | null } | null {
  if (!isStripeEventPayload(payload)) return null;
  const object = payload.data.object;
  const metadata = object && typeof object === "object" ? (object as Record<string, unknown>).metadata : null;
  const md = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  return {
    associationId: typeof md.associationId === "string" ? md.associationId : null,
    providerEventId: payload.id,
    eventType: payload.type,
  };
}
function getParam(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// ── Test fixtures ─────────────────────────────────────────────────────────────
const HOA_ID = "assoc-1";
const HOA_GATEWAY_SECRET = "whsec_hoa_gateway";     // Branch A (per-HOA Stripe)
const HOA_HMAC_SECRET = "sk_hoa_hmac";              // Branch C (internal HMAC)
const SHARED_SECRET = "shared-abc";                // Branch C (shared-secret)
const PLATFORM_SECRET = "whsec_platform";          // platform handler

// mimics gateway lookup (Branch A) — only HOA_ID has a gateway secret
function getGatewaySecret(associationId: string | null): string | null {
  return associationId === HOA_ID ? HOA_GATEWAY_SECRET : null;
}
// mimics webhookSigningSecrets active-row lookup (Branch C HMAC)
function getActiveSigningSecret(associationId: string | null): string | null {
  return associationId === HOA_ID ? HOA_HMAC_SECRET : null;
}

// ── Reproduce POST /api/webhooks/payments (post-#377 fail-closed) ─────────────
function paymentsHandler(sharedSecretEnv: string | undefined) {
  return (req: Request, res: Response) => {
    try {
      const stripeSignature = req.header("stripe-signature");
      const hmacSignature = req.header("x-webhook-hmac-sha256");
      const webhookSharedSecret = sharedSecretEnv;
      const rawBody = Buffer.isBuffer((req as any).rawBody) ? (req as any).rawBody.toString("utf8") : JSON.stringify(req.body);
      const normalizedStripeEvent = normalizeStripeWebhookPayload(req.body);

      // Branch A — genuine Stripe event w/ associationId metadata → per-HOA verify
      if (stripeSignature && normalizedStripeEvent?.associationId) {
        const secret = getGatewaySecret(normalizedStripeEvent.associationId);
        if (!secret) return res.status(403).json({ message: "Stripe webhook secret is not configured" });
        const { timestamp, signature } = parseStripeSignature(stripeSignature);
        if (!timestamp || !signature) return res.status(403).json({ message: "Missing Stripe signature components" });
        const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
        const eb = Buffer.from(expected, "utf8"); const pb = Buffer.from(signature, "utf8");
        if (eb.length !== pb.length || !timingSafeEqual(eb, pb)) return res.status(403).json({ message: "Invalid Stripe webhook signature" });
        mutations.payments++;
        return res.status(200).json({ processed: true });
      }

      // Branch B (#357) — signed Stripe event, no associationId → 200 ack, NO mutation
      if (stripeSignature && normalizedStripeEvent && !normalizedStripeEvent.associationId) {
        return res.status(200).json({ received: true, handled: false });
      }

      // Branch C — internal HMAC / shared-secret, fail-closed
      let webhookVerified = false;
      if (stripeSignature || hmacSignature) {
        const associationIdForVerify = typeof req.body.associationId === "string" ? req.body.associationId : null;
        if (!associationIdForVerify) return res.status(403).json({ message: "associationId required to verify webhook signature" });
        const sigSecret = getActiveSigningSecret(associationIdForVerify);
        if (!sigSecret) return res.status(403).json({ message: "Webhook signing secret is not configured for this association" });
        const payload = JSON.stringify(req.body);
        const expected = createHmac("sha256", sigSecret).update(payload).digest("hex");
        const provided = hmacSignature || (stripeSignature ? stripeSignature.split(",").find((p) => p.startsWith("v1="))?.slice(3) : null);
        if (!provided) return res.status(403).json({ message: "Missing webhook signature" });
        try {
          const eb = Buffer.from(expected, "utf8"); const pb = Buffer.from(provided, "utf8");
          if (eb.length !== pb.length || !timingSafeEqual(eb, pb)) return res.status(403).json({ message: "Invalid webhook signature" });
        } catch { return res.status(403).json({ message: "Invalid webhook signature" }); }
        webhookVerified = true;
      } else if (webhookSharedSecret) {
        const provided = req.header("x-payment-webhook-secret");
        if (!provided || provided !== webhookSharedSecret) return res.status(403).json({ message: "Invalid webhook secret" });
        webhookVerified = true;
      }
      if (!webhookVerified) return res.status(403).json({ message: "Webhook authentication required" });

      const associationId = getParam(req.body.associationId);
      const providerRaw = typeof req.body.provider === "string" ? req.body.provider : "";
      const provider = providerRaw === "stripe" || providerRaw === "other" ? providerRaw : null;
      const providerEventId = getParam(req.body.providerEventId);
      if (!associationId || !provider || !providerEventId) {
        return res.status(400).json({ message: "associationId, provider, and providerEventId are required" });
      }
      mutations.payments++; // the ledger-mutating processPaymentWebhookEvent() call
      return res.status(201).json({ ok: true });
    } catch (e: any) {
      return res.status(400).json({ message: e.message });
    }
  };
}

// ── Reproduce POST /api/webhooks/platform/stripe (post-#377 fail-closed) ──────
function platformHandler(secretConfigured: string | undefined) {
  return (req: Request, res: Response) => {
    try {
      const stripeSignature = req.header("stripe-signature");
      const webhookSecret = secretConfigured;
      if (!webhookSecret) return res.status(503).json({ message: "Platform Stripe webhook secret is not configured" });
      if (!stripeSignature) return res.status(403).json({ message: "Missing Stripe signature" });
      const rawBody = Buffer.isBuffer((req as any).rawBody) ? (req as any).rawBody.toString("utf8") : JSON.stringify(req.body);
      const { timestamp, signature } = parseStripeSignature(stripeSignature);
      if (!timestamp || !signature) return res.status(403).json({ message: "Invalid Stripe signature format" });
      const expected = createHmac("sha256", webhookSecret).update(`${timestamp}.${rawBody}`).digest("hex");
      const eb = Buffer.from(expected, "utf8"); const pb = Buffer.from(signature, "utf8");
      if (eb.length !== pb.length || !timingSafeEqual(eb, pb)) return res.status(403).json({ message: "Invalid webhook signature" });
      mutations.platform++; // the provisionWorkspace / subscription-flip path
      return res.json({ received: true });
    } catch (e: any) {
      return res.status(500).json({ message: e.message });
    }
  };
}

function makeApp() {
  const app = express();
  // Capture rawBody exactly like production (server/index.ts express.json verify hook)
  app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));
  app.post("/pay/env-set", paymentsHandler(SHARED_SECRET));
  app.post("/pay/env-unset", paymentsHandler(undefined));
  app.post("/platform/configured", platformHandler(PLATFORM_SECRET));
  app.post("/platform/unconfigured", platformHandler(undefined));
  return app;
}

// stripe-signature header for `${timestamp}.${rawBody}` (Branch A / platform)
function stripeSigHeader(secret: string, ts: string, rawBody: string): string {
  const v1 = createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  return `t=${ts},v1=${v1}`;
}
// HMAC over JSON.stringify(body) provided via v1= (Branch C)
function hmacV1Header(secret: string, body: unknown, ts = "1"): string {
  const v1 = createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex");
  return `t=${ts},v1=${v1}`;
}

let baseUrl: string;
let close: () => Promise<void>;
beforeAll(async () => {
  const app = makeApp();
  await new Promise<void>((resolve, reject) => {
    const s = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${(s.address() as { port: number }).port}`;
      close = () => new Promise((r) => s.close(() => r(undefined)));
      resolve();
    });
    s.on("error", reject);
  });
});
afterAll(async () => { if (close) await close(); });
beforeEach(() => { mutations.payments = 0; mutations.platform = 0; });

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${baseUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

const normalizedBody = { associationId: HOA_ID, provider: "stripe", providerEventId: "evt_1", status: "succeeded", amount: 100, personId: "p1", unitId: "u1" };

describe("#377 — /api/webhooks/payments fail-closed", () => {
  it("FORGED: no signature + shared-secret UNSET → 403, no ledger mutation", async () => {
    const res = await post("/pay/env-unset", normalizedBody);
    expect(res.status).toBe(403);
    expect(mutations.payments).toBe(0);
  });

  it("FORGED: no signature, shared-secret configured but header absent → 403, no mutation", async () => {
    const res = await post("/pay/env-set", normalizedBody);
    expect(res.status).toBe(403);
    expect(mutations.payments).toBe(0);
  });

  it("FORGED: invalid HMAC signature (secret row exists) → 403, no mutation", async () => {
    const res = await post("/pay/env-unset", normalizedBody, { "x-webhook-hmac-sha256": "deadbeef" });
    expect(res.status).toBe(403);
    expect(mutations.payments).toBe(0);
  });

  it("FORGED: signature present but association has no signing secret → 403, no mutation", async () => {
    const body = { ...normalizedBody, associationId: "assoc-unknown" };
    const res = await post("/pay/env-unset", body, { "x-webhook-hmac-sha256": createHmac("sha256", "x").update(JSON.stringify(body)).digest("hex") });
    expect(res.status).toBe(403);
    expect(mutations.payments).toBe(0);
  });

  it("VALID: correct HMAC signature → 2xx, mutation runs", async () => {
    const res = await post("/pay/env-unset", normalizedBody, {
      "x-webhook-hmac-sha256": createHmac("sha256", HOA_HMAC_SECRET).update(JSON.stringify(normalizedBody)).digest("hex"),
    });
    expect(res.status).toBe(201);
    expect(mutations.payments).toBe(1);
  });

  it("VALID: correct shared-secret header (env configured) → 2xx, mutation runs", async () => {
    const res = await post("/pay/env-set", normalizedBody, { "x-payment-webhook-secret": SHARED_SECRET });
    expect(res.status).toBe(201);
    expect(mutations.payments).toBe(1);
  });

  it("BRANCH A: genuine Stripe event w/ valid per-HOA signature → 200, mutation runs", async () => {
    const evt = { id: "evt_x", type: "payment_intent.succeeded", data: { object: { metadata: { associationId: HOA_ID } } } };
    const raw = JSON.stringify(evt);
    const res = await post("/pay/env-unset", evt, { "stripe-signature": stripeSigHeader(HOA_GATEWAY_SECRET, "1", raw) });
    expect(res.status).toBe(200);
    expect(mutations.payments).toBe(1);
  });

  it("BRANCH A: genuine Stripe event w/ FORGED per-HOA signature → 403, no mutation", async () => {
    const evt = { id: "evt_x", type: "payment_intent.succeeded", data: { object: { metadata: { associationId: HOA_ID } } } };
    const res = await post("/pay/env-unset", evt, { "stripe-signature": "t=1,v1=forged" });
    expect(res.status).toBe(403);
    expect(mutations.payments).toBe(0);
  });

  it("#357 PRESERVED: signed Stripe event, no associationId → 200 {handled:false}, no mutation", async () => {
    const evt = { id: "evt_billing", type: "invoice.paid", data: { object: { metadata: {} } } };
    const res = await post("/pay/env-unset", evt, { "stripe-signature": "t=1,v1=x" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, handled: false });
    expect(mutations.payments).toBe(0);
  });
});

describe("#377 — /api/webhooks/platform/stripe fail-closed", () => {
  const evt = { id: "evt_sub", type: "checkout.session.completed", data: { object: {} } };

  it("FORGED: no signature header → 403, no provisioning mutation", async () => {
    const res = await post("/platform/configured", evt);
    expect(res.status).toBe(403);
    expect(mutations.platform).toBe(0);
  });

  it("FORGED: invalid signature → 403, no mutation", async () => {
    const res = await post("/platform/configured", evt, { "stripe-signature": "t=1,v1=forged" });
    expect(res.status).toBe(403);
    expect(mutations.platform).toBe(0);
  });

  it("FORGED: unparseable signature header → 403, no mutation", async () => {
    const res = await post("/platform/configured", evt, { "stripe-signature": "garbage" });
    expect(res.status).toBe(403);
    expect(mutations.platform).toBe(0);
  });

  it("MISCONFIG: signing secret unset → 503, no mutation (never processes forged)", async () => {
    const res = await post("/platform/unconfigured", evt, { "stripe-signature": "t=1,v1=whatever" });
    expect(res.status).toBe(503);
    expect(mutations.platform).toBe(0);
  });

  it("VALID: correct signature → 2xx, mutation runs", async () => {
    const raw = JSON.stringify(evt);
    const res = await post("/platform/configured", evt, { "stripe-signature": stripeSigHeader(PLATFORM_SECRET, "1", raw) });
    expect(res.status).toBe(200);
    expect(mutations.platform).toBe(1);
  });
});
