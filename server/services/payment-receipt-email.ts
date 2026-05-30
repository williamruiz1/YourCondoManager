/**
 * Payment Receipt Email Service (P0-2 — Issue #205)
 *
 * Sends a branded payment receipt email after a Stripe payment_intent.succeeded
 * webhook is processed into the owner ledger.
 *
 * Idempotency: receipt_email_sent_at on payment_transactions is set
 * optimistically before the send.  Re-delivered Stripe webhook retries are
 * safe because:
 *   1. processPaymentWebhookEvent returns { duplicate: true } for a repeated
 *      providerEventId — so the receipt path is never reached twice via the
 *      webhook event table.
 *   2. If the event somehow slips through, receipt_email_sent_at provides a
 *      second guard inside sendPaymentReceiptEmail.
 *
 * Callers:
 *   - server/routes.ts (Stripe-signature webhook branch, after processPaymentWebhookEvent)
 *   - GET /api/portal/receipts  (list of downloadable/printable receipts)
 *   - GET /api/portal/receipts/:id  (single receipt detail for print view)
 */

import { and, desc, eq, sql as drizzleSql } from "drizzle-orm";
import { db } from "../db.js";
import {
  associations,
  persons,
  paymentTransactions,
  units,
} from "@shared/schema";
import { sendEmail } from "../email/send.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PaymentReceiptContext {
  /** PAY-YYYYMMDD-XXXXXXXX style reference */
  receiptReference: string;
  amountCents: number;
  /** "$350.00" */
  amountFormatted: string;
  confirmedAt: string;        // ISO-8601
  /** "May 15, 2026" */
  paidAtFormatted: string;
  description: string;
  recipientName: string;
  recipientEmail: string;
  associationName: string;
  /** e.g. "Building A / Unit 4B" or "Unit 101" */
  unitLabel: string;
  /** Running balance in cents after this payment (positive = still owed) */
  balanceAfterCents: number;
  /** "$0.00" or "($25.00)" */
  balanceAfterFormatted: string;
}

export interface PortalReceiptSummary {
  id: string;
  receiptReference: string;
  amountFormatted: string;
  description: string;
  paidAtFormatted: string;
  confirmedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCents(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = (abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return cents < 0 ? `($${dollars})` : `$${dollars}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// ── Build receipt context ─────────────────────────────────────────────────────

/**
 * Resolves all context needed to render a receipt for a given
 * payment_transactions row.  Returns null when a required entity is missing.
 */
export async function getPaymentReceiptData(
  txn: typeof paymentTransactions.$inferSelect,
): Promise<PaymentReceiptContext | null> {
  const [assoc, person, unit] = await Promise.all([
    db
      .select({ name: associations.name })
      .from(associations)
      .where(eq(associations.id, txn.associationId))
      .then((r) => r[0] ?? null),
    db
      .select({
        firstName: persons.firstName,
        lastName: persons.lastName,
        email: persons.email,
      })
      .from(persons)
      .where(eq(persons.id, txn.personId))
      .then((r) => r[0] ?? null),
    db
      .select({ unitNumber: units.unitNumber, building: units.building })
      .from(units)
      .where(eq(units.id, txn.unitId))
      .then((r) => r[0] ?? null),
  ]);

  if (!assoc || !person || !unit) return null;
  if (!person.email) return null;

  // Running balance for this owner in this unit, in dollars from the DB.
  // Uses drizzle sql`` tag for parameterized raw aggregation.
  const balanceResult = await db.execute<{ total: string }>(
    drizzleSql`SELECT COALESCE(SUM(amount), 0)::text AS total
               FROM owner_ledger_entries
               WHERE association_id = ${txn.associationId}
                 AND unit_id        = ${txn.unitId}
                 AND person_id      = ${txn.personId}`,
  );
  const balanceDollars = parseFloat(
    (balanceResult.rows[0] as { total?: string } | undefined)?.total ?? "0",
  );
  const balanceCents = Math.round(balanceDollars * 100);

  const confirmedDate = txn.confirmedAt ?? txn.createdAt;
  const buildingPrefix = unit.building ? `${unit.building} / ` : "";
  const unitLabel = `${buildingPrefix}Unit ${unit.unitNumber}`;
  const receiptRef =
    txn.receiptReference ?? `PAY-${txn.id.slice(0, 8).toUpperCase()}`;

  return {
    receiptReference: receiptRef,
    amountCents: txn.amountCents,
    amountFormatted: fmtCents(txn.amountCents),
    confirmedAt: confirmedDate.toISOString(),
    paidAtFormatted: fmtDate(confirmedDate),
    description: txn.description ?? "HOA payment",
    recipientName: `${person.firstName} ${person.lastName}`.trim(),
    recipientEmail: person.email,
    associationName: assoc.name,
    unitLabel,
    balanceAfterCents: balanceCents,
    balanceAfterFormatted: fmtCents(balanceCents),
  };
}

// ── Send receipt email ────────────────────────────────────────────────────────

/**
 * Send a receipt email for a settled payment_transactions row.
 * Idempotent via receipt_email_sent_at.
 */
export async function sendPaymentReceiptEmail(params: {
  transactionId: string;
  /** Pre-loaded context avoids a second DB round-trip when caller already has it. */
  context?: PaymentReceiptContext;
}): Promise<{ sent: boolean; skipped: boolean; errorMessage?: string }> {
  const [txn] = await db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.id, params.transactionId))
    .limit(1);

  if (!txn) {
    return { sent: false, skipped: false, errorMessage: "Transaction not found" };
  }

  // Already sent (re-delivered Stripe webhook or manual retry).
  if (txn.receiptEmailSentAt != null) {
    return { sent: false, skipped: true };
  }

  const ctx = params.context ?? (await getPaymentReceiptData(txn));
  if (!ctx) {
    return {
      sent: false,
      skipped: false,
      errorMessage: "Receipt context unavailable (deleted owner/unit/association?)",
    };
  }

  // Optimistically mark as sent before the network call so that a concurrent
  // Stripe retry that arrives while the email is in-flight also sees the guard.
  await db
    .update(paymentTransactions)
    .set({ receiptEmailSentAt: new Date() } as Partial<typeof paymentTransactions.$inferInsert>)
    .where(eq(paymentTransactions.id, txn.id));

  try {
    const result = await sendEmail({
      to: ctx.recipientEmail,
      template: "receipt-payment",
      data: {
        recipientName: ctx.recipientName,
        associationName: ctx.associationName,
        unitLabel: ctx.unitLabel,
        amountFormatted: ctx.amountFormatted,
        description: ctx.description,
        paidAt: ctx.paidAtFormatted,
        receiptReference: ctx.receiptReference,
      },
      tags: [
        { name: "associationId", value: txn.associationId },
        { name: "transactionId", value: txn.id },
      ],
      associationId: txn.associationId,
    });

    if (result.status === "failed") {
      // Roll back so a later retry can re-send.
      await db
        .update(paymentTransactions)
        .set({ receiptEmailSentAt: null } as Partial<typeof paymentTransactions.$inferInsert>)
        .where(eq(paymentTransactions.id, txn.id));

      return {
        sent: false,
        skipped: false,
        errorMessage: result.errorMessage ?? "Email send failed",
      };
    }

    return { sent: true, skipped: false };
  } catch (err: unknown) {
    // Roll back on unexpected error.
    await db
      .update(paymentTransactions)
      .set({ receiptEmailSentAt: null } as Partial<typeof paymentTransactions.$inferInsert>)
      .where(eq(paymentTransactions.id, txn.id));

    return {
      sent: false,
      skipped: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Portal receipt list ───────────────────────────────────────────────────────

/**
 * Returns the most recent settled payment_transactions for a given
 * owner+unit in descending order — used by GET /api/portal/receipts.
 */
export async function getPortalReceiptList(params: {
  associationId: string;
  personId: string;
  unitId: string;
  limit?: number;
}): Promise<PortalReceiptSummary[]> {
  const rows = await db
    .select()
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.associationId, params.associationId),
        eq(paymentTransactions.personId, params.personId),
        eq(paymentTransactions.unitId, params.unitId),
        eq(paymentTransactions.status, "succeeded"),
      ),
    )
    .orderBy(desc(paymentTransactions.confirmedAt))
    .limit(params.limit ?? 20);

  return rows.map((txn) => {
    const confirmedDate = txn.confirmedAt ?? txn.createdAt;
    return {
      id: txn.id,
      receiptReference:
        txn.receiptReference ?? `PAY-${txn.id.slice(0, 8).toUpperCase()}`,
      amountFormatted: fmtCents(txn.amountCents),
      description: txn.description ?? "HOA payment",
      paidAtFormatted: fmtDate(confirmedDate),
      confirmedAt: confirmedDate.toISOString(),
    };
  });
}
