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
