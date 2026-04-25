// zone: shared
//
// 5.8 — prefers-reduced-motion helper (Wave 29).
//
// Spec: docs/projects/platform-overhaul/decisions/5.8-motion-reduce-audit.md
//
// Tiny utility to detect the user's OS-level "reduce motion" preference at
// runtime. Use this for imperative motion (e.g. `scrollIntoView({ behavior })`)
// where Tailwind's `motion-reduce:` variant cannot reach. Decorative CSS
// animations should be suppressed via `motion-reduce:` classes — not this
// helper — so server-rendered markup is correct on first paint.

/**
 * Returns `true` when the user has requested reduced motion at the OS level.
 *
 * SSR-safe: returns `false` when `window` is unavailable.
 *
 * The result is read once per call; we do not cache because the OS preference
 * can change at runtime (macOS toggle, system-wide zoom, etc.) and we want the
 * latest value at the moment a scroll/animation imperative fires.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Returns the appropriate `ScrollBehavior` value for the current user's
 * preference: `"auto"` (instant) when reduce-motion is set, `"smooth"`
 * otherwise.
 *
 * Use with `element.scrollIntoView(getScrollBehavior(...))` or `window.scrollTo`.
 */
export function getScrollBehavior(
  preferred: ScrollBehavior = "smooth",
): ScrollBehavior {
  if (preferred === "auto") return "auto";
  return prefersReducedMotion() ? "auto" : preferred;
}
