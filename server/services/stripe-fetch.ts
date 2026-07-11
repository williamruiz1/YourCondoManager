/**
 * stripeFetch — the ONE shared Stripe HTTP transport (CQ-008 consolidation).
 *
 * Before this file, YCM called `api.stripe.com` via 9 hand-rolled `fetch()`
 * sites across 5 files, each re-implementing the auth header, url-encoded body,
 * Stripe-Account / Idempotency-Key headers, and error parsing independently.
 * This wrapper owns the TRANSPORT (headers, url, retry, timeout, error parse)
 * so every money call goes through one audited path.
 *
 * MONEY-SAFETY / byte-identical contract (why this is safe on live CHC money
 * code — see founder-os#10755 MONEY-SAFETY note):
 *
 *  1. The caller RESOLVES and PASSES its own `secretKey`. This wrapper NEVER
 *     decides which credential to use — so the platform-key sites keep using
 *     the platform key and the connected-account / payload-key sites keep using
 *     theirs. Key-resolution behavior is unchanged by construction.
 *  2. Header assembly matches the pre-existing sites EXACTLY: Content-Type is
 *     set only when a body is present; Stripe-Account only when passed;
 *     Idempotency-Key only on POST when passed.
 *  3. This wrapper NEVER throws on an HTTP error status. It returns
 *     `{ ok, status, data }` and each caller keeps its own bespoke
 *     post-response validation + error message (byte-identical error text).
 *     It throws ONLY on a network/timeout failure after retries are exhausted —
 *     which is exactly what a raw `fetch()` already did (propagated the throw),
 *     just with safe retries added first.
 *  4. RETRY is additive and money-safe: a POST is retried ONLY when an
 *     Idempotency-Key is present (Stripe replays the original result → no
 *     double charge). GET/DELETE are always retriable. A keyless POST is
 *     NEVER retried. Retry fires on a network/timeout throw, HTTP 429, or 5xx.
 *
 * This introduces the retry/timeout hardening CQ-008 asked for without changing
 * any call site's correctness.
 */

export interface StripeFetchOptions {
  /** Caller-resolved Stripe secret key. This wrapper never resolves a key. */
  secretKey: string;
  method: "GET" | "POST" | "DELETE";
  /** Path beginning with "/", e.g. "/checkout/sessions". */
  path: string;
  /** url-encoded request body (POST/DELETE). Content-Type is set iff present. */
  body?: URLSearchParams | null;
  /** Optional query string appended to the URL (used by list/read calls). */
  query?: URLSearchParams | null;
  /** Optional connected-account id → `Stripe-Account` header. */
  stripeAccount?: string;
  /** Optional Idempotency-Key. Applied ONLY on POST; also gates POST retry. */
  idempotencyKey?: string;
  /** Extra headers merged last (rare; e.g. Stripe-Version pinning). */
  extraHeaders?: Record<string, string>;
  /** Max retry attempts on network/timeout/429/5xx (default 2). */
  maxRetries?: number;
  /** Per-attempt timeout in ms (default 30_000). */
  timeoutMs?: number;
}

export interface StripeFetchResult {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
}

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 30_000;

function buildHeaders(opts: StripeFetchOptions): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.secretKey}`,
  };
  if (opts.body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }
  if (opts.stripeAccount) {
    headers["Stripe-Account"] = opts.stripeAccount;
  }
  // Idempotency-Key only applies to POST (the money-moving / create verb).
  if (opts.idempotencyKey && opts.method === "POST") {
    headers["Idempotency-Key"] = opts.idempotencyKey;
  }
  if (opts.extraHeaders) {
    Object.assign(headers, opts.extraHeaders);
  }
  return headers;
}

/**
 * A POST is only safe to retry when it carries an Idempotency-Key (Stripe
 * replays the first result on the retry). Keyless POSTs are never retried to
 * avoid a second charge. GET/DELETE are always safe.
 */
function isRetriableMethod(opts: StripeFetchOptions): boolean {
  if (opts.method === "POST") {
    return Boolean(opts.idempotencyKey);
  }
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff with a small fixed base; bounded so tests stay fast. */
function backoffMs(attempt: number): number {
  return Math.min(200 * 2 ** attempt, 2_000);
}

export async function stripeFetch(
  opts: StripeFetchOptions,
): Promise<StripeFetchResult> {
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retriable = isRetriableMethod(opts);
  const headers = buildHeaders(opts);
  const qs =
    opts.query && Array.from(opts.query.keys()).length > 0
      ? `?${opts.query.toString()}`
      : "";
  const url = `${STRIPE_API_BASE}${opts.path}${qs}`;
  const bodyStr = opts.body ? opts.body.toString() : undefined;

  let lastNetworkError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, {
        method: opts.method,
        headers,
        body: bodyStr,
        signal: controller.signal,
      });
      const data = (await resp
        .json()
        .catch(() => ({}))) as Record<string, unknown>;

      // Retry ONLY on transient server-side signals (429 / 5xx), and only when
      // the method is safe to retry. A 4xx (except 429) is a caller error →
      // return it so the caller's own validation + message handle it.
      const transient = resp.status === 429 || resp.status >= 500;
      if (transient && retriable && attempt < maxRetries) {
        await sleep(backoffMs(attempt));
        continue;
      }
      return { ok: resp.ok, status: resp.status, data };
    } catch (err) {
      // Network error / timeout (AbortError). Retry when safe; otherwise rethrow
      // — matching the pre-existing behavior where a raw fetch throw propagated.
      lastNetworkError = err;
      if (retriable && attempt < maxRetries) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // Unreachable in practice (loop either returns or throws), but satisfies the
  // type checker and preserves throw-on-network-exhaustion semantics.
  throw lastNetworkError ?? new Error("stripeFetch: exhausted retries");
}
