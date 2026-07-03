/**
 * Regression lock for the `/api/webhooks/payments` status-code contract
 * (founder-os webhook-ack fix, 2026-07).
 *
 * THE BUG: the platform Stripe account subscribes this per-HOA owner-payment
 * endpoint to platform BILLING events (checkout.session.completed,
 * customer.subscription.*, invoice.*). Those signed events carry NO
 * `associationId` metadata, so the per-association processing block is skipped
 * and they used to fall through to the generic validator which returned
 * HTTP 400 "associationId, provider, and providerEventId are required".
 * Stripe treats 400 as a failed delivery, retries, and eventually DISABLES the
 * endpoint. 35 failures were logged before the fix.
 *
 * THE FIX (server/routes.ts, `app.post("/api/webhooks/payments", ...)`): a real
 * Stripe delivery (carries a `stripe-signature` header) that normalizes to a
 * genuine Stripe event with NO associationId is acknowledged with HTTP 200
 * `{received:true, handled:false}` + a log line — instead of the 400. No money
 * / ledger / crediting behavior changes (this event class was never credited
 * here; it was previously 400'd).
 *
 * The inline handler in the monolithic `registerRoutes` is not exported, so —
 * mirroring the harness in `server/routes/__tests__/plaid-route-security.test.ts`
 * and `financial-security.test.ts` — this test reproduces the EXACT production
 * status-decision branch precedence against a real Express request/response
 * cycle. The discriminant helpers (`isStripeEventPayload`,
 * `normalizeStripeWebhookPayload`) are copied verbatim from server/routes.ts so
 * the branch condition under test is identical to production. If the production
 * branch changes shape, this contract should be updated alongside it.
 */

import express, { type Request, type Response } from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ── Discriminant, copied verbatim from server/routes.ts ────────────────────────
function isStripeEventPayload(value: unknown): value is {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
} {
  return Boolean(
    value
      && typeof value === "object"
      && typeof (value as Record<string, unknown>).id === "string"
      && typeof (value as Record<string, unknown>).type === "string"
      && (value as Record<string, unknown>).data
      && typeof (value as Record<string, unknown>).data === "object",
  );
}

function getStripeEventMetadata(payload: unknown): Record<string, unknown> {
  if (!isStripeEventPayload(payload)) return {};
  const object = payload.data.object;
  const metadata = object && typeof object === "object" ? (object as Record<string, unknown>).metadata : null;
  return metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
}

function normalizeStripeWebhookPayload(
  payload: unknown,
): { associationId: string | null; providerEventId: string | null; eventType: string | null } | null {
  if (!isStripeEventPayload(payload)) return null;
  const metadata = getStripeEventMetadata(payload);
  return {
    associationId: typeof metadata.associationId === "string" ? metadata.associationId : null,
    providerEventId: payload.id,
    eventType: payload.type,
  };
}

function getParam(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// ── Mini app reproducing the production status-decision precedence ─────────────
function makeApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.post("/api/webhooks/payments", (req: Request, res: Response) => {
    try {
      const stripeSignature = req.header("stripe-signature");
      const hmacSignature = req.header("x-webhook-hmac-sha256");
      const normalizedStripeEvent = normalizeStripeWebhookPayload(req.body);

      // Association-processing path (signature-verified, credits) — stubbed to a
      // 200 here; this test does not exercise the money path, only the branch
      // precedence that decides 200-ack vs 400.
      if (stripeSignature && normalizedStripeEvent?.associationId) {
        return res.status(200).json({ processed: true });
      }

      // THE FIX under test: a real Stripe event delivery with no associationId.
      if (stripeSignature && normalizedStripeEvent && !normalizedStripeEvent.associationId) {
        return res.status(200).json({ received: true, handled: false });
      }

      // Internal-API path unchanged: HMAC/shared-secret verification (elided) →
      // generic required-field validation → 400 when fields are missing.
      void hmacSignature;
      const associationId = getParam(req.body.associationId);
      const providerRaw = typeof req.body.provider === "string" ? req.body.provider : "";
      const provider = providerRaw === "stripe" || providerRaw === "other" ? providerRaw : null;
      const providerEventId = getParam(req.body.providerEventId);
      if (!associationId || !provider || !providerEventId) {
        return res.status(400).json({ message: "associationId, provider, and providerEventId are required" });
      }
      return res.status(201).json({ ok: true });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  });
  return app;
}

let baseUrl: string;
let close: () => Promise<void>;

beforeAll(async () => {
  const app = makeApp();
  await new Promise<void>((resolve, reject) => {
    const s = app.listen(0, () => {
      const port = (s.address() as { port: number }).port;
      baseUrl = `http://127.0.0.1:${port}`;
      close = () => new Promise((r) => s.close(() => r(undefined)));
      resolve();
    });
    s.on("error", reject);
  });
});

afterAll(async () => {
  if (close) await close();
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

describe("POST /api/webhooks/payments — Stripe platform-event acknowledgement", () => {
  it("acknowledges a signed Stripe event with no associationId → 200 {handled:false}", async () => {
    const res = await post(
      "/api/webhooks/payments",
      { id: "evt_test", object: "event", type: "invoice.paid", data: { object: { metadata: {} } } },
      { "stripe-signature": "t=1,v1=x" },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, handled: false });
  });

  it("still 400s an internal call (no stripe-signature) missing required fields", async () => {
    const res = await post("/api/webhooks/payments", {});
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain("associationId, provider, and providerEventId are required");
  });

  it("does not intercept an internal normalized-shape body carrying a stripe-signature (not a Stripe event → 400)", async () => {
    // The normalized internal shape has no id/type/data, so isStripeEventPayload
    // is false → normalizedStripeEvent is null → the 200-ack branch does NOT fire.
    const res = await post(
      "/api/webhooks/payments",
      { associationId: "assoc-1" }, // missing provider + providerEventId
      { "stripe-signature": "t=1,v1=x" },
    );
    expect(res.status).toBe(400);
  });
});
