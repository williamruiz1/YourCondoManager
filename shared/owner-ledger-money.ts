/**
 * Release B canonical owner-ledger money readers.
 *
 * The database compatibility trigger still mirrors legacy dollar writes during
 * the rolling deployment, but application calculations must read integer cents.
 * Missing cents are a release invariant failure, not a reason to fall back to
 * floating-point dollars.
 */
export type OwnerLedgerMoneyRecord = {
  amountCents: number | null;
};

export function ownerLedgerAmountCents(record: OwnerLedgerMoneyRecord): number {
  const amountCents = record.amountCents;
  if (!Number.isInteger(amountCents)) {
    throw new Error("owner ledger amount_cents invariant failed");
  }
  return amountCents as number;
}

export function ownerLedgerAmountDollars(record: OwnerLedgerMoneyRecord): number {
  return ownerLedgerAmountCents(record) / 100;
}

export function ownerLedgerV1Amount<T extends OwnerLedgerMoneyRecord>(record: T): T & { amount: number } {
  return {
    ...record,
    amount: ownerLedgerAmountDollars(record),
  };
}
