import type { Request, Response, NextFunction } from "express";

type Bucket = { count: number; resetAt: number };

/**
 * Simple in-memory rate limiter. Suitable for single-instance deployments.
 * For multi-instance setups, use a shared store (Redis) instead.
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
