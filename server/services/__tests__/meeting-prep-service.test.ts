/**
 * Meeting-prep agent ability — pure logic + injected-deps unit tests
 * (founder-os#9478).
 *
 * Exercises the deterministic aggregation-ranking, agenda-drafting, and
 * packet-assembly functions directly (no database), plus the DB-composing
 * entrypoint via injected FAKE data + file deps — the same seam pattern
 * `violation-triage-service.test.ts` uses for `ViolationTriageDeps`. Proves
 * the REAL server-authoritative ladder (`levelForActionType`) assigns
 * `suggest.meeting_prep` → L1 and `reversible.distribute_meeting_packet` → L2.
 *
 * DB-backed read/isolation behavior + the full real-fileAction path are
 * covered in `meeting-prep-flow.test.ts`.
 */
import { describe, expect, it, vi } from "vitest";
import type { AgentAction } from "@shared/schema";

// agent-action-service does `import { db } from "../db"` at module load (which
// throws without DATABASE_URL); stub it minimally, mirroring
// violation-triage-service.test.ts. The pure functions + fake-dep entrypoint
// here never touch it.
vi.mock("../../db", () => ({ db: {} }));

import { levelForActionType } from "../agent-action-service";
import type { FileActionInput } from "../agent-action-service";
import {
  aggregateActivity,
  assemblePacket,
  buildReasoning,
  draftAgenda,
  mapPriorityToSeverity,
  MEETING_PACKET_DISTRIBUTE_ACTION_TYPE,
  MEETING_PREP_ACTION_TYPE,
  prepareMeetingPacket,
  rankActivity,
  severityFromDeadline,
  type ActivityItem,
  type MeetingPrepDataDeps,
  type PriorMeetingSummary,
} from "../meeting-prep-service";

const ASSOC = "assoc-1";
const NOW = new Date("2026-07-08T12:00:00Z");

function item(over: Partial<ActivityItem> & Pick<ActivityItem, "ref">): ActivityItem {
  return {
    title: "Item",
    detail: "Detail",
    severity: "medium",
    createdAt: NOW,
    statutoryDeadline: null,
    status: "open",
    ...over,
  };
}

describe("mapPriorityToSeverity", () => {
  it("maps the maintenance/work-order priority vocabulary onto the agent-action severity vocabulary", () => {
    expect(mapPriorityToSeverity("urgent")).toBe("critical");
    expect(mapPriorityToSeverity("high")).toBe("high");
    expect(mapPriorityToSeverity("medium")).toBe("medium");
    expect(mapPriorityToSeverity("low")).toBe("low");
    expect(mapPriorityToSeverity("unknown-value")).toBe("medium");
  });
});

describe("severityFromDeadline", () => {
  it("escalates as a statutory deadline approaches or passes", () => {
    expect(severityFromDeadline(null, NOW)).toBe("medium");
    expect(severityFromDeadline(new Date("2026-07-01T00:00:00Z"), NOW)).toBe("critical"); // overdue
    expect(severityFromDeadline(new Date("2026-07-09T12:00:00Z"), NOW)).toBe("critical"); // 1 day out
    expect(severityFromDeadline(new Date("2026-07-12T12:00:00Z"), NOW)).toBe("high"); // 4 days out
    expect(severityFromDeadline(new Date("2026-08-01T12:00:00Z"), NOW)).toBe("medium"); // far out
  });
});

describe("rankActivity (pure ranking)", () => {
  it("pins statutory-deadline items to the top (soonest first), then severity desc, then oldest-created first", () => {
    const items: ActivityItem[] = [
      item({ ref: { type: "work_order", id: "w1" }, severity: "low", createdAt: new Date("2026-06-01") }),
      item({ ref: { type: "records_request", id: "r1" }, statutoryDeadline: new Date("2026-07-20"), severity: "medium" }),
      item({ ref: { type: "records_request", id: "r2" }, statutoryDeadline: new Date("2026-07-10"), severity: "medium" }),
      item({ ref: { type: "violation_action", id: "v1" }, severity: "critical", createdAt: new Date("2026-06-15") }),
      item({ ref: { type: "maintenance_request", id: "m1" }, severity: "critical", createdAt: new Date("2026-06-10") }),
    ];
    const ranked = rankActivity(items);
    // Both deadline-bearing items float to the top, soonest first.
    expect(ranked[0].ref.id).toBe("r2");
    expect(ranked[1].ref.id).toBe("r1");
    // Then non-deadline items by severity desc, then oldest-created first.
    expect(ranked[2].ref.id).toBe("m1"); // critical, created 06-10 (older)
    expect(ranked[3].ref.id).toBe("v1"); // critical, created 06-15
    expect(ranked[4].ref.id).toBe("w1"); // low
  });
});

function fakeData(overrides: Partial<MeetingPrepDataDeps> = {}): MeetingPrepDataDeps {
  return {
    fetchOpenMaintenanceRequests: vi.fn(async () => []),
    fetchOpenRecordsRequests: vi.fn(async () => []),
    fetchOpenWorkOrders: vi.fn(async () => []),
    fetchViolationActions: vi.fn(async () => []),
    fetchPriorMeeting: vi.fn(async () => null),
    ...overrides,
  };
}

describe("aggregateActivity (sinceDate defaulting)", () => {
  it("defaults sinceDate to the day after the prior completed meeting when discoverable", async () => {
    const priorMeeting: PriorMeetingSummary = {
      ref: { type: "prior_meeting", id: "mtg-1" },
      title: "June Board Meeting",
      scheduledAt: new Date("2026-06-15T18:00:00Z"),
      summary: "Discussed the roof project.",
      notes: [],
    };
    const deps = fakeData({ fetchPriorMeeting: vi.fn(async () => priorMeeting) });
    const activity = await aggregateActivity(ASSOC, { meetingDate: NOW }, deps);
    expect(activity.sinceDate.getTime()).toBe(priorMeeting.scheduledAt.getTime() + 1000);
    expect(activity.priorMeeting).toEqual(priorMeeting);
  });

  it("defaults sinceDate to 30 days before meetingDate when no prior meeting exists", async () => {
    const deps = fakeData();
    const activity = await aggregateActivity(ASSOC, { meetingDate: NOW }, deps);
    const expected = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(activity.sinceDate.getTime()).toBe(expected.getTime());
    expect(activity.priorMeeting).toBeNull();
  });

  it("honors an explicit sinceDate override", async () => {
    const explicit = new Date("2026-01-01T00:00:00Z");
    const deps = fakeData();
    const activity = await aggregateActivity(ASSOC, { meetingDate: NOW, sinceDate: explicit }, deps);
    expect(activity.sinceDate.getTime()).toBe(explicit.getTime());
  });

  it("rejects a missing associationId", async () => {
    await expect(aggregateActivity("", {}, fakeData())).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("draftAgenda (AC2 — every line carries sourceRefs; items map to correct sections)", () => {
  it("groups items into the correct named sections, one line per item, each with its sourceRef", async () => {
    const activity = await aggregateActivity(
      ASSOC,
      { meetingDate: NOW },
      fakeData({
        fetchOpenMaintenanceRequests: vi.fn(async () => [
          item({ ref: { type: "maintenance_request", id: "m1" }, title: "Leaky roof" }),
        ]),
        fetchOpenWorkOrders: vi.fn(async () => [item({ ref: { type: "work_order", id: "w1" }, title: "Fix gutter" })]),
        fetchOpenRecordsRequests: vi.fn(async () => [
          item({ ref: { type: "records_request", id: "r1" }, title: "Owner records request" }),
        ]),
        fetchViolationActions: vi.fn(async () => [
          item({ ref: { type: "violation_action", id: "v1" }, title: "Landscaping notice" }),
        ]),
      }),
    );

    const agenda = draftAgenda(activity);
    const byTitle = new Map(agenda.sections.map((s) => [s.title, s]));

    expect(byTitle.get("Compliance & Violations")!.lines).toHaveLength(1);
    expect(byTitle.get("Compliance & Violations")!.lines[0].sourceRefs).toEqual([{ type: "violation_action", id: "v1" }]);

    // Maintenance requests AND work orders share one section, one line each.
    const maintSection = byTitle.get("Maintenance & Work Orders")!;
    expect(maintSection.lines).toHaveLength(2);
    const maintRefs = maintSection.lines.flatMap((l) => l.sourceRefs);
    expect(maintRefs).toContainEqual({ type: "maintenance_request", id: "m1" });
    expect(maintRefs).toContainEqual({ type: "work_order", id: "w1" });

    expect(byTitle.get("Owner Records Requests (Statutory)")!.lines).toHaveLength(1);
    expect(byTitle.get("Owner Records Requests (Statutory)")!.lines[0].sourceRefs).toEqual([
      { type: "records_request", id: "r1" },
    ]);

    // Every single agenda line, across every section, carries >=1 sourceRef.
    for (const section of agenda.sections) {
      for (const line of section.lines) {
        expect(line.sourceRefs.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("omits empty sections and produces an honest call-to-order note with no prior meeting", () => {
    const agenda = draftAgenda({
      associationId: ASSOC,
      meetingDate: NOW,
      sinceDate: NOW,
      items: [],
      priorMeeting: null,
    });
    expect(agenda.sections).toHaveLength(0);
    expect(agenda.priorMeetingRef).toBeNull();
    expect(agenda.callToOrderNote).toMatch(/no prior completed meeting/i);
    expect(agenda.adjournmentNote).toMatch(/no open activity/i);
  });
});

describe("assemblePacket", () => {
  it("expands each line with the supporting detail of its source item and counts activity by source", () => {
    const violation = item({ ref: { type: "violation_action", id: "v1" }, title: "Notice", detail: "Full evidence text" });
    const activity = {
      associationId: ASSOC,
      meetingDate: NOW,
      sinceDate: NOW,
      items: [violation],
      priorMeeting: null,
    };
    const agenda = draftAgenda(activity);
    const packet = assemblePacket(agenda, activity);
    expect(packet.kind).toBe("meeting_agenda_packet");
    expect(packet.activityCounts.violation_action).toBe(1);
    expect(packet.activityCounts.maintenance_request).toBe(0);
    const section = packet.sections.find((s) => s.title === "Compliance & Violations")!;
    expect(section.lines[0].supportingDetail).toBe("Full evidence text");
    expect(section.lines[0].sourceRefs).toEqual([{ type: "violation_action", id: "v1" }]);
  });
});

describe("buildReasoning", () => {
  it("states the per-source counts and the prior-meeting reference honestly", () => {
    const activity = {
      associationId: ASSOC,
      meetingDate: NOW,
      sinceDate: new Date("2026-06-16T00:00:00Z"),
      items: [item({ ref: { type: "work_order", id: "w1" } })],
      priorMeeting: {
        ref: { type: "prior_meeting" as const, id: "mtg-1" },
        title: "June Board Meeting",
        scheduledAt: new Date("2026-06-15T18:00:00Z"),
        summary: null,
        notes: [],
      },
    };
    const agenda = draftAgenda(activity);
    const reasoning = buildReasoning(activity, agenda);
    expect(reasoning).toContain("1 open work order(s)");
    expect(reasoning).toContain("June Board Meeting");
    expect(reasoning).toContain(MEETING_PACKET_DISTRIBUTE_ACTION_TYPE);
  });
});

describe("prepareMeetingPacket (AC3/AC4 — real ladder, injected file dep)", () => {
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

  it("files the drafted packet as suggest.meeting_prep, which the REAL ladder assigns to L1", async () => {
    const { file, calls } = fakeFileDep();
    const violation = item({ ref: { type: "violation_action", id: "v1" }, severity: "high" });
    const result = await prepareMeetingPacket(
      { associationId: ASSOC, meetingDate: NOW, createdByAgent: "test-agent" },
      { data: fakeData({ fetchViolationActions: vi.fn(async () => [violation]) }), file },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].actionType).toBe(MEETING_PREP_ACTION_TYPE);
    expect(calls[0].associationId).toBe(ASSOC);
    expect(calls[0].targetEntityType).toBe("governance_meeting");
    expect(calls[0].payload).toMatchObject({ kind: "meeting_agenda_packet" });
    expect(calls[0].severity).toBe("high"); // overall severity = highest item severity

    expect(result.action.actionType).toBe(MEETING_PREP_ACTION_TYPE);
    expect(result.action.level).toBe("L1"); // real levelForActionType()
    expect(result.action.status).toBe("queued");
    expect(result.packet.activityCounts.violation_action).toBe(1);
  });

  it("rejects a missing associationId before touching any dep", async () => {
    const { file } = fakeFileDep();
    await expect(prepareMeetingPacket({ associationId: "" }, { data: fakeData(), file })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    expect(file).not.toHaveBeenCalled();
  });

  it("AC4 — the distribution action-type maps to L2 via the real ladder, and this ability never files it", async () => {
    expect(levelForActionType(MEETING_PACKET_DISTRIBUTE_ACTION_TYPE)).toBe("L2");
    const { file, calls } = fakeFileDep();
    await prepareMeetingPacket({ associationId: ASSOC, meetingDate: NOW }, { data: fakeData(), file });
    expect(calls.every((c) => c.actionType !== MEETING_PACKET_DISTRIBUTE_ACTION_TYPE)).toBe(true);
  });
});
