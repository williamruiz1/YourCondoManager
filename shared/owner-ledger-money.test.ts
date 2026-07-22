import { describe, expect, it } from "vitest";

import {
  ownerLedgerAmountCents,
  ownerLedgerAmountDollars,
  ownerLedgerV1Amount,
} from "./owner-ledger-money";

describe("Release B owner-ledger money readers", () => {
  it("uses integer cents as the only calculation authority", () => {
    const row = { amount: 999_999.99, amountCents: -12_345 };

    expect(ownerLedgerAmountCents(row)).toBe(-12_345);
    expect(ownerLedgerAmountDollars(row)).toBe(-123.45);
    expect(ownerLedgerV1Amount(row).amount).toBe(-123.45);
  });

  it("fails closed instead of falling back to legacy dollars", () => {
    expect(() => ownerLedgerAmountCents({ amountCents: null })).toThrow(
      "owner ledger amount_cents invariant failed",
    );
  });
});
