/**
 * 5.4 — Perf smoke test.
 *
 * Spec: docs/projects/platform-overhaul/decisions/5.4-performance-audit.md
 *
 * This is a BASELINE, not a regression gate. It times a minimal in-
 * memory operation (the alert `canAccessAlert` predicate applied to 50
 * synthetic alerts) and asserts it completes in < 500ms. If this ever
 * fires, something has regressed catastrophically — the real signal
 * lives in the documented recommendations in the audit artifact.
 *
 * We use `canAccessAlert` specifically because it's a pure function
 * with no IO — any slowness here would indicate algorithmic regression
 * rather than environmental noise.
 */

import { describe, it, expect } from "vitest";
import { canAccessAlert } from "../server/alerts/can-access-alert";
import { FEATURE_DOMAINS } from "../server/alerts/types";

describe("5.4 perf smoke — canAccessAlert over 50 alerts", () => {
  it("completes in under 500ms", () => {
    // Synthesize 50 alert-like records, each mapped to a feature domain.
    const domains = Object.values(FEATURE_DOMAINS);
    const alerts = Array.from({ length: 50 }, (_, i) => ({
      id: `alert-${i}`,
      featureDomain: domains[i % domains.length],
    }));

    const persona = "manager" as const;
    const toggles = {};

    const start = performance.now();
    const filtered = alerts.filter((a) =>
      canAccessAlert(persona, a.featureDomain, toggles),
    );
    const elapsed = performance.now() - start;

    // Sanity — Manager should see all 50 since the predicate early-exits
    // to true for Manager/Platform-Admin.
    expect(filtered.length).toBe(50);
    // Baseline: < 500ms is embarrassingly generous for 50 pure-function
    // calls. This is a "nothing regressed catastrophically" gate, not
    // a real perf bound.
    expect(elapsed).toBeLessThan(500);
  });
});
