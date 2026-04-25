/**
 * 4.1 Wave 2 — Unit test: expiring-governance-documents resolver.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted state the mocked db factory reads from so individual tests can
// swap the rows returned by the governance-compliance-templates query.
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

import { resolve, resolveMany } from "../sources/expiring-governance-documents";

const now = new Date("2026-04-22T12:00:00Z");

function makeTemplate(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "tpl-1",
    associationId: "assoc-1",
    baseTemplateId: null,
    scope: "ct-baseline",
    stateCode: null,
    year: 2026,
    versionNumber: 1,
    name: "Condo bylaws",
    sourceAuthority: null,
    sourceUrl: null,
    sourceDocumentTitle: null,
    sourceDocumentDate: null,
    effectiveDate: null,
    lastSourceUpdatedAt: null,
    lastVerifiedAt: null,
    lastSyncedAt: null,
    nextReviewDueAt: new Date("2026-05-10T00:00:00Z"), // ~18 days away
    publicationStatus: "published",
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    reviewNotes: null,
    createdBy: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("resolver: expiring-governance-documents", () => {
  beforeEach(() => {
    state.rows = [];
  });

  it("returns AlertItem for templates with nextReviewDueAt inside the lead window", async () => {
    state.rows = [makeTemplate()];
    const items = await resolve("assoc-1", { associationName: "Test HOA", now });
    expect(items).toHaveLength(1);
    expect(items[0].alertId).toBe("expiring-governance-document:governance_compliance_templates:tpl-1");
    expect(items[0].zone).toBe("governance");
    expect(items[0].featureDomain).toBe("governance.documents");
    expect(items[0].ruleType).toBe("expiring-governance-document");
    expect(items[0].severity).toBe("low");
  });

  it("marks lapsed templates (past due) as high severity", async () => {
    state.rows = [
      makeTemplate({ id: "tpl-lapsed", nextReviewDueAt: new Date("2026-03-01T00:00:00Z") }),
    ];
    const items = await resolve("assoc-1", { associationName: "Test HOA", now });
    expect(items[0].severity).toBe("high");
    expect(items[0].title).toContain("Lapsed");
  });

  it("alertId is deterministic", async () => {
    state.rows = [makeTemplate({ id: "stable" })];
    const a = await resolve("assoc-1", { associationName: "X", now });
    state.rows = [makeTemplate({ id: "stable" })];
    const b = await resolve("assoc-1", { associationName: "X", now });
    expect(a[0].alertId).toBe(b[0].alertId);
  });

  // -------------------------------------------------------------------------
  // 5.4-F1 Wave 16b — resolveMany batched fan-out.
  // -------------------------------------------------------------------------

  it("resolveMany: emits alerts for 3 associations from a single IN-query", async () => {
    state.rows = [
      makeTemplate({ id: "tpl-a1", associationId: "assoc-1" }),
      makeTemplate({ id: "tpl-a2", associationId: "assoc-2" }),
      makeTemplate({ id: "tpl-a3", associationId: "assoc-3" }),
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
