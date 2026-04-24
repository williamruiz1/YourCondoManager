// zone: shared
//
// 5.2 — Error reporting helper.
//
// Spec: docs/projects/platform-overhaul/decisions/5.2-error-states.md (AC #4)
//
// Single seam for future observability integration (Sentry / Datadog /
// OpenTelemetry). For Wave 14 this is a console-log shim + a TODO. No
// external dependency is introduced.
//
// Call from: ErrorBoundary.componentDidCatch, mutation onError handlers,
// async worker failure paths — anywhere you'd otherwise drop a silent
// console.error.

/**
 * Report an error with optional context. Wave 14 implementation writes
 * to `console.error` with a `[reportError]` prefix so it's greppable in
 * logs but does not ship elsewhere.
 *
 * TODO: wire a real transport (Sentry / Datadog RUM / custom endpoint)
 * once the observability workstream lands. When that happens, this
 * function is the only call site that needs to change.
 */
export function reportError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  // Normalize to an Error so consumers have a stable shape to inspect.
  const normalized =
    error instanceof Error
      ? error
      : new Error(
          typeof error === "string" ? error : JSON.stringify(error ?? "unknown"),
        );

  // TODO(5.2): replace with real transport once observability workstream
  // lands. Until then, console.error is the only destination.
  console.error("[reportError]", normalized.message, {
    stack: normalized.stack,
    ...context,
  });
}
