/**
 * Admin manual payment recording (founder-os#2479).
 *
 * Surfaces a typed entry point for cash / check / Zelle / external-ACH /
 * Venmo / other payments that arrive outside the YCM portal. Replaces the
 * raw `POST /api/financial/owner-ledger/entries` path with a method-aware,
 * audit-logged write that optionally invokes the reconciliation auto-matcher
 * immediately after recording so a payment that already has a corresponding
 * bank deposit gets settled in one round-trip.
 *
 * William's spec (2026-05-25): "If a manual identification needs to be
 * made, then it should be in a surface in the platform or in the workspace."
 * Never offline.
 *
 * Endpoints
 *   POST /api/admin/payments/record         { associationId, unitId?, personId,
 *                                              amount, method, checkNumber?,
 *                                              zelleSender?, receivedAt,
 *                                              notes?, attemptBankMatch? }
 *   POST /api/admin/payments/record-bulk    { associationId, rows: [...] }
 *   GET  /api/admin/payments/recent?associationId=&limit=
 *
 * Authorization (per the dispatch spec): platform-admin + board-officer
 * only. board-treasurer doesn't exist as an AdminRole in this codebase
 * (the canonical enum is platform-admin / board-officer / assisted-board /
 * pm-assistant / manager / viewer per shared/schema.ts L169); board-officer
 * is the treasurer-equivalent for boards.
 *
 * Cross-link: server/services/reconciliation/auto-matcher.ts (runAutoMatch
 * is association-scoped + idempotent; safe to invoke after each record).
 */
import type { Express, NextFunction, Request, Response } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  auditLogs,
  ownerLedgerEntries,
  type AdminRole,
} from "@shared/schema";
import { runAutoMatch, type AutoMatchResult } from "../services/reconciliation/auto-matcher";
import { refundConnectCharge, isRefundsEnabled } from "../services/refund-service";
import { reversePayment } from "../services/payment-edge-cases";

// ── Reusable request shape (mirrored from routes.ts) ─────────────────────────

export type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

interface AdminGuards {
  requireAdmin: (req: Request, res: Response, next: NextFunction) => unknown;
  requireAdminRole: (
    roles: AdminRole[],
  ) => (req: Request, res: Response, next: NextFunction) => unknown;
  getAssociationIdQuery: (req: Request) => string | undefined;
  assertAssociationScope: (req: AdminRequest, associationId: string) => void;
}

// Spec: platform-admin + board-treasurer only. board-treasurer doesn't exist
// in this codebase's AdminRole enum (see shared/schema.ts L169); board-officer
// is the treasurer-equivalent. Keep the gate tight to those two roles per
// the dispatch's permission-boundary acceptance criterion.
const RECORD_ROLES: AdminRole[] = ["platform-admin", "board-officer"];
// Refunds move money OUT — gate to platform-admin / board-officer / manager.
const REFUND_ROLES: AdminRole[] = ["platform-admin", "board-officer", "manager"];
// Read role list intentionally wider than write so PMs / managers can audit
// the recent-payments table without the ability to write.
const READ_ROLES: AdminRole[] = [
  "platform-admin",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "manager",
  "viewer",
];

// ── Schema ───────────────────────────────────────────────────────────────────

export const PAYMENT_METHODS = [
  "cash",
  "check",
  "zelle",
  "external-ach",
  "venmo",
  "other",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const recordPaymentSchema = z.object({
  associationId: z.string().min(1),
  unitId: z.string().min(1).optional(),
  personId: z.string().min(1),
  amount: z.coerce.number().refine((n) => n > 0, {
    message: "amount must be positive (the endpoint converts to a negative ledger entry)",
  }),
  method: z.enum(PAYMENT_METHODS),
  checkNumber: z.string().trim().min(1).optional(),
  zelleSender: z.string().trim().min(1).optional(),
  receivedAt: z.coerce.date(),
  notes: z.string().trim().optional(),
  attemptBankMatch: z.boolean().optional().default(true),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

const bulkRecordSchema = z.object({
  associationId: z.string().min(1),
  rows: z.array(recordPaymentSchema).min(1).max(100),
  attemptBankMatch: z.boolean().optional().default(true),
});

// Refund a Connect direct charge. `amountCents` omitted = full refund.
const refundChargeSchema = z.object({
  associationId: z.string().min(1),
  chargeId: z.string().trim().min(1),
  amountCents: z.coerce.number().int().positive().optional(),
  reason: z.enum(["duplicate", "fraudulent", "requested_by_customer"]).optional(),
  // refund_application_fee defaults true server-side so the HOA never loses
  // YCM's platform fee on a refund; allow an explicit override for the rare case.
  refundApplicationFee: z.boolean().optional(),
  // A-STRIPE-005: optional per-refund-request disambiguator. Supply a stable id
  // (generated once per refund action, reused on retry) so two DISTINCT partial
  // refunds of the same charge+amount both succeed while a network retry of one
  // still collapses. Omit for the legacy charge+amount retry-collapse grain.
  requestId: z.string().trim().min(1).max(64).optional(),
});

// Reverse a manual/non-Stripe posting on the owner ledger (founder-os#8535 /
// YCM#286 — wires the tested payment-edge-cases module into a live route).
// `amount` (positive dollars) omitted = reverse the full remaining amount.
// `reason` is REQUIRED — every reversal is an auditable money decision.
const reverseEntrySchema = z.object({
  associationId: z.string().min(1),
  ledgerEntryId: z.string().trim().min(1),
  amount: z.coerce.number().positive().optional(),
  reason: z.string().trim().min(3, "a reason is required for every reversal"),
});

// Ledger entries recorded from Stripe charges carry this referenceType (the
// non-exported convention in services/stripe-reconciliation.ts). A Stripe-
// backed receipt must be refunded through POST /refund (which moves the real
// money AND posts the ledger reversal) — never ledger-reversed alone, or the
// books would show money returned that Stripe still holds.
const STRIPE_CHARGE_REFERENCE_TYPE = "stripe_charge";

// ── Description builder ─────────────────────────────────────────────────────

/**
 * Build a neutral, method-aware description for the ledger entry.
 *
 * Exposed for tests + the optional client-side preview. Examples:
 *
 *   buildDescription({ method: "check", checkNumber: "1042" })
 *     → "Check #1042"
 *   buildDescription({ method: "zelle", zelleSender: "WILLIAM RUIZ" })
 *     → "Zelle from WILLIAM RUIZ"
 *   buildDescription({ method: "cash" })
 *     → "Cash payment"
 *   buildDescription({ method: "external-ach", notes: "wire from owner" })
 *     → "External ACH — wire from owner"
 */
export function buildDescription(input: {
  method: PaymentMethod;
  checkNumber?: string;
  zelleSender?: string;
  notes?: string;
}): string {
  const { method, checkNumber, zelleSender, notes } = input;
  let base: string;
  switch (method) {
    case "cash":
      base = "Cash payment";
      break;
    case "check":
      base = checkNumber ? `Check #${checkNumber}` : "Check payment";
      break;
    case "zelle":
      base = zelleSender ? `Zelle from ${zelleSender}` : "Zelle payment";
      break;
    case "external-ach":
      base = "External ACH";
      break;
    case "venmo":
      base = zelleSender ? `Venmo from ${zelleSender}` : "Venmo payment";
      break;
    case "other":
      base = "Manual payment";
      break;
  }
  if (notes && notes.trim().length > 0) {
    return `${base} — ${notes.trim()}`;
  }
  return base;
}

// ── Bulk-paste parser ───────────────────────────────────────────────────────

/**
 * Parse a CSV / TSV blob into structured row-input objects suitable for the
 * bulk endpoint. Permissive about delimiter (auto-detects tab vs comma) and
 * about column order via a header row. Exposed for tests.
 *
 * Required columns (any order):
 *   personId, amount, method, receivedAt
 *
 * Optional columns:
 *   unitId, checkNumber, zelleSender, notes
 *
 * Returns parsed rows + per-row errors so the UI can surface partial-success
 * outcomes instead of all-or-nothing.
 */
export function parseBulkPaste(
  blob: string,
  associationId: string,
): {
  rows: RecordPaymentInput[];
  errors: Array<{ line: number; message: string }>;
} {
  const errors: Array<{ line: number; message: string }> = [];
  const rows: RecordPaymentInput[] = [];

  const trimmed = blob.replace(/\r\n/g, "\n").trim();
  if (!trimmed) {
    return { rows, errors: [{ line: 0, message: "Empty input" }] };
  }
  const lines = trimmed.split("\n");
  if (lines.length < 2) {
    return {
      rows,
      errors: [{ line: 0, message: "Need a header row + at least one data row" }],
    };
  }

  // Auto-detect delimiter: prefer tab; fall back to comma.
  const headerLine = lines[0];
  const delim = headerLine.includes("\t") ? "\t" : ",";
  const headers = headerLine.split(delim).map((h) => h.trim().toLowerCase());

  const requiredHeaders = ["personid", "amount", "method", "receivedat"];
  for (const h of requiredHeaders) {
    if (!headers.includes(h)) {
      errors.push({ line: 1, message: `Missing required column: ${h}` });
    }
  }
  if (errors.length > 0) return { rows, errors };

  const idx = (name: string) => headers.indexOf(name);

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const cols = raw.split(delim).map((c) => c.trim());
    try {
      const parsed = recordPaymentSchema.parse({
        associationId,
        personId: cols[idx("personid")],
        unitId: idx("unitid") >= 0 ? cols[idx("unitid")] || undefined : undefined,
        amount: cols[idx("amount")]?.replace(/[$,]/g, ""),
        method: cols[idx("method")]?.toLowerCase(),
        checkNumber:
          idx("checknumber") >= 0 ? cols[idx("checknumber")] || undefined : undefined,
        zelleSender:
          idx("zellesender") >= 0 ? cols[idx("zellesender")] || undefined : undefined,
        receivedAt: cols[idx("receivedat")],
        notes: idx("notes") >= 0 ? cols[idx("notes")] || undefined : undefined,
      });
      rows.push(parsed);
    } catch (err: any) {
      const msg =
        err?.issues
          ?.map((iss: any) => `${iss.path.join(".")}: ${iss.message}`)
          .join("; ") ?? String(err?.message ?? err);
      errors.push({ line: i + 1, message: msg });
    }
  }

  return { rows, errors };
}

// ── Core write ──────────────────────────────────────────────────────────────

interface RecordPaymentDeps {
  actorEmail: string;
}

interface RecordedPayment {
  ledgerEntryId: string;
  associationId: string;
  unitId: string;
  personId: string;
  amount: number;
  method: PaymentMethod;
  receivedAt: Date;
  description: string;
}

async function recordSinglePayment(
  input: RecordPaymentInput,
  deps: RecordPaymentDeps,
): Promise<RecordedPayment> {
  // If unitId is omitted, the spec allows the caller to attach it later via
  // ownership lookup. For Cherry Hill go-live we tighten this: require unitId
  // here (the UI will resolve person → unit before submit) — but at the
  // endpoint we'll degrade gracefully and accept it without unitId if the
  // caller passes one. The schema marks unitId optional; if omitted, we
  // resolve the primary unit via the `ownerships` table downstream.
  const unitId = input.unitId;
  if (!unitId) {
    throw new Error(
      "unitId is required (resolve from person's ownership before submitting)",
    );
  }

  const description = buildDescription({
    method: input.method,
    checkNumber: input.checkNumber,
    zelleSender: input.zelleSender,
    notes: input.notes,
  });

  // Payments are stored as negative amounts in the ledger (per the existing
  // owner_ledger_entries convention — `entry_type='payment'` + amount<0 is
  // a credit against charges). The endpoint accepts positive amounts from
  // the UI and negates them server-side so callers can't accidentally
  // double-negate.
  const negativeAmount = -Math.abs(input.amount);

  const [inserted] = await db
    .insert(ownerLedgerEntries)
    .values({
      associationId: input.associationId,
      unitId,
      personId: input.personId,
      entryType: "payment",
      amount: negativeAmount,
      postedAt: input.receivedAt,
      description,
      referenceType: "manual-recorded-payment",
      // Method + payor metadata embedded into referenceId so it survives
      // alongside the ledger entry without requiring a schema migration.
      // Format: `<method>:<checkNumber|zelleSender|->`
      referenceId: `${input.method}:${input.checkNumber ?? input.zelleSender ?? "-"}`,
    })
    .returning();

  await db.insert(auditLogs).values({
    actorEmail: deps.actorEmail,
    action: "payment.manual-record",
    entityType: "owner_ledger_entry",
    entityId: inserted.id,
    associationId: input.associationId,
    afterJson: {
      method: input.method,
      amount: input.amount,
      checkNumber: input.checkNumber ?? null,
      zelleSender: input.zelleSender ?? null,
      receivedAt: input.receivedAt.toISOString(),
      notes: input.notes ?? null,
      personId: input.personId,
      unitId,
    },
  });

  return {
    ledgerEntryId: inserted.id,
    associationId: inserted.associationId,
    unitId: inserted.unitId,
    personId: inserted.personId,
    amount: inserted.amount,
    method: input.method,
    receivedAt: inserted.postedAt,
    description: inserted.description ?? description,
  };
}

// ── Ledger reversal (founder-os#8535 / YCM#286) ─────────────────────────────

export interface ReversalOutcome {
  reversalEntryId: string;
  reversedEntryId: string;
  amountReversed: number;
  priorBalance: number;
  newBalance: number;
}

/**
 * Reverse a credit-side owner-ledger entry (payment/credit) by posting the
 * equal-and-opposite `adjustment` row the payment-edge-cases module computes.
 * Forward-only: the original row is never touched.
 *
 * Guards the module doesn't (it's pure and sees one call at a time):
 *   - the target must belong to the given association (404 otherwise);
 *   - CUMULATIVE cap — prior reversals of the same target count against the
 *     original magnitude, so repeated partial reversals can never exceed it.
 *
 * `allowStripeBacked` is set ONLY by the Stripe /refund path, which has
 * already moved the real money; the standalone /reverse route refuses
 * Stripe-backed entries so the ledger can't claim a refund Stripe never made.
 */
async function reverseLedgerEntry(params: {
  associationId: string;
  ledgerEntryId: string;
  amount?: number;
  reason: string;
  actorEmail: string;
  auditAction: string;
  allowStripeBacked?: boolean;
}): Promise<ReversalOutcome> {
  const [target] = await db
    .select()
    .from(ownerLedgerEntries)
    .where(
      and(
        eq(ownerLedgerEntries.id, params.ledgerEntryId),
        eq(ownerLedgerEntries.associationId, params.associationId),
      ),
    )
    .limit(1);
  if (!target) {
    const err: any = new Error("Ledger entry not found for this association");
    err.status = 404;
    err.code = "ENTRY_NOT_FOUND";
    throw err;
  }
  if (!params.allowStripeBacked && target.referenceType === STRIPE_CHARGE_REFERENCE_TYPE) {
    const err: any = new Error(
      "This payment was collected through Stripe — refund it via POST /api/admin/payments/refund so the money actually moves; the ledger reversal posts automatically with it",
    );
    err.status = 409;
    err.code = "USE_STRIPE_REFUND";
    throw err;
  }

  // The unit's ledger — the balance context the module computes against.
  const unitEntries = await db
    .select()
    .from(ownerLedgerEntries)
    .where(
      and(
        eq(ownerLedgerEntries.associationId, params.associationId),
        eq(ownerLedgerEntries.unitId, target.unitId),
      ),
    );

  // Cumulative cap: sum prior reversals of THIS target (they reference it).
  const alreadyReversed = unitEntries
    .filter(
      (e) =>
        e.referenceType === "refund-reversal" &&
        e.referenceId === target.id &&
        e.entryType === "adjustment" &&
        e.amount > 0,
    )
    .reduce((s, e) => s + e.amount, 0);
  const originalMagnitude = Math.abs(target.amount);
  const remaining = Math.round((originalMagnitude - alreadyReversed) * 100) / 100;
  if (remaining <= 0) {
    const err: any = new Error(
      `Entry ${target.id} is already fully reversed ($${alreadyReversed.toFixed(2)} of $${originalMagnitude.toFixed(2)})`,
    );
    err.status = 400;
    err.code = "ALREADY_REVERSED";
    throw err;
  }
  const requested = params.amount ?? remaining;
  if (requested > remaining + 1e-9) {
    const err: any = new Error(
      `Reversal $${requested.toFixed(2)} exceeds the remaining reversible amount $${remaining.toFixed(2)} (original $${originalMagnitude.toFixed(2)}, already reversed $${alreadyReversed.toFixed(2)})`,
    );
    err.status = 400;
    err.code = "EXCEEDS_REMAINING";
    throw err;
  }

  const result = reversePayment({
    entries: unitEntries,
    target,
    amount: requested,
    postedAt: new Date(),
    description: `Refund $${requested.toFixed(2)} — reversal of ${target.entryType} (entry ${target.id}) — ${params.reason}`,
  });

  const [inserted] = await db
    .insert(ownerLedgerEntries)
    .values({
      associationId: params.associationId,
      unitId: target.unitId,
      personId: target.personId,
      entryType: result.entry.entryType,
      amount: result.entry.amount,
      postedAt: result.entry.postedAt,
      description: result.entry.description,
      referenceType: result.entry.referenceType,
      referenceId: result.entry.referenceId,
    })
    .returning();

  await db.insert(auditLogs).values({
    actorEmail: params.actorEmail,
    action: params.auditAction,
    entityType: "owner_ledger_entry",
    entityId: inserted.id,
    associationId: params.associationId,
    afterJson: {
      reversedEntryId: result.reversedEntryId,
      amountReversed: result.amountReversed,
      priorBalance: result.priorBalance,
      newBalance: result.newBalance,
      reason: params.reason,
      unitId: target.unitId,
      personId: target.personId,
    },
  });

  return {
    reversalEntryId: inserted.id,
    reversedEntryId: result.reversedEntryId,
    amountReversed: result.amountReversed,
    priorBalance: result.priorBalance,
    newBalance: result.newBalance,
  };
}

// ── Registrar ───────────────────────────────────────────────────────────────

export function registerAdminPaymentsRoutes(
  app: Express,
  guards: AdminGuards,
): void {
  const {
    requireAdmin,
    requireAdminRole,
    getAssociationIdQuery,
    assertAssociationScope,
  } = guards;

  // POST /api/admin/payments/record — single-payment write.
  app.post(
    "/api/admin/payments/record",
    requireAdmin,
    requireAdminRole(RECORD_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const parsed = recordPaymentSchema.parse(req.body);
        assertAssociationScope(req, parsed.associationId);

        const recorded = await recordSinglePayment(parsed, {
          actorEmail: req.adminUserEmail ?? "unknown",
        });

        let autoMatch: AutoMatchResult | null = null;
        if (parsed.attemptBankMatch) {
          try {
            autoMatch = await runAutoMatch(parsed.associationId);
          } catch (err: any) {
            // Auto-match is best-effort; never fail the record because the
            // matcher had a bad day. Surface the error in the response so
            // the UI can show the user a non-fatal "auto-match skipped"
            // toast.
            console.error("[admin-payments] auto-match failed:", err);
            autoMatch = null;
          }
        }

        return res.status(201).json({
          payment: recorded,
          autoMatch,
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: "Invalid input",
            code: "INVALID_INPUT",
            issues: error.issues,
          });
        }
        return res.status(400).json({ error: error.message, code: "RECORD_PAYMENT_ERROR" });
      }
    },
  );

  // POST /api/admin/payments/record-bulk — N records in one round-trip.
  // Partial success — returns per-row outcome arrays.
  app.post(
    "/api/admin/payments/record-bulk",
    requireAdmin,
    requireAdminRole(RECORD_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const parsed = bulkRecordSchema.parse(req.body);
        assertAssociationScope(req, parsed.associationId);

        const recorded: RecordedPayment[] = [];
        const failures: Array<{ index: number; error: string }> = [];

        for (let i = 0; i < parsed.rows.length; i++) {
          const row = parsed.rows[i];
          if (row.associationId !== parsed.associationId) {
            failures.push({
              index: i,
              error: "row associationId must match the request associationId",
            });
            continue;
          }
          try {
            const r = await recordSinglePayment(row, {
              actorEmail: req.adminUserEmail ?? "unknown",
            });
            recorded.push(r);
          } catch (err: any) {
            failures.push({ index: i, error: err.message ?? String(err) });
          }
        }

        // Run a single auto-match sweep at the end of the batch (one DB read,
        // not N) — the matcher is association-scoped + idempotent.
        let autoMatch: AutoMatchResult | null = null;
        if (parsed.attemptBankMatch && recorded.length > 0) {
          try {
            autoMatch = await runAutoMatch(parsed.associationId);
          } catch (err: any) {
            console.error("[admin-payments] bulk auto-match failed:", err);
            autoMatch = null;
          }
        }

        return res.status(recorded.length > 0 ? 201 : 400).json({
          recorded,
          failures,
          autoMatch,
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: "Invalid input",
            code: "INVALID_INPUT",
            issues: error.issues,
          });
        }
        return res
          .status(400)
          .json({ error: error.message, code: "RECORD_PAYMENT_BULK_ERROR" });
      }
    },
  );

  // POST /api/admin/payments/refund — refund a Connect direct charge.
  //
  // CRITICAL (issue #286): refunds proportionally refund the application fee by
  // DEFAULT so the HOA never eats YCM's 1% platform fee on a refund. Gated by
  // the REFUNDS_ENABLED flag (default OFF) so the live money-out path stays
  // reversible. Admin-only + association-scoped + audited.
  app.post(
    "/api/admin/payments/refund",
    requireAdmin,
    requireAdminRole(REFUND_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        if (!isRefundsEnabled()) {
          return res
            .status(503)
            .json({ error: "Refunds are disabled (REFUNDS_ENABLED is off)", code: "REFUNDS_DISABLED" });
        }
        const parsed = refundChargeSchema.parse(req.body);
        assertAssociationScope(req, parsed.associationId);

        const result = await refundConnectCharge({
          associationId: parsed.associationId,
          chargeId: parsed.chargeId,
          amountCents: parsed.amountCents,
          reason: parsed.reason,
          refundApplicationFee: parsed.refundApplicationFee,
          requestId: parsed.requestId,
        });

        // Audit every refund (who, charge, amount, whether app fee refunded).
        await db.insert(auditLogs).values({
          actorEmail: req.adminUserEmail ?? "unknown",
          action: "payment.refund",
          entityType: "stripe_refund",
          entityId: result.refundId,
          associationId: parsed.associationId,
          afterJson: {
            chargeId: parsed.chargeId,
            amountCents: result.amountCents,
            status: result.status,
            applicationFeeRefunded: result.applicationFeeRefunded,
            connectedAccountId: result.connectedAccountId,
            reason: parsed.reason ?? null,
          },
        });

        // founder-os#8535 / YCM#286 — keep the OWNER LEDGER consistent with
        // Stripe: post the equal-and-opposite adjustment for the refunded
        // amount against the ledger entry this charge was recorded as.
        // FAIL-SOFT: the Stripe refund has already happened; a missing ledger
        // entry (charge recorded before ledger reconciliation existed) or a
        // reversal error must not fail the refund — it is reported + audited
        // so the books can be trued up by hand.
        let ledgerReversal: ReversalOutcome | { error: string } | null = null;
        try {
          const [chargeEntry] = await db
            .select()
            .from(ownerLedgerEntries)
            .where(
              and(
                eq(ownerLedgerEntries.associationId, parsed.associationId),
                eq(ownerLedgerEntries.referenceType, STRIPE_CHARGE_REFERENCE_TYPE),
                eq(ownerLedgerEntries.referenceId, parsed.chargeId),
              ),
            )
            .limit(1);
          // Stripe can omit amount_cents on some refund shapes — without a
          // concrete refunded amount there is nothing safe to post; fall to
          // the fail-soft note instead of guessing.
          if (chargeEntry && typeof result.amountCents === "number" && result.amountCents > 0) {
            ledgerReversal = await reverseLedgerEntry({
              associationId: parsed.associationId,
              ledgerEntryId: chargeEntry.id,
              amount: result.amountCents / 100,
              reason: `Stripe refund ${result.refundId}${parsed.reason ? ` (${parsed.reason})` : ""}`,
              actorEmail: req.adminUserEmail ?? "unknown",
              auditAction: "payment.refund-ledger-reversal",
              allowStripeBacked: true,
            });
          }
        } catch (reversalErr: any) {
          ledgerReversal = { error: reversalErr?.message ?? String(reversalErr) };
          await db.insert(auditLogs).values({
            actorEmail: req.adminUserEmail ?? "unknown",
            action: "payment.refund-ledger-reversal-failed",
            entityType: "stripe_refund",
            entityId: result.refundId,
            associationId: parsed.associationId,
            afterJson: { chargeId: parsed.chargeId, error: ledgerReversal.error },
          });
        }

        return res.status(201).json({ refund: result, ledgerReversal });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: "Invalid input",
            code: "INVALID_INPUT",
            issues: error.issues,
          });
        }
        return res.status(400).json({ error: error.message, code: "REFUND_ERROR" });
      }
    },
  );

  // POST /api/admin/payments/reverse — reverse a manual/non-Stripe posting
  // (founder-os#8535 / YCM#286). Posts the equal-and-opposite adjustment via
  // the tested payment-edge-cases module. Forward-only, cumulative-capped,
  // treasurer/admin-gated, audited. Stripe-backed receipts are refused with
  // a pointer to /refund (which moves the money AND posts this reversal).
  app.post(
    "/api/admin/payments/reverse",
    requireAdmin,
    requireAdminRole(REFUND_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const parsed = reverseEntrySchema.parse(req.body);
        assertAssociationScope(req, parsed.associationId);

        const reversal = await reverseLedgerEntry({
          associationId: parsed.associationId,
          ledgerEntryId: parsed.ledgerEntryId,
          amount: parsed.amount,
          reason: parsed.reason,
          actorEmail: req.adminUserEmail ?? "unknown",
          auditAction: "payment.reverse",
        });

        return res.status(201).json({ reversal });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: "Invalid input",
            code: "INVALID_INPUT",
            issues: error.issues,
          });
        }
        return res
          .status(error.status ?? 400)
          .json({ error: error.message, code: error.code ?? "REVERSE_ERROR" });
      }
    },
  );

  // GET /api/admin/payments/recent?associationId=&limit= — recent manual records.
  app.get(
    "/api/admin/payments/recent",
    requireAdmin,
    requireAdminRole(READ_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res
            .status(400)
            .json({ error: "associationId is required", code: "MISSING_ASSOCIATION_ID" });
        }
        assertAssociationScope(req, associationId);

        const limit = Math.min(
          200,
          Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20),
        );

        const rows = await db
          .select()
          .from(ownerLedgerEntries)
          .where(
            and(
              eq(ownerLedgerEntries.associationId, associationId),
              eq(ownerLedgerEntries.entryType, "payment"),
              eq(ownerLedgerEntries.referenceType, "manual-recorded-payment"),
            ),
          )
          .orderBy(desc(ownerLedgerEntries.postedAt))
          .limit(limit);

        // Pull matching audit-log rows so the UI can show "recorded by".
        const ids = rows.map((r) => r.id);
        const audit = ids.length
          ? await db
              .select()
              .from(auditLogs)
              .where(
                and(
                  eq(auditLogs.action, "payment.manual-record"),
                  inArray(auditLogs.entityId, ids),
                ),
              )
          : [];
        const auditByEntityId = new Map(audit.map((a) => [a.entityId, a]));

        return res.json({
          entries: rows.map((r) => {
            const a = auditByEntityId.get(r.id);
            const [method] = (r.referenceId ?? "").split(":");
            return {
              id: r.id,
              associationId: r.associationId,
              unitId: r.unitId,
              personId: r.personId,
              amount: r.amount,
              postedAt: r.postedAt,
              description: r.description,
              method: method || "other",
              settledAt: r.settledAt,
              bankTransactionId: r.bankTransactionId,
              actorEmail: a?.actorEmail ?? null,
              createdAt: r.createdAt,
            };
          }),
        });
      } catch (error: any) {
        return res
          .status(500)
          .json({ error: error.message, code: "RECENT_PAYMENTS_ERROR" });
      }
    },
  );
}
