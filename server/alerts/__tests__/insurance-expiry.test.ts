/**
 * 4.1 Tier 2 — Unit test: insurance-expiry resolver.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const state: { rows: Array<Record<string, unknown>> } = { rows: [] };

vi.mock("../../db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(state.rows),
      }),
    }),
  },
}));

import { resolve, resolveMany } from "../sources/insurance-expiry";

const now = new Date("2026-04-22T12:00:00Z");

function makePolicy(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "pol-1",
    associationId: "assoc-1",
    policyType: "master",
    carrier: "Hartford",
    policyNumber: "MSTR-1",
    effectiveDate: new Date("2025-05-01T00:00:00Z"),
    expirationDate: new Date("2026-05-10T00:00:00Z"), // 18 days away
    premiumAmount: 10000,
    coverageAmount: 5000000,
    notes: null,
    createdAt: new Date("2025-05-01T00:00:00Z"),
    updatedAt: new Date("2025-05-01T00:00:00Z"),
    ...overrides,
  };
}

describe("resolver: insurance-expiry", () => {
  beforeEach(() => {
    state.rows = [];
  });

  it("emits AlertItem for policies within the 60-day lead-time", async () => {
    state.rows = [makePolicy()];
    const items = await resolve("assoc-1", { associationName: "Test HOA", now });
    expect(items).toHaveLength(1);
    expect(items[0].alertId).toBe("insurance-expiry:association_insurance_policies:pol-1");
    expect(items[0].zone).toBe("governance");
    expect(items[0].featureDomain).toBe("governance-compliance");
    expect(items[0].ruleType).toBe("insurance-expiry");
    expect(items[0].recordType).toBe("association_insurance_policies");
    expect(items[0].severity).toBe("critical"); // <= 30 days
    expect(items[0].resolutionHref).toBe("/app/governance/insurance/pol-1");
  });

  it("marks lapsed policies as critical", async () => {
    state.rows = [
      makePolicy({ id: "pol-lapsed", expirationDate: new Date("2026-03-01T00:00:00Z") }),
    ];
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items[0].severity).toBe("critical");
    expect(items[0].title).toContain("expired");
    expect(items[0].description).toContain("ago");
  });

  it("uses high severity for policies expiring 31-45 days out", async () => {
    state.rows = [
      makePolicy({ id: "pol-high", expirationDate: new Date("2026-06-01T00:00:00Z") }), // ~40 days
    ];
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items[0].severity).toBe("high");
  });

  it("uses medium severity for policies expiring 46-60 days out", async () => {
    state.rows = [
      makePolicy({ id: "pol-med", expirationDate: new Date("2026-06-15T00:00:00Z") }), // ~54 days
    ];
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items[0].severity).toBe("medium");
  });

  it("skips policies with null expirationDate defensively", async () => {
    // The DB query's predicate filters these out, but if one slips
    // through (malformed row) the resolver must not crash.
    state.rows = [makePolicy({ id: "pol-noexp", expirationDate: null })];
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items).toHaveLength(0);
  });

  it("returns empty array when no rows match", async () => {
    state.rows = [];
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items).toEqual([]);
  });

  it("produces deterministic alertId", async () => {
    state.rows = [makePolicy({ id: "stable" })];
    const a = await resolve("assoc-1", { associationName: "X", now });
    state.rows = [makePolicy({ id: "stable" })];
    const b = await resolve("assoc-1", { associationName: "X", now });
    expect(a[0].alertId).toBe(b[0].alertId);
    expect(a[0].alertId).toBe("insurance-expiry:association_insurance_policies:stable");
  });

  // -------------------------------------------------------------------------
  // 5.4-F1 Wave 16b — resolveMany batched fan-out.
  // -------------------------------------------------------------------------

  it("resolveMany: emits alerts for 3 associations from a single IN-query", async () => {
    state.rows = [
      makePolicy({ id: "p-a1", associationId: "assoc-1" }),
      makePolicy({ id: "p-a2", associationId: "assoc-2" }),
      makePolicy({ id: "p-a3", associationId: "assoc-3" }),
    ];
    const items = await resolveMany(
      [
        { id: "assoc-1", name: "A" },
        { id: "assoc-2", name: "B" },
        { id: "assoc-3", name: "C" },
      ],
      { now },
    );
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.associationId).sort()).toEqual([
      "assoc-1",
      "assoc-2",
      "assoc-3",
    ]);
  });
});
