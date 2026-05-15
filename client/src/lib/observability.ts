// Client-side observability bootstrap (Issue founder-os#1030).
//
// Wires Sentry React SDK + GA4 (gtag) when their respective env vars are
// set at build time. Both surfaces degrade to no-ops when their env var
// is absent so local dev and preview builds don't need credentials.
//
// Build-time env (read from `import.meta.env`):
//   - VITE_SENTRY_DSN          — Sentry DSN; absent → SDK no-op
//   - VITE_GA_MEASUREMENT_ID   — GA4 Measurement ID (G-XXXXXXX); absent → gtag no-op
//   - VITE_APP_ENV             — environment label ("production" / "preview" / "dev")
//
// Why this is a single module (vs split sentry/ga modules):
//   - Single call site from `client/src/main.tsx` (`initClientObservability`)
//   - Single deactivation point if observability is ever scoped down
//   - Shared dev-mode logging keeps the local-dev signal in one place

// Loose typing — `@sentry/react` is dynamically imported so the package
// can be added by William's INSTALL-OBSERVABILITY.md runbook. A proper
// `typeof import("@sentry/react")` ref would force the package to be
// present at typecheck time.
interface SentryReactSurface {
  init: (opts: Record<string, unknown>) => void;
  captureException: (err: unknown, opts?: { extra?: Record<string, unknown> }) => void;
}
type SentryReactModule = SentryReactSurface;

let sentryRef: SentryReactModule | null = null;
let initialized = false;
let ga4Loaded = false;

interface ClientObservabilityConfig {
  sentryDsn: string | null;
  gaMeasurementId: string | null;
  environment: string;
}

function readConfig(): ClientObservabilityConfig {
  // Vite typing: import.meta.env is a plain object; we read defensively.
  const env = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env ?? {};
  return {
    sentryDsn: env.VITE_SENTRY_DSN ?? null,
    gaMeasurementId: env.VITE_GA_MEASUREMENT_ID ?? null,
    environment: env.VITE_APP_ENV ?? env.MODE ?? "development",
  };
}

/**
 * Inject the GA4 gtag.js script + initial `config` call. No-op when
 * `VITE_GA_MEASUREMENT_ID` is absent. Idempotent — guarded by `ga4Loaded`.
 */
function loadGA4(measurementId: string, environment: string): void {
  if (ga4Loaded) return;
  ga4Loaded = true;

  const w = window as typeof window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag(...args: unknown[]): void {
    w.dataLayer!.push(args);
  };
  w.gtag("js", new Date());
  w.gtag("config", measurementId, { app_env: environment });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  // eslint-disable-next-line no-console
  console.log(`[observability] GA4 initialized (id=${measurementId}, env=${environment})`);
}

/**
 * Initialize Sentry React SDK. No-op when `VITE_SENTRY_DSN` is absent or
 * when the package isn't installed yet. Async because Sentry's React SDK
 * is loaded lazily via dynamic import to keep first-paint fast.
 */
async function initSentryReact(dsn: string, environment: string): Promise<void> {
  try {
    // Indirect through a runtime variable so Vite's static import-analysis
    // cannot resolve the specifier at build / test-runner scan time. The
    // `/* @vite-ignore */` annotation alone is not enough — Vite still
    // attempts resolution when the literal string is right at the call
    // site, breaking vitest in CI before the package is installed.
    // The `import()` falls through to the catch block at runtime when
    // `@sentry/react` isn't installed yet (the documented intent here).
    const sentryReactSpecifier = "@sentry/react";
    const Sentry = (await import(/* @vite-ignore */ sentryReactSpecifier)) as SentryReactModule;
    Sentry.init({
      dsn,
      environment,
      // Conservative trace + replay sample rates — adjustable via env
      // when a perf-investigation needs more data.
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0.1,
    });
    sentryRef = Sentry;
    // eslint-disable-next-line no-console
    console.log(`[observability] Sentry React SDK initialized (env=${environment})`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[observability] Sentry React SDK init failed (likely package not installed yet):",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Initialize all client observability surfaces. Call ONCE from
 * `client/src/main.tsx` BEFORE `createRoot().render(<App />)`.
 *
 * Safe to call repeatedly — second-and-later calls no-op via the
 * `initialized` latch.
 */
export async function initClientObservability(): Promise<void> {
  if (initialized) return;
  initialized = true;
  const cfg = readConfig();
  if (cfg.gaMeasurementId) {
    loadGA4(cfg.gaMeasurementId, cfg.environment);
  } else {
    // eslint-disable-next-line no-console
    console.log("[observability] VITE_GA_MEASUREMENT_ID not set; GA4 disabled");
  }
  if (cfg.sentryDsn) {
    await initSentryReact(cfg.sentryDsn, cfg.environment);
  } else {
    // eslint-disable-next-line no-console
    console.log("[observability] VITE_SENTRY_DSN not set; Sentry React SDK disabled");
  }
}

/**
 * Report a client-side error to Sentry. No-op when Sentry isn't
 * initialized. Always also writes to `console.error` so the local dev
 * surface keeps the error visible.
 */
export function captureClientError(error: unknown, context?: Record<string, unknown>): void {
  const normalized =
    error instanceof Error
      ? error
      : new Error(typeof error === "string" ? error : JSON.stringify(error ?? "unknown"));
  // eslint-disable-next-line no-console
  console.error("[captureClientError]", normalized.message, context ?? {});
  if (sentryRef) {
    try {
      sentryRef.captureException(normalized, context ? { extra: context } : undefined);
    } catch {
      // Sentry must never crash the render path.
    }
  }
}

/**
 * Emit a GA4 custom event. No-op when GA4 isn't configured. Use for
 * smoke-tests and key product events (signups, payments, etc.). Avoid
 * naming collisions with built-in GA4 events.
 */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  const w = window as typeof window & { gtag?: (...args: unknown[]) => void };
  if (typeof w.gtag !== "function") return;
  w.gtag("event", name, params ?? {});
}

/** Exposed for tests + smoke-test surfaces. */
export function isClientObservabilityInitialized(): boolean {
  return initialized;
}
