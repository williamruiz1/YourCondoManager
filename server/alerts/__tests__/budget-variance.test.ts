/**
 * 4.1 Tier 2 — Unit test: budget-variance-flags resolver.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../storage", () => ({
  storage: {
    getBudgets: vi.fn(),
    getBudgetVersions: vi.fn(),
    getBudgetVariance: vi.fn(),
  },
}));

import { storage } from "../../storage";
import { resolve } from "../sources/budget-variance-flags";

const now = new Date("2026-04-22T12:00:00Z");

function makeBudget(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "budget-1",
    associationId: "assoc-1",
    name: "FY 2026",
    fiscalYear: 2026,
    periodStart: new Date("2026-01-01T00:00:00Z"),
    periodEnd: new Date("2026-12-31T23:59:59Z"),
    createdAt: new Date("2025-12-01T00:00:00Z"),
    updatedAt: new Date("2025-12-01T00:00:00Z"),
    ...overrides,
  };
}

function makeVersion(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "ver-1",
    budgetId: "budget-1",
    versionNumber: 1,
    status: "ratified",
    notes: null,
    ratifiedAt: new Date("2026-01-05T00:00:00Z"),
    createdAt: new Date("2025-12-15T00:00:00Z"),
    updatedAt: new Date("2026-01-05T00:00:00Z"),
    ...overrides,
  };
}

describe("resolver: budget-variance-flags", () => {
  beforeEach(() => {
    vi.mocked(storage.getBudgets).mockReset();
    vi.mocked(storage.getBudgetVersions).mockReset();
    vi.mocked(storage.getBudgetVariance).mockReset();
  });

  it("emits AlertItem when a budget line's overspend exceeds 10%", async () => {
    vi.mocked(storage.getBudgets).mockResolvedValueOnce([makeBudget()] as any);
    vi.mocked(storage.getBudgetVersions).mockResolvedValueOnce([makeVersion()] as any);
    vi.mocked(storage.getBudgetVariance).mockResolvedValueOnce([
      {
        budgetLineId: "line-a",
        lineItemName: "Landscaping",
        plannedAmount: 1000,
        actualAmount: 1150, // +15% overspend -> medium
        varianceAmount: -150,
        accountId: null,
        categoryId: null,
      },
      {
        budgetLineId: "line-b",
        lineItemName: "Cleaning",
        plannedAmount: 1000,
        actualAmount: 900, // underspend, ignored
        varianceAmount: 100,
        accountId: null,
        categoryId: null,
      },
    ]);

    const items = await resolve("assoc-1", { associationName: "Test HOA", now });
    expect(items).toHaveLength(1);
    expect(items[0].alertId).toBe("budget-variance:budget_lines:line-a");
    expect(items[0].zone).toBe("financials");
    expect(items[0].featureDomain).toBe("financials.reports");
    expect(items[0].ruleType).toBe("budget-variance");
    expect(items[0].recordType).toBe("budget_lines");
    expect(items[0].severity).toBe("medium");
    expect(items[0].resolutionHref).toBe("/app/financials/budgets/budget-1?versionId=ver-1");
  });

  it("escalates to high severity when overspend exceeds 25%", async () => {
    vi.mocked(storage.getBudgets).mockResolvedValueOnce([makeBudget()] as any);
    vi.mocked(storage.getBudgetVersions).mockResolvedValueOnce([makeVersion()] as any);
    vi.mocked(storage.getBudgetVariance).mockResolvedValueOnce([
      {
        budgetLineId: "line-hot",
        lineItemName: "Repairs",
        plannedAmount: 500,
        actualAmount: 700, // +40%
        varianceAmount: -200,
        accountId: null,
        categoryId: null,
      },
    ]);
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items[0].severity).toBe("high");
  });

  it("excludes overspends <= 10%", async () => {
    vi.mocked(storage.getBudgets).mockResolvedValueOnce([makeBudget()] as any);
    vi.mocked(storage.getBudgetVersions).mockResolvedValueOnce([makeVersion()] as any);
    vi.mocked(storage.getBudgetVariance).mockResolvedValueOnce([
      {
        budgetLineId: "line-edge",
        lineItemName: "Utilities",
        plannedAmount: 1000,
        actualAmount: 1100, // exactly 10% — excluded
        varianceAmount: -100,
        accountId: null,
        categoryId: null,
      },
    ]);
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items).toHaveLength(0);
  });

  it("returns empty array when there are no current-period budgets", async () => {
    vi.mocked(storage.getBudgets).mockResolvedValueOnce([
      makeBudget({
        id: "b-old",
        periodStart: new Date("2024-01-01T00:00:00Z"),
        periodEnd: new Date("2024-12-31T23:59:59Z"),
      }),
    ] as any);
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items).toEqual([]);
    expect(vi.mocked(storage.getBudgetVersions)).not.toHaveBeenCalled();
  });

  it("returns empty array when no ratified budget version exists", async () => {
    vi.mocked(storage.getBudgets).mockResolvedValueOnce([makeBudget()] as any);
    vi.mocked(storage.getBudgetVersions).mockResolvedValueOnce([
      makeVersion({ status: "draft" }),
      makeVersion({ id: "ver-proposed", status: "proposed", versionNumber: 2 }),
    ] as any);
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items).toEqual([]);
    expect(vi.mocked(storage.getBudgetVariance)).not.toHaveBeenCalled();
  });

  it("recovers when getBudgetVariance throws", async () => {
    vi.mocked(storage.getBudgets).mockResolvedValueOnce([makeBudget()] as any);
    vi.mocked(storage.getBudgetVersions).mockResolvedValueOnce([makeVersion()] as any);
    vi.mocked(storage.getBudgetVariance).mockRejectedValueOnce(new Error("boom"));
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items).toEqual([]);
  });

  it("ignores malformed lines with non-positive plannedAmount", async () => {
    vi.mocked(storage.getBudgets).mockResolvedValueOnce([makeBudget()] as any);
    vi.mocked(storage.getBudgetVersions).mockResolvedValueOnce([makeVersion()] as any);
    vi.mocked(storage.getBudgetVariance).mockResolvedValueOnce([
      {
        budgetLineId: "line-zero",
        lineItemName: "Empty",
        plannedAmount: 0,
        actualAmount: 50,
        varianceAmount: -50,
        accountId: null,
        categoryId: null,
      },
    ]);
    const items = await resolve("assoc-1", { associationName: "X", now });
    expect(items).toEqual([]);
  });

  it("produces deterministic alertId", async () => {
    vi.mocked(storage.getBudgets).mockResolvedValue([makeBudget()] as any);
    vi.mocked(storage.getBudgetVersions).mockResolvedValue([makeVersion()] as any);
    vi.mocked(storage.getBudgetVariance).mockResolvedValue([
      {
        budgetLineId: "stable",
        lineItemName: "Stable",
        plannedAmount: 1000,
        actualAmount: 1500,
        varianceAmount: -500,
        accountId: null,
        categoryId: null,
      },
    ]);
    const a = await resolve("assoc-1", { associationName: "X", now });
    const b = await resolve("assoc-1", { associationName: "X", now });
    expect(a[0].alertId).toBe(b[0].alertId);
    expect(a[0].alertId).toBe("budget-variance:budget_lines:stable");
  });
});
