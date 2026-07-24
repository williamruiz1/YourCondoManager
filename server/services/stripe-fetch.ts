/**
 * stripe-fetch.ts — the ONE canonical Stripe HTTP client for YourCondoManager
 * (founder-os#10780, CQ-008). Consolidates the request-construction that was
 * hand-rolled at 8 raw `fetch('https://api.stripe.com/...')` sites: the base URL,
 * the header set (Authorization / Content-Type / Stripe-Account / Idempotency-Key),
 * and an OPT-IN retry-with-backoff + optional timeout.
 *
 * ── MONEY-SAFETY (this file touches LIVE payment code) ────────────────────────
 * 1. `secretKey` is a REQUIRED PARAMETER — never hardcoded here. Each caller keeps
 *    its EXACT key: the platform key (callPlatformStripe / usage-reconcile), the
 *    connected-account/gateway key (payment-service, routes), or the user-supplied
 *    key being verified (storage.ts). A wrong key routes money to the wrong account,
 *    so key selection stays 100% with the caller.
 * 2. This returns the RAW `Response` — it does NOT parse the body, inspect `.ok`, or
 *    throw. Every caller keeps its OWN response handling / business validation /
 *    error-message shape byte-for-byte (they differ: some throw, one returns a
 *    structured failure, one returns null, and the parse fallback differs
 *    `() => null` vs `() => ({})`). Centralizing response handling would silently
 *    change behavior — so only the REQUEST is consolidated.
 * 3. Retry is OPT-IN, default OFF. With retry off (the migration default) this is
 *    exactly `fetch(url, { method, headers, body })` — ZERO behavior change. When
 *    on, it will ONLY actually retry a request that is safe to replay: a GET, or a
 *    POST that carries an Idempotency-Key (Stripe returns the original object on a
 *    replay → no double charge). A keyless money POST is NEVER retried, even if the
 *    caller asks — that guard is baked in here so it cannot be bypassed by mistake.
 */

const STRIPE_API_BASE = "https://api.stripe.com/v1";

/** Statuses Stripe/infra consider transient and safe to replay (with the safety guard). */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export interface StripeRetryConfig {
  /** Max additional attempts after the first (default 2 → up to 3 total). */
  retries?: number;
  /** Base backoff in ms for exponential backoff + jitter (default 200). */
  baseMs?: number;
}

export interface StripeFetchOptions {
  /** Path appended to https://api.stripe.com/v1 — e.g. "/checkout/sessions" or
   *  "/checkout/sessions/cs_123?expand[]=setup_intent.payment_method". */
  path: string;
  /** HTTP method. Defaults to "GET" (matches a bare `fetch(url)` with no method). */
  method?: string;
  /** REQUIRED. The Stripe secret key for THIS call — chosen by the caller. */
  secretKey: string;
  /** Form body. Present ⇒ Content-Type: application/x-www-form-urlencoded (matches
   *  every current site). A URLSearchParams is `.toString()`-ed. */
  body?: URLSearchParams | string | null;
  /** Connected-account id ⇒ Stripe-Account header (acts on behalf of). */
  stripeAccount?: string | null;
  /** Idempotency-Key. Applied ONLY on POST (the create/money verb), matching the
   *  existing sites + callPlatformStripe. Ignored on GET. */
  idempotencyKey?: string | null;
  /** OPT-IN retry-with-backoff. Default off ⇒ single fetch = zero behavior change.
   *  Even when on, only replays a GET or an idempotent POST (money-safety guard). */
  retry?: boolean | StripeRetryConfig;
  /** OPT-IN per-attempt timeout via AbortController. Default: none (no signal, so
   *  byte-identical to a raw fetch). */
  timeoutMs?: number;
}

function buildHeaders(opts: StripeFetchOptions, hasBody: boolean): Record<string, string> {
  const method = (opts.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.secretKey}`,
  };
  // Content-Type set exactly when there is a form body (every POST site does this;
  // no GET site sets it).
  if (hasBody) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }
  if (opts.stripeAccount) {
    headers["Stripe-Account"] = opts.stripeAccount;
  }
  // Idempotency-Key only on POST (the money-moving / create verb), matching every
  // current site and callPlatformStripe.
  if (opts.idempotencyKey && method === "POST") {
    headers["Idempotency-Key"] = opts.idempotencyKey;
  }
  return headers;
}

/** True only for requests that Stripe guarantees are safe to replay. */
function isReplaySafe(method: string, idempotencyKey?: string | null): boolean {
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD") return true;
  // A POST is safe to replay ONLY with an Idempotency-Key (Stripe returns the
  // original object → no double charge). Everything else (keyless money POST): NO.
  if (m === "POST") return Boolean(idempotencyKey);
  return false;
}

function resolveRetry(retry: StripeFetchOptions["retry"]): { retries: number; baseMs: number } | null {
  if (!retry) return null;
  if (retry === true) return { retries: 2, baseMs: 200 };
  return { retries: retry.retries ?? 2, baseMs: retry.baseMs ?? 200 };
}

function backoffMs(attempt: number, baseMs: number): number {
  // Exponential backoff with full jitter: rand(0, base * 2^attempt).
  const ceiling = baseMs * Math.pow(2, attempt);
  return Math.floor(Math.random() * ceiling);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Issue one Stripe request. Returns the raw Response (unconsumed body) so the
 * caller keeps its exact `.json()` / `.ok` / error handling.
 */
export async function stripeFetch(opts: StripeFetchOptions): Promise<Response> {
  const method = (opts.method ?? "GET").toUpperCase();
  const bodyStr =
    opts.body == null ? undefined : typeof opts.body === "string" ? opts.body : opts.body.toString();
  const headers = buildHeaders(opts, bodyStr !== undefined);
  const url = `${STRIPE_API_BASE}${opts.path}`;

  const retryCfg = resolveRetry(opts.retry);
  // Money-safety guard: never actually retry a request that isn't replay-safe,
  // even if the caller passed retry: true.
  const maxRetries = retryCfg && isReplaySafe(method, opts.idempotencyKey) ? retryCfg.retries : 0;
  const baseMs = retryCfg?.baseMs ?? 200;

  const doFetch = async (): Promise<Response> => {
    // Optional per-attempt timeout. Absent ⇒ no signal ⇒ identical to raw fetch.
    if (opts.timeoutMs && opts.timeoutMs > 0 && typeof AbortController !== "undefined") {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
      try {
        return await fetch(url, { method, headers, body: bodyStr, signal: ctrl.signal });
      } finally {
        clearTimeout(timer);
      }
    }
    return fetch(url, { method, headers, body: bodyStr });
  };

  let attempt = 0;
  // Fast path (maxRetries === 0): exactly one fetch, no try/catch overhead beyond
  // the single call — byte-identical to the pre-consolidation site.
  while (true) {
    try {
      const resp = await doFetch();
      // Only inspect status (never the body — leaves the Response intact for the
      // caller). Retry on a transient status when allowed.
      if (attempt < maxRetries && RETRYABLE_STATUS.has(resp.status)) {
        await sleep(backoffMs(attempt, baseMs));
        attempt += 1;
        continue;
      }
      return resp;
    } catch (err) {
      // Network / abort error. Retry when allowed, else rethrow (a raw fetch would
      // also throw here — byte-identical when retry is off).
      if (attempt < maxRetries) {
        await sleep(backoffMs(attempt, baseMs));
        attempt += 1;
        continue;
      }
      throw err;
    }
  }
}
