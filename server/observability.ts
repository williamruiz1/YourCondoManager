// Server-side observability bootstrap (Issue founder-os#1030).
//
// Wires `@sentry/node` when `SENTRY_DSN` is set. If the env var is absent,
// this module is a no-op so local dev (and tests) don't need to install
// or configure Sentry. Production must set `SENTRY_DSN` as a Fly secret —
// see INSTALL-OBSERVABILITY.md.
//
// Why this module exists (vs inline init in server/index.ts):
//   - Keeps observability concerns out of the request-handling boot path
//   - Provides a single seam (`initServerObservability` + `captureServerError`)
//     so future migrations (Datadog, OpenTelemetry, etc.) touch one file
//
// Dependency note: `@sentry/node` is loaded via dynamic import so the
// module degrades to a no-op when the package isn't installed yet
// (William's first-time-setup path). After `npm install`, the dynamic
// import resolves normally and Sentry is wired.

import { log } from "./logger";

// Loose typing on purpose — `@sentry/node` is dynamically imported so the
// package can be added by William's INSTALL-OBSERVABILITY.md runbook. A
// proper `typeof import("@sentry/node")` ref would force the package to
// be present at typecheck time.
interface SentryServerSurface {
  init: (opts: Record<string, unknown>) => void;
  captureException: (err: unknown, opts?: { extra?: Record<string, unknown> }) => void;
}
type SentryModule = SentryServerSurface;

let sentryRef: SentryModule | null = null;
let initialized = false;

export interface ServerObservabilityConfig {
  dsn: string | null;
  environment: string;
  release?: string | null;
  /** Override for tests — defaults to `import("@sentry/node")`. */
  loader?: () => Promise<SentryModule>;
}

export function readServerObservabilityConfig(): ServerObservabilityConfig {
  return {
    dsn: process.env.SENTRY_DSN ?? null,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.SENTRY_RELEASE ?? process.env.FLY_MACHINE_ID ?? null,
  };
}

export interface ObservabilityAssertion {
  ok: boolean;
  level: "ok" | "warn" | "error";
  message: string;
}

/**
 * Boot-time observability assertion (A-OPS-003 / CQ-009).
 *
 * A money app must NOT be silently blind to production errors. When
 * `SENTRY_DSN` is unset in production this returns an `error`-level
 * assertion so `initServerObservability` can log it LOUDLY (and, when
 * `SENTRY_ENFORCE=1`, fail the boot) — closing the "wired but inert, no-op
 * in prod" gap so it can never silently regress again. Pure + testable.
 */
export function assertServerObservabilityConfig(
  cfg: ServerObservabilityConfig = readServerObservabilityConfig(),
): ObservabilityAssertion {
  if (cfg.dsn) {
    return { ok: true, level: "ok", message: "SENTRY_DSN configured; error reporting active" };
  }
  if (cfg.environment === "production") {
    return {
      ok: false,
      level: "error",
      message:
        "SENTRY_DSN is UNSET in production — server errors are NOT being captured. " +
        "Set the SENTRY_DSN Fly secret (see INSTALL-OBSERVABILITY.md). " +
        "Set SENTRY_ENFORCE=1 to hard-fail the boot instead of warning.",
    };
  }
  return {
    ok: true,
    level: "warn",
    message: `SENTRY_DSN unset (env=${cfg.environment}) — error reporting disabled (expected outside production)`,
  };
}

/**
 * Initialize Sentry server-side. Safe to call repeatedly — only the first
 * call wires anything. No-op when `SENTRY_DSN` is unset (local dev path),
 * but LOUD in production (see `assertServerObservabilityConfig`).
 */
export async function initServerObservability(
  cfg: ServerObservabilityConfig = readServerObservabilityConfig(),
): Promise<void> {
  if (initialized) return;
  initialized = true;
  if (!cfg.dsn) {
    const assertion = assertServerObservabilityConfig(cfg);
    if (assertion.level === "error") {
      // Loud, error-level banner so an unset prod DSN can never be missed.
      log(`[observability] CRITICAL: ${assertion.message}`);
      if (process.env.SENTRY_ENFORCE === "1") {
        throw new Error(`[observability] ${assertion.message}`);
      }
    } else {
      log(`[observability] ${assertion.message}`);
    }
    return;
  }
  try {
    // Indirect specifier through a runtime variable so static import
    // analysis (Vite / vitest scan) can't resolve the package before
    // William's install runbook adds it. See client-side observability.ts
    // for the same pattern + rationale.
    const sentryNodeSpecifier = "@sentry/node";
    const Sentry = cfg.loader
      ? await cfg.loader()
      : ((await import(/* @vite-ignore */ sentryNodeSpecifier)) as SentryModule);
    Sentry.init({
      dsn: cfg.dsn,
      environment: cfg.environment,
      release: cfg.release ?? undefined,
      // Conservative defaults — 0.1 trace sample rate keeps cost low; we
      // can dial up if a perf-investigation needs it.
      tracesSampleRate: 0.1,
      // Capture unhandled errors out of the box; downstream code can call
      // `captureServerError` for specific contexts.
    });
    sentryRef = Sentry;
    log(`[observability] Sentry server SDK initialized (env=${cfg.environment})`);
  } catch (err) {
    // The package may not be installed yet (first-deploy state). Log + continue
    // so the server still boots; William's INSTALL-OBSERVABILITY.md runbook
    // covers the `npm install @sentry/node` step.
    log(
      `[observability] Sentry server SDK init failed (likely package not installed): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

/**
 * Report a server-side error. No-op when Sentry isn't initialized. Always
 * also writes to the existing structured logger so the local dev experience
 * (and Fly logs) keep the error visible.
 */
export function captureServerError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const normalized =
    error instanceof Error
      ? error
      : new Error(typeof error === "string" ? error : JSON.stringify(error ?? "unknown"));
  log(`[captureServerError] ${normalized.message}${context ? ` ${JSON.stringify(context)}` : ""}`);
  if (sentryRef) {
    try {
      sentryRef.captureException(normalized, context ? { extra: context } : undefined);
    } catch {
      // Sentry surface failure must never crash the request path.
    }
  }
}

/** Exposed for tests + smoke-test route. */
export function isServerObservabilityInitialized(): boolean {
  return initialized && sentryRef !== null;
}
