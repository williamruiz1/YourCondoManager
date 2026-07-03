/**
 * Pricing-correctness test for the signup page (the "$30 stale price" bug).
 *
 * Asserts:
 *   1. The shared resolver NEVER routes an unrecognized slug to the stale PM
 *      $30 per-complex fallback — it lands on the self-managed track, and the
 *      tier-specific PM slugs (Starter/Growth/Scale) resolve to their real
 *      plan_catalog keys.
 *   2. The signup page on the self-managed track shows the CORRECT current
 *      Small Community floor ($129/mo) and NO "$30" anywhere — matching the
 *      live pricing page.
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { resolveSignupPlan } from "../shared/signup-plan-keys";
import PlanSignupPage from "../client/src/pages/plan-signup";

// ── 1. Shared resolver — never the stale $30 PM fallback ──────────────────────

describe("resolveSignupPlan (signup → plan_catalog tier)", () => {
  it("maps the self-managed slug to the SM track (tier derived from unit count)", () => {
    expect(resolveSignupPlan("self-managed")).toEqual({
      track: "self-managed",
      planKey: null,
    });
  });

  it("maps PM tier slugs to their real plan_catalog keys (no $30 fallback)", () => {
    expect(resolveSignupPlan("property-manager-starter")).toEqual({
      track: "property-manager",
      planKey: "pm_starter",
    });
    expect(resolveSignupPlan("property-manager-growth")).toEqual({
      track: "property-manager",
      planKey: "pm_growth",
    });
    expect(resolveSignupPlan("property-manager-scale")).toEqual({
      track: "property-manager",
      planKey: "pm_scale",
    });
  });

  it("routes an UNRECOGNIZED slug to self-managed — NEVER the stale PM $30 fallback", () => {
    const r = resolveSignupPlan("something-bogus");
    expect(r.track).toBe("self-managed");
    // The old bug fell back to PM ($30); the safe default is the SM track.
    expect(r.track).not.toBe("property-manager");
  });

  it("maps the bare property-manager slug to the entry tier (pm_starter)", () => {
    expect(resolveSignupPlan("property-manager")).toEqual({
      track: "property-manager",
      planKey: "pm_starter",
    });
  });
});

// ── 2. Signup page — self-managed track shows $129, never $30 ─────────────────

function setSearch(search: string) {
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, search, assign: vi.fn(), href: "" },
  });
}

describe("PlanSignupPage — self-managed pricing (no $30 stale price)", () => {
  const origLocation = window.location;

  beforeEach(() => {
    // /api/auth/me → unauthenticated, so the page renders the form (not redirect).
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ authenticated: false }), { status: 200 }),
      ),
    );
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { writable: true, value: origLocation });
    vi.unstubAllGlobals();
  });

  it("shows the Small Community floor ($129/mo) and NO '$30' on the self-managed track", () => {
    setSearch("?plan=self-managed");
    render(<PlanSignupPage />);

    // The self-managed left panel headline price is the real floor, not "$30".
    expect(screen.getByText("From $129/mo")).toBeTruthy();

    // The stale "$30" per-complex price must NOT appear anywhere on the page.
    expect(screen.queryByText(/\$30\b/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/\$30\b/);
  });
});
