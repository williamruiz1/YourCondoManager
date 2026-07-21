import type { PaymentTransaction } from "@shared/schema";
import { netLedgerCreditDollars, recordPlatformProcessingFee } from "./convenience-fee";
import { postPaymentLedgerEntry } from "./ledger-payment-identity";

export type FeeSettlementMethod = "connect_application_fee" | "accounting_only";

/**
 * Transaction-backed safety net for a successful Stripe payment webhook.
 *
 * The primary webhook processor posts from signed Stripe metadata. Legacy
 * manual-key payments may not carry enough owner/unit metadata for that path,
 * even though the matching local payment transaction has all of it. This
 * fallback uses the trusted transaction row and the same payment identity key
 * as every other ledger path, so Postgres remains the exactly-once arbiter.
 */
export async function postSucceededPaymentTransactionLedgerEntry(params: {
  transaction: PaymentTransaction;
  paymentIdentityKey?: string | null;
  feeSettlementMethod?: FeeSettlementMethod | null;
  postedAt?: Date;
}) {
  const { transaction } = params;
  if (transaction.status !== "succeeded") {
    return { created: false, entry: null };
  }
  const paymentIdentityKey = transaction.providerIntentId?.trim()
    || params.paymentIdentityKey?.trim()
    || `payment-transaction:${transaction.id}`;
  const ledgerCreditDollars = netLedgerCreditDollars(
    transaction.amountCents / 100,
    transaction.platformFeeCents,
  );

  const ledgerResult = await postPaymentLedgerEntry({
    associationId: transaction.associationId,
    unitId: transaction.unitId,
    personId: transaction.personId,
    amount: Number((-Math.abs(ledgerCreditDollars)).toFixed(2)),
    postedAt: params.postedAt ?? new Date(),
    description: transaction.description
      || (transaction.source === "autopay" ? "Autopay payment" : "Owner payment"),
    referenceType: transaction.source === "autopay"
      ? "autopay_payment_transaction"
      : "payment_transaction",
    referenceId: transaction.id,
    paymentIdentityKey,
    source: transaction.source === "autopay" ? "autopay-webhook" : "payment-webhook-transaction",
  });

  // The primary metadata path books this fee when it wins the ledger insert.
  // If this fallback wins instead, book it here using the same idempotency key.
  if (ledgerResult.created && transaction.platformFeeCents > 0) {
    try {
      await recordPlatformProcessingFee({
        associationId: transaction.associationId,
        paymentTransactionId: transaction.id,
        unitId: transaction.unitId,
        personId: transaction.personId,
        feeType: "card_processing",
        amountCents: transaction.platformFeeCents,
        currency: transaction.currency || "USD",
        idempotencyKey: paymentIdentityKey,
        stripePaymentIntentId: paymentIdentityKey,
        status: "collected",
        settlementMethod: params.feeSettlementMethod ?? "accounting_only",
      });
    } catch (error) {
      // A fee-booking failure must not roll back or cause Stripe to retry a
      // ledger credit that has already posted successfully.
      console.error("[payment-webhook] transaction-backed platform fee booking failed (non-fatal):", error);
    }
  }

  return ledgerResult;
}
