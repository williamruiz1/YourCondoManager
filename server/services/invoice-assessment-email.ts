/**
 * Invoice-on-Assessment Email Service (founder-os#11194)
 *
 * Wires the existing `invoice-assessment` email template (built in
 * founder-os#1042 / YCM PR #126) into the assessment-execution flow so that
 * when an assessment/charge posts to an owner's ledger, the owner is emailed
 * their invoice — with a working Stripe pay link — instead of only seeing a
 * balance if they log into the portal. This is the last must-have
 * production-readiness gap before the first paying HOA (per founder-os#839).
 *
 * The send is fired from `server/assessment-execution.ts:executeSingle`, AFTER
 * a successful real (non-dry-run) `ownerLedgerEntries` insert. It is a pure
 * side-effect: the assessment MUST post whether or not the email sends — so
 * this function NEVER throws (all failures are caught and returned).
 *
 * Pay link:
 *   Uses the existing owner-payment-link system (`storage.createOwnerPaymentLink`)
 *   — a token URL (`/api/portal/payments/link/<token>`) that renders the
 *   hosted pay page and creates a Stripe Checkout session. The link is created
 *   for the owner's full outstanding balance (post-posting), locked to that
 *   amount.
 *
 * Idempotency (NO schema migration — reuses the existing owner_payment_links
 * table as the sent-marker):
 *   Each created pay link is tagged in `metadataJson` with
 *   `invoiceAssessmentLedgerEntryId = <ledgerEntryId>`. Before creating a new
 *   link + sending, we query for an existing NON-VOIDED link carrying that key
 *   for this ledger entry — if present, the invoice was already sent, so we
 *   skip. On send FAILURE the just-created link is voided so a retry re-creates
 *   and re-sends (mirrors the receipt service's optimistic-then-rollback).
 *
 * Kill switch (reversible without a deploy):
 *   `INVOICE_EMAIL_ON_ASSESSMENT` = "off" disables the send entirely (the
 *   assessment still posts). Any other value (or unset) = enabled.
 */

import { and, eq, sql as drizzleSql } from "drizzle-orm";
import { db } from "../db.js";
import {
  associations,
  ownerLedgerEntries,
  ownerPaymentLinks,
  persons,
  units,
} from "@shared/schema";
import { sendEmail } from "../email/send.js";
import { storage } from "../storage.js";

/** Metadata key that marks an owner-payment-link as the invoice sent-marker. */
const INVOICE_MARKER_KEY = "invoiceAssessmentLedgerEntryId";

/** Ledger entry types that represent a debit the owner should be invoiced for. */
const INVOICEABLE_ENTRY_TYPES = new Set([
  "charge",
  "assessment",
  "late-fee",
]);

export interface InvoiceAssessmentSendInput {
  /** The just-inserted owner_ledger_entries row id (idempotency key). */
  ledgerEntryId: string;
  associationId: string;
  unitId: string;
  personId: string;
  /** Posted assessment amount, in dollars (positive = charge). */
  amount: number;
  /** Ledger entry type — only debit types are invoiced. */
  entryType: string;
  /** Human-readable assessment description (e.g. "May 2026 dues"). */
  description: string | null;
  /** Due date for the assessment. */
  dueDate: Date;
}

export interface InvoiceAssessmentSendResult {
  sent: boolean;
  skipped: boolean;
  skipReason?: string;
  errorMessage?: string;
}

function fmtDollars(amount: number): string {
  const abs = Math.abs(amount);
  const dollars = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `($${dollars})` : `$${dollars}`;
}

function fmtDueDate(d: Date): string {
  // YYYY-MM-DD in UTC — matches the template's expected `dueDate` shape.
  return d.toISOString().slice(0, 10);
}

function isEnabled(): boolean {
  return (process.env.INVOICE_EMAIL_ON_ASSESSMENT ?? "on").toLowerCase().trim() !== "off";
}

/**
 * Returns true if this ledger entry has already been invoiced (a non-voided
 * owner-payment-link tagged with its id exists).
 */
async function alreadyInvoiced(ledgerEntryId: string): Promise<boolean> {
  const rows = await db
    .select({ id: ownerPaymentLinks.id })
    .from(ownerPaymentLinks)
    .where(
      and(
        drizzleSql`${ownerPaymentLinks.metadataJson}->>${INVOICE_MARKER_KEY} = ${ledgerEntryId}`,
        drizzleSql`${ownerPaymentLinks.status} <> 'void'`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Send an invoice email for a single posted assessment ledger entry.
 * Idempotent, non-throwing, kill-switchable.
 */
export async function sendInvoiceAssessmentEmail(
  input: InvoiceAssessmentSendInput,
): Promise<InvoiceAssessmentSendResult> {
  try {
    if (!isEnabled()) {
      return { sent: false, skipped: true, skipReason: "disabled_by_env" };
    }

    if (!INVOICEABLE_ENTRY_TYPES.has(input.entryType)) {
      return { sent: false, skipped: true, skipReason: "non_invoiceable_entry_type" };
    }

    // Idempotency guard — do not double-send on assessment-execution retry.
    if (await alreadyInvoiced(input.ledgerEntryId)) {
      return { sent: false, skipped: true, skipReason: "already_invoiced" };
    }

    // Resolve owner / unit / association context.
    const [person, unit, assoc] = await Promise.all([
      db
        .select({
          firstName: persons.firstName,
          lastName: persons.lastName,
          email: persons.email,
        })
        .from(persons)
        .where(eq(persons.id, input.personId))
        .then((r) => r[0] ?? null),
      db
        .select({ unitNumber: units.unitNumber, building: units.building })
        .from(units)
        .where(eq(units.id, input.unitId))
        .then((r) => r[0] ?? null),
      db
        .select({ name: associations.name })
        .from(associations)
        .where(eq(associations.id, input.associationId))
        .then((r) => r[0] ?? null),
    ]);

    if (!person || !unit || !assoc) {
      return { sent: false, skipped: true, skipReason: "context_missing" };
    }
    // Owners without an email on file are skipped without error; the
    // assessment still posts (the caller already inserted the ledger row).
    if (!person.email) {
      return { sent: false, skipped: true, skipReason: "no_email_on_file" };
    }

    const buildingPrefix = unit.building ? `${unit.building} / ` : "";
    const unitLabel = `${buildingPrefix}Unit ${unit.unitNumber}`;
    const recipientName = `${person.firstName} ${person.lastName}`.trim();
    const description = input.description?.trim() || "HOA assessment";

    // Create the owner payment link (the "Pay now" target) for the full
    // outstanding balance after this posting. Also the idempotency marker.
    let paymentUrl: string;
    let outstandingBalance: number;
    let paymentLinkId: string;
    try {
      const linkResult = await storage.createOwnerPaymentLink({
        associationId: input.associationId,
        unitId: input.unitId,
        personId: input.personId,
        amount: null, // full outstanding balance
        memo: description,
        metadataJson: {
          source: "invoice-assessment",
          [INVOICE_MARKER_KEY]: input.ledgerEntryId,
        },
      });
      paymentUrl = linkResult.paymentUrl;
      outstandingBalance = linkResult.outstandingBalance;
      paymentLinkId = linkResult.link.id;
    } catch (err: unknown) {
      // e.g. "Owner ledger balance is not payable" (balance <= 0) — nothing to
      // invoice. Skip without error; the assessment still posted.
      return {
        sent: false,
        skipped: true,
        skipReason: "pay_link_unavailable",
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }

    // Send the invoice email.
    const result = await sendEmail({
      to: person.email,
      template: "invoice-assessment",
      data: {
        recipientName,
        associationName: assoc.name,
        unitLabel,
        amountFormatted: fmtDollars(input.amount),
        description,
        dueDate: fmtDueDate(input.dueDate),
        paymentLinkUrl: paymentUrl,
        currentBalanceFormatted: fmtDollars(outstandingBalance),
      },
      tags: [
        { name: "associationId", value: input.associationId },
        { name: "ledgerEntryId", value: input.ledgerEntryId },
      ],
      associationId: input.associationId,
    });

    if (result.status === "failed") {
      // Roll back the marker so a later retry re-creates the link + re-sends.
      await voidPaymentLink(paymentLinkId);
      return {
        sent: false,
        skipped: false,
        errorMessage: result.errorMessage ?? "Email send failed",
      };
    }

    // status === "sent" or "skipped" (SMTP simulated in dev) — leave the link
    // active so the owner can pay, and so the idempotency guard holds.
    return { sent: result.status === "sent", skipped: result.status === "skipped" };
  } catch (err: unknown) {
    // Never throw out of here — the assessment posting must not be affected.
    return {
      sent: false,
      skipped: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

async function voidPaymentLink(paymentLinkId: string): Promise<void> {
  try {
    await db
      .update(ownerPaymentLinks)
      .set({ status: "void", voidedAt: new Date(), updatedAt: new Date() })
      .where(eq(ownerPaymentLinks.id, paymentLinkId));
  } catch {
    // Best-effort rollback; if it fails the worst case is a missed retry-send,
    // never a double-charge (the link points at a balance the owner may still
    // pay). Do not surface.
  }
}
