/**
 * Violation-intake triage — acceptance tests (founder-os#9479, W2).
 *
 * Proves the full ability WITHOUT a database: the pure categorize → ground-in-rule
 * → draft → reason pipeline, and the DB-composing entrypoint via an injected fake
 * `file` dep. To prove the acceptance criterion "the notice CANNOT issue without a
 * human signature," it composes the REAL W1 gate functions (`levelForActionType`,
 * `evaluateGate`) — so the L2 gating is proven against the actual foundation, not a
 * mock.
 *
 * Acceptance criteria (dispatch #9479):
 *  1. A submitted report + photos is intaken + categorized against the correct rule.
 *  2. A notice draft is generated grounded in the triggered rule + evidence.
 *  3. The draft files as an L2 action routed to PM/board; the notice CANNOT issue
 *     without a human signature (verified here).
 *  4. Reasoning shows the rule that triggered + the evidence used.
 *  5. intake→categorize→draft→route verified end-to-end.
 */
import { describe, expect, it, vi } from "vitest";
import type { AgentAction } from "@shared/schema";

// This suite exercises the PURE ladder functions (levelForActionType/evaluateGate)
// + the entrypoint via an injected FAKE `file` dep — the real DB is never used.
// agent-action-service does `import { db } from "../db"` at module load (which
// throws without DATABASE_URL), so stub it minimally: the pure functions + the
// fake-dep entrypoint never touch it.
vi.mock("../../db", () => ({ db: {} }));

import { levelForActionType, evaluateGate } from "../agent-action-service";
import {
  categorizeViolation,
  summarizeEvidence,
  draftNotice,
  buildReasoning,
  triageAndQueueViolation,
  DRAFT_NOTICE_ACTION_TYPE,
  SEND_NOTICE_ACTION_TYPE,
  type ViolationReport,
} from "../violation-triage-service";
import type { FileActionInput } from "../agent-action-service";

// A fake W1 `file` dep: records the filed input + returns a realistic queued
// action whose level is assigned by the REAL server-authoritative ladder.
function fakeFileDep() {
  const calls: FileActionInput[] = [];
  const file = vi.fn(async (input: FileActionInput): Promise<AgentAction> => {
    calls.push(input);
    return {
      id: `act-${calls.length}`,
      associationId: input.associationId,
      actionType: input.actionType,
      level: levelForActionType(input.actionType), // real ladder
      status: "queued",
      targetEntityType: input.targetEntityType ?? null,
      targetEntityId: input.targetEntityId ?? null,
      payload: input.payload ?? null,
      reasoning: input.reasoning,
      severity: (input.severity as string) ?? "medium",
      statutoryDeadline: input.statutoryDeadline ?? null,
      createdByAgent: input.createdByAgent,
      approvedByUserId: null,
      approvedByEmail: null,
      approvedAt: null,
      rejectedByUserId: null,
      rejectedByEmail: null,
      rejectedAt: null,
      rejectionReason: null,
      executedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as AgentAction;
  });
  return { file, calls };
}

describe("categorizeViolation (AC1 — intake + categorize against the correct rule)", () => {
  const cases: Array<{ desc: string; expected: string }> = [
    { desc: "The lawn is completely overgrown with weeds and the grass is dead", expected: "landscaping" },
    { desc: "There is an inoperable truck parked in the driveway for weeks", expected: "parking_vehicle" },
    { desc: "Owner painted their front door bright purple without ARC approval", expected: "architectural" },
    { desc: "Dog is off-leash and there is pet waste left on the common lawn", expected: "pets" },
    { desc: "Trash bins have been left out at the curb since Monday", expected: "trash_bins" },
    { desc: "Loud music and a late night party disturbing the whole block", expected: "noise_nuisance" },
    { desc: "The siding is peeling and gutters are broken and sagging", expected: "exterior_maintenance" },
    { desc: "A large political sign is posted in the front yard", expected: "signage" },
    { desc: "Unit is being used as a short-term Airbnb rental", expected: "rental_occupancy" },
  ];
  for (const c of cases) {
    it(`categorizes "${c.desc.slice(0, 32)}…" as ${c.expected}`, () => {
      const r = categorizeViolation({ description: c.desc });
      expect(r.category).toBe(c.expected);
      expect(r.rule.text.length).toBeGreaterThan(0);
      expect(r.matchedKeywords.length).toBeGreaterThan(0);
    });
  }

  it("falls back to 'general' + the general rule when nothing matches", () => {
    const r = categorizeViolation({ description: "xyzzy nothing recognizable here" });
    expect(r.category).toBe("general");
    expect(r.rule.ruleId).toBe("std.general");
    expect(r.confidence).toBe(0);
  });

  it("prefers the association's OWN governing-doc rule when supplied for the matched category (grounding)", () => {
    const report: ViolationReport = {
      description: "The lawn is overgrown",
      rules: [{ category: "landscaping", ruleId: "chc.ccr.4.2", citation: "CC&R Art. IV §4.2", text: "Lawns shall be kept mowed below 6 inches." }],
    };
    const r = categorizeViolation(report);
    expect(r.category).toBe("landscaping");
    expect(r.rule.source).toBe("association");
    expect(r.rule.ruleId).toBe("chc.ccr.4.2");
    expect(r.rule.citation).toBe("CC&R Art. IV §4.2");
  });

  it("uses the standard-category rule when the association supplies none", () => {
    const r = categorizeViolation({ description: "The lawn is overgrown" });
    expect(r.rule.source).toBe("standard");
    expect(r.rule.ruleId).toBe("std.landscaping");
  });
});

describe("summarizeEvidence + draftNotice (AC2 — draft grounded in rule + evidence)", () => {
  it("summarizes the report text + photo refs", () => {
    const e = summarizeEvidence({ description: "overgrown lawn", photos: ["p1.jpg", "p2.jpg", ""] });
    expect(e.photoCount).toBe(2);
    expect(e.photoRefs).toEqual(["p1.jpg", "p2.jpg"]);
    expect(e.descriptionExcerpt).toBe("overgrown lawn");
  });

  it("drafts a notice that cites the triggered rule + names the evidence", () => {
    const report: ViolationReport = { description: "The lawn is overgrown with weeds", photos: ["a.jpg"], unitLabel: "12B", ownerName: "Jane Doe" };
    const cat = categorizeViolation(report);
    const ev = summarizeEvidence(report);
    const notice = draftNotice(cat, ev, report, { associationName: "Cherry Hill Court" });
    expect(notice.subject).toContain("landscaping");
    expect(notice.body).toContain(cat.rule.citation); // grounded in the rule
    expect(notice.body).toContain(cat.rule.text);
    expect(notice.body).toContain("1 photo"); // names the evidence
    expect(notice.body).toContain("Jane Doe");
    expect(notice.body).toContain("Cherry Hill Court");
    // It must read as a DRAFT that a human signs — never a final issued notice.
    expect(notice.body.toLowerCase()).toContain("draft");
    expect(notice.body.toLowerCase()).toContain("sign before");
  });
});

describe("buildReasoning (AC4 — reasoning shows the rule + the evidence)", () => {
  it("names the triggered rule, its source, and the evidence used", () => {
    const report: ViolationReport = { description: "inoperable truck in the driveway", photos: ["x.jpg", "y.jpg"] };
    const cat = categorizeViolation(report);
    const ev = summarizeEvidence(report);
    const reasoning = buildReasoning(cat, ev);
    expect(reasoning).toContain(cat.rule.citation);
    expect(reasoning).toContain(cat.rule.text);
    expect(reasoning).toContain("2 photo");
    expect(reasoning.toLowerCase()).toContain("parking_vehicle");
  });
});

describe("triageAndQueueViolation (AC3 + AC5 — files L2 draft+route end-to-end; cannot issue without a signature)", () => {
  it("files a single reversible.draft_notice (L2) action with grounded reasoning + the draft payload", async () => {
    const { file, calls } = fakeFileDep();
    const report: ViolationReport = {
      description: "Owner painted the front door without ARC approval",
      photos: ["door1.jpg"],
      unitLabel: "7A",
      ownerName: "Sam Smith",
    };
    const { action, categorization, notice } = await triageAndQueueViolation(
      { associationId: "assoc-1", report, associationName: "Maple HOA" },
      { file },
    );

    // exactly one action filed, and it is the L2 DRAFT — never a send.
    expect(calls).toHaveLength(1);
    expect(calls[0].actionType).toBe(DRAFT_NOTICE_ACTION_TYPE);
    expect(calls[0].actionType).not.toBe(SEND_NOTICE_ACTION_TYPE);
    expect(action.actionType).toBe(DRAFT_NOTICE_ACTION_TYPE);
    expect(action.status).toBe("queued");

    // routed with the grounded reasoning (rule + evidence) + the draft payload.
    expect(action.reasoning).toContain(categorization.rule.citation);
    expect(action.reasoning).toContain("photo");
    const payload = calls[0].payload as { kind: string; notice: unknown; rule: unknown };
    expect(payload.kind).toBe("violation_notice_draft");
    expect(payload.notice).toBeTruthy();
    expect(notice.category).toBe("architectural");
    expect(action.targetEntityType).toBe("violation_report");
  });

  it("AC3: the filed action is L2, and the REAL W1 gate refuses to issue it without a recorded human approval", async () => {
    const { file } = fakeFileDep();
    const { action } = await triageAndQueueViolation(
      { associationId: "assoc-1", report: { description: "overgrown lawn" } },
      { file },
    );
    // Server-authoritative: draft_notice is L2; send_owner_notice is L3 (out of scope).
    expect(levelForActionType(DRAFT_NOTICE_ACTION_TYPE)).toBe("L2");
    expect(levelForActionType(SEND_NOTICE_ACTION_TYPE)).toBe("L3");
    // With the autonomy toggle OFF, a queued L2 action cannot execute — a human
    // approval (signature) is required first.
    const gateOff = evaluateGate({ level: action.level, status: "queued", autoApprove: false });
    expect(gateOff.executable).toBe(false);
    expect(gateOff.code).toBe("APPROVAL_REQUIRED");
    // And ISSUING the notice (the L3 send) can NEVER auto-execute — always approval.
    const sendGate = evaluateGate({ level: "L3", status: "queued", autoApprove: true });
    expect(sendGate.executable).toBe(false);
    expect(sendGate.code).toBe("APPROVAL_REQUIRED");
  });

  it("rejects an empty report (validation)", async () => {
    const { file } = fakeFileDep();
    await expect(triageAndQueueViolation({ associationId: "a", report: { description: "  " } }, { file })).rejects.toThrow();
    await expect(triageAndQueueViolation({ associationId: "", report: { description: "x" } }, { file })).rejects.toThrow();
  });
});
