import type { Request, Response, NextFunction } from "express";

type Bucket = { count: number; resetAt: number };

/**
 * Simple in-memory rate limiter. Suitable for single-instance deployments.
 *
 * Multi-instance note: each server process keeps an independent in-memory
 * counter. When YCM scales beyond a single Fly machine, replace this with a
 * shared store (Redis via `rate-limiter-flexible` or `ioredis`) so all
 * instances enforce a unified window. The interface is identical — only the
 * constructor changes. The call sites in `server/index.ts` are the canonical
 * swap point.
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  /**
   * Optional per-request bucket key. Defaults to the client IP
   * (`req.ip ?? "unknown"`) — preserves existing behavior for every current
   * caller. Pass this to key a limiter by account identity (e.g. email) in
   * addition to IP, so unrelated users sharing an IP (NAT / VPN / shared
   * office WiFi / a household) don't share one bucket. See YCM founder-os
   * incident 2026-07-17 (auth rate-limit rebalance) — the fixed-window shape
   * is unchanged, only WHAT discriminates a bucket is configurable.
   */
  keyGenerator?: (req: Request) => string;
}) {
  const buckets = new Map<string, Bucket>();
  const {
    windowMs,
    max,
    message = "Too many requests, please try again later.",
    keyGenerator = (req: Request) => req.ip ?? "unknown",
  } = options;

  // Periodic cleanup to prevent unbounded memory growth.
  // NOTE (founder-os#10741, SCALE-B-003): this is deliberately NOT wrapped in a
  // cross-machine advisory lock — `buckets` is a per-process in-memory Map, so
  // each machine must GC its OWN map. Locking it would leave other machines'
  // maps uncleaned (a memory leak). Only SIDE-EFFECT sweeps (money/email/DB) use
  // withSchedulerLock; per-machine memory hygiene correctly runs per-machine.
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req) || "unknown";
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= max) {
      res.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000).toString());
      return res.status(429).json({ message });
    }

    bucket.count++;
    return next();
  };
}

/**
 * Returns an Express middleware that applies `limiter` only for
 * state-mutating HTTP methods (POST, PUT, PATCH, DELETE).
 *
 * Use this when `app.use("/api/some-prefix", ...)` would also intercept
 * read-only GET requests that you want to leave unthrottled.
 */
export function onWriteOnly(
  limiter: (req: Request, res: Response, next: NextFunction) => void,
): (req: Request, res: Response, next: NextFunction) => void {
  const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  return (req: Request, res: Response, next: NextFunction) => {
    if (WRITE_METHODS.has(req.method)) {
      return limiter(req, res, next);
    }
    return next();
  };
}

/**
 * A single row returned by the atomic increment query.
 */
type RateLimitRow = { count: number | string };

/**
 * Minimal query interface — matches `pg.Pool.query` / `pg.Client.query`, but
 * narrow enough to inject a stub in tests. Only the `rows` field is used.
 */
export type RateLimitQuery = (
  sql: string,
  params: unknown[],
) => Promise<{ rows: RateLimitRow[] }>;

/**
 * Postgres-backed fixed-window rate limiter — the MULTI-MACHINE-CORRECT limiter.
 *
 * Unlike `createRateLimiter` (per-process in-memory), this shares one counter
 * across every Fly machine via the existing Postgres (`rate_limit_counters`
 * table). This matters because fly.toml provisions 2 machines (one auto-stopped)
 * — a per-machine counter would let a load-balanced attacker get 2x the quota on
 * money-mutation + auth-brute-force surfaces. No Redis, no new infra service.
 *
 * Fixed-window algorithm: each request atomically upserts the `(key, window)`
 * counter and reads back the post-increment count. The upsert is a single
 * statement, so concurrent requests (even across machines) serialize on the row
 * lock and can never over-count.
 *
 * FAIL-OPEN: on any DB error the limiter degrades to a per-process in-memory
 * limiter (same window/max). Rate limiting is abuse protection, not a security
 * gate — a transient DB blip must never DoS legitimate traffic. The fallback
 * still throttles per-machine, so protection degrades gracefully rather than
 * disappearing.
 */
export function createPgRateLimiter(options: {
  windowMs: number;
  max: number;
  /** Bucket namespace, e.g. "auth-verify" — keeps tiers from sharing a bucket. */
  keyPrefix: string;
  message?: string;
  query: RateLimitQuery;
  /** Optional hook invoked when a DB error forces the in-memory fallback. */
  onFallback?: (err: unknown) => void;
  /**
   * Optional per-request discriminator, composed with keyPrefix to form the
   * bucket key (`${keyPrefix}:${discriminator}`). Defaults to the client IP
   * (`req.ip ?? "unknown"`) — preserves existing behavior for every current
   * tier (money-write, invite-gen, auth-request all stay IP-only).
   *
   * Auth-verify (2026-07-17 rebalance): key by account (email) + IP instead
   * of bare IP. A pure-IP bucket means every user behind the same NAT / VPN /
   * shared WiFi — or one legitimate multi-association owner whose login
   * protocol costs 2 verify-login calls (OTP verify, then association pick)
   * — shares one budget and can lock each other out. Keying by account+IP
   * isolates that: an attacker still can't spray guesses past the per-token
   * `attempts >= 5` cap in routes.ts (unchanged, IP/account-agnostic — the
   * real brute-force floor), and a credential-stuffing attempt against ONE
   * account+IP pair stays tightly bounded.
   */
  keyGenerator?: (req: Request) => string;
}) {
  const {
    windowMs,
    max,
    keyPrefix,
    message = "Too many requests, please try again later.",
    query,
    onFallback,
    keyGenerator = (req: Request) => req.ip ?? "unknown",
  } = options;

  // The degraded-mode limiter (per-machine) used only when Postgres is down.
  // Shares the same keyGenerator so a DB blip doesn't silently widen the
  // bucket back to IP-only for the duration of the outage.
  const fallback = createRateLimiter({ windowMs, max, message, keyGenerator });

  return async (req: Request, res: Response, next: NextFunction) => {
    const discriminator = keyGenerator(req) || "unknown";
    const key = `${keyPrefix}:${discriminator}`;
    const now = Date.now();
    const windowStart = new Date(Math.floor(now / windowMs) * windowMs);

    try {
      const result = await query(
        `INSERT INTO rate_limit_counters (key, window_start, count, updated_at)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT (key) DO UPDATE SET
           count = CASE
                     WHEN rate_limit_counters.window_start = EXCLUDED.window_start
                     THEN rate_limit_counters.count + 1
                     ELSE 1
                   END,
           window_start = EXCLUDED.window_start,
           updated_at = NOW()
         RETURNING count`,
        [key, windowStart],
      );

      // count comes back as a JS number (node-postgres int4) but tolerate string.
      const count = Number(result.rows[0]?.count ?? 1);

      if (count > max) {
        const resetAt = windowStart.getTime() + windowMs;
        res.setHeader("Retry-After", Math.ceil((resetAt - now) / 1000).toString());
        return res.status(429).json({ message });
      }
      return next();
    } catch (err) {
      onFallback?.(err);
      return fallback(req, res, next);
    }
  };
}
