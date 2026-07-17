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

  it("uses a custom keyGenerator instead of req.ip when provided", () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 1,
      keyGenerator: (req) => `acct:${(req as unknown as { acctId?: string }).acctId ?? "none"}`,
    });
    const reqA = { ...makeReq({ ip: "10.0.0.1" }), acctId: "alice" } as Request;
    const reqB = { ...makeReq({ ip: "10.0.0.1" }), acctId: "bob" } as Request;

    limiter(reqA, makeRes().res, vi.fn()); // consume alice's quota

    // Same IP, different account key → bob is unaffected.
    const nextB = vi.fn();
    limiter(reqB, makeRes().res, nextB);
    expect(nextB).toHaveBeenCalledOnce();

    // Alice, same account key, is still blocked.
    const nextA = vi.fn();
    const ctxA = makeRes();
    limiter(reqA, ctxA.res, nextA);
    expect(ctxA.statusCode).toBe(429);
    expect(nextA).not.toHaveBeenCalled();
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

  // ── keyGenerator (2026-07-17 auth rate-limit rebalance) ──────────────────
  //
  // These lock in the shared-IP fix: `/api/portal/verify-login` previously
  // keyed auth-verify by bare IP, so any two unrelated accounts behind the
  // same NAT/VPN/shared WiFi shared one budget. See docs/rate-limiting.md
  // §"auth-verify account+IP keying".

  function authVerifyKeyFixture(req: Request): string {
    const ip = req.ip ?? "unknown";
    const body = (req as unknown as { body?: { email?: unknown } }).body;
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email) return `${email}:${ip}`;
    const token = (req as unknown as { params?: { token?: string } }).params?.token;
    if (typeof token === "string" && token) return `tok-${token}:${ip}`;
    return ip;
  }

  it("keys by account+IP, not bare IP — two accounts on the same IP do not share a budget", async () => {
    const { query, calls } = makeStubQuery();
    const limiter = createPgRateLimiter({
      query,
      keyPrefix: "auth-verify",
      windowMs: 10 * 60_000,
      max: 1,
      keyGenerator: authVerifyKeyFixture,
    });
    const sameIp = "10.0.0.42";
    const reqAlice = { ...makeReq({ ip: sameIp }), body: { email: "alice@example.com" } } as unknown as Request;
    const reqBob = { ...makeReq({ ip: sameIp }), body: { email: "bob@example.com" } } as unknown as Request;

    // Alice exhausts her own budget.
    await limiter(reqAlice, makeRes().res, vi.fn());
    const aliceBlocked = makeRes();
    const aliceNext = vi.fn();
    await limiter(reqAlice, aliceBlocked.res, aliceNext);
    expect(aliceBlocked.statusCode).toBe(429);
    expect(aliceNext).not.toHaveBeenCalled();

    // Bob, same IP, different account — unaffected (the shared-IP fix).
    const bobNext = vi.fn();
    await limiter(reqBob, makeRes().res, bobNext);
    expect(bobNext).toHaveBeenCalledOnce();

    expect(calls[0][0]).toBe("auth-verify:alice@example.com:10.0.0.42");
    expect(calls[2][0]).toBe("auth-verify:bob@example.com:10.0.0.42");
  });

  it("covers the two-call portal picker flow (verify + pick) within the raised ceiling", async () => {
    // Mirrors client/src/components/owner-portal-login-container.tsx: a
    // multi-association account calls verify-login once with just the OTP,
    // then again with the chosen associationId — same email, same endpoint.
    const { query } = makeStubQuery();
    const limiter = createPgRateLimiter({
      query,
      keyPrefix: "auth-verify",
      windowMs: 10 * 60_000,
      max: 15, // the live server/index.ts ceiling for auth-verify
      keyGenerator: authVerifyKeyFixture,
    });
    const req = { ...makeReq({ ip: "203.0.113.5" }), body: { email: "owner@example.com" } } as unknown as Request;

    // A login attempt that trips over a wrong-code retry, then succeeds and
    // completes the two-call picker flow — 3 calls total, comfortably under
    // the new ceiling where the OLD ceiling (5, pre-Postgres-migration) would
    // have already been at 3/5 after just this one login.
    for (let i = 0; i < 3; i++) {
      const next = vi.fn();
      await limiter(req, makeRes().res, next);
      expect(next).toHaveBeenCalledOnce();
    }
  });

  it("falls back to bare IP when the request has no email or token (e.g. a bodyless health-check route)", async () => {
    const { query, calls } = makeStubQuery();
    const limiter = createPgRateLimiter({
      query,
      keyPrefix: "auth-verify",
      windowMs: 60_000,
      max: 5,
      keyGenerator: authVerifyKeyFixture,
    });
    const req = makeReq({ ip: "198.51.100.9" }); // no body at all

    await limiter(req, makeRes().res, vi.fn());
    expect(calls[0][0]).toBe("auth-verify:198.51.100.9");
  });

  it("keys election-ballot-style requests by token+IP via the :token param fallback", async () => {
    const { query, calls } = makeStubQuery();
    const limiter = createPgRateLimiter({
      query,
      keyPrefix: "auth-verify",
      windowMs: 60_000,
      max: 5,
      keyGenerator: authVerifyKeyFixture,
    });
    const req = { ...makeReq({ ip: "198.51.100.9" }), params: { token: "ballot-abc123" } } as unknown as Request;

    await limiter(req, makeRes().res, vi.fn());
    expect(calls[0][0]).toBe("auth-verify:tok-ballot-abc123:198.51.100.9");
  });

  it("the fail-open in-memory fallback preserves the same keyGenerator (no silent widen-to-IP-only during a DB outage)", async () => {
    const failing: RateLimitQuery = async () => {
      throw new Error("connection terminated");
    };
    const limiter = createPgRateLimiter({
      query: failing,
      keyPrefix: "auth-verify",
      windowMs: 60_000,
      max: 1,
      keyGenerator: authVerifyKeyFixture,
    });
    const sameIp = "10.0.0.42";
    const reqAlice = { ...makeReq({ ip: sameIp }), body: { email: "alice@example.com" } } as unknown as Request;
    const reqBob = { ...makeReq({ ip: sameIp }), body: { email: "bob@example.com" } } as unknown as Request;

    await limiter(reqAlice, makeRes().res, vi.fn()); // consume alice's fallback quota

    const bobNext = vi.fn();
    await limiter(reqBob, makeRes().res, bobNext);
    expect(bobNext).toHaveBeenCalledOnce(); // bob unaffected even in fail-open mode
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
