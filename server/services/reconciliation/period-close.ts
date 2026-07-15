/**
 * Treasurer month-close service (YCM#220 / production-readiness P2-5).
 *
 * A treasurer closes the books monthly: confirm the month's bank transactions
 * are matched, flag stragglers, and lock the period with an audited
 * attestation. Before this, reconciliation was transaction-by-transaction and
 * "is June fully reconciled?" had no answer in the product.
 *
 * This module is the SERVER-SIDE authority for the close/reopen lifecycle.
 * Every rule that matters lives here (not the route, not the UI):
 *
 *   1. COUNTS ARE COMPOSED, NOT REINVENTED — the matched/unmatched numbers come
 *      straight from `buildReconciliationReport` (the existing engine) over the
 *      selected calendar month. No matching logic is duplicated.
 *   2. UNMATCHED GUARD (soft) — closing a month that still has unmatched
 *      transactions requires the caller to acknowledge the count. It is NOT a
 *      hard block: treasurers legitimately close with known stragglers.
 *   3. EXPLICIT REOPEN — a closed period can only be undone by an explicit
 *      reopen action, which is itself audit-logged.
 *   4. ATTESTATION ONLY — closing writes an attestation record; it does NOT lock
 *      ledger writes retroactively (out of scope by design).
 *
 * The `period_closes` row is the current state (one per assoc+month, upserted);
 * the append-only forensic history of every close/reopen lives in `audit_logs`.
 */
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { auditLogs, periodCloses, type PeriodClose } from "@shared/schema";
import { buildReconciliationReport } from "./report";

// ── Audit actions ─────────────────────────────────────────────────────────────
export const PERIOD_CLOSED_ACTION = "period.closed";
export const PERIOD_REOPENED_ACTION = "period.reopened";

// ── Error taxonomy ────────────────────────────────────────────────────────────
// Routes map these to HTTP status + { error, code }. Codes (not messages) drive
// the mapping so it stays robust.
export type PeriodCloseErrorCode =
  | "INVALID_PERIOD"
  | "UNMATCHED_ACK_REQUIRED"
  | "ALREADY_CLOSED"
  | "NOT_CLOSED";

export class PeriodCloseError extends Error {
  constructor(
    message: string,
    public readonly code: PeriodCloseErrorCode,
    /** Extra context surfaced to the caller — e.g. the unmatched count that
     * must be acknowledged. */
    public readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PeriodCloseError";
  }
}

// ── Month math ────────────────────────────────────────────────────────────────
const MONTH_RE = /^(\d{4})-(\d{2})$/;

/** Parse 'YYYY-MM' → UTC [start, end] bounds for the calendar month.
 * start = first day 00:00:00.000; end = last day 23:59:59.999. Throws
 * PeriodCloseError(INVALID_PERIOD) on a malformed or out-of-range month. */
export function monthBounds(periodMonth: string): { start: Date; end: Date } {
  const m = MONTH_RE.exec(periodMonth);
  if (!m) {
    throw new PeriodCloseError(
      `Invalid period month '${periodMonth}' (expected YYYY-MM)`,
      "INVALID_PERIOD",
    );
  }
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12
  if (month < 1 || month > 12) {
    throw new PeriodCloseError(
      `Invalid month '${periodMonth}' (month must be 01-12)`,
      "INVALID_PERIOD",
    );
  }
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  // Day 0 of the NEXT month = last day of this month.
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

// ── Wire shape ────────────────────────────────────────────────────────────────
export interface MonthCloseState {
  associationId: string;
  periodMonth: string;
  periodStart: string; // yyyy-mm-dd
  periodEnd: string; // yyyy-mm-dd
  matchedCount: number;
  unmatchedBankTxCount: number;
  unmatchedLedgerEntryCount: number;
  /** Sum of the two unmatched counts — the "stragglers" the close guard tests. */
  unmatchedTotal: number;
  unmatchedBankTransactions: Array<{
    id: string;
    date: string;
    name: string;
    merchantName: string | null;
    amountCents: number;
  }>;
  unmatchedLedgerEntries: Array<{
    id: string;
    personName: string;
    unitNumber: string | null;
    postedAt: string;
    amountCents: number;
    description: string | null;
  }>;
  /** The current close record, or null if the month has never been closed
   * (or was reopened). `isClosed` is the single "is this month reconciled?"
   * signal. */
  isClosed: boolean;
  close: {
    status: string;
    matchedCount: number;
    unmatchedBankTxCount: number;
    unmatchedLedgerEntryCount: number;
    closedByEmail: string;
    closedAt: string;
    reopenedByEmail: string | null;
    reopenedAt: string | null;
  } | null;
}

// ── Internal: fetch the single close row for (assoc, month) ───────────────────
async function fetchCloseRow(
  associationId: string,
  periodMonth: string,
): Promise<PeriodClose | undefined> {
  const rows = await db
    .select()
    .from(periodCloses)
    .where(
      and(
        eq(periodCloses.associationId, associationId),
        eq(periodCloses.periodMonth, periodMonth),
      ),
    )
    .limit(1);
  return rows[0];
}

function toIso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

// ── Read: the close-month view for a month ────────────────────────────────────
/** Compose the live reconciliation counts for the month with the current
 * close record. This is the data the "Close month" view renders. */
export async function getMonthCloseState(input: {
  associationId: string;
  periodMonth: string;
}): Promise<MonthCloseState> {
  const { associationId, periodMonth } = input;
  const { start, end } = monthBounds(periodMonth);

  const report = await buildReconciliationReport({
    associationId,
    periodStart: start,
    periodEnd: end,
  });

  const row = await fetchCloseRow(associationId, periodMonth);
  const isClosed = row?.status === "closed";

  return {
    associationId,
    periodMonth,
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
    matchedCount: report.totals.matchedCount,
    unmatchedBankTxCount: report.totals.unmatchedBankTxCount,
    unmatchedLedgerEntryCount: report.totals.unmatchedLedgerEntryCount,
    unmatchedTotal:
      report.totals.unmatchedBankTxCount + report.totals.unmatchedLedgerEntryCount,
    unmatchedBankTransactions: report.unmatchedBankTransactions,
    unmatchedLedgerEntries: report.unmatchedLedgerEntries.map((e) => ({
      id: e.id,
      personName: e.personName,
      unitNumber: e.unitNumber,
      postedAt:
        e.postedAt instanceof Date ? e.postedAt.toISOString() : String(e.postedAt),
      amountCents: e.amountCents,
      description: e.description,
    })),
    isClosed,
    close: row
      ? {
          status: row.status,
          matchedCount: row.matchedCount,
          unmatchedBankTxCount: row.unmatchedBankTxCount,
          unmatchedLedgerEntryCount: row.unmatchedLedgerEntryCount,
          closedByEmail: row.closedByEmail,
          closedAt: toIso(row.closedAt)!,
          reopenedByEmail: row.reopenedByEmail,
          reopenedAt: toIso(row.reopenedAt),
        }
      : null,
  };
}

// ── Write: close a month ──────────────────────────────────────────────────────
/** Attest that the books are closed for the month. Refuses if already closed
 * (reopen first). Requires `acknowledgeUnmatched` when there are stragglers. */
export async function closeMonth(input: {
  associationId: string;
  periodMonth: string;
  actorUserId: string;
  actorEmail: string;
  acknowledgeUnmatched?: boolean;
  notes?: string | null;
}): Promise<PeriodClose> {
  const { associationId, periodMonth, actorUserId, actorEmail, notes } = input;
  const { start, end } = monthBounds(periodMonth);

  // Guard: refuse to double-close (an already-closed period must be reopened
  // explicitly before it can be re-closed — keeps the who/when honest).
  const existing = await fetchCloseRow(associationId, periodMonth);
  if (existing && existing.status === "closed") {
    throw new PeriodCloseError(
      `Period ${periodMonth} is already closed`,
      "ALREADY_CLOSED",
    );
  }

  // Live counts at close time.
  const report = await buildReconciliationReport({
    associationId,
    periodStart: start,
    periodEnd: end,
  });
  const unmatchedTotal =
    report.totals.unmatchedBankTxCount + report.totals.unmatchedLedgerEntryCount;

  // Soft guard: close with stragglers requires an explicit acknowledgement.
  if (unmatchedTotal > 0 && !input.acknowledgeUnmatched) {
    throw new PeriodCloseError(
      `Period ${periodMonth} has ${unmatchedTotal} unmatched transaction(s); acknowledge to close`,
      "UNMATCHED_ACK_REQUIRED",
      {
        unmatchedTotal,
        unmatchedBankTxCount: report.totals.unmatchedBankTxCount,
        unmatchedLedgerEntryCount: report.totals.unmatchedLedgerEntryCount,
      },
    );
  }

  const closeValues = {
    associationId,
    periodMonth,
    status: "closed" as const,
    matchedCount: report.totals.matchedCount,
    unmatchedBankTxCount: report.totals.unmatchedBankTxCount,
    unmatchedLedgerEntryCount: report.totals.unmatchedLedgerEntryCount,
    closedByUserId: actorUserId,
    closedByEmail: actorEmail,
    closedAt: new Date(),
    // A fresh close clears any prior reopen markers.
    reopenedByUserId: null,
    reopenedByEmail: null,
    reopenedAt: null,
    notes: notes ?? null,
  };

  // Upsert on (association_id, period_month): first close inserts; a re-close
  // after a reopen overwrites the row (the audit_logs trail keeps full history).
  const [row] = await db
    .insert(periodCloses)
    .values(closeValues)
    .onConflictDoUpdate({
      target: [periodCloses.associationId, periodCloses.periodMonth],
      set: {
        status: closeValues.status,
        matchedCount: closeValues.matchedCount,
        unmatchedBankTxCount: closeValues.unmatchedBankTxCount,
        unmatchedLedgerEntryCount: closeValues.unmatchedLedgerEntryCount,
        closedByUserId: closeValues.closedByUserId,
        closedByEmail: closeValues.closedByEmail,
        closedAt: closeValues.closedAt,
        reopenedByUserId: null,
        reopenedByEmail: null,
        reopenedAt: null,
        notes: closeValues.notes,
      },
    })
    .returning();

  await db.insert(auditLogs).values({
    actorEmail,
    action: PERIOD_CLOSED_ACTION,
    entityType: "period_close",
    entityId: row.id,
    associationId,
    afterJson: {
      periodMonth,
      matchedCount: closeValues.matchedCount,
      unmatchedBankTxCount: closeValues.unmatchedBankTxCount,
      unmatchedLedgerEntryCount: closeValues.unmatchedLedgerEntryCount,
      acknowledgedUnmatched: unmatchedTotal > 0,
    },
  });

  return row;
}

// ── Write: reopen a month ─────────────────────────────────────────────────────
/** Explicitly reopen a previously-closed period. Refuses if the month is not
 * currently closed. Audit-logged. */
export async function reopenMonth(input: {
  associationId: string;
  periodMonth: string;
  actorUserId: string;
  actorEmail: string;
}): Promise<PeriodClose> {
  const { associationId, periodMonth, actorUserId, actorEmail } = input;
  monthBounds(periodMonth); // validate the month format

  const existing = await fetchCloseRow(associationId, periodMonth);
  if (!existing || existing.status !== "closed") {
    throw new PeriodCloseError(
      `Period ${periodMonth} is not currently closed`,
      "NOT_CLOSED",
    );
  }

  const [row] = await db
    .update(periodCloses)
    .set({
      status: "reopened",
      reopenedByUserId: actorUserId,
      reopenedByEmail: actorEmail,
      reopenedAt: new Date(),
    })
    .where(
      and(
        eq(periodCloses.associationId, associationId),
        eq(periodCloses.periodMonth, periodMonth),
      ),
    )
    .returning();

  await db.insert(auditLogs).values({
    actorEmail,
    action: PERIOD_REOPENED_ACTION,
    entityType: "period_close",
    entityId: row.id,
    associationId,
    beforeJson: { periodMonth, status: "closed" },
    afterJson: { periodMonth, status: "reopened" },
  });

  return row;
}
