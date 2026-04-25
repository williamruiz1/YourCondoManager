// Wave 25 — Shared axe-core audit helper.
//
// Runs `@axe-core/playwright` against the current page state, asserts
// zero violations of severity `serious` or `critical`, and prints a
// concise summary to stdout for failure traces.
//
// The tag set (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) matches the
// WCAG 2.1 AA target documented in `5.5-accessibility-audit.md`. We
// deliberately do NOT include `best-practice` or `experimental` — they
// surface high-noise warnings that are not part of the locked Wave-21
// acceptance criteria.
//
// Usage:
//
//   import { runAxeAudit } from "./helpers/a11y-check";
//
//   test("flow", async ({ page }) => {
//     // … run the actual flow …
//     await runAxeAudit(page, "alerts-lifecycle");
//   });
//
// If a violation is found that is non-trivial to fix inline, callers
// can call `runAxeAuditSoft(page, label)` instead — that variant uses
// `expect.soft` so the test still reports the violation in the trace
// but does not fail the run. Use sparingly and file a follow-up
// workitem for each soft-failed surface.

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export interface AxeViolationSummary {
  id: string;
  impact: string | null;
  help: string;
  nodes: number;
}

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;

/**
 * Run an axe-core audit on the current page state. Asserts (hard) that
 * there are zero violations with impact `critical` or `serious`. Lower-
 * severity violations (`moderate`, `minor`) are reported in the console
 * but do not fail the test — the locked 5.7 threshold is "no
 * critical/serious".
 */
export async function runAxeAudit(page: Page, label = "page"): Promise<AxeViolationSummary[]> {
  const summary = await collectViolations(page, label);
  const blocking = summary.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(
    blocking,
    `axe found ${blocking.length} critical/serious violations on ${label}: ` +
      blocking.map((v) => `${v.id} (${v.impact}): ${v.help}`).join("; "),
  ).toHaveLength(0);
  return summary;
}

/**
 * Soft variant — same audit, but reports violations to stderr WITHOUT
 * adding to the test's accumulated failure set. Use only when a
 * violation is non-trivial to fix inline and a follow-up workitem has
 * been filed (or for ambient surfaces outside the Wave-21 locked 10).
 *
 * Note on Playwright `expect.soft` semantics: a `.soft` assertion still
 * marks the test as failed at the end of the run (it just lets
 * execution continue past the failed line). That defeats the purpose
 * of "report without failing" — so this helper deliberately does NOT
 * use `expect.soft`. It logs to stderr and returns the summary;
 * callers can promote to a hard `expect` against the return value if
 * they want a strict gate on a specific surface.
 */
export async function runAxeAuditSoft(page: Page, label = "page"): Promise<AxeViolationSummary[]> {
  const summary = await collectViolations(page, label);
  const blocking = summary.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  if (blocking.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[axe-${label}] SOFT-FAIL: ${blocking.length} critical/serious violation(s). ` +
        `Test continues; file a follow-up if not already tracked. ` +
        blocking.map((v) => `${v.id} (${v.impact}): ${v.help}`).join("; "),
    );
  }
  return summary;
}

async function collectViolations(page: Page, label: string): Promise<AxeViolationSummary[]> {
  const results = await new AxeBuilder({ page })
    .withTags([...WCAG_TAGS])
    .analyze();

  const summary: AxeViolationSummary[] = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? null,
    help: v.help,
    nodes: v.nodes.length,
  }));

  if (summary.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `[axe-${label}] ${summary.length} violation(s):`,
      summary.map((v) => `${v.id} (${v.impact ?? "unknown"}): ${v.help} [${v.nodes} node(s)]`),
    );
    // Verbose dump (target / html) — gated on env var so the default
    // CI noise stays low.
    if (process.env.AXE_VERBOSE === "1") {
      for (const v of results.violations) {
        for (const n of v.nodes) {
          // eslint-disable-next-line no-console
          console.error(
            `[axe-${label}] ${v.id}: target=${JSON.stringify(n.target)} html=${n.html.slice(0, 200)}`,
          );
        }
      }
    }
  } else {
    // eslint-disable-next-line no-console
    console.log(`[axe-${label}] OK — no violations.`);
  }

  return summary;
}
