/**
 * 4.1 Wave 2 — Unit test: active-elections resolver.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../storage", () => ({
  storage: {
    getElections: vi.fn(),
  },
}));

import { storage } from "../../storage";
import { resolve, resolveMany } from "../sources/active-elections";

const now = new Date("2026-04-22T12:00:00Z");

function makeElection(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "el-1",
    associationId: "assoc-1",
    meetingId: null,
    title: "Board Election 2026",
    description: null,
    voteType: "board-seat",
    votingRule: "unit-weighted",
    isSecretBallot: 1,
    resultVisibility: "public",
    status: "voting-open",
    opensAt: new Date("2026-04-20T00:00:00Z"),
    closesAt: new Date("2026-04-27T00:00:00Z"), // closes in 5 days
    nominationsOpenAt: null,
    nominationsCloseAt: null,
    quorumPercent: 50,
    maxChoices: 3,
    eligibleVoterCount: 100,
    certifiedBy: null,
    certifiedAt: null,
    certificationSummary: null,
    resultDocumentId: null,
    createdBy: null,
    createdAt: new Date("2026-04-01T00:00:00Z"),
    updatedAt: new Date("2026-04-20T00:00:00Z"),
    ...overrides,
  };
}

describe("resolver: active-elections", () => {
  beforeEach(() => {
    vi.mocked(storage.getElections).mockReset();
  });

  it("returns AlertItem for elections in active statuses", async () => {
    vi.mocked(storage.getElections).mockResolvedValueOnce([makeElection({ id: "el-open" })] as any);
    const items = await resolve("assoc-1", { associationName: "Test HOA", now });
    expect(items).toHaveLength(1);
    expect(items[0].alertId).toBe("active-election:elections:el-open");
    expect(items[0].zone).toBe("governance");
    expect(items[0].featureDomain).toBe("governance.elections");
    expect(items[0].ruleType).toBe("active-election");
  });

  it("excludes draft/cancelled/certified elections", async () => {
    vi.mocked(storage.getElections).mockResolvedValueOnce([
      makeElection({ id: "el-draft", status: "draft" }),
      makeElection({ id: "el-cancelled", status: "cancelled" }),
      makeElection({ id: "el-certified", status: "certified" }),
    ] as any);
    const items = await resolve("assoc-1", { associationName: "Test HOA", now });
    expect(items).toHaveLength(0);
  });

  it("marks awaiting-certification (past close, not yet certified) as high severity", async () => {
    vi.mocked(storage.getElections).mockResolvedValueOnce([
      makeElection({
        id: "el-awaiting",
        status: "voting-closed",
        closesAt: new Date("2026-04-18T00:00:00Z"),
        certifiedAt: null,
      }),
    ] as any);
    const items = await resolve("assoc-1", { associationName: "Test HOA", now });
    expect(items[0].severity).toBe("high");
  });

  it("alertId is deterministic", async () => {
    vi.mocked(storage.getElections).mockResolvedValue([makeElection({ id: "stable" })] as any);
    const a = await resolve("assoc-1", { associationName: "X", now });
    const b = await resolve("assoc-1", { associationName: "X", now });
    expect(a[0].alertId).toBe(b[0].alertId);
  });

  // -------------------------------------------------------------------------
  // 5.4-F1 Wave 16b — resolveMany batched fan-out.
  // -------------------------------------------------------------------------

  it("resolveMany: emits alerts for 3 associations from a single storage call", async () => {
    vi.mocked(storage.getElections).mockResolvedValueOnce([
      makeElection({ id: "el-1", associationId: "assoc-1" }),
      makeElection({ id: "el-2", associationId: "assoc-2" }),
      makeElection({ id: "el-3", associationId: "assoc-3" }),
    ] as any);

    const items = await resolveMany(
      [
        { id: "assoc-1", name: "A" },
        { id: "assoc-2", name: "B" },
        { id: "assoc-3", name: "C" },
      ],
      { now },
    );

    expect(items).toHaveLength(3);
    expect(items.map((i) => i.associationId).sort()).toEqual(["assoc-1", "assoc-2", "assoc-3"]);
    expect(vi.mocked(storage.getElections).mock.calls).toHaveLength(1);
    // Multi-assoc path: getElections() called with no associationId arg.
    expect(vi.mocked(storage.getElections).mock.calls[0][0]).toBeUndefined();
  });
});
