import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [] as Array<{ associationId: string }>,
  enabled: new Set<string>(),
  maybeSyncAssociationGl: vi.fn(),
}));

vi.mock("../../db", () => ({
  db: {
    select: () => ({
      from: () => ({
        groupBy: () => Promise.resolve(mocks.rows),
      }),
    }),
  },
}));

vi.mock("../gl/flag", () => ({
  isGlEnabledForAssociation: (associationId: string) =>
    mocks.enabled.has(associationId),
}));

vi.mock("../gl/runtime-sync", () => ({
  maybeSyncAssociationGl: mocks.maybeSyncAssociationGl,
}));

import { runGlProjectionContinuitySweep } from "../gl/projection-sweep";

beforeEach(() => {
  mocks.rows = [
    { associationId: "assoc-enabled" },
    { associationId: "assoc-disabled" },
  ];
  mocks.enabled = new Set(["assoc-enabled"]);
  mocks.maybeSyncAssociationGl.mockReset();
  mocks.maybeSyncAssociationGl.mockResolvedValue({
    posted: true,
    result: {
      skipped: false,
      accountsSeeded: 13,
      journalsConsidered: 1,
      legsInserted: 2,
    },
  });
});

describe("runGlProjectionContinuitySweep", () => {
  it("reconciles every enabled association and leaves gated cohorts untouched", async () => {
    const result = await runGlProjectionContinuitySweep();

    expect(result).toEqual({
      scanned: 2,
      enabled: 1,
      reconciled: 1,
      skipped: 1,
      failed: 0,
    });
    expect(mocks.maybeSyncAssociationGl).toHaveBeenCalledWith(
      "assoc-enabled",
      "continuity-sweep",
    );
  });

  it("counts a failed projection for retry/alert visibility without aborting other associations", async () => {
    mocks.rows = [
      { associationId: "assoc-a" },
      { associationId: "assoc-b" },
    ];
    mocks.enabled = new Set(["assoc-a", "assoc-b"]);
    mocks.maybeSyncAssociationGl
      .mockResolvedValueOnce({
        posted: false,
        reason: "error",
        detail: "synthetic",
      })
      .mockResolvedValueOnce({
        posted: true,
        result: {
          skipped: false,
          accountsSeeded: 13,
          journalsConsidered: 2,
          legsInserted: 2,
        },
      });

    const result = await runGlProjectionContinuitySweep();

    expect(result.failed).toBe(1);
    expect(result.reconciled).toBe(1);
    expect(mocks.maybeSyncAssociationGl).toHaveBeenCalledTimes(2);
  });
});
