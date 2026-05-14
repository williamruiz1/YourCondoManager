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
 * Truncate an HOA name to the spec §2.2 pattern: ≤17 chars to leave room
 * for a 4-5 char suffix (e.g., " DUES") within Stripe's 22-char hard limit.
 *
 * Strategy:
 *   1. Uppercase, strip non-ASCII, collapse whitespace.
 *   2. Drop common suffix noise words: "CONDOMINIUMS", "CONDOMINIUM",
 *      "ASSOCIATION", "HOMEOWNERS", "COURT", "INC", "LLC" — but always
 *      keep "HOA" if present (signals to owners on bank statement).
 *   3. If still >17 chars, hard-truncate at 17.
 *
 * Examples (per spec §2.2):
 *   "Cherry Hill Court Condominiums" → "CHRY HILL HOA"
 *   "Wawaset"                        → "WAWASET HOA"
 */
export function buildStatementDescriptorPrefix(hoaName: string): string {
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

  if (!cleaned) return "HOA";

  const tokensRaw = cleaned.split(" ");
  const hadHoa = tokensRaw.includes("HOA");

  let tokens = tokensRaw
    .filter((t) => !NOISE_WORDS.has(t))
    .map((t) => ABBREVIATIONS[t] ?? t);
  if (tokens.length === 0) tokens = tokensRaw; // edge case: pure-noise name

  let result = tokens.join(" ");
  if (!result.includes("HOA")) result = `${result} HOA`;
  if (result.length <= 17) return result;

  // Hard truncate, preserve trailing "HOA" if it fits.
  const HOA_SUFFIX = " HOA";
  const head = result.replace(/\s*HOA$/, "").slice(0, 17 - HOA_SUFFIX.length).trim();
  result = head ? `${head}${HOA_SUFFIX}` : "HOA";
  void hadHoa;
  return result.slice(0, 17);
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
}

async function callPlatformStripe<T = Record<string, unknown>>(
  opts: StripeApiCallOptions,
): Promise<T> {
  const secretKey = await getSecret("PLATFORM_STRIPE_SECRET_KEY", "platform_stripe_secret_key");
  if (!secretKey) {
    throw new Error("Platform Stripe secret key not configured");
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
  };
  if (opts.body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }
  if (opts.stripeAccount) {
    headers["Stripe-Account"] = opts.stripeAccount;
  }
  const resp = await fetch(`https://api.stripe.com/v1${opts.path}`, {
    method: opts.method,
    headers,
    body: opts.body ? opts.body.toString() : undefined,
  });
  const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resp.ok) {
    const errBody = (data.error ?? {}) as Record<string, unknown>;
    const msg = typeof errBody.message === "string" ? errBody.message : `Stripe error ${resp.status}`;
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
