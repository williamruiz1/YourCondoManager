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
}) {
  const buckets = new Map<string, Bucket>();
  const { windowMs, max, message = "Too many requests, please try again later." } = options;

  // Periodic cleanup to prevent unbounded memory growth
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "unknown";
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
}) {
  const {
    windowMs,
    max,
    keyPrefix,
    message = "Too many requests, please try again later.",
    query,
    onFallback,
  } = options;

  // The degraded-mode limiter (per-machine) used only when Postgres is down.
  const fallback = createRateLimiter({ windowMs, max, message });

  return async (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip ?? "unknown";
    const key = `${keyPrefix}:${clientIp}`;
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
