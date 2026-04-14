/**
 * Retry Service — Phase 3 Delinquency & Retry Logic
 *
 * Classifies payment failures, marks transactions for retry,
 * finds retry-eligible transactions, and executes retries.
 */

import { and, eq, lte, isNull, desc, sql } from "drizzle-orm";
import { db } from "../db";
import {
  paymentTransactions,
  delinquencySettings,
  savedPaymentMethods,
  autopayEnrollments,
  autopayRuns,
  ownerLedgerEntries,
  type PaymentTransaction,
  type DelinquencySettings,
} from "@shared/schema";
import { storage } from "../storage";
import {
  createPaymentTransaction,
  chargeOffSession,
  updatePaymentTransactionStatus,
} from "./payment-service";

// ── Failure Classification ───────────────────────────────────────────────────

const HARD_FAILURE_CODES = new Set([
  "account_closed",
  "invalid_account",
  "no_account",
  "account_frozen",
  "bank_account_declined",
  "debit_not_authorized",
  "authentication_required",
  "setup_intent_authentication_failure",
]);

const SOFT_FAILURE_CODES = new Set([
  "insufficient_funds",
  "processing_error",
  "temporary_failure",
  "rate_limit",
]);

export function classifyFailure(
  failureCode: string | null | undefined,
  failureReason: string | null | undefined,
): "soft" | "hard" | "unknown" {
  const code = (failureCode ?? "").toLowerCase();
  const reason = (failureReason ?? "").toLowerCase();

  if (HARD_FAILURE_CODES.has(code)) return "hard";
  if (SOFT_FAILURE_CODES.has(code)) return "soft";
  if (reason.includes("network") || reason.includes("timeout")) return "soft";
  if (reason.includes("closed") || reason.includes("not authorized")) return "hard";

  return "unknown";
}

// ── Delinquency Settings ─────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Omit<DelinquencySettings, "id" | "createdAt" | "updatedAt"> = {
  associationId: null,
  gracePeriodDays: 15,
  bucketBoundariesJson: [30, 60, 90],
  maxRetryAttempts: 3,
  retryScheduleJson: [3, 7, 14],
  noticeStagesJson: null,
  autoLateFeeEnabled: 0,
};

export async function getDelinquencySettings(associationId: string): Promise<DelinquencySettings> {
  // Try association-specific first
  const [assocSettings] = await db
    .select()
    .from(delinquencySettings)
    .where(eq(delinquencySettings.associationId, associationId))
    .limit(1);

  if (assocSettings) return assocSettings;

  // Try global default (null associationId)
  const [globalSettings] = await db
    .select()
    .from(delinquencySettings)
    .where(isNull(delinquencySettings.associationId))
    .limit(1);

  if (globalSettings) return globalSettings;

  // Return hard-coded defaults
  return {
    id: "default",
    ...DEFAULT_SETTINGS,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as DelinquencySettings;
}

// ── Mark Transaction for Retry ───────────────────────────────────────────────

export async function markTransactionForRetry(
  txnId: string,
  failureCode: string | null | undefined,
  failureReason: string | null | undefined,
  settings: DelinquencySettings,
): Promise<void> {
  const [txn] = await db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.id, txnId))
    .limit(1);

  if (!txn) return;

  const category = classifyFailure(failureCode, failureReason);
  const maxRetries = settings.maxRetryAttempts ?? 3;
  const schedule = (Array.isArray(settings.retryScheduleJson) ? settings.retryScheduleJson : [3, 7, 14]) as number[];

  if (category === "hard" || txn.attemptNumber >= maxRetries) {
    // Non-retryable or max attempts reached
    await db
      .update(paymentTransactions)
      .set({
        failureCategory: category,
        retryEligible: 0,
        updatedAt: new Date(),
      })
      .where(eq(paymentTransactions.id, txnId));
    return;
  }

  // Retryable — compute next retry date
  const scheduleIndex = Math.min(txn.attemptNumber - 1, schedule.length - 1);
  const daysUntilRetry = schedule[scheduleIndex] ?? 3;
  const nextRetryAt = new Date();
  nextRetryAt.setDate(nextRetryAt.getDate() + daysUntilRetry);

  await db
    .update(paymentTransactions)
    .set({
      failureCategory: category,
      retryEligible: 1,
      nextRetryAt,
      updatedAt: new Date(),
    })
    .where(eq(paymentTransactions.id, txnId));
}

// ── Find Retry-Eligible Transactions ─────────────────────────────────────────

export async function findRetryEligibleTransactions(
  associationId?: string,
): Promise<PaymentTransaction[]> {
  const conditions = [
    eq(paymentTransactions.status, "failed"),
    eq(paymentTransactions.retryEligible, 1),
    eq(paymentTransactions.source, "autopay"),
    lte(paymentTransactions.nextRetryAt, new Date()),
  ];

  if (associationId) {
    conditions.push(eq(paymentTransactions.associationId, associationId));
  }

  return db
    .select()
    .from(paymentTransactions)
    .where(and(...conditions))
    .orderBy(paymentTransactions.nextRetryAt);
}

// ── Execute Autopay Retries ──────────────────────────────────────────────────

export async function runAutopayRetries(): Promise<{
  retried: number;
  succeeded: number;
  failed: number;
  skipped: number;
}> {
  const eligible = await findRetryEligibleTransactions();
  let retried = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const originalTxn of eligible) {
    try {
      // Load payment method
      if (!originalTxn.paymentMethodId) {
        await db
          .update(paymentTransactions)
          .set({ retryEligible: 0, updatedAt: new Date() })
          .where(eq(paymentTransactions.id, originalTxn.id));
        skipped++;
        continue;
      }

      const [method] = await db
        .select()
        .from(savedPaymentMethods)
        .where(eq(savedPaymentMethods.id, originalTxn.paymentMethodId))
        .limit(1);

      if (!method || method.status !== "active" || !method.providerPaymentMethodId || !method.providerCustomerId) {
        await db
          .update(paymentTransactions)
          .set({ retryEligible: 0, updatedAt: new Date() })
          .where(eq(paymentTransactions.id, originalTxn.id));
        skipped++;
        continue;
      }

      // Load gateway
      const gateway = await storage.getActivePaymentGatewayConnection({
        associationId: originalTxn.associationId,
        provider: "stripe",
      });

      if (!gateway?.secretKey) {
        skipped++;
        continue;
      }

      // Create retry transaction
      const retryTxn = await createPaymentTransaction({
        associationId: originalTxn.associationId,
        unitId: originalTxn.unitId,
        personId: originalTxn.personId,
        amountCents: originalTxn.amountCents,
        description: originalTxn.description || "Autopay retry",
        source: "autopay",
        paymentMethodId: originalTxn.paymentMethodId,
        autopayEnrollmentId: originalTxn.autopayEnrollmentId,
        isOffSession: true,
      });

      // Set retry metadata on the new transaction
      await db
        .update(paymentTransactions)
        .set({
          attemptNumber: originalTxn.attemptNumber + 1,
          retryOfTransactionId: originalTxn.id,
        })
        .where(eq(paymentTransactions.id, retryTxn.id));

      // Mark original as no longer retry-eligible
      await db
        .update(paymentTransactions)
        .set({ retryEligible: 0, updatedAt: new Date() })
        .where(eq(paymentTransactions.id, originalTxn.id));

      // Charge off-session
      const chargeResult = await chargeOffSession({
        secretKey: gateway.secretKey,
        stripeCustomerId: method.providerCustomerId,
        stripePaymentMethodId: method.providerPaymentMethodId,
        amountCents: originalTxn.amountCents,
        currency: "usd",
        description: originalTxn.description || "Autopay retry",
        associationId: originalTxn.associationId,
        personId: originalTxn.personId,
        unitId: originalTxn.unitId,
        transactionId: retryTxn.id,
        enrollmentId: originalTxn.autopayEnrollmentId ?? "",
      });

      // Update retry transaction status
      await updatePaymentTransactionStatus({
        transactionId: retryTxn.id,
        providerIntentId: chargeResult.intentId || undefined,
        status: chargeResult.status === "succeeded" ? "succeeded"
          : chargeResult.status === "pending" ? "pending"
          : "failed",
        failureCode: chargeResult.failureCode,
        failureReason: chargeResult.failureReason,
      });

      retried++;

      if (chargeResult.status === "succeeded") {
        // Create ledger entry
        await db.insert(ownerLedgerEntries).values({
          associationId: originalTxn.associationId,
          unitId: originalTxn.unitId,
          personId: originalTxn.personId,
          entryType: "payment",
          amount: -(originalTxn.amountCents / 100),
          postedAt: new Date(),
          description: originalTxn.description || "Autopay retry payment",
          referenceType: "autopay_payment_transaction",
          referenceId: retryTxn.id,
        });

        // Create autopay_run record
        if (originalTxn.autopayEnrollmentId) {
          await db.insert(autopayRuns).values({
            enrollmentId: originalTxn.autopayEnrollmentId,
            associationId: originalTxn.associationId,
            amount: originalTxn.amountCents / 100,
            status: "success",
            paymentTransactionId: retryTxn.id,
            ranAt: new Date(),
          });
        }

        succeeded++;
      } else if (chargeResult.status === "failed") {
        // Mark the new retry txn for possible further retry
        const settings = await getDelinquencySettings(originalTxn.associationId);
        await markTransactionForRetry(retryTxn.id, chargeResult.failureCode, chargeResult.failureReason, settings);
        failed++;
      }
      // "pending" status — webhook will resolve later
    } catch (err: any) {
      console.error(`[retry] Error retrying txn ${originalTxn.id}:`, err);
      failed++;
    }
  }

  return { retried, succeeded, failed, skipped };
}
