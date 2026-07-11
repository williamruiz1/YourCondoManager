/**
 * Platform (non-Connect) Stripe request helper — A-STRIPE-004.
 *
 * The internal platform SaaS-billing flow (customer create, subscription create,
 * checkout-session create, meter events) previously issued raw `fetch`es with NO
 * Idempotency-Key and NO retry/backoff. A network retry of a subscription/customer
 * create could therefore create a DUPLICATE Stripe customer/subscription — the
 * pre-Stripe DB existence check is a TOCTOU window (the Stripe object can be
 * created before the local row is written, so a retry issues a second one).
 *
 * This helper centralizes the platform Stripe call so:
 *   1. every money-moving / create POST can carry a stable Idempotency-Key
 *      (Stripe replays the first result on a retry instead of creating a second
 *      object), and
 *   2. transient 429 (rate-limit) and 5xx errors are retried with exponential
 *      backoff — SAFE only because idempotency keys are present on the POSTs, and
 *      GET/DELETE are naturally retry-safe.
 *
 * It is a thin, dependency-free unit (the secret key + fetch/sleep are injected)
 * so the retry/idempotency contract is unit-testable without a live Stripe call
 * or the whole routes closure.
 */

export interface PlatformStripeRequestOptions {
  /** Stable Idempotency-Key — set on POSTs so a retry collapses to one object. */
  idempotencyKey?: string;
  /** Max RETRIES (attempts = maxRetries + 1). Default 2. */
  maxRetries?: number;
  /** Base backoff in ms (doubled each retry). Default 200. */
  baseDelayMs?: number;
  /** Injected fetch (defaults to global fetch) — for tests. */
  fetchImpl?: typeof fetch;
  /** Injected sleep (defaults to a real timer) — for tests. */
  sleep?: (ms: number) => Promise<void>;
}

const STRIPE_API = "https://api.stripe.com/v1";

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True for transient statuses that are safe to retry (given idempotency). */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Issue a platform Stripe API call with idempotency + bounded retry/backoff.
 *
 * @throws on a non-ok response after exhausting retries (message = Stripe's).
 */
export async function platformStripeRequest(
  secretKey: string,
  method: string,
  path: string,
  body?: URLSearchParams,
  opts: PlatformStripeRequestOptions = {},
): Promise<Record<string, unknown>> {
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const maxRetries = opts.maxRetries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 200;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  // Idempotency-Key only applies to the money-moving / create verb (POST). A
  // stable key across retries is what makes retrying a POST safe.
  const upper = method.toUpperCase();
  if (opts.idempotencyKey && upper === "POST") {
    headers["Idempotency-Key"] = opts.idempotencyKey;
  }

  // Retry a POST only when it carries an idempotency key (otherwise a retry could
  // duplicate money movement). GET/DELETE are naturally safe to retry.
  const retryable = upper !== "POST" || !!opts.idempotencyKey;

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let resp: Response;
    try {
      resp = await doFetch(`${STRIPE_API}${path}`, {
        method,
        headers,
        body: body?.toString(),
      });
    } catch (networkErr) {
      // A transport-level failure (connection reset, DNS, timeout).
      lastErr = networkErr instanceof Error ? networkErr : new Error(String(networkErr));
      if (retryable && attempt < maxRetries) {
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }
      throw lastErr;
    }

    const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    if (resp.ok) return data;

    const errMsg = (data.error as { message?: string } | undefined)?.message ?? `Stripe error ${resp.status}`;
    lastErr = new Error(errMsg);
    if (retryable && isRetryableStatus(resp.status) && attempt < maxRetries) {
      await sleep(baseDelayMs * 2 ** attempt);
      continue;
    }
    throw lastErr;
  }

  // Unreachable (loop either returns or throws), but satisfies the type checker.
  throw lastErr ?? new Error("Stripe request failed");
}
