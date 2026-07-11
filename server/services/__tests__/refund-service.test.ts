/**
 * Refund service tests (payment-correctness hardening 2026-06-30, issue #286).
 *
 * R1.1 — default refunds set refund_application_fee=true (proportional app-fee
 *        refund) so the HOA never eats YCM's platform fee; partial passes amount;
 *        explicit false omits it.
 * R1.2 — routes via the connected account; no active routing → rejected.
 * R1.3 — idempotency key on the refund POST keyed by charge+amount.
 * R1.6 — REFUNDS_ENABLED flag gates the live path.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock seams ────────────────────────────────────────────────────────────────
let routing: { stripeAccountHeader: string; platformSecretKey: string; status: "active" } | null = {
  stripeAccountHeader: "acct_hoa_1",
  platformSecretKey: "sk_test_platform",
  status: "active",
};

vi.mock("../stripe-connect-resolver", () => ({
  resolveConnectChargeRouting: vi.fn(async (_assocId: string) => routing),
}));

type Captured = {
  method: string;
  path: string;
  body?: URLSearchParams | null;
  stripeAccount?: string;
  idempotencyKey?: string;
};
let captured: Captured[] = [];

vi.mock("../stripe-connect", () => ({
  callPlatformStripe: vi.fn(async (opts: Captured) => {
    captured.push(opts);
    return { id: "re_test_1", status: "succeeded", amount: 5000 };
  }),
}));

import { refundConnectCharge, isRefundsEnabled } from "../refund-service";

const ORIGINAL_FLAG = process.env.REFUNDS_ENABLED;

beforeEach(() => {
  captured = [];
  routing = { stripeAccountHeader: "acct_hoa_1", platformSecretKey: "sk_test_platform", status: "active" };
  process.env.REFUNDS_ENABLED = "1"; // enabled for most tests
});

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.REFUNDS_ENABLED;
  else process.env.REFUNDS_ENABLED = ORIGINAL_FLAG;
  vi.clearAllMocks();
});

describe("refundConnectCharge", () => {
  it("R1.1 default refund sets refund_application_fee=true", async () => {
    const result = await refundConnectCharge({ associationId: "a1", chargeId: "ch_1" });
    expect(captured).toHaveLength(1);
    const body = captured[0].body!;
    expect(body.get("charge")).toBe("ch_1");
    expect(body.get("refund_application_fee")).toBe("true");
    expect(body.has("amount")).toBe(false); // full refund
    expect(result.applicationFeeRefunded).toBe(true);
    expect(result.refundId).toBe("re_test_1");
  });

  it("R1.1 partial refund passes amount + still refunds app fee", async () => {
    await refundConnectCharge({ associationId: "a1", chargeId: "ch_1", amountCents: 5000 });
    const body = captured[0].body!;
    expect(body.get("amount")).toBe("5000");
    expect(body.get("refund_application_fee")).toBe("true");
  });

  it("R1.1 explicit refundApplicationFee=false sets it false", async () => {
    await refundConnectCharge({ associationId: "a1", chargeId: "ch_1", refundApplicationFee: false });
    expect(captured[0].body!.get("refund_application_fee")).toBe("false");
  });

  it("R1.2 routes via the connected account (Stripe-Account header)", async () => {
    await refundConnectCharge({ associationId: "a1", chargeId: "ch_1" });
    expect(captured[0].stripeAccount).toBe("acct_hoa_1");
    expect(captured[0].path).toBe("/refunds");
    expect(captured[0].method).toBe("POST");
  });

  it("R1.2 no active Connect routing → rejected, no Stripe call", async () => {
    routing = null;
    await expect(refundConnectCharge({ associationId: "a1", chargeId: "ch_1" })).rejects.toThrow(
      /no active stripe connect account/i,
    );
    expect(captured).toHaveLength(0);
  });

  it("R1.3 idempotency key keyed by charge+amount; distinct for partial", async () => {
    await refundConnectCharge({ associationId: "a1", chargeId: "ch_1" });
    const fullKey = captured[0].idempotencyKey;
    captured = [];
    await refundConnectCharge({ associationId: "a1", chargeId: "ch_1", amountCents: 5000 });
    const partialKey = captured[0].idempotencyKey;
    expect(fullKey).toBeTruthy();
    expect(partialKey).toBeTruthy();
    expect(fullKey).not.toBe(partialKey);
  });

  it("R1.6 disabled flag rejects before any Stripe call", async () => {
    process.env.REFUNDS_ENABLED = "0";
    expect(isRefundsEnabled()).toBe(false);
    await expect(refundConnectCharge({ associationId: "a1", chargeId: "ch_1" })).rejects.toThrow(
      /disabled/i,
    );
    expect(captured).toHaveLength(0);
  });

  it("rejects non-positive partial amount", async () => {
    await expect(
      refundConnectCharge({ associationId: "a1", chargeId: "ch_1", amountCents: 0 }),
    ).rejects.toThrow(/positive/i);
  });
});
