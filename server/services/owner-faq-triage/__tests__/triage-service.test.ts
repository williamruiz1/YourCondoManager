/**
 * triage-service.test.ts — the intake→classify→ground→draft→queue path,
 * end-to-end with injected fakes (founder-os#9476). No live DB.
 *
 * Verifies:
 *   - a grounded balance inquiry produces an L2 "owner-faq.send-reply" action
 *     that is HELD for review by default (auto-send toggle OFF → nothing sends)
 *   - the same with the toggle ON auto-executes (send)
 *   - an "other" inquiry files an L1 "owner-faq.suggest" (advisory, never sends)
 *   - the filed action carries reasoning + sourceData (explainability)
 */
import { describe, it, expect, vi } from "vitest";
import { classifyInquiry } from "../classifier";
import { triageInquiry, type TriageInput, type TriageDeps } from "../triage-service";
import { canExecute, levelForActionType } from "../../agent-queue/permission-ladder";
import type { GroundingSnapshot } from "../draft-generator";
import type { FileActionResult } from "../../agent-queue/agent-queue-service";

const input: TriageInput = {
  associationId: "assoc-1",
  personId: "person-1",
  unitIds: ["unit-1"],
  text: "Hi, what's my current balance?",
};

/** A fake fileAction that simulates the real queue gate (toggle governs L2). */
function makeFakeFileAction(autoSendToggle: boolean): {
  fileAction: TriageDeps["fileAction"];
  calls: any[];
} {
  const calls: any[] = [];
  const fileAction = vi.fn(async (fi: any): Promise<FileActionResult> => {
    calls.push(fi);
    const level = levelForActionType(fi.actionType);
    const gate = canExecute({
      level,
      autoExecuteEnabled: level === "L2" ? autoSendToggle : false,
      hasHumanApproval: false,
      hasBoardApproval: false,
    });
    return {
      action: {
        id: "act-1",
        associationId: fi.associationId,
        actionType: fi.actionType,
        level,
        status: gate.ok ? "executed" : "queued",
      } as any,
      level,
      autoExecuted: gate.ok,
      gateReason: gate.reason,
    };
  });
  return { fileAction: fileAction as unknown as TriageDeps["fileAction"], calls };
}

const groundBalance = async (): Promise<GroundingSnapshot> => ({
  ownerName: "Jordan",
  balanceCents: 12500,
  balanceAsOf: "2026-07-01",
});

describe("triageInquiry — end-to-end", () => {
  it("balance inquiry → L2 send-reply, HELD for review by default (toggle OFF, nothing sends)", async () => {
    const { fileAction } = makeFakeFileAction(false);
    const r = await triageInquiry(input, { classify: classifyInquiry, ground: groundBalance, fileAction });

    expect(r.classification.category).toBe("balance");
    expect(r.draft.draftText).toContain("$125.00");
    expect(r.actionType).toBe("owner-faq.send-reply");
    expect(r.fileResult.level).toBe("L2");
    // The core safety AC: default is queue-for-review, NOT auto-send.
    expect(r.fileResult.autoExecuted).toBe(false);
    expect(r.fileResult.action.status).toBe("queued");
  });

  it("with the per-toggle ON, the L2 reply auto-sends", async () => {
    const { fileAction } = makeFakeFileAction(true);
    const r = await triageInquiry(input, { classify: classifyInquiry, ground: groundBalance, fileAction });
    expect(r.fileResult.autoExecuted).toBe(true);
    expect(r.fileResult.action.status).toBe("executed");
  });

  it("an 'other' inquiry files an L1 advisory suggestion that never sends", async () => {
    const { fileAction } = makeFakeFileAction(true); // even with toggle ON
    const other: TriageInput = { ...input, text: "My neighbor's dog barks all night." };
    const r = await triageInquiry(other, {
      classify: classifyInquiry,
      ground: async () => ({}),
      fileAction,
    });
    expect(r.classification.category).toBe("other");
    expect(r.actionType).toBe("owner-faq.suggest");
    expect(r.fileResult.level).toBe("L1");
    expect(r.fileResult.autoExecuted).toBe(false); // L1 never executes
  });

  it("the filed action carries reasoning + sourceData (explainability)", async () => {
    const { fileAction, calls } = makeFakeFileAction(false);
    await triageInquiry(input, { classify: classifyInquiry, ground: groundBalance, fileAction });
    expect(calls[0].reasoning).toMatch(/balance/i);
    expect(calls[0].sourceData.balanceCents).toBe(12500);
    expect(calls[0].createdByAgent).toBe("agent:owner-faq-triage");
  });
});
