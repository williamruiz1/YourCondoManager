/**
 * Client observability — Sentry capture + the ErrorBoundary→Sentry chain
 * (A-OPS-003 / CQ-009).
 *
 * Proves:
 *   - once initialized (via the loader seam) a client error is CAPTURED by Sentry;
 *   - the ErrorBoundary reporting path (reportError) forwards to Sentry;
 *   - with no DSN the surfaces safely no-op (no throw).
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  initClientObservability,
  captureClientError,
  isClientObservabilityInitialized,
  __resetClientObservabilityForTest,
} from "../client/src/lib/observability";
import { reportError } from "../client/src/lib/error-reporting";

function fakeSentry() {
  return { init: vi.fn(), captureException: vi.fn() };
}

beforeEach(() => {
  __resetClientObservabilityForTest();
  vi.unstubAllEnvs();
});
afterEach(() => {
  __resetClientObservabilityForTest();
  vi.unstubAllEnvs();
});

describe("client Sentry capture", () => {
  it("captures a client error once initialized (loader seam + VITE_SENTRY_DSN)", async () => {
    const sentry = fakeSentry();
    await initClientObservability({
      loader: async () => sentry,
      configOverride: { sentryDsn: "https://pub@o1.ingest.sentry.io/2" },
    });
    expect(isClientObservabilityInitialized()).toBe(true);
    expect(sentry.init).toHaveBeenCalledTimes(1);

    const err = new Error("render boom");
    captureClientError(err, { panel: "finance" });
    expect(sentry.captureException).toHaveBeenCalledWith(err, { extra: { panel: "finance" } });
  });

  it("ErrorBoundary path: reportError forwards to Sentry (componentDidCatch chain)", async () => {
    const sentry = fakeSentry();
    await initClientObservability({
      loader: async () => sentry,
      configOverride: { sentryDsn: "https://pub@o1.ingest.sentry.io/2" },
    });

    // This is exactly what ErrorBoundary.componentDidCatch calls.
    reportError(new Error("boundary boom"), { componentStack: "<App/>" });
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    const [captured, opts] = sentry.captureException.mock.calls[0];
    expect((captured as Error).message).toBe("boundary boom");
    expect(opts).toEqual({ extra: { componentStack: "<App/>" } });
  });

  it("no DSN → Sentry stays disabled and capture safely no-ops (no throw)", async () => {
    // VITE_SENTRY_DSN unset → initSentryReact never runs.
    await initClientObservability({ loader: async () => fakeSentry() });
    expect(() => captureClientError(new Error("x"))).not.toThrow();
    expect(() => reportError(new Error("y"))).not.toThrow();
  });
});
