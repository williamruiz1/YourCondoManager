/**
 * Payment Service — Owner Payment Portal
 *
 * Owns payment transaction lifecycle: creation, Stripe Checkout initiation,
 * idempotent status updates from webhooks, and query functions.
 * Phase 2: Stripe SetupIntent for saved methods, off-session charging.
 *
 * All Stripe calls use raw fetch (no SDK) — matches existing codebase pattern.
 */

import crypto from "crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { checkoutSessionKey, offSessionChargeKey } from "./stripe-idempotency";
import {
  paymentTransactions,
  ownerLedgerEntries,
  savedPaymentMethods,
  type PaymentTransaction,
} from "@shared/schema";
import {
  applyChargeMetadataToPaymentIntent,
  buildSpecMetadata,
  computeApplicationFeeCents,
  descriptorSuffixForEntryType,
  type ChargeMetadataContext,
} from "./stripe-charge-metadata";

// ── Receipt Reference ────────────────────────────────────────────────────────

export function generateReceiptReference(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const hex = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `PAY-${date}-${hex}`;
}

// ── Terminal status check ────────────────────────────────────────────────────

const TERMINAL_STATUSES = new Set(["succeeded", "failed", "canceled", "reversed"]);

function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

// ── Create Payment Transaction ───────────────────────────────────────────────

export async function createPaymentTransaction(params: {
  associationId: string;
  unitId: string;
  personId: string;
  amountCents: number;
  currency?: string;
  description?: string;
  provider?: "stripe" | "other";
  source?: "owner_initiated" | "autopay";
  paymentMethodId?: string | null;
  autopayEnrollmentId?: string | null;
  isOffSession?: boolean;
  /**
   * Spec §3.1 metadata mirrored locally so YCM can search payment_transactions
   * without round-tripping Stripe. Stored under `metadataJson.spec` so the
   * column can also carry future non-spec annotations without collision.
   * Per Issue founder-os#969 dispatch §Scope.
   */
  chargeMetadata?: Record<string, string> | null;
  /**
   * CT convenience-fee structure (founder-os
   * wiki/research/chc-processing-fee-legality-2026-07-14.md §6). The portion
   * of `amountCents` that is the platform processing fee — 0 (default) for
   * every association with the fee flag off, and every legacy caller.
   * `amountCents` itself is the TOTAL actually charged (assessment + fee).
   */
  platformFeeCents?: number;
  /** Which payment method the owner chose at checkout — display/receipt only. */
  checkoutMethod?: "ach" | "card" | null;
}): Promise<PaymentTransaction> {
  const receiptReference = generateReceiptReference();
  const metadataJson = params.chargeMetadata
    ? { spec: params.chargeMetadata }
    : null;
  const [txn] = await db
    .insert(paymentTransactions)
    .values({
      associationId: params.associationId,
      unitId: params.unitId,
      personId: params.personId,
      amountCents: params.amountCents,
      currency: params.currency ?? "USD",
      description: params.description ?? null,
      provider: params.provider ?? "stripe",
      receiptReference,
      status: "draft",
      platformFeeCents: params.platformFeeCents ?? 0,
      checkoutMethod: params.checkoutMethod ?? null,
      source: params.source ?? "owner_initiated",
      paymentMethodId: params.paymentMethodId ?? null,
      autopayEnrollmentId: params.autopayEnrollmentId ?? null,
      isOffSession: params.isOffSession ? 1 : 0,
      metadataJson,
    })
    .returning();
  return txn;
}

// ── Initiate Stripe Checkout ─────────────────────────────────────────────────

export async function initiateStripeCheckout(params: {
  transactionId: string;
  secretKey: string;
  appBaseUrl: string;
  ownerEmail?: string | null;
  associationName: string;
  unitNumber: string;
  /**
   * Stripe Connect routing (spec §1.1). When provided, the Checkout Session is
   * created on the connected HOA account via the `Stripe-Account` header (a
   * DIRECT charge), `secretKey` MUST be the PLATFORM key, and an
   * `application_fee_amount` is attached to the underlying PaymentIntent so the
   * YCM platform fee routes to the platform balance. When omitted, this is the
   * legacy manual-key path (charge on whatever account `secretKey` belongs to)
   * — UNCHANGED.
   */
  stripeAccountHeader?: string | null;
  /** Spec §1.2 application fee in cents (only applied when stripeAccountHeader is set). */
  applicationFeeCents?: number | null;
  /** Spec §2.3 statement descriptor suffix (e.g. "DUES"); attached to the PaymentIntent. */
  statementDescriptorSuffix?: string | null;
  /**
   * CT convenience-fee structure (founder-os
   * wiki/research/chc-processing-fee-legality-2026-07-14.md §6). Which
   * payment method the owner is checking out with. Defaults to "ach"
   * (`us_bank_account`) — UNCHANGED legacy behavior when omitted. "card"
   * scopes the Checkout Session to card ONLY (never both), which is what
   * makes it safe to include a card-only convenience-fee line item — an
   * owner who picks "card" can't silently pay the fee-inclusive total via
   * ACH instead.
   */
  paymentMethodType?: "ach" | "card";
  /**
   * CT convenience-fee structure — Stripe topology fix (2026-07-14). How
   * `feeCents` (below) actually settled: 'connect_application_fee' when the
   * caller already folded it into `applicationFeeCents` so Stripe's own
   * transfer moves it to the platform balance (Connect-active association),
   * or 'accounting_only' when there's no Connect mechanism to route through
   * (single-account/manual-key association). Null when there's no fee at
   * all. Carried as metadata so the webhook handler can record the SAME
   * settlement method the checkout was actually created with.
   */
  feeSettlementMethod?: "connect_application_fee" | "accounting_only" | null;
}): Promise<{ checkoutUrl: string; sessionId: string }> {
  const [txn] = await db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.id, params.transactionId))
    .limit(1);

  if (!txn) throw new Error("Payment transaction not found");
  if (txn.status !== "draft") throw new Error(`Cannot initiate checkout for transaction in "${txn.status}" status`);

  const description = txn.description || `${params.associationName} owner payment`;
  const currency = (txn.currency || "USD").toLowerCase();
  const paymentMethodType = params.paymentMethodType ?? "ach";

  // CT convenience-fee split (memo §6). `txn.amountCents` is the TOTAL
  // actually charged; `txn.platformFeeCents` (0 by default, for every
  // association with the fee flag off) carves out the fee portion so it can
  // be itemized as its own disclosed Checkout line item, never folded
  // silently into the assessment line.
  const feeCents = Math.max(0, txn.platformFeeCents ?? 0);
  const assessmentCents = Math.max(0, txn.amountCents - feeCents);

  const successUrl = `${params.appBaseUrl}/portal?payment=success&txn=${txn.id}`;
  const cancelUrl = `${params.appBaseUrl}/portal?payment=cancelled`;

  const sessionParams = new URLSearchParams();
  sessionParams.set("mode", "payment");
  sessionParams.set("success_url", successUrl);
  sessionParams.set("cancel_url", cancelUrl);
  sessionParams.set("payment_method_types[0]", paymentMethodType === "card" ? "card" : "us_bank_account");
  sessionParams.set("billing_address_collection", "auto");
  if (params.ownerEmail?.trim()) {
    sessionParams.set("customer_email", params.ownerEmail.trim());
  }
  if (paymentMethodType !== "card") {
    sessionParams.set("payment_method_options[us_bank_account][verification_method]", "instant");
  }
  sessionParams.set("line_items[0][quantity]", "1");
  sessionParams.set("line_items[0][price_data][currency]", currency);
  sessionParams.set("line_items[0][price_data][unit_amount]", String(assessmentCents));
  sessionParams.set("line_items[0][price_data][product_data][name]", description);
  if (feeCents > 0) {
    // Disclosed as its own line item — never folded into the assessment
    // amount — per the memo §6.5 disclosure requirement. Charged AND KEPT BY
    // THE PLATFORM (booked to platform_processing_fees, never the
    // association's owner ledger — see storage.ts processPaymentWebhookEvent).
    sessionParams.set("line_items[1][quantity]", "1");
    sessionParams.set("line_items[1][price_data][currency]", currency);
    sessionParams.set("line_items[1][price_data][unit_amount]", String(feeCents));
    sessionParams.set(
      "line_items[1][price_data][product_data][name]",
      "Platform processing fee (card payments)",
    );
  }
  sessionParams.set("payment_intent_data[description]", `${params.associationName} payment for ${params.unitNumber}`);

  // Metadata on payment_intent (appears on payment_intent webhook events)
  sessionParams.set("payment_intent_data[metadata][associationId]", txn.associationId);
  sessionParams.set("payment_intent_data[metadata][unitId]", txn.unitId);
  sessionParams.set("payment_intent_data[metadata][personId]", txn.personId);
  sessionParams.set("payment_intent_data[metadata][transactionId]", txn.id);
  sessionParams.set("payment_intent_data[metadata][currency]", txn.currency || "USD");
  sessionParams.set("payment_intent_data[metadata][amount]", (txn.amountCents / 100).toFixed(2));
  sessionParams.set("payment_intent_data[metadata][checkoutMethod]", paymentMethodType);
  if (feeCents > 0) {
    // Read back by normalizeStripeWebhookPayload (server/routes.ts) so the
    // ledger credit nets the fee out — assessment-at-face-value, never the
    // fee-inclusive total.
    sessionParams.set("payment_intent_data[metadata][platformFeeCents]", String(feeCents));
    if (params.feeSettlementMethod) {
      sessionParams.set("payment_intent_data[metadata][feeSettlementMethod]", params.feeSettlementMethod);
    }
  }

  // Session-level metadata (appears on checkout.session webhook events)
  sessionParams.set("metadata[associationId]", txn.associationId);
  sessionParams.set("metadata[unitId]", txn.unitId);
  sessionParams.set("metadata[personId]", txn.personId);
  sessionParams.set("metadata[transactionId]", txn.id);
  sessionParams.set("metadata[currency]", txn.currency || "USD");
  sessionParams.set("metadata[amount]", (txn.amountCents / 100).toFixed(2));
  sessionParams.set("metadata[checkoutMethod]", paymentMethodType);
  if (feeCents > 0) {
    sessionParams.set("metadata[platformFeeCents]", String(feeCents));
    if (params.feeSettlementMethod) {
      sessionParams.set("metadata[feeSettlementMethod]", params.feeSettlementMethod);
    }
  }

  // Stripe Connect direct-charge routing (spec §1.1 + §1.2). When routing to a
  // connected HOA account, attach the application fee + statement descriptor
  // suffix to the underlying PaymentIntent. Both are only meaningful on a
  // direct charge (i.e. with the Stripe-Account header set below).
  if (params.stripeAccountHeader) {
    if (params.applicationFeeCents && params.applicationFeeCents > 0) {
      sessionParams.set(
        "payment_intent_data[application_fee_amount]",
        String(params.applicationFeeCents),
      );
    }
    if (params.statementDescriptorSuffix) {
      sessionParams.set(
        "payment_intent_data[statement_descriptor_suffix]",
        params.statementDescriptorSuffix,
      );
    }
  }

  const checkoutHeaders: Record<string, string> = {
    Authorization: `Bearer ${params.secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  // Direct charge on the connected HOA account (spec §1.1). Required for the
  // application fee to route to the platform balance and for per-HOA payouts.
  if (params.stripeAccountHeader) {
    checkoutHeaders["Stripe-Account"] = params.stripeAccountHeader;
  }

  // Idempotency: one hosted checkout session per logical transaction. A retry
  // of this POST (network blip) returns the original session, never a second.
  checkoutHeaders["Idempotency-Key"] = checkoutSessionKey(txn.id);

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: checkoutHeaders,
    body: sessionParams.toString(),
  });

  const stripeBody = (await stripeResponse.json().catch(() => null)) as Record<string, unknown> | null;
  if (!stripeResponse.ok || !stripeBody || typeof stripeBody.url !== "string") {
    const providerMessage =
      stripeBody &&
      typeof stripeBody.error === "object" &&
      stripeBody.error &&
      typeof (stripeBody.error as Record<string, unknown>).message === "string"
        ? ((stripeBody.error as Record<string, unknown>).message as string)
        : "Stripe could not create a hosted checkout session";
    throw new Error(providerMessage);
  }

  const sessionId = typeof stripeBody.id === "string" ? stripeBody.id : "";

  await db
    .update(paymentTransactions)
    .set({
      status: "initiated",
      providerPaymentId: sessionId,
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(paymentTransactions.id, txn.id));

  return { checkoutUrl: stripeBody.url, sessionId };
}

// ── Idempotent Status Update (webhook-driven) ────────────────────────────────

export async function updatePaymentTransactionStatus(params: {
  transactionId?: string;
  providerPaymentId?: string;
  providerIntentId?: string;
  status: "pending" | "succeeded" | "failed" | "canceled";
  failureCode?: string | null;
  failureReason?: string | null;
}): Promise<PaymentTransaction | null> {
  // Find the transaction
  let txn: PaymentTransaction | undefined;

  if (params.transactionId) {
    [txn] = await db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.id, params.transactionId))
      .limit(1);
  }

  if (!txn && params.providerPaymentId) {
    [txn] = await db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.providerPaymentId, params.providerPaymentId))
      .limit(1);
  }

  if (!txn && params.providerIntentId) {
    [txn] = await db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.providerIntentId, params.providerIntentId))
      .limit(1);
  }

  if (!txn) return null;

  // Idempotent: skip if already in a terminal state
  if (isTerminalStatus(txn.status)) return txn;

  const updates: Partial<Record<string, unknown>> = {
    status: params.status,
    updatedAt: new Date(),
  };

  if (params.status === "succeeded") {
    updates.confirmedAt = new Date();
  } else if (params.status === "failed") {
    updates.failedAt = new Date();
    if (params.failureCode !== undefined) updates.failureCode = params.failureCode;
    if (params.failureReason !== undefined) updates.failureReason = params.failureReason;
  }

  if (params.providerIntentId && !txn.providerIntentId) {
    updates.providerIntentId = params.providerIntentId;
  }

  const [updated] = await db
    .update(paymentTransactions)
    .set(updates as any)
    .where(eq(paymentTransactions.id, txn.id))
    .returning();

  return updated ?? txn;
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getPaymentTransactionById(id: string): Promise<PaymentTransaction | null> {
  const [txn] = await db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.id, id))
    .limit(1);
  return txn ?? null;
}

export async function getOwnerPaymentHistory(params: {
  associationId: string;
  personId: string;
  limit?: number;
}): Promise<PaymentTransaction[]> {
  return db
    .select()
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.associationId, params.associationId),
        eq(paymentTransactions.personId, params.personId),
      ),
    )
    .orderBy(desc(paymentTransactions.createdAt))
    .limit(params.limit ?? 50);
}

export async function getOwnerBalanceSummary(params: {
  associationId: string;
  personId: string;
  unitIds: string[];
}): Promise<{
  totalBalance: number;
  totalCharges: number;
  totalPayments: number;
  pendingPaymentCents: number;
  openCharges: Array<{
    id: string;
    entryType: string;
    amount: number;
    description: string | null;
    postedAt: string;
    unitId: string;
  }>;
}> {
  if (params.unitIds.length === 0) {
    return { totalBalance: 0, totalCharges: 0, totalPayments: 0, pendingPaymentCents: 0, openCharges: [] };
  }

  // Ledger entries for this owner's units
  const ledgerEntries = await db
    .select()
    .from(ownerLedgerEntries)
    .where(
      and(
        eq(ownerLedgerEntries.associationId, params.associationId),
        inArray(ownerLedgerEntries.unitId, params.unitIds),
        eq(ownerLedgerEntries.personId, params.personId),
      ),
    )
    .orderBy(desc(ownerLedgerEntries.postedAt));

  let totalCharges = 0;
  let totalPayments = 0;
  const chargeTypes = new Set(["charge", "assessment", "late-fee"]);
  const creditTypes = new Set(["payment", "credit", "adjustment"]);

  for (const entry of ledgerEntries) {
    const amt = Number(entry.amount) || 0;
    if (chargeTypes.has(entry.entryType)) {
      totalCharges += amt;
    } else if (creditTypes.has(entry.entryType)) {
      totalPayments += Math.abs(amt);
    }
  }

  const totalBalance = totalCharges - totalPayments;

  // Open charges: positive-amount charge/assessment/late-fee entries
  const openCharges = ledgerEntries
    .filter((e) => chargeTypes.has(e.entryType) && (Number(e.amount) || 0) > 0)
    .map((e) => ({
      id: e.id,
      entryType: e.entryType,
      amount: Number(e.amount) || 0,
      description: e.description,
      postedAt: e.postedAt.toISOString(),
      unitId: e.unitId,
    }));

  // Pending payment amounts from payment_transactions
  const pendingTxns = await db
    .select({ amountCents: paymentTransactions.amountCents })
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.associationId, params.associationId),
        eq(paymentTransactions.personId, params.personId),
        inArray(paymentTransactions.status, ["initiated", "pending"]),
      ),
    );

  const pendingPaymentCents = pendingTxns.reduce((sum, t) => sum + t.amountCents, 0);

  return { totalBalance, totalCharges, totalPayments, pendingPaymentCents, openCharges };
}

export async function getAdminPaymentTransactions(params: {
  associationId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ transactions: PaymentTransaction[]; total: number }> {
  const conditions = [];
  if (params.associationId) {
    conditions.push(eq(paymentTransactions.associationId, params.associationId));
  }
  if (params.status) {
    conditions.push(eq(paymentTransactions.status, params.status as any));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [transactions, countResult] = await Promise.all([
    db
      .select()
      .from(paymentTransactions)
      .where(whereClause)
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(params.limit ?? 50)
      .offset(params.offset ?? 0),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(paymentTransactions)
      .where(whereClause),
  ]);

  return { transactions, total: countResult[0]?.count ?? 0 };
}

// ── Phase 2: Stripe Customer Management ──────────────────────────────────────

export async function ensureStripeCustomer(params: {
  secretKey: string;
  /**
   * 2026-06-30 — Stripe Connect. When set, the customer + setup session live on
   * the connected HOA account (direct), and `secretKey` MUST be the PLATFORM
   * key. The saved customer/payment-method ids are scoped to that connected
   * account, so the setup-return MUST also fetch with this same header.
   */
  stripeAccountHeader?: string | null;
  associationId: string;
  personId: string;
  email?: string | null;
  name?: string | null;
}): Promise<string> {
  // Check if we already have a Stripe customer for this person+association
  const [existing] = await db
    .select({ providerCustomerId: savedPaymentMethods.providerCustomerId })
    .from(savedPaymentMethods)
    .where(
      and(
        eq(savedPaymentMethods.associationId, params.associationId),
        eq(savedPaymentMethods.personId, params.personId),
        sql`${savedPaymentMethods.providerCustomerId} IS NOT NULL`,
      ),
    )
    .limit(1);

  if (existing?.providerCustomerId) return existing.providerCustomerId;

  // Create a new Stripe Customer
  const customerParams = new URLSearchParams();
  if (params.email?.trim()) customerParams.set("email", params.email.trim());
  if (params.name?.trim()) customerParams.set("name", params.name.trim());
  customerParams.set("metadata[associationId]", params.associationId);
  customerParams.set("metadata[personId]", params.personId);

  const customerHeaders: Record<string, string> = {
    Authorization: `Bearer ${params.secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (params.stripeAccountHeader) {
    customerHeaders["Stripe-Account"] = params.stripeAccountHeader;
  }
  const res = await fetch("https://api.stripe.com/v1/customers", {
    method: "POST",
    headers: customerHeaders,
    body: customerParams.toString(),
  });

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !body || typeof body.id !== "string") {
    const msg = body?.error && typeof (body.error as any).message === "string"
      ? (body.error as any).message
      : "Failed to create Stripe customer";
    throw new Error(msg);
  }

  return body.id;
}

// ── Phase 2: Stripe Setup Checkout (save payment method) ─────────────────────

export async function initiateStripeSetupCheckout(params: {
  secretKey: string;
  /** 2026-06-30 — Connect. When set, the setup session is created on the
   *  connected HOA account (`secretKey` = PLATFORM key). */
  stripeAccountHeader?: string | null;
  stripeCustomerId: string;
  appBaseUrl: string;
  associationId: string;
  personId: string;
}): Promise<{ checkoutUrl: string; sessionId: string }> {
  const successUrl = `${params.appBaseUrl}/api/portal/payment-methods/setup/return?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${params.appBaseUrl}/portal?setup=cancelled`;

  const sessionParams = new URLSearchParams();
  sessionParams.set("mode", "setup");
  sessionParams.set("customer", params.stripeCustomerId);
  // Card + ACH: owners can save either a card or a bank account.
  sessionParams.set("payment_method_types[0]", "card");
  sessionParams.set("payment_method_types[1]", "us_bank_account");
  sessionParams.set("payment_method_options[us_bank_account][verification_method]", "instant");
  sessionParams.set("success_url", successUrl);
  sessionParams.set("cancel_url", cancelUrl);
  sessionParams.set("metadata[associationId]", params.associationId);
  sessionParams.set("metadata[personId]", params.personId);

  const setupHeaders: Record<string, string> = {
    Authorization: `Bearer ${params.secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (params.stripeAccountHeader) {
    setupHeaders["Stripe-Account"] = params.stripeAccountHeader;
  }
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: setupHeaders,
    body: sessionParams.toString(),
  });

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !body || typeof body.url !== "string") {
    const msg = body?.error && typeof (body.error as any).message === "string"
      ? (body.error as any).message
      : "Stripe could not create a setup checkout session";
    throw new Error(msg);
  }

  return {
    checkoutUrl: body.url,
    sessionId: typeof body.id === "string" ? body.id : "",
  };
}

// ── Phase 2: Off-Session Charge (autopay) ────────────────────────────────────

export async function chargeOffSession(params: {
  secretKey: string;
  stripeCustomerId: string;
  stripePaymentMethodId: string;
  amountCents: number;
  currency: string;
  description: string;
  associationId: string;
  personId: string;
  unitId: string;
  transactionId: string;
  enrollmentId: string;
  /**
   * Spec §3.1 metadata context. When provided, the off-session intent sets
   * the full spec metadata schema (preferred). When omitted (legacy callers),
   * the intent falls back to the legacy associationId/unitId/personId set.
   * Per Issue founder-os#969.
   */
  metadataContext?: ChargeMetadataContext | null;
  /**
   * Spec §2.3 statement_descriptor_suffix (e.g., "DUES"). When provided,
   * attached to the intent so the owner's bank statement shows the right
   * payment-type vocabulary. Per Issue founder-os#969 + §2 of the spec.
   */
  statementDescriptorSuffix?: string | null;
  /**
   * Spec §1.2 application_fee_amount in cents. When set AND the gateway is
   * routing to a connected account (`stripeAccountHeader` provided), the
   * direct charge takes this fee to the platform balance. Per Issue
   * founder-os#969 + §1.2 of the spec.
   */
  applicationFeeCents?: number | null;
  /**
   * Stripe-Account header value (the connected HOA's `acct_…` ID). Required
   * to make this a direct charge on the HOA's account. Without it, charges
   * land on YCM's platform account (legacy pre-Connect behavior).
   */
  stripeAccountHeader?: string | null;
}): Promise<{
  intentId: string;
  status: "succeeded" | "pending" | "failed";
  failureCode?: string | null;
  failureReason?: string | null;
}> {
  const intentParams = new URLSearchParams();
  intentParams.set("amount", String(params.amountCents));
  intentParams.set("currency", params.currency.toLowerCase());
  intentParams.set("customer", params.stripeCustomerId);
  intentParams.set("payment_method", params.stripePaymentMethodId);
  intentParams.set("payment_method_types[0]", "us_bank_account");
  intentParams.set("off_session", "true");
  intentParams.set("confirm", "true");
  intentParams.set("description", params.description);

  // Spec §3.1 — canonical metadata. If a caller passes the full context, we
  // set every required key. Otherwise we keep the legacy keys so existing
  // autopay callers still work pre-#969 cutover.
  if (params.metadataContext) {
    applyChargeMetadataToPaymentIntent(intentParams, buildSpecMetadata(params.metadataContext));
    // Also include the legacy keys so reconciliation code that hasn't
    // migrated to the new vocab still finds its fields.
    intentParams.set("metadata[transactionId]", params.transactionId);
    intentParams.set("metadata[enrollmentId]", params.enrollmentId);
  } else {
    intentParams.set("metadata[associationId]", params.associationId);
    intentParams.set("metadata[personId]", params.personId);
    intentParams.set("metadata[unitId]", params.unitId);
    intentParams.set("metadata[transactionId]", params.transactionId);
    intentParams.set("metadata[enrollmentId]", params.enrollmentId);
  }

  // Spec §2.3 — statement_descriptor_suffix per entryType.
  if (params.statementDescriptorSuffix) {
    intentParams.set("statement_descriptor_suffix", params.statementDescriptorSuffix);
  }

  // Spec §1.2 — application fee on direct charges (connected account only).
  if (params.stripeAccountHeader && params.applicationFeeCents && params.applicationFeeCents > 0) {
    intentParams.set("application_fee_amount", String(params.applicationFeeCents));
  }

  const intentHeaders: Record<string, string> = {
    Authorization: `Bearer ${params.secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  // Stripe-Account header makes this a direct charge on the connected HOA
  // account (per spec §1.1). Required for application_fee_amount to route
  // back to the platform; required for per-HOA payouts.
  if (params.stripeAccountHeader) {
    intentHeaders["Stripe-Account"] = params.stripeAccountHeader;
  }

  // Idempotency: one off-session intent per logical transaction. A retry of the
  // off-session charge POST (network blip) returns the original intent rather
  // than charging the owner's bank account a second time.
  intentHeaders["Idempotency-Key"] = offSessionChargeKey(params.transactionId);

  const res = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: intentHeaders,
    body: intentParams.toString(),
  });

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.id !== "string") {
    const msg = body?.error && typeof (body.error as any).message === "string"
      ? (body.error as any).message
      : "Failed to create off-session payment";
    return {
      intentId: "",
      status: "failed",
      failureCode: "api_error",
      failureReason: msg,
    };
  }

  const intentId = body.id;
  const stripeStatus = body.status as string;

  if (stripeStatus === "succeeded") {
    return { intentId, status: "succeeded" };
  } else if (stripeStatus === "processing") {
    return { intentId, status: "pending" };
  } else {
    const lastError = body.last_payment_error as Record<string, unknown> | null;
    return {
      intentId,
      status: "failed",
      failureCode: typeof lastError?.code === "string" ? lastError.code : null,
      failureReason: typeof lastError?.message === "string" ? lastError.message : `Stripe status: ${stripeStatus}`,
    };
  }
}

// ── Phase 2: Fetch Stripe Checkout Session (for setup return) ────────────────

export async function fetchStripeCheckoutSession(params: {
  secretKey: string;
  /** 2026-06-30 — Connect. Must match the header the session was created with,
   *  or Stripe returns "No such checkout session" for a connected-account
   *  session fetched without it. */
  stripeAccountHeader?: string | null;
  sessionId: string;
}): Promise<Record<string, unknown> | null> {
  const fetchHeaders: Record<string, string> = {
    Authorization: `Bearer ${params.secretKey}`,
  };
  if (params.stripeAccountHeader) {
    fetchHeaders["Stripe-Account"] = params.stripeAccountHeader;
  }
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(params.sessionId)}?expand[]=setup_intent.payment_method`,
    {
      headers: fetchHeaders,
    },
  );
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as Record<string, unknown> | null;
}
