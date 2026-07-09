/**
 * Amenity money-capture service — orchestration suite (founder-os#10181).
 *
 * Proves Slices 1–4 of the amenity money loop AT THE LIVE CODE PATH (the layer
 * YCM #329 found had ZERO live writes), WITHOUT touching live Stripe: the Stripe
 * gateway is injected, `db` + the GL sync are mocked, and the flag is driven via
 * env. What's asserted is the RISK SURFACE — the gating, the column math, the
 * invariants, the GL-sync wiring, idempotency, and non-fatal-ness:
 *
 *   Slice 1 — enabled booking charges the fee → writes feeChargedCents
 *   Slice 2 — enabled booking holds the deposit → writes depositHeldCents
 *   Slice 3 — clean resolution refunds → writes depositRefundedCents
 *   Slice 4 — damage resolution forfeits → writes depositForfeitedCents; partial split
 *   Gate    — a non-allowlisted association is a PURE NO-OP on every slice (default-off)
 *   Safety  — amounts come from amenity config (never hardcoded); a failed Stripe op
 *             leaves the column 0; over-resolving is rejected fail-loud; GL sync fires.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Programmable `db` mock. Selects shift the next queued result; updates are
//    recorded so we can assert exactly which money columns were written. ───────
let selectQueue: any[][] = [];
const updates: any[] = [];
vi.mock("../../db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => Promise.resolve(selectQueue.shift() ?? []) }) }),
    update: () => ({ set: (v: any) => ({ where: () => { updates.push(v); return Promise.resolve(); } }) }),
  },
}));

// ── Mock the default Stripe gateway so constructing it never pulls in storage/
//    live Stripe. Tests always INJECT a gateway, so this is only a safety net. ─
vi.mock("../amenity-stripe-gateway", () => ({
  createStripeAmenityGateway: () => ({
    chargeFee: async () => ({ ok: false, reason: "payment-context-unavailable" }),
    holdDeposit: async () => ({ ok: false, reason: "payment-context-unavailable" }),
    refundDeposit: async () => ({ ok: false, reason: "payment-context-unavailable" }),
    forfeitDeposit: async () => ({ ok: false, reason: "payment-context-unavailable" }),
  }),
}));

// ── Mock the GL sync wrapper so we can assert it FIRED after a money mutation. ─
const glSyncSpy = vi.fn();
vi.mock("../gl/amenity-runtime-sync", () => ({
  maybeSyncAssociationAmenityGl: async (associationId: string, ctx?: string) => {
    glSyncSpy(associationId, ctx);
    return { posted: false, reason: "not-enabled" };
  },
}));

import {
  captureAmenityBookingMoney,
  resolveAmenityDeposit,
  type AmenityMoneyGateway,
} from "../amenity-money-service";

const ASSOC = "assoc-1";
const RES_ID = "resv-1";
const AMENITY_ID = "amn-1";

const FEE = 7500; // $75.00 (from amenity config, never hardcoded in the service)
const DEPOSIT = 20000; // $200.00

/** A gateway whose every op succeeds — the "resident can pay" happy path. */
function okGateway(): AmenityMoneyGateway {
  return {
    chargeFee: async () => ({ ok: true, intentId: "pi_fee" }),
    holdDeposit: async () => ({ ok: true, intentId: "pi_hold" }),
    refundDeposit: async () => ({ ok: true, intentId: "pi_hold" }),
    forfeitDeposit: async () => ({ ok: true, intentId: "pi_hold" }),
  };
}

/** A gateway whose every op fails — no payment method / a decline. */
function failGateway(): AmenityMoneyGateway {
  return {
    chargeFee: async () => ({ ok: false, reason: "fee-charge-failed" }),
    holdDeposit: async () => ({ ok: false, reason: "deposit-hold-failed" }),
    refundDeposit: async () => ({ ok: false, reason: "deposit-hold-not-found" }),
    forfeitDeposit: async () => ({ ok: false, reason: "deposit-hold-not-found" }),
  };
}

function reservation(overrides: Record<string, any> = {}) {
  return {
    id: RES_ID,
    amenityId: AMENITY_ID,
    associationId: ASSOC,
    personId: "person-1",
    feeChargedCents: 0,
    depositHeldCents: 0,
    depositRefundedCents: 0,
    depositForfeitedCents: 0,
    ...overrides,
  };
}
function amenity(overrides: Record<string, any> = {}) {
  return { id: AMENITY_ID, usageFeeCents: FEE, depositCents: DEPOSIT, ...overrides };
}

beforeEach(() => {
  selectQueue = [];
  updates.length = 0;
  glSyncSpy.mockClear();
  delete process.env.GL_ENABLED;
  delete process.env.GL_ENABLED_ASSOCIATIONS;
});
afterEach(() => {
  delete process.env.GL_ENABLED;
  delete process.env.GL_ENABLED_ASSOCIATIONS;
});

describe("captureAmenityBookingMoney — Slice 1 (fee) + Slice 2 (deposit hold)", () => {
  it("GATE (default-off): non-allowlisted association is a PURE NO-OP — no charge, no write, no GL", async () => {
    selectQueue = [[reservation()]]; // gate short-circuits before the amenity load
    const gw = okGateway();
    const chargeFee = vi.spyOn(gw, "chargeFee");
    const out = await captureAmenityBookingMoney({ reservationId: RES_ID, gateway: gw });
    expect(out.skipped).toBe(true);
    expect(out.reason).toBe("not-enabled");
    expect(out.mutated).toBe(false);
    expect(chargeFee).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
    expect(glSyncSpy).not.toHaveBeenCalled();
  });

  it("enabled (allowlisted): charges the fee + holds the deposit → writes both columns + fires GL", async () => {
    process.env.GL_ENABLED_ASSOCIATIONS = ASSOC;
    selectQueue = [[reservation()], [amenity()]];
    const out = await captureAmenityBookingMoney({ reservationId: RES_ID, gateway: okGateway() });
    expect(out.skipped).toBe(false);
    expect(out.feeChargedCents).toBe(FEE);
    expect(out.depositHeldCents).toBe(DEPOSIT);
    expect(out.mutated).toBe(true);
    // Exactly the two money columns written, sourced from amenity config.
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ feeChargedCents: FEE, depositHeldCents: DEPOSIT });
    expect(glSyncSpy).toHaveBeenCalledWith(ASSOC, "amenity-booking-capture");
  });

  it("SAFETY: a failed Stripe charge leaves the columns 0 — never fabricates a GL liability", async () => {
    process.env.GL_ENABLED_ASSOCIATIONS = ASSOC;
    selectQueue = [[reservation()], [amenity()]];
    const out = await captureAmenityBookingMoney({ reservationId: RES_ID, gateway: failGateway() });
    expect(out.feeChargedCents).toBe(0);
    expect(out.depositHeldCents).toBe(0);
    expect(out.mutated).toBe(false);
    expect(updates).toHaveLength(0);
    expect(glSyncSpy).not.toHaveBeenCalled();
  });

  it("SAFETY: fee amount comes from the amenity config, not a hardcoded constant", async () => {
    process.env.GL_ENABLED = "1";
    selectQueue = [[reservation()], [amenity({ usageFeeCents: 12345, depositCents: 0 })]];
    const out = await captureAmenityBookingMoney({ reservationId: RES_ID, gateway: okGateway() });
    expect(out.feeChargedCents).toBe(12345);
    expect(out.depositHeldCents).toBe(0);
  });

  it("free amenity (fee=0, deposit=0): no money, no GL, still not a gate-skip", async () => {
    process.env.GL_ENABLED = "1";
    selectQueue = [[reservation()], [amenity({ usageFeeCents: 0, depositCents: 0 })]];
    const out = await captureAmenityBookingMoney({ reservationId: RES_ID, gateway: okGateway() });
    expect(out.skipped).toBe(false);
    expect(out.mutated).toBe(false);
    expect(updates).toHaveLength(0);
  });

  it("IDEMPOTENT: a reservation already captured is not re-charged", async () => {
    process.env.GL_ENABLED = "1";
    selectQueue = [[reservation({ feeChargedCents: FEE })]];
    const gw = okGateway();
    const chargeFee = vi.spyOn(gw, "chargeFee");
    const out = await captureAmenityBookingMoney({ reservationId: RES_ID, gateway: gw });
    expect(out.skipped).toBe(true);
    expect(out.reason).toBe("already-captured");
    expect(chargeFee).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });
});

describe("resolveAmenityDeposit — Slice 3 (refund) + Slice 4 (forfeit)", () => {
  it("GATE (default-off): non-allowlisted association is a PURE NO-OP", async () => {
    selectQueue = [[reservation({ depositHeldCents: DEPOSIT })]];
    const out = await resolveAmenityDeposit({ reservationId: RES_ID, refundCents: DEPOSIT, gateway: okGateway() });
    expect(out.skipped).toBe(true);
    expect(out.reason).toBe("not-enabled");
    expect(updates).toHaveLength(0);
    expect(glSyncSpy).not.toHaveBeenCalled();
  });

  it("Slice 3: clean checkout refunds the full deposit → writes depositRefundedCents + fires GL", async () => {
    process.env.GL_ENABLED_ASSOCIATIONS = ASSOC;
    selectQueue = [[reservation({ depositHeldCents: DEPOSIT })]];
    const out = await resolveAmenityDeposit({ reservationId: RES_ID, refundCents: DEPOSIT, gateway: okGateway() });
    expect(out.depositRefundedCents).toBe(DEPOSIT);
    expect(out.depositForfeitedCents).toBe(0);
    expect(out.mutated).toBe(true);
    expect(updates[0]).toMatchObject({ depositRefundedCents: DEPOSIT, depositForfeitedCents: 0 });
    expect(glSyncSpy).toHaveBeenCalledWith(ASSOC, "amenity-deposit-resolution");
  });

  it("Slice 4: damage forfeits the full deposit → writes depositForfeitedCents", async () => {
    process.env.GL_ENABLED_ASSOCIATIONS = ASSOC;
    selectQueue = [[reservation({ depositHeldCents: DEPOSIT })]];
    const out = await resolveAmenityDeposit({ reservationId: RES_ID, forfeitCents: DEPOSIT, gateway: okGateway() });
    expect(out.depositForfeitedCents).toBe(DEPOSIT);
    expect(out.depositRefundedCents).toBe(0);
    expect(updates[0]).toMatchObject({ depositForfeitedCents: DEPOSIT, depositRefundedCents: 0 });
  });

  it("Slice 4 (partial): forfeit + refund split where forfeited + refunded == held", async () => {
    process.env.GL_ENABLED_ASSOCIATIONS = ASSOC;
    selectQueue = [[reservation({ depositHeldCents: DEPOSIT })]];
    const out = await resolveAmenityDeposit({ reservationId: RES_ID, refundCents: 15000, forfeitCents: 5000, gateway: okGateway() });
    expect(out.depositRefundedCents).toBe(15000);
    expect(out.depositForfeitedCents).toBe(5000);
    expect(out.depositRefundedCents + out.depositForfeitedCents).toBe(DEPOSIT);
  });

  it("accumulates across partial resolutions (increment, not overwrite)", async () => {
    process.env.GL_ENABLED_ASSOCIATIONS = ASSOC;
    // Already refunded 5000 of a 20000 hold; now forfeit 5000 more.
    selectQueue = [[reservation({ depositHeldCents: DEPOSIT, depositRefundedCents: 5000 })]];
    const out = await resolveAmenityDeposit({ reservationId: RES_ID, forfeitCents: 5000, gateway: okGateway() });
    expect(out.depositRefundedCents).toBe(5000);
    expect(out.depositForfeitedCents).toBe(5000);
    expect(updates[0]).toMatchObject({ depositRefundedCents: 5000, depositForfeitedCents: 5000 });
  });

  it("INVARIANT: refund + forfeit exceeding the unresolved deposit is rejected fail-loud", async () => {
    process.env.GL_ENABLED_ASSOCIATIONS = ASSOC;
    selectQueue = [[reservation({ depositHeldCents: DEPOSIT, depositRefundedCents: 15000 })]];
    await expect(
      resolveAmenityDeposit({ reservationId: RES_ID, forfeitCents: 10000, gateway: okGateway() }),
    ).rejects.toThrow(/exceeds the .*unresolved deposit/);
    expect(updates).toHaveLength(0);
  });

  it("INVARIANT: a negative resolution amount is rejected fail-loud", async () => {
    process.env.GL_ENABLED_ASSOCIATIONS = ASSOC;
    selectQueue = [[reservation({ depositHeldCents: DEPOSIT })]];
    await expect(
      resolveAmenityDeposit({ reservationId: RES_ID, refundCents: -100, gateway: okGateway() }),
    ).rejects.toThrow(/non-negative integer/);
  });

  it("SAFETY: a failed Stripe refund leaves the column unchanged", async () => {
    process.env.GL_ENABLED_ASSOCIATIONS = ASSOC;
    selectQueue = [[reservation({ depositHeldCents: DEPOSIT })]];
    const out = await resolveAmenityDeposit({ reservationId: RES_ID, refundCents: DEPOSIT, gateway: failGateway() });
    expect(out.depositRefundedCents).toBe(0);
    expect(out.mutated).toBe(false);
    expect(updates).toHaveLength(0);
  });
});
