/**
 * Bank-reconciliation suggestion agent — pure logic + injected-deps unit tests
 * (founder-os#9480, W2).
 *
 * Exercises the deterministic banding / signal-description / commit-eligibility
 * / greedy-selection functions directly (no database), plus the DB-composing
 * entrypoints via injected FAKE deps — the same seam pattern
 * meeting-prep-service.test.ts uses. Proves the REAL server-authoritative
 * ladder (`levelForActionType`) assigns `financial.reconcile_bank_match` → L3,
 * and that the execute leg REFUSES to commit a pairing without a recorded
 * human approval (through the real `evaluateGate`), never calling the commit
 * lever on a refused action.
 *
 * The real-fileAction / real-approve / real-execute end-to-end path is covered
 * in `recon-suggestion-flow.test.ts`.
 */
import { describe, expect, it, vi } from "vitest";
import type { AgentAction } from "@shared/schema";

// agent-action-service does `import { db } from "../db"` at module load (which
// throws without DATABASE_URL); stub it minimally, mirroring
// meeting-prep-service.test.ts. The pure functions + fake-dep entrypoints here
// never touch it.
vi.mock("../../db", () => ({ db: {} }));

import { levelForActionType, type FileActionInput } from "../agent-action-service";
import {
  bandForConfidence,
  buildPairReasoning,
  DEFAULT_MAX_PROPOSALS,
  describeSignals,
  executeApprovedReconMatch,
  fileReconSuggestions,
  isCommitEligible,
  previewReconSuggestions,
  RECON_MATCH_ACTION_TYPE,
  RECON_SUGGESTION_AGENT,
  selectProposals,
  severityForBand,
  type CandidateSignals,
  type ReconExecuteDeps,
  type ReviewRow,
} from "../recon-suggestion-service";

const ASSOC = "assoc-1";

function signals(over: Partial<CandidateSignals> = {}): CandidateSignals {
  return { amountDeltaCents: 0, dateDeltaDays: 0, payorMatch: "none", ...over };
}

function reviewRow(over: Partial<ReviewRow> & Pick<ReviewRow, "bankTransactionId">): ReviewRow {
  return {
    candidates: [{ ledgerEntryId: "le-1", confidence: 0.75, signals: signals() }],
    reason: "low-confidence",
    ...over,
  };
}

const noOpenRefs = () => ({ bankTransactionIds: new Set<string>(), ledgerEntryIds: new Set<string>() });

describe("levelForActionType — server-authoritative ladder", () => {
  it("assigns financial.reconcile_bank_match → L3 (always human approval)", () => {
    expect(levelForActionType(RECON_MATCH_ACTION_TYPE)).toBe("L3");
  });
});

describe("bandForConfidence", () => {
  it("bands at the auto-match threshold (0.85) and 0.6", () => {
    expect(bandForConfidence(0.85)).toBe("high");
    expect(bandForConfidence(0.9)).toBe("high");
    expect(bandForConfidence(0.84)).toBe("medium");
    expect(bandForConfidence(0.6)).toBe("medium");
    expect(bandForConfidence(0.59)).toBe("low");
    expect(bandForConfidence(0)).toBe("low");
  });
});

describe("isCommitEligible — proposals must be committable by the manual-match lever", () => {
  it("accepts within $1 and within 7 days; rejects outside either", () => {
    expect(isCommitEligible(signals({ amountDeltaCents: 100, dateDeltaDays: 7 }))).toBe(true);
    expect(isCommitEligible(signals({ amountDeltaCents: 101, dateDeltaDays: 0 }))).toBe(false);
    expect(isCommitEligible(signals({ amountDeltaCents: 0, dateDeltaDays: 8 }))).toBe(false);
  });
});

describe("describeSignals — explainability", () => {
  it("describes exact amount, same-day, and payor signals", () => {
    const s = describeSignals(signals({ payorMatch: "exact" }));
    expect(s).toContain("amount exact to the cent");
    expect(s).toContain("same-day");
    expect(s.join(" ")).toContain("payor name appears exactly");
  });
  it("describes near amounts with the dollar delta and plural day gaps", () => {
    const s = describeSignals(signals({ amountDeltaCents: 50, dateDeltaDays: 2, payorMatch: "partial" }));
    expect(s.join("; ")).toContain("off by $0.50");
    expect(s.join("; ")).toContain("2 days apart");
    expect(s.join("; ")).toContain("partially matches");
  });
});

describe("buildPairReasoning", () => {
  it("names the signals, the confidence band, why it was not auto-committed, and the approval gate", () => {
    const reasoning = buildPairReasoning({
      confidence: 0.75,
      band: "medium",
      reviewReason: "low-confidence",
      signals: ["amount exact to the cent", "same-day"],
    });
    expect(reasoning).toContain("amount exact to the cent");
    expect(reasoning).toContain("0.75");
    expect(reasoning).toContain("medium");
    expect(reasoning).toContain("below the auto-commit threshold");
    expect(reasoning).toContain("nothing settles without this approval");
  });
  it("explains the ambiguous case as a human-must-pick", () => {
    expect(
      buildPairReasoning({ confidence: 0.9, band: "high", reviewReason: "ambiguous", signals: ["same-day"] }),
    ).toContain("more than one plausible pairing");
  });
});

describe("selectProposals — greedy, deduped, capped", () => {
  it("picks the best commit-eligible candidate per credit", () => {
    const rows: ReviewRow[] = [
      reviewRow({
        bankTransactionId: "btx-1",
        candidates: [
          { ledgerEntryId: "le-weak", confidence: 0.4, signals: signals({ amountDeltaCents: 50 }) },
          { ledgerEntryId: "le-strong", confidence: 0.8, signals: signals() },
          { ledgerEntryId: "le-uncommittable", confidence: 0.95, signals: signals({ amountDeltaCents: 5000 }) },
        ],
      }),
    ];
    const picked = selectProposals(rows, noOpenRefs());
    expect(picked).toHaveLength(1);
    // the un-committable 0.95 candidate is skipped; the best ELIGIBLE wins.
    expect(picked[0].ledgerEntryId).toBe("le-strong");
    expect(picked[0].band).toBe("medium");
    expect(picked[0].reasoning).toContain("amount exact to the cent");
  });

  it("never assigns the same ledger entry to two credits (higher confidence wins)", () => {
    const rows: ReviewRow[] = [
      reviewRow({ bankTransactionId: "btx-lo", candidates: [{ ledgerEntryId: "le-shared", confidence: 0.6, signals: signals() }] }),
      reviewRow({ bankTransactionId: "btx-hi", candidates: [{ ledgerEntryId: "le-shared", confidence: 0.9, signals: signals() }] }),
    ];
    const picked = selectProposals(rows, noOpenRefs());
    expect(picked).toHaveLength(1);
    expect(picked[0].bankTransactionId).toBe("btx-hi");
  });

  it("skips credits and entries that already carry an open proposal", () => {
    const rows: ReviewRow[] = [
      reviewRow({ bankTransactionId: "btx-open" }),
      reviewRow({ bankTransactionId: "btx-2", candidates: [{ ledgerEntryId: "le-open", confidence: 0.9, signals: signals() }] }),
      reviewRow({ bankTransactionId: "btx-3", candidates: [{ ledgerEntryId: "le-free", confidence: 0.7, signals: signals() }] }),
    ];
    const picked = selectProposals(rows, {
      bankTransactionIds: new Set(["btx-open"]),
      ledgerEntryIds: new Set(["le-open"]),
    });
    expect(picked).toHaveLength(1);
    expect(picked[0].bankTransactionId).toBe("btx-3");
  });

  it("caps the run and keeps the highest-confidence proposals", () => {
    const rows: ReviewRow[] = Array.from({ length: 30 }, (_, i) =>
      reviewRow({
        bankTransactionId: `btx-${i}`,
        candidates: [{ ledgerEntryId: `le-${i}`, confidence: i / 30, signals: signals() }],
      }),
    );
    const picked = selectProposals(rows, noOpenRefs(), 5);
    expect(picked).toHaveLength(5);
    expect(picked.every((p) => p.confidence >= 25 / 30)).toBe(true);
  });
});

describe("severityForBand", () => {
  it("surfaces strong matches at medium severity, the rest low", () => {
    expect(severityForBand("high")).toBe("medium");
    expect(severityForBand("medium")).toBe("low");
    expect(severityForBand("low")).toBe("low");
  });
});

describe("previewReconSuggestions / fileReconSuggestions — injected deps", () => {
  const rows: ReviewRow[] = [
    reviewRow({
      bankTransactionId: "btx-1",
      candidates: [{ ledgerEntryId: "le-1", confidence: 0.9, signals: signals({ payorMatch: "exact" }) }],
      reason: "ambiguous",
    }),
    reviewRow({
      bankTransactionId: "btx-2",
      candidates: [{ ledgerEntryId: "le-2", confidence: 0.4, signals: signals({ amountDeltaCents: 75, dateDeltaDays: 5 }) }],
    }),
  ];
  const data = {
    listReviewCandidates: vi.fn(async () => rows),
    listOpenProposalRefs: vi.fn(async () => noOpenRefs()),
  };

  it("preview scores + selects but files nothing", async () => {
    const result = await previewReconSuggestions(ASSOC, data);
    expect(result.proposals).toHaveLength(2);
    expect(result.reviewRowCount).toBe(2);
    expect(result.proposals[0].band).toBe("high");
    expect(result.proposals[1].band).toBe("low");
  });

  it("files one L3-typed action per proposal with the pairing payload + reasoning + confidence-derived severity", async () => {
    const filed: FileActionInput[] = [];
    const file = vi.fn(async (input: FileActionInput) => {
      filed.push(input);
      return { id: `act-${filed.length}`, ...input } as unknown as AgentAction;
    });
    const result = await fileReconSuggestions({ associationId: ASSOC }, { data, file });
    expect(result.actions).toHaveLength(2);
    expect(file).toHaveBeenCalledTimes(2);
    for (const input of filed) {
      expect(input.actionType).toBe(RECON_MATCH_ACTION_TYPE);
      expect(input.associationId).toBe(ASSOC);
      expect(input.createdByAgent).toBe(RECON_SUGGESTION_AGENT);
      expect(input.targetEntityType).toBe("bank_transaction");
      expect(input.reasoning).toContain("nothing settles without this approval");
      const payload = input.payload as { bankTransactionId: string; ledgerEntryId: string; confidence: number };
      expect(typeof payload.bankTransactionId).toBe("string");
      expect(typeof payload.ledgerEntryId).toBe("string");
    }
    // severity follows the band: high → medium, low → low.
    expect(filed.find((f) => (f.payload as any).bankTransactionId === "btx-1")?.severity).toBe("medium");
    expect(filed.find((f) => (f.payload as any).bankTransactionId === "btx-2")?.severity).toBe("low");
  });

  it("respects maxProposals and defaults to DEFAULT_MAX_PROPOSALS", async () => {
    const many = Array.from({ length: DEFAULT_MAX_PROPOSALS + 10 }, (_, i) =>
      reviewRow({ bankTransactionId: `b-${i}`, candidates: [{ ledgerEntryId: `l-${i}`, confidence: 0.7, signals: signals() }] }),
    );
    const wide = { ...data, listReviewCandidates: vi.fn(async () => many) };
    const capped = await previewReconSuggestions(ASSOC, wide);
    expect(capped.proposals).toHaveLength(DEFAULT_MAX_PROPOSALS);
    const tighter = await previewReconSuggestions(ASSOC, wide, 3);
    expect(tighter.proposals).toHaveLength(3);
  });
});

describe("executeApprovedReconMatch — the mandatory human gate (AC: no commit without approval)", () => {
  function action(over: Partial<AgentAction> = {}): AgentAction {
    return {
      id: "act-1",
      associationId: ASSOC,
      actionType: RECON_MATCH_ACTION_TYPE,
      level: "L3",
      status: "queued",
      payload: { bankTransactionId: "btx-1", ledgerEntryId: "le-1" },
      reasoning: "r",
      ...over,
    } as unknown as AgentAction;
  }

  function deps(over: Partial<ReconExecuteDeps> = {}): ReconExecuteDeps & { commit: ReturnType<typeof vi.fn>; execute: ReturnType<typeof vi.fn> } {
    const commit = vi.fn(async () => ({
      ok: true as const,
      outcome: { bankTransactionId: "btx-1", ledgerEntryId: "le-1", amountCents: 45000, dateDeltaDays: 1 },
    }));
    const execute = vi.fn(async () => action({ status: "executed" }));
    return {
      loadAction: async () => action(),
      commit: commit as unknown as ReconExecuteDeps["commit"],
      execute: execute as unknown as ReconExecuteDeps["execute"],
      ...over,
    } as ReconExecuteDeps & { commit: ReturnType<typeof vi.fn>; execute: ReturnType<typeof vi.fn> };
  }

  const actor = { actorType: "human", actorEmail: "pm@example.com" };

  it("REFUSES a queued (unapproved) L3 pairing and NEVER touches the commit lever", async () => {
    const d = deps();
    await expect(
      executeApprovedReconMatch({ actionId: "act-1", associationId: ASSOC, actor }, d),
    ).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    expect(d.commit).not.toHaveBeenCalled();
    expect(d.execute).not.toHaveBeenCalled();
  });

  it("refuses a rejected action", async () => {
    const d = deps({ loadAction: async () => action({ status: "rejected" }) });
    await expect(
      executeApprovedReconMatch({ actionId: "act-1", associationId: ASSOC, actor }, d),
    ).rejects.toMatchObject({ code: "REJECTED" });
    expect(d.commit).not.toHaveBeenCalled();
  });

  it("refuses an already-executed action (no double-settle through this leg)", async () => {
    const d = deps({ loadAction: async () => action({ status: "executed" }) });
    await expect(
      executeApprovedReconMatch({ actionId: "act-1", associationId: ASSOC, actor }, d),
    ).rejects.toMatchObject({ code: "ALREADY_EXECUTED" });
    expect(d.commit).not.toHaveBeenCalled();
  });

  it("refuses an action of another type (this leg only actuates recon pairings)", async () => {
    const d = deps({ loadAction: async () => action({ actionType: "financial.post_ledger_entry" }) });
    await expect(
      executeApprovedReconMatch({ actionId: "act-1", associationId: ASSOC, actor }, d),
    ).rejects.toMatchObject({ code: "WRONG_ACTION_TYPE" });
  });

  it("404s an unknown/out-of-tenant action", async () => {
    const d = deps({ loadAction: async () => undefined });
    await expect(
      executeApprovedReconMatch({ actionId: "nope", associationId: ASSOC, actor }, d),
    ).rejects.toMatchObject({ code: "NOT_FOUND", httpStatus: 404 });
  });

  it("refuses a malformed payload without touching the commit lever", async () => {
    const d = deps({ loadAction: async () => action({ status: "approved", payload: {} as any }) });
    await expect(
      executeApprovedReconMatch({ actionId: "act-1", associationId: ASSOC, actor }, d),
    ).rejects.toMatchObject({ code: "INVALID_PAYLOAD" });
    expect(d.commit).not.toHaveBeenCalled();
  });

  it("an APPROVED pairing commits through the manual-match lever, THEN marks executed", async () => {
    const calls: string[] = [];
    const commit = vi.fn(async (input: { associationId: string; bankTransactionId: string; ledgerEntryId: string }) => {
      calls.push("commit");
      expect(input).toEqual({ associationId: ASSOC, bankTransactionId: "btx-1", ledgerEntryId: "le-1" });
      return { ok: true as const, outcome: { bankTransactionId: "btx-1", ledgerEntryId: "le-1", amountCents: 45000, dateDeltaDays: 1 } };
    });
    const execute = vi.fn(async () => {
      calls.push("execute");
      return action({ status: "executed" });
    });
    const d = deps({
      loadAction: async () => action({ status: "approved" }),
      commit: commit as unknown as ReconExecuteDeps["commit"],
      execute: execute as unknown as ReconExecuteDeps["execute"],
    });
    const result = await executeApprovedReconMatch({ actionId: "act-1", associationId: ASSOC, actor }, d);
    expect(calls).toEqual(["commit", "execute"]);
    expect(result.action.status).toBe("executed");
    expect(result.outcome.amountCents).toBe(45000);
  });

  it("a commit refusal (e.g. record already settled elsewhere) surfaces its code and does NOT mark executed", async () => {
    const commit = vi.fn(async () => ({ ok: false as const, reason: "already reconciled", code: "BANK_TX_ALREADY_CONSUMED" }));
    const execute = vi.fn();
    const d = deps({
      loadAction: async () => action({ status: "approved" }),
      commit: commit as unknown as ReconExecuteDeps["commit"],
      execute: execute as unknown as ReconExecuteDeps["execute"],
    });
    await expect(
      executeApprovedReconMatch({ actionId: "act-1", associationId: ASSOC, actor }, d),
    ).rejects.toMatchObject({ code: "BANK_TX_ALREADY_CONSUMED" });
    expect(execute).not.toHaveBeenCalled();
  });
});
