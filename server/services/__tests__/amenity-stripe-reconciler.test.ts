/**
 * Amenity deposit Stripe-truth reconciler (A-STRIPE-002).
 *
 * Proves the non-atomic charge-then-write gap is REPAIRABLE from Stripe truth:
 *   - a DB write failure after a successful Stripe op (columns at 0 but Stripe
 *     captured/released) is repaired to match Stripe;
 *   - when the columns already agree with Stripe, the reconciler NEVER writes.
 * The lookup is deterministic — keyed on the stored hold-intent id (A-STRIPE-003).
 */
import { describe, expect, it, vi } from "vitest";
import {
  reconcileAmenityDepositColumns,
  reconcileReservationDeposit,
  type AmenityDepositIntentSnapshot,
} from "../amenity-stripe-reconciler";

const HELD = 20000;

describe("reconcileAmenityDepositColumns (pure mapping)", () => {
  it("requires_capture → authorized, unresolved (held set, refunded/forfeited 0)", () => {
    const r = reconcileAmenityDepositColumns(
      { depositHeldCents: 0, depositRefundedCents: 0, depositForfeitedCents: 0 },
      { status: "requires_capture", amountCents: HELD, amountCapturedCents: 0 },
    );
    // DB never wrote the hold column → repair sets it.
    expect(r.needsRepair).toBe(true);
    expect(r.columns).toEqual({ depositHeldCents: HELD, depositRefundedCents: 0, depositForfeitedCents: 0 });
  });

  it("REPAIR: Stripe succeeded (captured) but DB column at 0 → repairs forfeited", () => {
    const r = reconcileAmenityDepositColumns(
      { depositHeldCents: HELD, depositRefundedCents: 0, depositForfeitedCents: 0 },
      { status: "succeeded", amountCents: HELD, amountCapturedCents: HELD },
    );
    expect(r.needsRepair).toBe(true);
    expect(r.columns.depositForfeitedCents).toBe(HELD);
    expect(r.columns.depositRefundedCents).toBe(0);
  });

  it("partial capture: forfeited = captured, remainder auto-released → refunded", () => {
    const r = reconcileAmenityDepositColumns(
      { depositHeldCents: HELD, depositRefundedCents: 0, depositForfeitedCents: 0 },
      { status: "succeeded", amountCents: HELD, amountCapturedCents: 5000 },
    );
    expect(r.needsRepair).toBe(true);
    expect(r.columns.depositForfeitedCents).toBe(5000);
    expect(r.columns.depositRefundedCents).toBe(HELD - 5000);
  });

  it("canceled → fully released → refunded = held", () => {
    const r = reconcileAmenityDepositColumns(
      { depositHeldCents: HELD, depositRefundedCents: 0, depositForfeitedCents: 0 },
      { status: "canceled", amountCents: HELD, amountCapturedCents: 0 },
    );
    expect(r.needsRepair).toBe(true);
    expect(r.columns.depositRefundedCents).toBe(HELD);
    expect(r.columns.depositForfeitedCents).toBe(0);
  });

  it("NO double-write: columns already match Stripe truth → needsRepair false", () => {
    const r = reconcileAmenityDepositColumns(
      { depositHeldCents: HELD, depositRefundedCents: 0, depositForfeitedCents: HELD },
      { status: "succeeded", amountCents: HELD, amountCapturedCents: HELD },
    );
    expect(r.needsRepair).toBe(false);
  });

  it("indeterminate status (processing) → never repairs", () => {
    const r = reconcileAmenityDepositColumns(
      { depositHeldCents: 0, depositRefundedCents: 0, depositForfeitedCents: 0 },
      { status: "processing", amountCents: HELD, amountCapturedCents: 0 },
    );
    expect(r.needsRepair).toBe(false);
    expect(r.reason).toContain("indeterminate");
  });
});

describe("reconcileReservationDeposit (orchestrator)", () => {
  const captured: AmenityDepositIntentSnapshot = { status: "succeeded", amountCents: HELD, amountCapturedCents: HELD };

  it("repairs the reservation column via the STORED intent id and writes once", async () => {
    const writeColumns = vi.fn(async () => {});
    const readIntent = vi.fn(async (id: string) => (id === "pi_stored" ? captured : null));
    const result = await reconcileReservationDeposit(
      { id: "res-1", depositHoldIntentId: "pi_stored", depositHeldCents: HELD, depositRefundedCents: 0, depositForfeitedCents: 0 },
      { readIntent, writeColumns },
    );
    expect(readIntent).toHaveBeenCalledWith("pi_stored");
    expect(result.needsRepair).toBe(true);
    expect(writeColumns).toHaveBeenCalledTimes(1);
    expect(writeColumns).toHaveBeenCalledWith("res-1", expect.objectContaining({ depositForfeitedCents: HELD }));
  });

  it("NEVER double-writes when the column already agrees", async () => {
    const writeColumns = vi.fn(async () => {});
    const readIntent = vi.fn(async () => captured);
    const result = await reconcileReservationDeposit(
      { id: "res-1", depositHoldIntentId: "pi_stored", depositHeldCents: HELD, depositRefundedCents: 0, depositForfeitedCents: HELD },
      { readIntent, writeColumns },
    );
    expect(result.needsRepair).toBe(false);
    expect(writeColumns).not.toHaveBeenCalled();
  });

  it("no stored intent id → no repair (nothing to reconcile deterministically)", async () => {
    const writeColumns = vi.fn(async () => {});
    const readIntent = vi.fn(async () => captured);
    const result = await reconcileReservationDeposit(
      { id: "res-1", depositHoldIntentId: null, depositHeldCents: 0, depositRefundedCents: 0, depositForfeitedCents: 0 },
      { readIntent, writeColumns },
    );
    expect(result.reason).toBe("no-stored-intent-id");
    expect(readIntent).not.toHaveBeenCalled();
    expect(writeColumns).not.toHaveBeenCalled();
  });
});
