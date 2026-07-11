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

/**
 * Initialize Sentry server-side. Safe to call repeatedly — only the first
 * call wires anything. No-op when `SENTRY_DSN` is unset (local dev path).
 */
export async function initServerObservability(
  cfg: ServerObservabilityConfig = readServerObservabilityConfig(),
): Promise<void> {
  if (initialized) return;
  initialized = true;
  if (!cfg.dsn) {
    log("[observability] SENTRY_DSN not set; server-side error reporting disabled");
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

/** Test-only: reset the init latch + Sentry ref so each case starts clean. */
export function __resetServerObservabilityForTest(): void {
  initialized = false;
  sentryRef = null;
}

export interface ObservabilityConfigAssertion {
  /** True when a DSN is present (Sentry can actually capture). */
  configured: boolean;
  /** True when we emitted a loud "observability disabled in prod" warning. */
  warned: boolean;
}

/**
 * Boot-time assertion (A-OPS-003 / CQ-009) — make the "Sentry silently no-ops in
 * production" failure LOUD so it can never regress unnoticed again.
 *
 *   - non-production                       → silent ok (local dev / tests / preview)
 *   - production + DSN present             → ok
 *   - production + DSN absent + strict     → THROWS (aborts boot; mirrors the
 *                                            BLINDSPOT F7 Plaid env-flip guard —
 *                                            "make the safe order mechanical")
 *   - production + DSN absent + non-strict → LOUD error-level log, no throw
 *                                            (default: never brick prod on a
 *                                            missing observability secret)
 *
 * `strict` defaults from `SENTRY_STRICT` ("1"/"true"/"yes"/"on"). Set it once the
 * DSN secret is provisioned so a future deploy that drops the secret hard-fails.
 */
export function assertServerObservabilityConfigured(
  cfg: ServerObservabilityConfig = readServerObservabilityConfig(),
  opts: { strict?: boolean } = {},
): ObservabilityConfigAssertion {
  const isProd = cfg.environment === "production";
  if (!isProd) {
    return { configured: Boolean(cfg.dsn), warned: false };
  }
  if (cfg.dsn) {
    return { configured: true, warned: false };
  }

  const strictRaw = (process.env.SENTRY_STRICT ?? "").trim().toLowerCase();
  const strict = opts.strict ?? (strictRaw === "1" || strictRaw === "true" || strictRaw === "yes" || strictRaw === "on");

  const message =
    "[observability] SENTRY_DSN is UNSET in production — server error reporting is DISABLED. " +
    "Set the SENTRY_DSN Fly secret + redeploy so production exceptions are captured. " +
    "(Set SENTRY_STRICT=1 to make a missing DSN hard-fail the boot.)";

  if (strict) {
    // Loud + fatal — aborts boot, exactly like the F7 Plaid guard.
    throw new Error(message);
  }
  // Loud but non-fatal — the app still boots (observability being down must not
  // take prod down), but the miss is unmissable in the logs + health surface.
  log(`ERROR ${message}`);
  return { configured: false, warned: true };
}
