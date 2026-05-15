// zone: shared
//
// 5.2 — Error reporting helper.
//
// Spec: docs/projects/platform-overhaul/decisions/5.2-error-states.md (AC #4)
//
// Single seam for observability integration. As of Issue founder-os#1030
// this routes to Sentry (when `VITE_SENTRY_DSN` is set at build time) via
// the `captureClientError` helper in `./observability.ts`. Local dev with
// no DSN still gets the `console.error` shim that originally lived here.
//
// Call from: ErrorBoundary.componentDidCatch, mutation onError handlers,
// async worker failure paths — anywhere you'd otherwise drop a silent
// console.error.

import { captureClientError } from "./observability";

/**
 * Report an error with optional context. Routes to Sentry when configured,
 * always also writes to console.error for local-dev visibility.
 *
 * Per founder-os#1030: this used to be a console-only shim with a TODO to
 * wire Sentry. The TODO is now closed — `captureClientError` is the real
 * transport, conditional on `VITE_SENTRY_DSN` being set at build time.
 */
export function reportError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  captureClientError(error, context);
}
