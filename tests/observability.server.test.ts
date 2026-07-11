/**
 * Server observability — Sentry capture + boot-time assertion (A-OPS-003 / CQ-009).
 *
 * Proves:
 *   - a server error is CAPTURED by Sentry once initialized (via the loader seam);
 *   - the boot-time assertion fails LOUD (or hard) when SENTRY_DSN is unset in
 *     production, so the silent-no-op can never regress unnoticed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  initServerObservability,
  captureServerError,
  isServerObservabilityInitialized,
  assertServerObservabilityConfigured,
  __resetServerObservabilityForTest,
} from "../server/observability";

function fakeSentry() {
  return { init: vi.fn(), captureException: vi.fn() };
}

beforeEach(() => {
  __resetServerObservabilityForTest();
  delete process.env.SENTRY_STRICT;
});
afterEach(() => {
  __resetServerObservabilityForTest();
  delete process.env.SENTRY_STRICT;
});

describe("captureServerError → Sentry", () => {
  it("captures a server error once Sentry is initialized (loader seam)", async () => {
    const sentry = fakeSentry();
    await initServerObservability({
      dsn: "https://pub@o1.ingest.sentry.io/1",
      environment: "production",
      loader: async () => sentry,
    });
    expect(isServerObservabilityInitialized()).toBe(true);

    const err = new Error("payment flow 500");
    captureServerError(err, { route: "/api/pay" });
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(err, { extra: { route: "/api/pay" } });
  });

  it("no-ops safely (no throw) when Sentry is not initialized (no DSN)", async () => {
    await initServerObservability({ dsn: null, environment: "development" });
    expect(isServerObservabilityInitialized()).toBe(false);
    // Must not throw — reporting is best-effort and never crashes the request path.
    expect(() => captureServerError(new Error("x"))).not.toThrow();
  });
});

describe("assertServerObservabilityConfigured — boot-time prod assertion", () => {
  it("production + DSN absent + STRICT → throws loudly (aborts boot)", () => {
    expect(() =>
      assertServerObservabilityConfigured({ dsn: null, environment: "production" }, { strict: true }),
    ).toThrow(/SENTRY_DSN is UNSET in production/);
  });

  it("production + DSN absent + non-strict → loud warn, does NOT throw", () => {
    const out = assertServerObservabilityConfigured({ dsn: null, environment: "production" }, { strict: false });
    expect(out).toEqual({ configured: false, warned: true });
  });

  it("SENTRY_STRICT=1 env upgrades the missing-DSN case to a hard fail", () => {
    process.env.SENTRY_STRICT = "1";
    expect(() =>
      assertServerObservabilityConfigured({ dsn: null, environment: "production" }),
    ).toThrow(/SENTRY_DSN is UNSET/);
  });

  it("production + DSN present → configured, no warning", () => {
    const out = assertServerObservabilityConfigured({
      dsn: "https://pub@o1.ingest.sentry.io/1",
      environment: "production",
    });
    expect(out).toEqual({ configured: true, warned: false });
  });

  it("non-production is a silent no-op (never warns, never throws)", () => {
    const out = assertServerObservabilityConfigured({ dsn: null, environment: "development" }, { strict: true });
    expect(out).toEqual({ configured: false, warned: false });
  });
});
