/**
 * Lightweight analytics wrapper.
 * No-ops gracefully when GA is disabled (no env var) or consent not given.
 */

/** Track a custom event. */
export function trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, params);
}

/** Track a page view (call on route change). */
export function trackPageView(path: string, title?: string): void {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: title ?? document.title,
  });
}
