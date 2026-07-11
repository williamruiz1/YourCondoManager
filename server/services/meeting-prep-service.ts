/**
 * Meeting-prep agent ability (founder-os#9478).
 *
 * Aggregates an association's recent activity — open maintenance issues, open
 * statutory owner records requests ("cases"), open work orders, violation
 * notices in flight, and the prior governance meeting's minutes — into a
 * STRUCTURED draft meeting agenda + a supporting packet, and files it onto the
 * W1 Chief-of-Staff queue (founder-os#9474) as a `suggest.meeting_prep` (L1)
 * action for human review. The action-type is PRE-PROVISIONED in the
 * server-authoritative ladder (agent-action-service.ts ACTION_TYPE_LEVELS) —
 * this ability is its first consumer.
 *
 * No dedicated "violations" table exists in this schema (see
 * violation-triage-service.ts, founder-os#9479 W2): a violation is represented
 * as a queued/approved/executed `reversible.draft_notice` /
 * `irreversible.send_owner_notice` agent action. This ability aggregates those
 * agent-action rows as the "violations" activity class — the honest
 * representation given the substrate, rather than inventing a parallel store.
 *
 * "Cases" is represented by `records_requests` (the statutory owner
 * records-request docket, CGS §47-260, with its own `responseDueAt` deadline) —
 * the closest first-class "case" concept in this schema.
 *
 * Design (mirrors violation-triage-service.ts): the AGGREGATION + DRAFTING
 * logic is deterministic and template-based, NOT LLM-backed. Every agenda line
 * carries the exact activity-item reference(s) that produced it (sourceRefs),
 * so the agenda is fully traceable back to its source rows — a property an
 * LLM-authored draft could not guarantee without a separate verification pass.
 * The existing `server/services/ai-assistant/llm-adapter.ts` is a STREAMING
 * CHAT adapter built for the resident conversational assistant (RAG retrieval +
 * an `AsyncIterable` of chat turns); it has no structured/deterministic-output
 * contract, so reusing it here would risk inventing agenda items with no
 * source grounding — exactly what the acceptance criteria forbid. A future
 * slice could layer an LLM PHRASING pass on top of this structured draft
 * (reword the lines this module produces — never invent new ones).
 *
 * DISTRIBUTION IS OUT OF SCOPE. `MEETING_PACKET_DISTRIBUTE_ACTION_TYPE` is
 * named here (L2, server-authoritative) so the boundary is legible +
 * assertable — this service NEVER files it. No auto-send anywhere.
 *
 * Design note (mirrors agent-action-service.ts): the pure drafting functions
 * (`draftAgenda`, `assemblePacket`, `buildReasoning`, `severityFromDeadline`,
 * `mapPriorityToSeverity`) are exported for direct unit testing; the DB reads
 * live behind the injectable `MeetingPrepDataDeps` seam (same pattern as
 * `ViolationTriageDeps`) so the whole path is testable without a live database.
 */
import { and, asc, desc, eq, inArray, lt, notInArray } from "drizzle-orm";
import { db } from "../db";
import {
  agentActions,
  governanceMeetings,
  maintenanceRequests,
  meetingNotes,
  recordsRequests,
  workOrders,
  type AgentAction,
} from "@shared/schema";
import { fileAction, AgentActionError, type FileActionInput } from "./agent-action-service";

// The L1 action-type the agenda+packet draft files under. Pre-provisioned in
// the W1 server-authoritative ladder — see agent-action-service.ts.
export const MEETING_PREP_ACTION_TYPE = "suggest.meeting_prep";
// The L2 action-type that would DISTRIBUTE the packet — explicitly OUT of
// scope for this ability. Named here so the boundary is legible + assertable.
export const MEETING_PACKET_DISTRIBUTE_ACTION_TYPE = "reversible.distribute_meeting_packet";

// The agent-action types this ability treats as the "violations" activity
// class (see file header — no dedicated violations table exists).
const VIOLATION_ACTION_TYPES = ["reversible.draft_notice", "irreversible.send_owner_notice"] as const;
// Agent-action statuses that still need board attention regardless of age.
const VIOLATION_OPEN_STATUSES = ["queued", "approved"] as const;

const DEFAULT_LOOKBACK_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBefore(date: Date, days: number): Date {
  return new Date(date.getTime() - days * MS_PER_DAY);
}

// ── Severity mapping (pure) ───────────────────────────────────────────────────
export type Severity = "low" | "medium" | "high" | "critical";

/** Maps the maintenance/work-order priority vocabulary onto the agent-action
 *  severity vocabulary (which agent-action-service.ts ranks low<medium<high<critical). */
export function mapPriorityToSeverity(priority: string): Severity {
  switch (priority) {
    case "urgent":
      return "critical";
    case "high":
      return "high";
    case "low":
      return "low";
    default:
      return "medium";
  }
}

/** A statutory-deadline-driven severity: overdue/imminent deadlines escalate
 *  a records request even though it carries no independent priority field. */
export function severityFromDeadline(deadline: Date | null | undefined, now: Date): Severity {
  if (!deadline) return "medium";
  const daysUntil = (deadline.getTime() - now.getTime()) / MS_PER_DAY;
  if (daysUntil < 0) return "critical"; // already overdue
  if (daysUntil <= 2) return "critical";
  if (daysUntil <= 5) return "high";
  return "medium";
}

// ── Activity model (pure types) ───────────────────────────────────────────────
export type ActivitySourceType = "maintenance_request" | "records_request" | "work_order" | "violation_action";

export interface SourceRef {
  type: ActivitySourceType;
  id: string;
}

export interface ActivityItem {
  ref: SourceRef;
  title: string;
  detail: string;
  severity: Severity;
  createdAt: Date;
  statutoryDeadline: Date | null;
  status: string;
}

export interface PriorMeetingNote {
  id: string;
  noteType: string;
  content: string;
}

export interface PriorMeetingSummary {
  ref: { type: "prior_meeting"; id: string };
  title: string;
  scheduledAt: Date;
  summary: string | null;
  notes: PriorMeetingNote[];
}

export interface AggregatedActivity {
  associationId: string;
  meetingDate: Date;
  sinceDate: Date;
  items: ActivityItem[];
  priorMeeting: PriorMeetingSummary | null;
}

// ── Injectable data-access deps (mirrors ViolationTriageDeps) ────────────────
export interface MeetingPrepDataDeps {
  fetchOpenMaintenanceRequests(associationId: string): Promise<ActivityItem[]>;
  fetchOpenRecordsRequests(associationId: string, now: Date): Promise<ActivityItem[]>;
  fetchOpenWorkOrders(associationId: string): Promise<ActivityItem[]>;
  fetchViolationActions(associationId: string, sinceDate: Date): Promise<ActivityItem[]>;
  fetchPriorMeeting(associationId: string, beforeDate: Date): Promise<PriorMeetingSummary | null>;
}

async function fetchOpenMaintenanceRequestsDb(associationId: string): Promise<ActivityItem[]> {
  const rows = await db
    .select()
    .from(maintenanceRequests)
    .where(
      and(
        eq(maintenanceRequests.associationId, associationId),
        notInArray(maintenanceRequests.status, ["resolved", "closed", "rejected"]),
      ),
    );
  return rows.map((r) => ({
    ref: { type: "maintenance_request", id: r.id },
    title: `Open maintenance issue: ${r.title}`,
    detail: [
      r.description,
      r.locationText ? `Location: ${r.locationText}` : null,
      `Category: ${r.category}`,
      r.unitId ? `Unit: ${r.unitId}` : null,
    ]
      .filter(Boolean)
      .join(" — "),
    severity: mapPriorityToSeverity(r.priority),
    createdAt: r.createdAt,
    statutoryDeadline: r.responseDueAt ?? null,
    status: r.status,
  }));
}

async function fetchOpenRecordsRequestsDb(associationId: string, now: Date): Promise<ActivityItem[]> {
  const rows = await db
    .select()
    .from(recordsRequests)
    .where(
      and(
        eq(recordsRequests.associationId, associationId),
        notInArray(recordsRequests.status, ["fulfilled", "withheld", "closed"]),
      ),
    );
  return rows.map((r) => ({
    ref: { type: "records_request", id: r.id },
    title: `Owner records request — ${r.requesterName}`,
    detail: [`Requested: ${r.recordsRequested}`, `Status: ${r.status}`, `Received: ${r.receivedAt.toISOString().slice(0, 10)}`].join(" — "),
    severity: severityFromDeadline(r.responseDueAt, now),
    createdAt: r.createdAt,
    statutoryDeadline: r.responseDueAt,
    status: r.status,
  }));
}

async function fetchOpenWorkOrdersDb(associationId: string): Promise<ActivityItem[]> {
  const rows = await db
    .select()
    .from(workOrders)
    .where(and(eq(workOrders.associationId, associationId), notInArray(workOrders.status, ["closed", "cancelled"])));
  return rows.map((r) => ({
    ref: { type: "work_order", id: r.id },
    title: `Work order: ${r.title}`,
    detail: [r.description, `Category: ${r.category}`, r.vendorId ? `Vendor: ${r.vendorId}` : "Vendor: unassigned", `Status: ${r.status}`]
      .filter(Boolean)
      .join(" — "),
    severity: mapPriorityToSeverity(r.priority),
    createdAt: r.createdAt,
    statutoryDeadline: r.scheduledFor ?? null,
    status: r.status,
  }));
}

/** Humanizes a violation agent-action-type for display ("reversible.draft_notice" → "draft notice"). */
function humanizeActionType(actionType: string): string {
  const suffix = actionType.split(".").slice(1).join(" ");
  return suffix.replace(/_/g, " ");
}

async function fetchViolationActionsDb(associationId: string, sinceDate: Date): Promise<ActivityItem[]> {
  const rows = await db
    .select()
    .from(agentActions)
    .where(
      and(eq(agentActions.associationId, associationId), inArray(agentActions.actionType, [...VIOLATION_ACTION_TYPES])),
    );
  const filtered = rows.filter(
    (r) => (VIOLATION_OPEN_STATUSES as readonly string[]).includes(r.status) || r.createdAt.getTime() >= sinceDate.getTime(),
  );
  return filtered.map((r) => ({
    ref: { type: "violation_action", id: r.id },
    title: `Violation notice — ${humanizeActionType(r.actionType)}`,
    detail: [r.reasoning, `Level: ${r.level}`, `Status: ${r.status}`].filter(Boolean).join(" — "),
    severity: (r.severity as Severity) ?? "medium",
    createdAt: r.createdAt,
    statutoryDeadline: r.statutoryDeadline ?? null,
    status: r.status,
  }));
}

async function fetchPriorMeetingDb(associationId: string, beforeDate: Date): Promise<PriorMeetingSummary | null> {
  const rows = await db
    .select()
    .from(governanceMeetings)
    .where(
      and(
        eq(governanceMeetings.associationId, associationId),
        eq(governanceMeetings.status, "completed"),
        lt(governanceMeetings.scheduledAt, beforeDate),
      ),
    )
    .orderBy(desc(governanceMeetings.scheduledAt));
  const prior = rows[0];
  if (!prior) return null;
  const noteRows = await db
    .select()
    .from(meetingNotes)
    .where(eq(meetingNotes.meetingId, prior.id))
    .orderBy(asc(meetingNotes.createdAt));
  return {
    ref: { type: "prior_meeting", id: prior.id },
    title: prior.title,
    scheduledAt: prior.scheduledAt,
    summary: prior.summaryText ?? prior.notes ?? null,
    notes: noteRows.map((n) => ({ id: n.id, noteType: n.noteType, content: n.content })),
  };
}

export const defaultMeetingPrepDataDeps: MeetingPrepDataDeps = {
  fetchOpenMaintenanceRequests: fetchOpenMaintenanceRequestsDb,
  fetchOpenRecordsRequests: fetchOpenRecordsRequestsDb,
  fetchOpenWorkOrders: fetchOpenWorkOrdersDb,
  fetchViolationActions: fetchViolationActionsDb,
  fetchPriorMeeting: fetchPriorMeetingDb,
};

// ── Aggregation (pure ranking; DB reads via injected deps) ───────────────────
const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

/** PURE ranking: statutory-deadline items pin to the top (soonest first), then
 *  by severity desc, then oldest-created first — mirrors agent-action-service's
 *  `rankQueue` so the agenda's internal ordering matches the CoS queue's. */
export function rankActivity(items: ActivityItem[]): ActivityItem[] {
  return [...items].sort((a, b) => {
    const aHas = a.statutoryDeadline != null;
    const bHas = b.statutoryDeadline != null;
    if (aHas && bHas) {
      const d = a.statutoryDeadline!.getTime() - b.statutoryDeadline!.getTime();
      if (d !== 0) return d;
    } else if (aHas !== bHas) {
      return aHas ? -1 : 1;
    }
    const s = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (s !== 0) return s;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export interface AggregateActivityOptions {
  meetingDate?: Date;
  sinceDate?: Date;
}

/**
 * Aggregates the association's current activity across all four sources.
 * `sinceDate` defaults to the day after the last completed prior meeting when
 * discoverable, else `DEFAULT_LOOKBACK_DAYS` before `meetingDate`. Currently
 * OPEN maintenance/records/work-order rows are included regardless of age
 * (an open item stays actionable however old it is); violation actions are
 * included if still unresolved OR filed/decided since `sinceDate` (so a
 * recently-executed/rejected notice still gets one meeting cycle of visibility).
 */
export async function aggregateActivity(
  associationId: string,
  opts: AggregateActivityOptions = {},
  deps: MeetingPrepDataDeps = defaultMeetingPrepDataDeps,
): Promise<AggregatedActivity> {
  if (!associationId) throw new AgentActionError("associationId required", "VALIDATION");
  const meetingDate = opts.meetingDate ?? new Date();
  const priorMeeting = await deps.fetchPriorMeeting(associationId, meetingDate);
  const sinceDate = opts.sinceDate ?? (priorMeeting ? new Date(priorMeeting.scheduledAt.getTime() + 1000) : daysBefore(meetingDate, DEFAULT_LOOKBACK_DAYS));

  const [maintenance, records, work, violations] = await Promise.all([
    deps.fetchOpenMaintenanceRequests(associationId),
    deps.fetchOpenRecordsRequests(associationId, meetingDate),
    deps.fetchOpenWorkOrders(associationId),
    deps.fetchViolationActions(associationId, sinceDate),
  ]);

  return {
    associationId,
    meetingDate,
    sinceDate,
    items: rankActivity([...maintenance, ...records, ...work, ...violations]),
    priorMeeting,
  };
}

// ── Agenda draft (pure) ───────────────────────────────────────────────────────
export interface AgendaLine {
  text: string;
  sourceRefs: SourceRef[];
  severity: Severity;
  statutoryDeadline: Date | null;
}

export interface AgendaSection {
  title: string;
  lines: AgendaLine[];
}

export interface AgendaDraft {
  meetingDate: Date;
  sinceDate: Date;
  priorMeetingRef: { type: "prior_meeting"; id: string } | null;
  callToOrderNote: string;
  sections: AgendaSection[];
  adjournmentNote: string;
}

const SECTION_TITLES: Record<ActivitySourceType, string> = {
  violation_action: "Compliance & Violations",
  maintenance_request: "Maintenance & Work Orders",
  work_order: "Maintenance & Work Orders",
  records_request: "Owner Records Requests (Statutory)",
};

const SECTION_ORDER: string[] = ["Compliance & Violations", "Maintenance & Work Orders", "Owner Records Requests (Statutory)"];

function lineTextFor(item: ActivityItem): string {
  const deadline = item.statutoryDeadline ? ` (due ${item.statutoryDeadline.toISOString().slice(0, 10)})` : "";
  return `${item.title} — ${item.detail}${deadline} [status: ${item.status}]`;
}

/**
 * PURE agenda drafter. Groups the ranked activity items into named sections,
 * one AGENDA LINE per activity item (never merged), each carrying the exact
 * `sourceRefs` that produced it — full traceability, no invented content. The
 * LLM (if ever layered on top) may reword `text`; it may never add or drop a
 * line, and it may never touch `sourceRefs`.
 */
export function draftAgenda(activity: AggregatedActivity): AgendaDraft {
  const bySection = new Map<string, AgendaLine[]>();
  for (const item of activity.items) {
    const title = SECTION_TITLES[item.ref.type];
    const line: AgendaLine = {
      text: lineTextFor(item),
      sourceRefs: [item.ref],
      severity: item.severity,
      statutoryDeadline: item.statutoryDeadline,
    };
    const existing = bySection.get(title) ?? [];
    existing.push(line);
    bySection.set(title, existing);
  }

  const sections: AgendaSection[] = SECTION_ORDER.filter((title) => bySection.has(title)).map((title) => ({
    title,
    lines: bySection.get(title)!,
  }));

  const priorMeeting = activity.priorMeeting;
  const callToOrderNote = priorMeeting
    ? `Review + approve minutes from the prior meeting: "${priorMeeting.title}" on ${priorMeeting.scheduledAt.toISOString().slice(0, 10)}.`
    : "No prior completed meeting on record — this is the association's first meeting in the system, or minutes were not recorded.";

  const adjournmentNote =
    activity.items.length === 0
      ? "No open activity since the prior meeting — a short meeting is expected."
      : `${activity.items.length} item(s) covered above. Adjournment upon completion of the agenda.`;

  return {
    meetingDate: activity.meetingDate,
    sinceDate: activity.sinceDate,
    priorMeetingRef: priorMeeting?.ref ?? null,
    callToOrderNote,
    sections,
    adjournmentNote,
  };
}

// ── Packet assembly (pure) ────────────────────────────────────────────────────
export interface PacketLine {
  text: string;
  sourceRefs: SourceRef[];
  severity: Severity;
  statutoryDeadline: string | null; // ISO
  supportingDetail: string;
}

export interface PacketSection {
  title: string;
  lines: PacketLine[];
}

export interface MeetingPacket {
  kind: "meeting_agenda_packet";
  meetingDate: string; // ISO
  sinceDate: string; // ISO
  priorMeeting: {
    ref: { type: "prior_meeting"; id: string };
    title: string;
    scheduledAt: string;
    summary: string | null;
    notes: PriorMeetingNote[];
  } | null;
  callToOrderNote: string;
  sections: PacketSection[];
  adjournmentNote: string;
  activityCounts: Record<ActivitySourceType, number>;
}

/**
 * PURE packet assembler. Expands each agenda line with the full supporting
 * detail of the activity item(s) it references (an appendix a board member can
 * read for the whole story, not just the one-line agenda text).
 */
export function assemblePacket(agenda: AgendaDraft, activity: AggregatedActivity): MeetingPacket {
  const byRef = new Map<string, ActivityItem>();
  for (const item of activity.items) byRef.set(`${item.ref.type}:${item.ref.id}`, item);

  const sections: PacketSection[] = agenda.sections.map((section) => ({
    title: section.title,
    lines: section.lines.map((line) => {
      const detail = line.sourceRefs
        .map((ref) => byRef.get(`${ref.type}:${ref.id}`)?.detail ?? "")
        .filter(Boolean)
        .join(" | ");
      return {
        text: line.text,
        sourceRefs: line.sourceRefs,
        severity: line.severity,
        statutoryDeadline: line.statutoryDeadline ? line.statutoryDeadline.toISOString() : null,
        supportingDetail: detail,
      };
    }),
  }));

  const activityCounts: Record<ActivitySourceType, number> = {
    maintenance_request: 0,
    records_request: 0,
    work_order: 0,
    violation_action: 0,
  };
  for (const item of activity.items) activityCounts[item.ref.type] += 1;

  return {
    kind: "meeting_agenda_packet",
    meetingDate: agenda.meetingDate.toISOString(),
    sinceDate: agenda.sinceDate.toISOString(),
    priorMeeting: activity.priorMeeting
      ? {
          ref: activity.priorMeeting.ref,
          title: activity.priorMeeting.title,
          scheduledAt: activity.priorMeeting.scheduledAt.toISOString(),
          summary: activity.priorMeeting.summary,
          notes: activity.priorMeeting.notes,
        }
      : null,
    callToOrderNote: agenda.callToOrderNote,
    sections,
    adjournmentNote: agenda.adjournmentNote,
    activityCounts,
  };
}

/** The queue-visible reasoning — which sources drove which counts (traceability, AC-honesty). */
export function buildReasoning(activity: AggregatedActivity, agenda: AgendaDraft): string {
  const counts: Record<ActivitySourceType, number> = {
    maintenance_request: 0,
    records_request: 0,
    work_order: 0,
    violation_action: 0,
  };
  for (const item of activity.items) counts[item.ref.type] += 1;
  const priorLine = activity.priorMeeting
    ? `Prior meeting on record: "${activity.priorMeeting.title}" (${activity.priorMeeting.scheduledAt.toISOString().slice(0, 10)}).`
    : "No prior completed meeting found on record.";
  return [
    `Aggregated activity since ${activity.sinceDate.toISOString().slice(0, 10)}: ${counts.maintenance_request} open maintenance issue(s), ${counts.records_request} open owner records request(s) (statutory cases), ${counts.work_order} open work order(s), ${counts.violation_action} violation-notice action(s) in flight.`,
    priorLine,
    `Drafted a ${agenda.sections.length}-section agenda covering ${activity.items.length} item(s); every line is grounded in the exact source record it summarizes (no items invented).`,
    `This is an L1 suggestion for human review; a board member/manager curates the final agenda before the meeting. Distributing the packet is a separate, never-auto-filed L2 action (${MEETING_PACKET_DISTRIBUTE_ACTION_TYPE}).`,
  ].join(" ");
}

// ── DB-composing entrypoint ───────────────────────────────────────────────────
export interface MeetingPrepInput {
  associationId: string;
  meetingDate?: Date;
  sinceDate?: Date;
  createdByAgent?: string;
  /** Optional link to a scheduled governanceMeeting this packet preps for. */
  targetMeetingId?: string | null;
}

/** Injectable deps (default = the real data reads + the real W1 gate) so the
 *  whole path is unit-testable, mirroring `ViolationTriageDeps`. */
export interface MeetingPrepDeps {
  data: MeetingPrepDataDeps;
  file: (input: FileActionInput) => Promise<AgentAction>;
}
export const defaultMeetingPrepDeps: MeetingPrepDeps = { data: defaultMeetingPrepDataDeps, file: fileAction };

export interface MeetingPrepResult {
  action: AgentAction;
  activity: AggregatedActivity;
  agenda: AgendaDraft;
  packet: MeetingPacket;
}

function overallSeverity(items: ActivityItem[]): Severity {
  let best: Severity = "low";
  for (const item of items) {
    if (SEVERITY_RANK[item.severity] > SEVERITY_RANK[best]) best = item.severity;
  }
  return items.length ? best : "medium";
}

/**
 * Aggregate → draft → assemble → route. Files a `suggest.meeting_prep` (L1)
 * action onto the W1 queue with the drafted agenda + packet as payload and the
 * traceable reasoning. NEVER distributes: distribution is a separate,
 * never-auto-filed L2 action out of scope for this ability.
 */
export async function prepareMeetingPacket(input: MeetingPrepInput, deps: MeetingPrepDeps = defaultMeetingPrepDeps): Promise<MeetingPrepResult> {
  if (!input.associationId) throw new AgentActionError("associationId required", "VALIDATION");

  const meetingDate = input.meetingDate ?? new Date();
  const activity = await aggregateActivity(input.associationId, { meetingDate, sinceDate: input.sinceDate }, deps.data);
  const agenda = draftAgenda(activity);
  const packet = assemblePacket(agenda, activity);
  const reasoning = buildReasoning(activity, agenda);

  const action = await deps.file({
    associationId: input.associationId,
    actionType: MEETING_PREP_ACTION_TYPE, // → L1, server-authoritative (suggest only)
    reasoning,
    createdByAgent: input.createdByAgent ?? "meeting-prep",
    targetEntityType: "governance_meeting",
    targetEntityId: input.targetMeetingId ?? null,
    payload: packet,
    severity: overallSeverity(activity.items),
  });

  return { action, activity, agenda, packet };
}
