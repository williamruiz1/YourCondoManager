/**
 * Unit tests for server/rate-limit.ts.
 *
 * Covers:
 *   1. createRateLimiter — basic window counting + 429 + Retry-After header.
 *   2. onWriteOnly — applies the limiter only on mutating HTTP methods.
 *
 * Uses fake-timers to control Date.now() without sleeping.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRateLimiter, onWriteOnly } from "../rate-limit";
import type { Request, Response } from "express";

// ── Minimal request / response stubs ─────────────────────────────────────────

function makeReq(overrides: Partial<Request> = {}): Request {
  return { ip: "127.0.0.1", method: "POST", ...overrides } as Request;
}

function makeRes(): {
  res: Response;
  statusCode: number | undefined;
  body: unknown;
  headers: Record<string, string>;
} {
  const ctx: {
    statusCode: number | undefined;
    body: unknown;
    headers: Record<string, string>;
    res: Response;
  } = {
    statusCode: undefined,
    body: undefined,
    headers: {},
    res: null as unknown as Response,
  };

  const res = {
    status(code: number) {
      ctx.statusCode = code;
      return res;
    },
    json(body: unknown) {
      ctx.body = body;
      return res;
    },
    setHeader(name: string, value: string) {
      ctx.headers[name] = value;
      return res;
    },
  } as unknown as Response;

  ctx.res = res;
  return ctx;
}

// ── Tests: createRateLimiter ──────────────────────────────────────────────────

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the max within a window", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    const req = makeReq();

    for (let i = 0; i < 3; i++) {
      const next = vi.fn();
      const { res } = makeRes();
      limiter(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    }
  });

  it("returns 429 when the max is exceeded", () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 2,
      message: "Slow down!",
    });
    const req = makeReq();

    // Exhaust the quota.
    for (let i = 0; i < 2; i++) {
      limiter(req, makeRes().res, vi.fn());
    }

    // Next request should be rate-limited.
    const next = vi.fn();
    const ctx = makeRes();
    limiter(req, ctx.res, next);

    expect(ctx.statusCode).toBe(429);
    expect((ctx.body as { message?: string })?.message).toBe("Slow down!");
    expect(next).not.toHaveBeenCalled();
  });

  it("sets Retry-After header on 429", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const req = makeReq();

    limiter(req, makeRes().res, vi.fn()); // consume the quota
    const ctx = makeRes();
    limiter(req, ctx.res, vi.fn());

    expect(ctx.headers["Retry-After"]).toBeDefined();
    expect(Number(ctx.headers["Retry-After"])).toBeGreaterThan(0);
  });

  it("resets the bucket after the window expires", () => {
    const limiter = createRateLimiter({ windowMs: 1_000, max: 1 });
    const req = makeReq();

    limiter(req, makeRes().res, vi.fn()); // consume quota

    // One window later — bucket should be fresh.
    vi.advanceTimersByTime(1_001);

    const next = vi.fn();
    limiter(req, makeRes().res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("tracks different IPs independently", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const reqA = makeReq({ ip: "10.0.0.1" });
    const reqB = makeReq({ ip: "10.0.0.2" });

    limiter(reqA, makeRes().res, vi.fn()); // consume A's quota

    const nextB = vi.fn();
    limiter(reqB, makeRes().res, nextB);
    expect(nextB).toHaveBeenCalledOnce(); // B is unaffected
  });

  it("falls back to 'unknown' key when req.ip is undefined", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const req = makeReq({ ip: undefined });

    limiter(req, makeRes().res, vi.fn()); // consume quota

    const next = vi.fn();
    const ctx = makeRes();
    limiter(req, ctx.res, next); // should be rate-limited

    expect(ctx.statusCode).toBe(429);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── Tests: onWriteOnly ────────────────────────────────────────────────────────

describe("onWriteOnly", () => {
  it("invokes the limiter for POST requests", () => {
    const limiter = vi.fn();
    const wrapped = onWriteOnly(limiter);
    const req = makeReq({ method: "POST" });
    const { res } = makeRes();
    const next = vi.fn();

    wrapped(req, res, next);

    expect(limiter).toHaveBeenCalledOnce();
  });

  it("invokes the limiter for PATCH requests", () => {
    const limiter = vi.fn();
    const wrapped = onWriteOnly(limiter);
    const req = makeReq({ method: "PATCH" });
    const { res } = makeRes();
    const next = vi.fn();

    wrapped(req, res, next);

    expect(limiter).toHaveBeenCalledOnce();
  });

  it("invokes the limiter for DELETE requests", () => {
    const limiter = vi.fn();
    const wrapped = onWriteOnly(limiter);
    const req = makeReq({ method: "DELETE" });
    const { res } = makeRes();
    const next = vi.fn();

    wrapped(req, res, next);

    expect(limiter).toHaveBeenCalledOnce();
  });

  it("invokes the limiter for PUT requests", () => {
    const limiter = vi.fn();
    const wrapped = onWriteOnly(limiter);
    const req = makeReq({ method: "PUT" });
    const { res } = makeRes();
    const next = vi.fn();

    wrapped(req, res, next);

    expect(limiter).toHaveBeenCalledOnce();
  });

  it("passes GET requests directly to next without calling the limiter", () => {
    const limiter = vi.fn();
    const wrapped = onWriteOnly(limiter);
    const req = makeReq({ method: "GET" });
    const { res } = makeRes();
    const next = vi.fn();

    wrapped(req, res, next);

    expect(limiter).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it("passes HEAD requests directly to next without calling the limiter", () => {
    const limiter = vi.fn();
    const wrapped = onWriteOnly(limiter);
    const req = makeReq({ method: "HEAD" });
    const { res } = makeRes();
    const next = vi.fn();

    wrapped(req, res, next);

    expect(limiter).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it("passes OPTIONS requests directly to next without calling the limiter", () => {
    const limiter = vi.fn();
    const wrapped = onWriteOnly(limiter);
    const req = makeReq({ method: "OPTIONS" });
    const { res } = makeRes();
    const next = vi.fn();

    wrapped(req, res, next);

    expect(limiter).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it("passes the limiter's outcome through (limiter calls next → next fires)", () => {
    // When the limiter itself calls `next`, the response should reach `next`.
    const passThruLimiter = (
      _req: Request,
      _res: Response,
      next: () => void,
    ) => next();
    const wrapped = onWriteOnly(passThruLimiter);
    const req = makeReq({ method: "POST" });
    const { res } = makeRes();
    const next = vi.fn();

    wrapped(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("passes the limiter's outcome through (limiter blocks → next does not fire)", () => {
    // When the limiter responds 429 without calling `next`, next must not fire.
    const blockingLimiter = (_req: Request, res: Response, _next: () => void) => {
      res.status(429).json({ message: "Rate limited" });
    };
    const wrapped = onWriteOnly(blockingLimiter);
    const req = makeReq({ method: "POST" });
    const ctx = makeRes();
    const next = vi.fn();

    wrapped(req, ctx.res, next);

    expect(ctx.statusCode).toBe(429);
    expect(next).not.toHaveBeenCalled();
  });
});
