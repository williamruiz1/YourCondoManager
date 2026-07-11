/**
 * Stripe Connect (Standard) — platform onboarding flow for YCM.
 *
 * Implements the canonical spec at:
 *   founder-os/wiki/products/ycm/stripe-connect-spec.md §6 dispatch #1 + §7.1
 *
 * Each HOA is onboarded as a Standard Connect sub-merchant under the YCM
 * platform. YCM holds the platform secret; the HOA owns its own Stripe
 * dashboard. Charges (dispatch #2) read the statement_descriptor set here
 * and route to the connected account via direct charges.
 *
 * Storage: this service writes to `payment_gateway_connections`. Connect-
 * specific state lives in `metadataJson._connect` (mode, status, charges/
 * payouts flags, statement_descriptor, last_synced_at) to avoid a schema
 * migration that would also touch the existing "manual key" onboarding
 * path (`validateAndUpsertPaymentGatewayConnection` in storage.ts).
 *
 * Status state machine (spec §7.1):
 *   pending     — account exists, details_submitted=false
 *   active      — charges_enabled=true && payouts_enabled=true && details_submitted=true
 *   restricted  — details_submitted=true && (!charges_enabled || !payouts_enabled)
 *   disabled    — requirements.disabled_reason present, or account marked disabled
 */

import { getSecret } from "../platform-secrets-store";
import { stripeFetch } from "./stripe-fetch";

export type StripeConnectStatus = "pending" | "active" | "restricted" | "disabled";

export interface StripeAccountSnapshot {
  id: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  requirements?: {
    disabled_reason?: string | null;
    currently_due?: string[];
    eventually_due?: string[];
  };
  business_profile?: {
    name?: string | null;
  };
  settings?: {
    payments?: {
      statement_descriptor?: string | null;
    };
  };
}

export interface ConnectMetadataState {
  mode: "connect";
  status: StripeConnectStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  statementDescriptor: string | null;
  disabledReason: string | null;
  lastSyncedAt: string; // ISO timestamp
}

/**
 * Build the connected-account `statement_descriptor` per spec §2.1 + §2.2:
 * `YCM-<HOA-13-char-truncated>` — total ≤17 chars (including the platform
 * `YCM-` prefix) to leave room for a 4-5 char suffix (e.g., " DUES") within
 * Stripe's 22-char hard limit.
 *
 * Why the `YCM-` prefix is load-bearing (do NOT drop it):
 * Per spec §2.1 (William-ratified 2026-05-14) + §2.4, the `YCM-` prefix is
 * constant on every charge across the entire platform and is the
 * platform-brand-recognition mechanic surfaced on every owner's bank
 * statement. PR #121 Stage 2 FAIL iteration 1 (Issue #968) was caused by
 * dropping the prefix because the dispatch's parenthetical example
 * paraphrased it away — the spec, not the example, is canonical.
 *
 * Strategy:
 *   1. Uppercase, strip non-ASCII, collapse whitespace.
 *   2. Drop common suffix noise words: "CONDOMINIUMS", "CONDOMINIUM",
 *      "ASSOCIATION", "HOMEOWNERS", "COURT", "INC", "LLC" — but always
 *      keep "HOA" if present (signals to owners on bank statement).
 *   3. Cap the HOA segment at 13 chars (so `YCM-` + segment ≤ 17).
 *   4. Prepend `YCM-`.
 *
 * Examples (per spec §2.2 + §2.4):
 *   "Cherry Hill Court Condominiums" → "YCM-CHRY HILL HOA"  (17 chars)
 *   "Wawaset"                        → "YCM-WAWASET HOA"    (15 chars)
 */
export function buildStatementDescriptorPrefix(hoaName: string): string {
  // Platform-wide constant prefix per spec §2.1 (ratified by William 2026-05-14).
  // 4 chars; consumes part of the 17-char total budget, leaving 13 for the HOA segment.
  const PLATFORM_PREFIX = "YCM-";
  const HOA_SEGMENT_BUDGET = 13; // 17 total - 4 for "YCM-" per spec §2.2

  const NOISE_WORDS = new Set([
    "CONDOMINIUMS",
    "CONDOMINIUM",
    "ASSOCIATION",
    "HOMEOWNERS",
    "COURT",
    "INC",
    "LLC",
    "LTD",
    "THE",
  ]);
  const ABBREVIATIONS: Record<string, string> = {
    CHERRY: "CHRY",
    HEIGHTS: "HTS",
    GARDENS: "GDNS",
    VILLAGE: "VLG",
    SQUARE: "SQ",
    HARBOR: "HBR",
    NORTH: "N",
    SOUTH: "S",
    EAST: "E",
    WEST: "W",
  };

  const cleaned = hoaName
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return `${PLATFORM_PREFIX}HOA`;

  const tokensRaw = cleaned.split(" ");

  let tokens = tokensRaw
    .filter((t) => !NOISE_WORDS.has(t))
    .map((t) => ABBREVIATIONS[t] ?? t);
  if (tokens.length === 0) tokens = tokensRaw; // edge case: pure-noise name

  let result = tokens.join(" ");
  if (!result.includes("HOA")) result = `${result} HOA`;
  if (result.length <= HOA_SEGMENT_BUDGET) return `${PLATFORM_PREFIX}${result}`;

  // Hard truncate the HOA segment to fit the 13-char budget, preserving trailing "HOA".
  const HOA_SUFFIX = " HOA";
  const head = result
    .replace(/\s*HOA$/, "")
    .slice(0, HOA_SEGMENT_BUDGET - HOA_SUFFIX.length)
    .trim();
  result = head ? `${head}${HOA_SUFFIX}` : "HOA";
  return `${PLATFORM_PREFIX}${result.slice(0, HOA_SEGMENT_BUDGET)}`;
}

/**
 * Compute the canonical Connect status from a Stripe Account snapshot.
 * Pure function — testable without mocking the Stripe API.
 */
export function deriveConnectStatus(account: StripeAccountSnapshot): StripeConnectStatus {
  const charges = Boolean(account.charges_enabled);
  const payouts = Boolean(account.payouts_enabled);
  const details = Boolean(account.details_submitted);
  const disabledReason = account.requirements?.disabled_reason ?? null;

  if (disabledReason) return "disabled";
  if (!details) return "pending";
  if (charges && payouts) return "active";
  return "restricted";
}

export function buildConnectMetadataState(
  account: StripeAccountSnapshot,
  now: Date = new Date(),
): ConnectMetadataState {
  return {
    mode: "connect",
    status: deriveConnectStatus(account),
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    statementDescriptor: account.settings?.payments?.statement_descriptor ?? null,
    disabledReason: account.requirements?.disabled_reason ?? null,
    lastSyncedAt: now.toISOString(),
  };
}

interface StripeApiCallOptions {
  method: "GET" | "POST" | "DELETE";
  path: string;
  body?: URLSearchParams | null;
  /** Optional connected-account ID for Stripe-Account header (acts on behalf of). */
  stripeAccount?: string;
  /**
   * Optional Idempotency-Key. When set on a POST, Stripe returns the original
   * result on a retry instead of creating a second object (no double charge /
   * refund). Ignored for non-POST methods. See server/services/stripe-idempotency.ts.
   */
  idempotencyKey?: string;
}

export async function callPlatformStripe<T = Record<string, unknown>>(
  opts: StripeApiCallOptions,
): Promise<T> {
  const secretKey = await getSecret("PLATFORM_STRIPE_SECRET_KEY", "platform_stripe_secret_key");
  if (!secretKey) {
    throw new Error("Platform Stripe secret key not configured");
  }
  const { ok, status, data } = await stripeFetch({
    secretKey,
    method: opts.method,
    path: opts.path,
    body: opts.body,
    stripeAccount: opts.stripeAccount,
    idempotencyKey: opts.idempotencyKey,
  });
  if (!ok) {
    const errBody = (data.error ?? {}) as Record<string, unknown>;
    const msg = typeof errBody.message === "string" ? errBody.message : `Stripe error ${status}`;
    throw new Error(`Stripe API error: ${msg}`);
  }
  return data as T;
}

export interface CreateConnectedAccountInput {
  hoaName: string;
  country?: string; // ISO 3166-1 alpha-2; default US
  email?: string | null;
}

export interface CreateConnectedAccountResult {
  accountId: string;
  statementDescriptor: string;
  raw: StripeAccountSnapshot;
}

/**
 * Create a new Stripe Standard Connect account for an HOA and set its
 * statement descriptor per spec §2.2.
 */
export async function createConnectedAccount(
  input: CreateConnectedAccountInput,
): Promise<CreateConnectedAccountResult> {
  const statementDescriptor = buildStatementDescriptorPrefix(input.hoaName);
  const body = new URLSearchParams();
  body.set("type", "standard");
  body.set("country", input.country ?? "US");
  if (input.email) body.set("email", input.email);
  body.set("business_profile[name]", input.hoaName);
  body.set("settings[payments][statement_descriptor]", statementDescriptor);

  const account = await callPlatformStripe<StripeAccountSnapshot>({
    method: "POST",
    path: "/accounts",
    body,
  });
  return {
    accountId: account.id,
    statementDescriptor,
    raw: account,
  };
}

export interface CreateAccountLinkInput {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}

export async function createAccountOnboardingLink(
  input: CreateAccountLinkInput,
): Promise<{ url: string; expiresAt: number }> {
  const body = new URLSearchParams();
  body.set("account", input.accountId);
  body.set("refresh_url", input.refreshUrl);
  body.set("return_url", input.returnUrl);
  body.set("type", "account_onboarding");
  const link = await callPlatformStripe<{ url: string; expires_at: number }>({
    method: "POST",
    path: "/account_links",
    body,
  });
  return { url: link.url, expiresAt: link.expires_at };
}

export async function retrieveConnectedAccount(accountId: string): Promise<StripeAccountSnapshot> {
  return callPlatformStripe<StripeAccountSnapshot>({
    method: "GET",
    path: `/accounts/${encodeURIComponent(accountId)}`,
  });
}

/**
 * Re-export of the spec §7.1 base URL builder for callbacks. The admin
 * onboarding link must include both refresh and return URLs that come back
 * to YCM under the same association context.
 */
export function getYcmBaseUrl(): string {
  return (process.env.APP_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
}

// ── Payout reconciliation (founder-os#970 / dispatch #3, spec §4) ────────────

/**
 * Detect whether the platform Stripe key is operating in test or live mode.
 * Per audit Gap D — the admin gateway listing surfaces this at-a-glance so an
 * operator never confuses a test connection for a live one. Derived from the
 * `sk_test_` / `sk_live_` secret-key prefix (Stripe's own convention).
 * Returns "test" | "live" | "unknown" (unknown = key not configured).
 */
export async function getPlatformKeyMode(): Promise<"test" | "live" | "unknown"> {
  const secretKey = await getSecret("PLATFORM_STRIPE_SECRET_KEY", "platform_stripe_secret_key");
  if (!secretKey) return "unknown";
  if (secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_")) return "live";
  if (secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_")) return "test";
  return "unknown";
}

/** A Stripe charge as surfaced via an expanded balance-transaction source. */
export interface StripeChargeObject {
  id: string;
  object?: string;
  amount?: number;
  currency?: string;
  payment_intent?: string | null;
  metadata?: Record<string, string> | null;
  billing_details?: { name?: string | null } | null;
  livemode?: boolean;
}

/** A Stripe balance transaction (a line within a payout). */
export interface StripeBalanceTransaction {
  id: string;
  type: string; // "charge" | "payment" | "refund" | "application_fee" | "stripe_fee" | "payout" | …
  amount: number; // gross contribution to balance (cents); negative for refunds
  fee: number; // Stripe fee + (for direct charges) application fee, cents
  net: number; // amount - fee
  currency: string;
  source?: StripeChargeObject | string | null; // expanded charge when type=charge/payment
}

export interface StripePayoutObject {
  id: string;
  object?: string;
  amount: number; // NET amount paid to the bank (cents)
  currency: string;
  status?: string; // "paid" | "pending" | "in_transit" | "failed" | "canceled"
  arrival_date?: number; // unix seconds
  livemode?: boolean;
}

/**
 * Fetch ALL balance transactions belonging to a payout on a connected account,
 * expanding each transaction's `source` to the underlying charge (so we can
 * read the spec §3.1 metadata). Handles Stripe cursor pagination (100/page).
 *
 * Per spec §4.1 step 5 — `payout.paid` → "loads all charges in the batch".
 */
export async function listPayoutBalanceTransactions(
  connectedAccountId: string,
  payoutId: string,
): Promise<StripeBalanceTransaction[]> {
  const out: StripeBalanceTransaction[] = [];
  let startingAfter: string | null = null;
  // Bound the loop defensively — a single daily HOA payout will never exceed
  // a handful of pages, but never spin forever on an unexpected response.
  for (let page = 0; page < 50; page += 1) {
    const qs = new URLSearchParams();
    qs.set("payout", payoutId);
    qs.set("limit", "100");
    qs.set("expand[]", "data.source");
    if (startingAfter) qs.set("starting_after", startingAfter);
    const resp = await callPlatformStripe<{
      data?: StripeBalanceTransaction[];
      has_more?: boolean;
    }>({
      method: "GET",
      path: `/balance_transactions?${qs.toString()}`,
      stripeAccount: connectedAccountId,
    });
    const batch = Array.isArray(resp.data) ? resp.data : [];
    out.push(...batch);
    if (!resp.has_more || batch.length === 0) break;
    startingAfter = batch[batch.length - 1].id;
  }
  return out;
}

/** Retrieve a single payout on a connected account (for the report header). */
export async function retrievePayout(
  connectedAccountId: string,
  payoutId: string,
): Promise<StripePayoutObject> {
  return callPlatformStripe<StripePayoutObject>({
    method: "GET",
    path: `/payouts/${encodeURIComponent(payoutId)}`,
    stripeAccount: connectedAccountId,
  });
}

/** Retrieve a single charge on a connected account (Gap C metadata fallback). */
export async function retrieveCharge(
  connectedAccountId: string,
  chargeId: string,
): Promise<StripeChargeObject> {
  return callPlatformStripe<StripeChargeObject>({
    method: "GET",
    path: `/charges/${encodeURIComponent(chargeId)}`,
    stripeAccount: connectedAccountId,
  });
}
