/**
 * Violations MANAGEMENT service (founder-os#10569, YCM Redesign M8).
 *
 * Builds the MISSING management surface over the pre-existing `violations`
 * table + `violation_status` enum (founder-os#9487 — the board-mode "Log a
 * violation" wizard, GET/POST/PATCH /api/violations). Per the signed-off
 * wireframe's own build note ("This wireframe is the missing management
 * surface — list · filter · detail · status timeline · notice history —
 * that ties them together"), this service adds:
 *
 *   - a joined LIST view (unit + owner + notice count + roll-up stats) for
 *     the Manager page's table + stat row
 *   - a single-violation DETAIL view with a merged status+notice TIMELINE
 *   - SEND NOTICE — reuses the existing `communication_history` table (the
 *     SAME generic entity-linked communication log already used for
 *     work-order + maintenance-request notifications; see
 *     `DatabaseStorage.updateWorkOrder` in server/storage.ts) — no new
 *     notice-engine, exactly matching the wireframe's build note: "Notices
 *     reuse the existing Communications / notice-send pipeline."
 *   - a guarded STATUS TRANSITION (open -> notice-sent -> cured | escalated
 *     | closed, with backtracking allowed for re-opened cases), writing the
 *     same dual audit trail (`communication_history` + `audit_logs`) the
 *     codebase already writes elsewhere for entity status changes.
 *
 * Money-safety: this service NEVER creates or modifies a ledger charge. Fine
 * posting stays exclusively on the existing LogViolationWizard -> POST
 * /api/financial/owner-ledger/entries -> PATCH /api/violations/:id
 * (ledgerEntryId) flow. This is display + status-transition only, per the
 * wireframe's explicit money-safety note.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { sendPlatformEmail } from "../email-provider";
import {
  violations,
  units,
  persons,
  communicationHistory,
  auditLogs,
  violationStatusEnum,
  type Violation,
} from "@shared/schema";

export class ViolationsManagementError extends Error {
  constructor(message: string, public readonly code: string, public readonly httpStatus = 400) {
    super(message);
    this.name = "ViolationsManagementError";
  }
}

export type ViolationStatus = (typeof violationStatusEnum.enumValues)[number];
const STATUS_VALUES: ReadonlyArray<ViolationStatus> = violationStatusEnum.enumValues;

export const STATUS_LABELS: Record<ViolationStatus, string> = {
  open: "Open",
  "notice-sent": "Notice sent",
  cured: "Cured",
  escalated: "Escalated",
  closed: "Closed",
};

// Legal transitions for the management page's explicit status actions. Every
// non-terminal status can move forward to any later stage (a manager may
// escalate or cure directly without a notice), and every status can be
// re-opened (a "cured" or "closed" case can recur). This is deliberately
// permissive — the wizard's own PATCH already accepts any status string
// unconditionally; this table exists so the MANAGEMENT surface's explicit
// "Mark cured" / "Escalate" actions can give a clear, testable 409 instead
// of silently accepting a nonsensical jump.
export const ALLOWED_TRANSITIONS: Record<ViolationStatus, ReadonlyArray<ViolationStatus>> = {
  open: ["open", "notice-sent", "cured", "escalated", "closed"],
  "notice-sent": ["notice-sent", "cured", "escalated", "closed", "open"],
  cured: ["cured", "open", "closed"],
  escalated: ["escalated", "cured", "closed", "open"],
  closed: ["closed", "open"],
};

export function isLegalTransition(from: ViolationStatus, to: ViolationStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export type ManagementViolationRow = Violation & {
  unitNumber: string | null;
  unitBuilding: string | null;
  ownerName: string | null;
  noticeCount: number;
};

export interface ManagementStats {
  open: number;
  openOver30Days: number;
  noticeSent: number;
  escalated: number;
  curedLast30Days: number;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Pure — no DB. Rolls up the stat-row counts the wireframe's 4 tiles show. */
export function computeManagementStats(
  rows: ReadonlyArray<Pick<Violation, "status" | "observedAt" | "updatedAt">>,
  now: number = Date.now(),
): ManagementStats {
  let open = 0;
  let openOver30Days = 0;
  let noticeSent = 0;
  let escalated = 0;
  let curedLast30Days = 0;
  for (const row of rows) {
    if (row.status === "open") {
      open += 1;
      const observedAge = now - new Date(row.observedAt).getTime();
      if (observedAge > THIRTY_DAYS_MS) openOver30Days += 1;
    } else if (row.status === "notice-sent") {
      noticeSent += 1;
    } else if (row.status === "escalated") {
      escalated += 1;
    } else if (row.status === "cured") {
      const curedAge = now - new Date(row.updatedAt).getTime();
      if (curedAge <= THIRTY_DAYS_MS) curedLast30Days += 1;
    }
  }
  return { open, openOver30Days, noticeSent, escalated, curedLast30Days };
}

/** Pure — no DB. The ordinal label shown in the timeline ("Notice sent", "2nd notice sent", …). */
export function ordinalNoticeLabel(ordinal: number): string {
  if (ordinal === 1) return "Notice sent";
  if (ordinal === 2) return "2nd notice sent";
  if (ordinal === 3) return "3rd notice sent";
  return `${ordinal}th notice sent`;
}

async function attachNoticeCounts(
  rows: ReadonlyArray<Violation & { unitNumber: string | null; unitBuilding: string | null; ownerName: string | null }>,
): Promise<ManagementViolationRow[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const notices = await db
    .select({ relatedId: communicationHistory.relatedId })
    .from(communicationHistory)
    .where(and(eq(communicationHistory.relatedType, "violation-notice"), inArray(communicationHistory.relatedId, ids)));
  const counts = new Map<string, number>();
  for (const n of notices) {
    if (!n.relatedId) continue;
    counts.set(n.relatedId, (counts.get(n.relatedId) ?? 0) + 1);
  }
  return rows.map((r) => ({ ...r, noticeCount: counts.get(r.id) ?? 0 }));
}

/** List every violation for the association, joined with unit + owner display fields, plus roll-up stats. */
export async function listViolationsForManagement(
  associationId: string,
): Promise<{ violations: ManagementViolationRow[]; stats: ManagementStats }> {
  const joined = await db
    .select({
      violation: violations,
      unitNumber: units.unitNumber,
      unitBuilding: units.building,
      ownerFirstName: persons.firstName,
      ownerLastName: persons.lastName,
    })
    .from(violations)
    .leftJoin(units, eq(violations.unitId, units.id))
    .leftJoin(persons, eq(violations.personId, persons.id))
    .where(eq(violations.associationId, associationId))
    .orderBy(desc(violations.observedAt));

  const flattened = joined.map((row) => ({
    ...row.violation,
    unitNumber: row.unitNumber ?? null,
    unitBuilding: row.unitBuilding ?? null,
    ownerName:
      row.ownerFirstName || row.ownerLastName
        ? `${row.ownerFirstName ?? ""} ${row.ownerLastName ?? ""}`.trim()
        : null,
  }));

  const withCounts = await attachNoticeCounts(flattened);
  return { violations: withCounts, stats: computeManagementStats(withCounts) };
}

export type TimelineEventKind = "opened" | "notice" | "status";
export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  label: string;
  detail: string | null;
  actor: string | null;
  at: string;
}

async function loadViolationOrThrow(id: string, associationId: string): Promise<Violation> {
  const [violation] = await db.select().from(violations).where(eq(violations.id, id));
  if (!violation) throw new ViolationsManagementError("Violation not found", "NOT_FOUND", 404);
  if (violation.associationId !== associationId) {
    throw new ViolationsManagementError("Violation is outside this association", "NOT_FOUND", 404);
  }
  return violation;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/** Single violation + unit/owner + a chronological timeline (opened, notices, status changes), newest first. */
export async function getViolationDetail(
  id: string,
  associationId: string,
): Promise<{
  violation: Violation;
  unitNumber: string | null;
  unitBuilding: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  timeline: TimelineEvent[];
}> {
  const violation = await loadViolationOrThrow(id, associationId);

  const [unit] = violation.unitId ? await db.select().from(units).where(eq(units.id, violation.unitId)) : [undefined];
  const [person] = violation.personId ? await db.select().from(persons).where(eq(persons.id, violation.personId)) : [undefined];

  const history = await db
    .select()
    .from(communicationHistory)
    .where(
      and(
        inArray(communicationHistory.relatedType, ["violation-notice", "violation-status"]),
        eq(communicationHistory.relatedId, id),
      ),
    )
    .orderBy(desc(communicationHistory.createdAt));

  const openedEvent: TimelineEvent = {
    id: `${id}-opened`,
    kind: "opened",
    label: "Opened",
    detail: violation.violationType,
    actor: violation.loggedByEmail,
    at: toIso(violation.observedAt),
  };
  const historyEvents: TimelineEvent[] = history.map(
    (h): TimelineEvent => ({
      id: h.id,
      kind: h.relatedType === "violation-notice" ? "notice" : "status",
      label: h.subject ?? "",
      detail: h.bodySnippet ?? null,
      actor: h.recipientEmail ?? null,
      at: toIso(h.createdAt),
    }),
  );
  const timeline: TimelineEvent[] = [openedEvent, ...historyEvents].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  return {
    violation,
    unitNumber: unit?.unitNumber ?? null,
    unitBuilding: unit?.building ?? null,
    ownerName: person ? `${person.firstName} ${person.lastName}`.trim() : null,
    ownerEmail: person?.email ?? null,
    timeline,
  };
}

export type NoticeChannel = "email" | "portal" | "certified-mail";

/**
 * Records a notice send against a violation. Reuses `communication_history`
 * (relatedType "violation-notice") — no new notice-engine, per the
 * wireframe's build note. Auto-advances `open` -> `notice-sent`; a 2nd/3rd
 * notice on an already-`notice-sent`/`escalated` case just adds another
 * timeline entry without changing status.
 */
export async function sendViolationNotice(
  id: string,
  associationId: string,
  input: { channel?: NoticeChannel; note?: string | null },
  actorEmail: string,
): Promise<{ violation: Violation; event: TimelineEvent }> {
  const violation = await loadViolationOrThrow(id, associationId);
  const channel: NoticeChannel = input.channel ?? "email";

  const [unit] = violation.unitId ? await db.select().from(units).where(eq(units.id, violation.unitId)) : [undefined];
  const [person] = violation.personId ? await db.select().from(persons).where(eq(persons.id, violation.personId)) : [undefined];

  const priorNotices = await db
    .select({ id: communicationHistory.id })
    .from(communicationHistory)
    .where(and(eq(communicationHistory.relatedType, "violation-notice"), eq(communicationHistory.relatedId, id)));
  const ordinal = priorNotices.length + 1;
  const ordinalLabel = ordinalNoticeLabel(ordinal);
  const unitDisplay = unit ? (unit.building ? `${unit.building} · ${unit.unitNumber}` : unit.unitNumber) : "the unit";
  const subject = `${ordinalLabel} — ${violation.violationType} (${unitDisplay})`;
  const body =
    input.note?.trim() ||
    `${ordinalLabel.toLowerCase()} regarding ${violation.violationType.toLowerCase()} at ${unitDisplay}.`;

  if (channel !== "email") {
    throw new ViolationsManagementError(
      `${channel === "portal" ? "Portal" : "Certified-mail"} delivery is not connected yet. No notice was recorded as sent.`,
      "DELIVERY_CHANNEL_NOT_CONNECTED",
      409,
    );
  }
  if (!person?.email) {
    throw new ViolationsManagementError(
      "This owner does not have an email address. No notice was sent.",
      "RECIPIENT_EMAIL_REQUIRED",
      409,
    );
  }

  const delivery = await sendPlatformEmail({
    to: person.email,
    subject,
    text: body,
    templateKey: "violation-notice",
    enableTracking: true,
  });
  if (delivery.status === "failed") {
    throw new ViolationsManagementError(
      delivery.errorMessage || "The email provider could not send this notice.",
      "NOTICE_DELIVERY_FAILED",
      502,
    );
  }

  const [event] = await db
    .insert(communicationHistory)
    .values({
      associationId,
      channel,
      direction: "outbound",
      subject,
      bodySnippet: body,
      recipientEmail: person.email,
      recipientPersonId: person.id,
      relatedType: "violation-notice",
      relatedId: id,
      metadataJson: {
        violationId: id,
        ordinal,
        channel,
        provider: delivery.provider,
        providerMessageId: delivery.messageId,
        emailLogId: delivery.logId,
      },
      deliveryStatus: delivery.status,
      deliveryStatusUpdatedAt: new Date(),
    })
    .returning();

  const nextStatus: ViolationStatus = violation.status === "open" ? "notice-sent" : violation.status;

  await db.insert(auditLogs).values({
    actorEmail,
    action: "notice-sent",
    entityType: "violation",
    entityId: id,
    associationId,
    beforeJson: { status: violation.status },
    afterJson: { status: nextStatus, ordinal },
  });

  let updated = violation;
  if (nextStatus !== violation.status) {
    const [next] = await db
      .update(violations)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(violations.id, id))
      .returning();
    updated = next;
  }

  return {
    violation: updated,
    event: {
      id: event.id,
      kind: "notice",
      label: event.subject ?? ordinalLabel,
      detail: event.bodySnippet ?? null,
      actor: event.recipientEmail ?? null,
      at: toIso(event.createdAt),
    },
  };
}

/** Guarded status transition, writing the same dual (communication + audit) trail as sendViolationNotice. */
export async function transitionViolationStatus(
  id: string,
  associationId: string,
  nextStatus: ViolationStatus,
  note: string | null | undefined,
  actorEmail: string,
): Promise<{ violation: Violation; event: TimelineEvent }> {
  if (!STATUS_VALUES.includes(nextStatus)) {
    throw new ViolationsManagementError(`Unknown status "${nextStatus}"`, "INVALID_STATUS", 400);
  }
  const violation = await loadViolationOrThrow(id, associationId);
  if (!isLegalTransition(violation.status, nextStatus)) {
    throw new ViolationsManagementError(
      `Cannot move a violation from "${violation.status}" to "${nextStatus}"`,
      "INVALID_TRANSITION",
      409,
    );
  }

  const [updated] = await db
    .update(violations)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(eq(violations.id, id))
    .returning();

  const [person] = violation.personId ? await db.select().from(persons).where(eq(persons.id, violation.personId)) : [undefined];
  const label = `${STATUS_LABELS[nextStatus]} — ${STATUS_LABELS[violation.status]} → ${STATUS_LABELS[nextStatus]}`;

  const [event] = await db
    .insert(communicationHistory)
    .values({
      associationId,
      channel: "internal",
      direction: "outbound",
      subject: label,
      bodySnippet: note?.trim() || null,
      recipientEmail: person?.email ?? null,
      recipientPersonId: person?.id ?? null,
      relatedType: "violation-status",
      relatedId: id,
      metadataJson: { violationId: id, fromStatus: violation.status, toStatus: nextStatus },
      deliveryStatus: "recorded",
    })
    .returning();

  await db.insert(auditLogs).values({
    actorEmail,
    action: "status-changed",
    entityType: "violation",
    entityId: id,
    associationId,
    beforeJson: { status: violation.status },
    afterJson: { status: nextStatus },
  });

  return {
    violation: updated,
    event: {
      id: event.id,
      kind: "status",
      label: event.subject ?? label,
      detail: event.bodySnippet ?? null,
      actor: actorEmail,
      at: toIso(event.createdAt),
    },
  };
}
