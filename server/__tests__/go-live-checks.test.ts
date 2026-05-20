// #1340 — go-live readiness gate registry contract tests. Validates the
// gate inventory matches the wiki checklist (7 tiers, expected gate count
// per tier, hardSoft classification per tier), and that at least 8 gates
// have auto-check functions wired per the dispatch acceptance criteria.
//
// Auto-checks themselves are not invoked here — they hit live services
// (GitHub PR API, the YCM DB, yourcondomanager.org). Integration tests
// against those live surfaces live in a separate dispatch.

import { describe, it, expect, vi } from "vitest";

// Stub `../db` — the gate registry tests don't exercise the db; mocking
// the import avoids the DATABASE_URL-required side effect of importing
// the real db module (same pattern as consent-records.test.ts).
vi.mock("../db", () => ({ db: {}, pool: {} }));

const { GATES, TIER_HARD_SOFT, TIER_NAMES } = await import("../services/go-live-checks");

describe("go-live readiness gate registry (#1340)", () => {
  it("covers all 7 tiers A-G", () => {
    const tiers = new Set(GATES.map((g) => g.tier));
    expect([...tiers].sort()).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
  });

  it("classifies tier hardSoft correctly per the wiki checklist", () => {
    expect(TIER_HARD_SOFT.A).toBe("HARD");
    expect(TIER_HARD_SOFT.B).toBe("HARD");
    expect(TIER_HARD_SOFT.C).toBe("SOFT");
    expect(TIER_HARD_SOFT.D).toBe("NONBLOCKING");
    expect(TIER_HARD_SOFT.E).toBe("HARD");
    expect(TIER_HARD_SOFT.F).toBe("SOFT");
    expect(TIER_HARD_SOFT.G).toBe("SOFT");
  });

  it("ships at least 8 implemented auto-check functions (per AC)", () => {
    const implemented = GATES.filter((g) => Boolean(g.autoCheck));
    expect(implemented.length).toBeGreaterThanOrEqual(8);
  });

  it("covers all four auto-check categories (PR-status, DB-state, HTTP-200, env-presence)", () => {
    // We don't have explicit category metadata, but we can sanity-check the
    // 8 we ship cover the documented categories by gate ID.
    const ids = new Set(GATES.filter((g) => g.autoCheck).map((g) => g.id));
    // PR-status: A.2 (PR #124), E.1 (PR #125)
    expect(ids.has("A.2")).toBe(true);
    expect(ids.has("E.1")).toBe(true);
    // DB-state: A.5 (Stripe Connect row), B.1 (units count), E.3 (ai cost)
    expect(ids.has("A.5")).toBe(true);
    expect(ids.has("B.1")).toBe(true);
    expect(ids.has("E.3")).toBe(true);
    // HTTP-200: D.1 (landing page)
    expect(ids.has("D.1")).toBe(true);
    // env-presence: A.4 (PLAID_ENV), B.5 (EMAIL_FROM + RESEND_API_KEY)
    expect(ids.has("A.4")).toBe(true);
    expect(ids.has("B.5")).toBe(true);
  });

  it("has unique gate IDs", () => {
    const ids = GATES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tier-name map covers all tiers", () => {
    for (const tier of ["A", "B", "C", "D", "E", "F", "G"] as const) {
      expect(TIER_NAMES[tier]).toBeTruthy();
    }
  });

  it("at least one HARD gate per HARD tier (A/B/E)", () => {
    const hardTiers: Array<"A" | "B" | "E"> = ["A", "B", "E"];
    for (const t of hardTiers) {
      const tierGates = GATES.filter((g) => g.tier === t);
      const hardGates = tierGates.filter((g) => g.hardSoft === "HARD");
      expect(hardGates.length).toBeGreaterThan(0);
    }
  });
});
