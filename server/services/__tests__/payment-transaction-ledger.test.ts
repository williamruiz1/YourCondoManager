import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentTransaction } from "@shared/schema";

const mocks = vi.hoisted(() => ({
  postPaymentLedgerEntry: vi.fn(),
  recordPlatformProcessingFee: vi.fn(),
}));

vi.mock("../ledger-payment-identity", () => ({
  postPaymentLedgerEntry: mocks.postPaymentLedgerEntry,
}));

vi.mock("../convenience-fee", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../convenience-fee")>();
  return {
    ...actual,
    recordPlatformProcessingFee: mocks.recordPlatformProcessingFee,
  };
});

import { postSucceededPaymentTransactionLedgerEntry } from "../payment-transaction-ledger";

function transaction(overrides: Partial<PaymentTransaction> = {}): PaymentTransaction {
  return {
    id: "txn-owner-1",
    associationId: "assoc-1",
    unitId: "unit-1417-f",
    personId: "person-william",
    amountCents: 33_000,
    currency: "USD",
    status: "succeeded",
    provider: "stripe",
    source: "owner_initiated",
    providerIntentId: "pi_owner_1",
    platformFeeCents: 0,
    description: "July owner payment",
    ...overrides,
  } as PaymentTransaction;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.postPaymentLedgerEntry.mockResolvedValue({
    created: true,
    entry: { id: "ledger-1" },
  });
  mocks.recordPlatformProcessingFee.mockResolvedValue({ created: true, fee: { id: "fee-1" } });
});

describe("postSucceededPaymentTransactionLedgerEntry", () => {
  it("credits an owner-initiated payment using trusted transaction ownership", async () => {
    await postSucceededPaymentTransactionLedgerEntry({
      transaction: transaction(),
      paymentIdentityKey: "pi_event_fallback",
      postedAt: new Date("2026-07-20T12:00:00Z"),
    });

    expect(mocks.postPaymentLedgerEntry).toHaveBeenCalledWith(expect.objectContaining({
      associationId: "assoc-1",
      unitId: "unit-1417-f",
      personId: "person-william",
      amount: -330,
      referenceType: "payment_transaction",
      referenceId: "txn-owner-1",
      paymentIdentityKey: "pi_owner_1",
      source: "payment-webhook-transaction",
    }));
  });

  it("preserves the autopay path while using the same canonical writer", async () => {
    await postSucceededPaymentTransactionLedgerEntry({
      transaction: transaction({ id: "txn-auto-1", source: "autopay", providerIntentId: "pi_auto_1" }),
    });

    expect(mocks.postPaymentLedgerEntry).toHaveBeenCalledWith(expect.objectContaining({
      referenceType: "autopay_payment_transaction",
      referenceId: "txn-auto-1",
      paymentIdentityKey: "pi_auto_1",
      source: "autopay-webhook",
    }));
  });

  it("nets the platform fee from the owner ledger and books it separately", async () => {
    await postSucceededPaymentTransactionLedgerEntry({
      transaction: transaction({ amountCents: 20_610, platformFeeCents: 610 }),
      feeSettlementMethod: "connect_application_fee",
    });

    expect(mocks.postPaymentLedgerEntry).toHaveBeenCalledWith(expect.objectContaining({ amount: -200 }));
    expect(mocks.recordPlatformProcessingFee).toHaveBeenCalledWith(expect.objectContaining({
      paymentTransactionId: "txn-owner-1",
      amountCents: 610,
      idempotencyKey: "pi_owner_1",
      stripePaymentIntentId: "pi_owner_1",
      settlementMethod: "connect_application_fee",
    }));
  });

  it("does not re-book a fee when another webhook path already won the ledger insert", async () => {
    mocks.postPaymentLedgerEntry.mockResolvedValue({ created: false, entry: { id: "ledger-existing" } });

    await postSucceededPaymentTransactionLedgerEntry({
      transaction: transaction({ platformFeeCents: 610 }),
    });

    expect(mocks.recordPlatformProcessingFee).not.toHaveBeenCalled();
  });

  it("uses a stable local identity when a legacy event has no provider identity", async () => {
    await postSucceededPaymentTransactionLedgerEntry({
      transaction: transaction({ providerIntentId: null }),
      paymentIdentityKey: null,
    });

    expect(mocks.postPaymentLedgerEntry).toHaveBeenCalledWith(expect.objectContaining({
      paymentIdentityKey: "payment-transaction:txn-owner-1",
    }));
  });

  it.each(["initiated", "pending", "failed", "canceled", "reversed"] as const)(
    "never posts a %s transaction",
    async (status) => {
      const result = await postSucceededPaymentTransactionLedgerEntry({
        transaction: transaction({ status }),
      });

      expect(result).toEqual({ created: false, entry: null });
      expect(mocks.postPaymentLedgerEntry).not.toHaveBeenCalled();
      expect(mocks.recordPlatformProcessingFee).not.toHaveBeenCalled();
    },
  );
});
