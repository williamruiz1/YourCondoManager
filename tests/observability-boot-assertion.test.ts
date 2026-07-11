/**
 * Sentry / observability boot-assertion tests — founder-os#10742
 * (audit findings A-OPS-003 + CQ-009).
 *
 * The gap these close: Sentry was wired via dynamic import on both server and
 * client, but was a silent no-op in production (SDKs uninstalled, DSNs empty),
 * so a money app was blind to unhandled production errors. This suite locks in:
 *   - the boot-time prod assertion is LOUD (error-level) when SENTRY_DSN is
 *     unset in production, and HARD-FAILS the boot when SENTRY_ENFORCE=1;
 *   - it stays quiet+no-op outside production (local dev / test path);
 *   - a real server error is captured via the injectable Sentry loader seam
 *     (proves the capture path without needing the SDK physically present).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  assertServerObservabilityConfig,
  type ServerObservabilityConfig,
} from "../server/observability";

const base = (over: Partial<ServerObservabilityConfig> = {}): ServerObservabilityConfig => ({
  dsn: null,
  environment: "development",
  release: null,
  ...over,
});

describe("assertServerObservabilityConfig (boot-time prod assertion)", () => {
  it("prod + DSN unset → ERROR-level, not ok (the A-OPS-003/CQ-009 case)", () => {
    const a = assertServerObservabilityConfig(base({ environment: "production", dsn: null }));
    expect(a.ok).toBe(false);
    expect(a.level).toBe("error");
    expect(a.message).toMatch(/SENTRY_DSN is UNSET in production/i);
  });

  it("prod + DSN set → ok", () => {
    const a = assertServerObservabilityConfig(
      base({ environment: "production", dsn: "https://abc@o1.ingest.sentry.io/1" }),
    );
    expect(a.ok).toBe(true);
    expect(a.level).toBe("ok");
  });

  it("non-prod + DSN unset → warn but ok (expected local/test path)", () => {
    const a = assertServerObservabilityConfig(base({ environment: "development", dsn: null }));
    expect(a.ok).toBe(true);
    expect(a.level).toBe("warn");
  });
});

describe("initServerObservability (boot behavior + capture seam)", () => {
  const savedEnforce = process.env.SENTRY_ENFORCE;

  beforeEach(() => {
    vi.resetModules(); // reset the module-level singleton (initialized/sentryRef)
    delete process.env.SENTRY_ENFORCE;
  });
  afterEach(() => {
    if (savedEnforce === undefined) delete process.env.SENTRY_ENFORCE;
    else process.env.SENTRY_ENFORCE = savedEnforce;
  });

  it("prod + no DSN + SENTRY_ENFORCE=1 → throws (fails the boot loudly)", async () => {
    process.env.SENTRY_ENFORCE = "1";
    const mod = await import("../server/observability");
    await expect(
      mod.initServerObservability({ dsn: null, environment: "production", release: null }),
    ).rejects.toThrow(/SENTRY_DSN is UNSET in production/i);
  });

  it("prod + no DSN + no enforce → does NOT throw (loud-warn default; won't crash prod pre-secret)", async () => {
    const mod = await import("../server/observability");
    await expect(
      mod.initServerObservability({ dsn: null, environment: "production", release: null }),
    ).resolves.toBeUndefined();
    expect(mod.isServerObservabilityInitialized()).toBe(false);
  });

  it("captures a server error through the injected Sentry loader seam", async () => {
    const captureException = vi.fn();
    const init = vi.fn();
    const mod = await import("../server/observability");
    await mod.initServerObservability({
      dsn: "https://abc@o1.ingest.sentry.io/1",
      environment: "test",
      release: "test-release",
      loader: async () => ({ init, captureException }),
    });
    expect(init).toHaveBeenCalledOnce();
    expect(mod.isServerObservabilityInitialized()).toBe(true);

    mod.captureServerError(new Error("boom"), { source: "unit-test" });
    expect(captureException).toHaveBeenCalledOnce();
    const [err, opts] = captureException.mock.calls[0];
    expect((err as Error).message).toBe("boom");
    expect(opts).toEqual({ extra: { source: "unit-test" } });
  });
});
