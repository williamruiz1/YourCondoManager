/**
 * useDocumentTitle — the SOLE mechanism for setting `document.title` in YCM.
 *
 * Per 1.4 Page Title Consistency (Q1, Q2, Q5, Q6):
 * - Format: `{title} — YCM` (em dash U+2014, space on each side, uppercase YCM).
 * - Hook updates on mount and whenever the `title` argument changes.
 * - Idempotent: does not re-write `document.title` if it already matches.
 * - Direct `document.title = ...` assignments elsewhere are forbidden and
 *   flagged by the `no-restricted-syntax` ESLint rule scoped to `client/**`.
 *
 * Prohibition (Q5): "Dashboard" is not a valid user-facing page title.
 * Any future page that would pass `"Dashboard"` to this hook must use a
 * specific descriptive title instead (e.g., "Association Overview").
 *
 * @param title - The page-specific title. Must be a non-empty string.
 */
import { useEffect } from "react";

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const next = `${title} — YCM`;
    // Idempotence: skip the DOM write when document.title already matches.
    if (typeof document !== "undefined" && document.title !== next) {
      // eslint-disable-next-line no-restricted-syntax -- sole permitted writer of document.title (1.4 Q6)
      document.title = next;
    }
  }, [title]);
}
