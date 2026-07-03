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

// ── Tests: createPgRateLimiter (multi-machine-correct, Postgres-backed) ───────

import { createPgRateLimiter, type RateLimitQuery } from "../rate-limit";

/**
 * A stub `query` that simulates the atomic fixed-window upsert against a shared
 * counter — one counter per `key` per window, exactly like the real SQL. This
 * lets us assert the limiter's decision logic without a live Postgres.
 */
function makeStubQuery(): { query: RateLimitQuery; calls: unknown[][] } {
  const counters = new Map<string, { windowStart: number; count: number }>();
  const calls: unknown[][] = [];
  const query: RateLimitQuery = async (_sql, params) => {
    calls.push(params);
    const key = String(params[0]);
    const windowStart = (params[1] as Date).getTime();
    const existing = counters.get(key);
    if (!existing || existing.windowStart !== windowStart) {
      counters.set(key, { windowStart, count: 1 });
    } else {
      existing.count += 1;
    }
    return { rows: [{ count: counters.get(key)!.count }] };
  };
  return { query, calls };
}

describe("createPgRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows a normal-usage burst up to the max within a window", async () => {
    const { query } = makeStubQuery();
    const limiter = createPgRateLimiter({ query, keyPrefix: "money-write", windowMs: 60_000, max: 5 });
    const req = makeReq();

    for (let i = 0; i < 5; i++) {
      const next = vi.fn();
      await limiter(req, makeRes().res, next);
      expect(next).toHaveBeenCalledOnce();
    }
  });

  it("returns 429 once a limited route is hit past its threshold", async () => {
    const { query } = makeStubQuery();
    const limiter = createPgRateLimiter({
      query,
      keyPrefix: "auth-verify",
      windowMs: 60_000,
      max: 3,
      message: "Slow down!",
    });
    const req = makeReq();

    // Exhaust the quota (3 allowed).
    for (let i = 0; i < 3; i++) {
      const next = vi.fn();
      await limiter(req, makeRes().res, next);
      expect(next).toHaveBeenCalledOnce();
    }

    // 4th request is blocked.
    const next = vi.fn();
    const ctx = makeRes();
    await limiter(req, ctx.res, next);

    expect(ctx.statusCode).toBe(429);
    expect((ctx.body as { message?: string })?.message).toBe("Slow down!");
    expect(ctx.headers["Retry-After"]).toBeDefined();
    expect(Number(ctx.headers["Retry-After"])).toBeGreaterThan(0);
    expect(next).not.toHaveBeenCalled();
  });

  it("resets after the fixed window advances", async () => {
    const { query } = makeStubQuery();
    const limiter = createPgRateLimiter({ query, keyPrefix: "auth-request", windowMs: 60_000, max: 1 });
    const req = makeReq();

    await limiter(req, makeRes().res, vi.fn()); // consume quota
    const blocked = makeRes();
    await limiter(req, blocked.res, vi.fn());
    expect(blocked.statusCode).toBe(429);

    // Next window — counter resets.
    vi.advanceTimersByTime(60_001);
    const next = vi.fn();
    await limiter(req, makeRes().res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("tracks different tiers (keyPrefix) independently on the same IP", async () => {
    const { query, calls } = makeStubQuery();
    const money = createPgRateLimiter({ query, keyPrefix: "money-write", windowMs: 60_000, max: 1 });
    const auth = createPgRateLimiter({ query, keyPrefix: "auth-verify", windowMs: 60_000, max: 1 });
    const req = makeReq({ ip: "10.0.0.9" });

    await money(req, makeRes().res, vi.fn()); // consume money quota
    const next = vi.fn();
    await auth(req, makeRes().res, next); // auth is a different bucket → allowed
    expect(next).toHaveBeenCalledOnce();

    // Keys are namespaced by tier + ip.
    expect(calls[0][0]).toBe("money-write:10.0.0.9");
    expect(calls[1][0]).toBe("auth-verify:10.0.0.9");
  });

  it("FAILS OPEN to the in-memory limiter when Postgres errors", async () => {
    const failing: RateLimitQuery = async () => {
      throw new Error("connection terminated");
    };
    const onFallback = vi.fn();
    const limiter = createPgRateLimiter({
      query: failing,
      keyPrefix: "money-write",
      windowMs: 60_000,
      max: 2,
      onFallback,
    });
    const req = makeReq();

    // Despite the DB being down, the first requests pass (fail-open) and the
    // in-memory fallback still enforces the same limit per-machine.
    const first = vi.fn();
    await limiter(req, makeRes().res, first);
    expect(first).toHaveBeenCalledOnce();
    expect(onFallback).toHaveBeenCalled();

    await limiter(req, makeRes().res, vi.fn()); // 2nd allowed
    const blockedCtx = makeRes();
    const blockedNext = vi.fn();
    await limiter(req, blockedCtx.res, blockedNext); // 3rd blocked by the fallback
    expect(blockedCtx.statusCode).toBe(429);
    expect(blockedNext).not.toHaveBeenCalled();
  });
});
