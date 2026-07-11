/**
 * Admin reconciliation routes (founder-os#970 / Gap C).
 *
 * Surfaces the auto-matcher + manual-match workflow at the conventional admin
 * URL space (`/api/admin/reconciliation/*`). Wraps the lower-level services at
 * `server/services/reconciliation/*` and `server/services/plaid-reconciliation.ts`
 * with role-gated access + the standard `assertAssociationScope` tenant fence.
 *
 * Endpoints
 *   GET  /api/admin/reconciliation/report?associationId=&periodStart=&periodEnd=
 *   POST /api/admin/reconciliation/auto-match            { associationId }
 *   GET  /api/admin/reconciliation/manual-queue?associationId=
 *   POST /api/admin/reconciliation/match                 { associationId, bankTransactionId, ledgerEntryId }
 *   GET  /api/admin/reconciliation/audit-log?associationId=&limit=
 *
 * Visual surface: client/src/pages/admin-reconciliation.tsx (3 tabs).
 */
import type { Express, NextFunction, Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { auditLogs, bankTransactions, ownerLedgerEntries, type AdminRole } from "@shared/schema";
import {
  runAutoMatch,
  listManualReviewCandidates,
  findOwnerSuggestionsForUnmatchedCredits,
  createPaymentFromSuggestion,
  listAssociationOwners,
  upsertDescriptorAlias,
} from "../services/reconciliation/auto-matcher";
import {
  buildReconciliationReport,
  buildReconciliationTransactionLedger,
  NON_OWNER_INCOME_ACTION,
} from "../services/reconciliation/report";
import {
  manualMatchBankTransaction,
  listPendingReconciliation,
} from "../services/plaid-reconciliation";
import {
  getMonthCloseState,
  closeMonth,
  reopenMonth,
  PeriodCloseError,
} from "../services/reconciliation/period-close";

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

const RECON_ROLES: AdminRole[] = [
  "platform-admin",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "manager",
  "viewer",
];
const RECON_WRITE_ROLES: AdminRole[] = [
  "platform-admin",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "manager",
];

export function registerAdminReconciliationRoutes(
  app: Express,
  guards: AdminGuards,
): void {
  const {
    requireAdmin,
    requireAdminRole,
    getAssociationIdQuery,
    assertAssociationScope,
  } = guards;

  // ── Tab 2: Reconciliation report ───────────────────────────────────────────
  app.get(
    "/api/admin/reconciliation/report",
    requireAdmin,
    requireAdminRole(RECON_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res
            .status(400)
            .json({ error: "associationId is required", code: "MISSING_ASSOCIATION_ID" });
        }
        assertAssociationScope(req, associationId);

        const periodStartStr =
          typeof req.query.periodStart === "string" ? req.query.periodStart : undefined;
        const periodEndStr =
          typeof req.query.periodEnd === "string" ? req.query.periodEnd : undefined;
        // Defaults: last 30 days ending today (UTC).
        const now = new Date();
        const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));
        const defaultStart = new Date(defaultEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
        const periodStart = periodStartStr ? new Date(periodStartStr) : defaultStart;
        const periodEnd = periodEndStr ? new Date(periodEndStr) : defaultEnd;
        if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
          return res
            .status(400)
            .json({ error: "Invalid period dates", code: "INVALID_PERIOD" });
        }

        const report = await buildReconciliationReport({
          associationId,
          periodStart,
          periodEnd,
        });
        res.json(report);
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message, code: "RECONCILIATION_REPORT_ERROR" });
      }
    },
  );

  // ── Consolidated transaction ledger ────────────────────────────────────────
  // ONE row per bank credit with full identification (owner + unit + status +
  // confidence), composing the existing engine output. This is the data the
  // Bank Accounts page renders as a single, identified transaction table
  // (replacing the old two-raw-list duplication).
  app.get(
    "/api/admin/reconciliation/transactions",
    requireAdmin,
    requireAdminRole(RECON_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res
            .status(400)
            .json({ error: "associationId is required", code: "MISSING_ASSOCIATION_ID" });
        }
        assertAssociationScope(req, associationId);

        const ledger = await buildReconciliationTransactionLedger({ associationId });
        res.json(ledger);
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message, code: "RECONCILIATION_TRANSACTIONS_ERROR" });
      }
    },
  );

  // ── Owner roster (for the "choose a different owner" dropdown) ─────────────
  // The full owner directory for the association (all owners, not just the
  // name-scored candidates). Powers the review queue's manual-attribution
  // dropdown so a treasurer can assign a deposit to ANY owner. Read-only.
  app.get(
    "/api/admin/reconciliation/owners",
    requireAdmin,
    requireAdminRole(RECON_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res
            .status(400)
            .json({ error: "associationId is required", code: "MISSING_ASSOCIATION_ID" });
        }
        assertAssociationScope(req, associationId);

        const owners = await listAssociationOwners(associationId);
        res.json({ owners });
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message, code: "RECONCILIATION_OWNERS_ERROR" });
      }
    },
  );

  // ── Review queue: mark a deposit as non-owner income ───────────────────────
  //
  // Records a DURABLE, reversible human decision that a bank credit is NOT an
  // owner payment (bank interest, inter-account transfer, refund, etc.). This
  // MOVES NO MONEY and creates NO owner-ledger entry — it only writes an audit
  // record. The transaction-ledger read path (buildReconciliationTransactionLedger)
  // excludes classified credits, so the deposit leaves the review queue.
  // Idempotent: re-marking an already-classified credit is a no-op (ok: true).
  app.post(
    "/api/admin/reconciliation/mark-non-owner-income",
    requireAdmin,
    requireAdminRole(RECON_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const { associationId, bankTransactionId, category } = req.body as {
          associationId?: string;
          bankTransactionId?: string;
          category?: string;
        };
        if (!associationId || !bankTransactionId) {
          return res.status(400).json({
            error: "associationId and bankTransactionId are required",
            code: "MISSING_FIELDS",
          });
        }
        assertAssociationScope(req, associationId);

        // Validate the bank tx belongs to this association + is a credit + is
        // not already committed to an owner ledger entry.
        const [btx] = await db
          .select({
            id: bankTransactions.id,
            amountCents: bankTransactions.amountCents,
            name: bankTransactions.name,
            merchantName: bankTransactions.merchantName,
          })
          .from(bankTransactions)
          .where(
            and(
              eq(bankTransactions.id, bankTransactionId),
              eq(bankTransactions.associationId, associationId),
            ),
          )
          .limit(1);
        if (!btx) {
          return res
            .status(404)
            .json({ error: "Bank transaction not found", code: "BTX_NOT_FOUND" });
        }
        if (btx.amountCents >= 0) {
          return res
            .status(400)
            .json({ error: "Bank transaction is not a credit", code: "BTX_NOT_CREDIT" });
        }
        const [linked] = await db
          .select({ id: ownerLedgerEntries.id })
          .from(ownerLedgerEntries)
          .where(
            and(
              eq(ownerLedgerEntries.associationId, associationId),
              eq(ownerLedgerEntries.bankTransactionId, bankTransactionId),
            ),
          )
          .limit(1);
        if (linked) {
          return res.status(400).json({
            error:
              "Bank transaction is already matched to an owner ledger entry — un-match it before classifying as non-owner income",
            code: "ALREADY_LINKED",
          });
        }

        // Idempotency: if already classified, return ok without a duplicate row.
        const [existing] = await db
          .select({ id: auditLogs.id })
          .from(auditLogs)
          .where(
            and(
              eq(auditLogs.associationId, associationId),
              eq(auditLogs.entityType, "bank_transaction"),
              eq(auditLogs.entityId, bankTransactionId),
              eq(auditLogs.action, NON_OWNER_INCOME_ACTION),
            ),
          )
          .limit(1);
        if (existing) {
          return res.json({ ok: true, bankTransactionId, alreadyClassified: true });
        }

        await db.insert(auditLogs).values({
          actorEmail: req.adminUserEmail ?? "unknown",
          action: NON_OWNER_INCOME_ACTION,
          entityType: "bank_transaction",
          entityId: bankTransactionId,
          associationId,
          afterJson: {
            bankTransactionId,
            descriptor: btx.merchantName ?? btx.name,
            amountCents: btx.amountCents,
            category: category ?? null,
          },
        });

        res.json({ ok: true, bankTransactionId, alreadyClassified: false });
      } catch (error: any) {
        res.status(500).json({
          error: error.message,
          code: "RECONCILIATION_NON_OWNER_INCOME_ERROR",
        });
      }
    },
  );

  // ── Tab 1: Auto-match trigger (idempotent) ─────────────────────────────────
  app.post(
    "/api/admin/reconciliation/auto-match",
    requireAdmin,
    requireAdminRole(RECON_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const { associationId } = req.body as { associationId?: string };
        if (!associationId) {
          return res
            .status(400)
            .json({ error: "associationId is required", code: "MISSING_ASSOCIATION_ID" });
        }
        assertAssociationScope(req, associationId);

        const result = await runAutoMatch(associationId);

        // Audit-trail: log the auto-match invocation (not each individual
        // pairing — those are reflected in the ledger entry's bank_transaction_id
        // history already, and a single row per run keeps the audit log readable).
        if (result.matched.length > 0) {
          await db.insert(auditLogs).values({
            actorEmail: req.adminUserEmail ?? "automation@system",
            action: "reconciliation.auto-match.run",
            entityType: "reconciliation",
            entityId: associationId,
            associationId,
            afterJson: {
              matchedCount: result.matched.length,
              needsManualReviewCount: result.needsManualReview.length,
              matches: result.matched.map((m) => ({
                bankTransactionId: m.bankTransactionId,
                ledgerEntryId: m.ledgerEntryId,
                confidence: m.confidence,
              })),
            },
          });
        }

        res.json(result);
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message, code: "RECONCILIATION_AUTO_MATCH_ERROR" });
      }
    },
  );

  // ── Tab 1: list unmatched + candidates for manual review ───────────────────
  // Wraps both the plaid-pay-intent narrow-path candidates (legacy from #448)
  // and the broader confidence-scored candidates from the new auto-matcher.
  app.get(
    "/api/admin/reconciliation/manual-queue",
    requireAdmin,
    requireAdminRole(RECON_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res
            .status(400)
            .json({ error: "associationId is required", code: "MISSING_ASSOCIATION_ID" });
        }
        assertAssociationScope(req, associationId);

        const [planA, planB] = await Promise.all([
          listPendingReconciliation(associationId),
          listManualReviewCandidates(associationId),
        ]);

        res.json({
          // Legacy plaid-pay-intent path (Issue #448 surface kept intact)
          legacyPending: planA,
          // New auto-matcher review queue (scored candidates per bank tx)
          autoMatcherReview: planB,
        });
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message, code: "RECONCILIATION_MANUAL_QUEUE_ERROR" });
      }
    },
  );

  // ── Tab 1: manual match ────────────────────────────────────────────────────
  app.post(
    "/api/admin/reconciliation/match",
    requireAdmin,
    requireAdminRole(RECON_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const { associationId, bankTransactionId, ledgerEntryId } = req.body as {
          associationId?: string;
          bankTransactionId?: string;
          ledgerEntryId?: string;
        };
        if (!associationId || !bankTransactionId || !ledgerEntryId) {
          return res.status(400).json({
            error:
              "associationId, bankTransactionId, and ledgerEntryId are required",
            code: "MISSING_FIELDS",
          });
        }
        assertAssociationScope(req, associationId);

        const result = await manualMatchBankTransaction({
          associationId,
          bankTransactionId,
          ledgerEntryId,
        });
        if (!result.ok) {
          return res.status(400).json({ error: result.reason, code: result.code });
        }

        // Audit trail (Tab 3).
        await db.insert(auditLogs).values({
          actorEmail: req.adminUserEmail ?? "unknown",
          action: "reconciliation.manual-match",
          entityType: "owner_ledger_entry",
          entityId: ledgerEntryId,
          associationId,
          afterJson: {
            bankTransactionId,
            ledgerEntryId,
            amountCents: result.outcome.amountCents,
            dateDeltaDays: result.outcome.dateDeltaDays,
          },
        });

        // Gap 4 (learning): upsert descriptor alias so future credits from
        // the same sender auto-match without treasurer intervention. Fire-and-
        // forget — a failure here must not fail the match response.
        void (async () => {
          try {
            // Fetch the bank tx descriptor and ledger entry person/unit.
            const [btx] = await db
              .select({ name: bankTransactions.name, merchantName: bankTransactions.merchantName })
              .from(bankTransactions)
              .where(eq(bankTransactions.id, bankTransactionId))
              .limit(1);
            const [entry] = await db
              .select({ personId: ownerLedgerEntries.personId, unitId: ownerLedgerEntries.unitId })
              .from(ownerLedgerEntries)
              .where(and(eq(ownerLedgerEntries.id, ledgerEntryId), eq(ownerLedgerEntries.associationId, associationId)))
              .limit(1);
            if (btx && entry) {
              await upsertDescriptorAlias({
                associationId,
                rawDescriptor: btx.merchantName ?? btx.name,
                personId: entry.personId,
                unitId: entry.unitId,
              });
            }
          } catch {
            // Non-fatal — alias learning is best-effort.
          }
        })();

        res.json(result.outcome);
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message, code: "RECONCILIATION_MATCH_ERROR" });
      }
    },
  );

  // ── Tab 4: Suggestions — descriptor-to-owner heuristic (founder-os#2480) ───
  //
  // Surfaces unmatched bank credits with proposed owner attributions inferred
  // from the descriptor. Read-only — the actual ledger entry is created via
  // POST /api/admin/reconciliation/suggestions/create.
  app.get(
    "/api/admin/reconciliation/suggestions",
    requireAdmin,
    requireAdminRole(RECON_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res
            .status(400)
            .json({ error: "associationId is required", code: "MISSING_ASSOCIATION_ID" });
        }
        assertAssociationScope(req, associationId);

        const suggestions = await findOwnerSuggestionsForUnmatchedCredits(associationId);
        res.json({ suggestions });
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message, code: "RECONCILIATION_SUGGESTIONS_ERROR" });
      }
    },
  );

  // ── Tab 4: Create-from-suggestion — one-click materialize + auto-match ─────
  app.post(
    "/api/admin/reconciliation/suggestions/create",
    requireAdmin,
    requireAdminRole(RECON_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const { associationId, bankTransactionId, personId, unitId, description } =
          req.body as {
            associationId?: string;
            bankTransactionId?: string;
            personId?: string;
            unitId?: string;
            description?: string;
          };
        if (!associationId || !bankTransactionId || !personId || !unitId) {
          return res.status(400).json({
            error:
              "associationId, bankTransactionId, personId, and unitId are required",
            code: "MISSING_FIELDS",
          });
        }
        assertAssociationScope(req, associationId);

        const result = await createPaymentFromSuggestion({
          associationId,
          bankTransactionId,
          personId,
          unitId,
          description,
        });
        if (!result.ok) {
          return res.status(400).json({ error: result.reason, code: result.code });
        }

        // Audit-trail
        await db.insert(auditLogs).values({
          actorEmail: req.adminUserEmail ?? "unknown",
          action: "reconciliation.suggestion.create",
          entityType: "owner_ledger_entry",
          entityId: result.ledgerEntryId,
          associationId,
          afterJson: {
            bankTransactionId: result.bankTransactionId,
            ledgerEntryId: result.ledgerEntryId,
            personId,
            unitId,
          },
        });

        // Gap 4 (learning): upsert descriptor alias so future credits from
        // the same sender auto-match. Fire-and-forget — must not fail the response.
        void (async () => {
          try {
            const [btx] = await db
              .select({ name: bankTransactions.name, merchantName: bankTransactions.merchantName })
              .from(bankTransactions)
              .where(eq(bankTransactions.id, bankTransactionId))
              .limit(1);
            if (btx) {
              await upsertDescriptorAlias({
                associationId,
                rawDescriptor: btx.merchantName ?? btx.name,
                personId,
                unitId,
              });
            }
          } catch {
            // Non-fatal.
          }
        })();

        res.json(result);
      } catch (error: any) {
        res.status(500).json({
          error: error.message,
          code: "RECONCILIATION_SUGGESTION_CREATE_ERROR",
        });
      }
    },
  );

  // ── Tab 3: audit log of all matches (auto + manual) ────────────────────────
  app.get(
    "/api/admin/reconciliation/audit-log",
    requireAdmin,
    requireAdminRole(RECON_ROLES),
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
          Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50),
        );

        const rows = await db
          .select()
          .from(auditLogs)
          .where(
            and(
              eq(auditLogs.associationId, associationId),
              eq(auditLogs.entityType, "owner_ledger_entry"),
            ),
          )
          .orderBy(desc(auditLogs.createdAt))
          .limit(limit);

        // Also include auto-match runs (different entityType).
        const runRows = await db
          .select()
          .from(auditLogs)
          .where(
            and(
              eq(auditLogs.associationId, associationId),
              eq(auditLogs.entityType, "reconciliation"),
            ),
          )
          .orderBy(desc(auditLogs.createdAt))
          .limit(limit);

        // Merge + filter to reconciliation actions only, sort by createdAt desc.
        const merged = [...rows, ...runRows]
          .filter((r) => r.action.startsWith("reconciliation."))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, limit);

        res.json({ entries: merged });
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message, code: "RECONCILIATION_AUDIT_LOG_ERROR" });
      }
    },
  );

  // ── Month-close: the treasurer period-close workflow (YCM#220) ─────────────
  //
  // "Close month" answers the question reconciliation-by-transaction never
  // could: "is June fully reconciled?" A treasurer views the month's
  // matched/unmatched counts, then attests a close (who + when). Closing with
  // stragglers requires an explicit acknowledgement (soft guard, not a block).
  // A closed period surfaces a badge; re-opening is an explicit, audit-logged
  // action. This is an ATTESTATION — it does not lock ledger writes.
  //
  // Endpoints
  //   GET  /api/admin/reconciliation/month-close?associationId=&month=YYYY-MM
  //   POST /api/admin/reconciliation/month-close   { associationId, month, acknowledgeUnmatched?, notes? }
  //   POST /api/admin/reconciliation/month-reopen  { associationId, month }

  // Map PeriodCloseError codes → HTTP status.
  function periodCloseStatus(code: string): number {
    switch (code) {
      case "INVALID_PERIOD":
        return 400;
      case "UNMATCHED_ACK_REQUIRED":
        return 409;
      case "ALREADY_CLOSED":
        return 409;
      case "NOT_CLOSED":
        return 409;
      default:
        return 500;
    }
  }

  function getMonthQuery(req: Request): string | undefined {
    const m = (req.query.month ?? (req.body && req.body.month)) as unknown;
    return typeof m === "string" ? m : undefined;
  }

  app.get(
    "/api/admin/reconciliation/month-close",
    requireAdmin,
    requireAdminRole(RECON_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req);
        if (!associationId) {
          return res
            .status(400)
            .json({ error: "associationId is required", code: "MISSING_ASSOCIATION_ID" });
        }
        assertAssociationScope(req, associationId);

        const month = getMonthQuery(req);
        if (!month) {
          return res
            .status(400)
            .json({ error: "month (YYYY-MM) is required", code: "MISSING_MONTH" });
        }

        const state = await getMonthCloseState({ associationId, periodMonth: month });
        res.json(state);
      } catch (error: any) {
        if (error instanceof PeriodCloseError) {
          return res
            .status(periodCloseStatus(error.code))
            .json({ error: error.message, code: error.code, detail: error.detail });
        }
        res
          .status(500)
          .json({ error: error.message, code: "MONTH_CLOSE_STATE_ERROR" });
      }
    },
  );

  app.post(
    "/api/admin/reconciliation/month-close",
    requireAdmin,
    requireAdminRole(RECON_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId =
          typeof req.body?.associationId === "string"
            ? req.body.associationId
            : getAssociationIdQuery(req);
        if (!associationId) {
          return res
            .status(400)
            .json({ error: "associationId is required", code: "MISSING_ASSOCIATION_ID" });
        }
        assertAssociationScope(req, associationId);

        const month = getMonthQuery(req);
        if (!month) {
          return res
            .status(400)
            .json({ error: "month (YYYY-MM) is required", code: "MISSING_MONTH" });
        }

        const record = await closeMonth({
          associationId,
          periodMonth: month,
          actorUserId: req.adminUserId ?? "unknown",
          actorEmail: req.adminUserEmail ?? "unknown",
          acknowledgeUnmatched: req.body?.acknowledgeUnmatched === true,
          notes: typeof req.body?.notes === "string" ? req.body.notes : null,
        });
        res.json({ ok: true, close: record });
      } catch (error: any) {
        if (error instanceof PeriodCloseError) {
          return res
            .status(periodCloseStatus(error.code))
            .json({ error: error.message, code: error.code, detail: error.detail });
        }
        res.status(500).json({ error: error.message, code: "MONTH_CLOSE_ERROR" });
      }
    },
  );

  app.post(
    "/api/admin/reconciliation/month-reopen",
    requireAdmin,
    requireAdminRole(RECON_WRITE_ROLES),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId =
          typeof req.body?.associationId === "string"
            ? req.body.associationId
            : getAssociationIdQuery(req);
        if (!associationId) {
          return res
            .status(400)
            .json({ error: "associationId is required", code: "MISSING_ASSOCIATION_ID" });
        }
        assertAssociationScope(req, associationId);

        const month = getMonthQuery(req);
        if (!month) {
          return res
            .status(400)
            .json({ error: "month (YYYY-MM) is required", code: "MISSING_MONTH" });
        }

        const record = await reopenMonth({
          associationId,
          periodMonth: month,
          actorUserId: req.adminUserId ?? "unknown",
          actorEmail: req.adminUserEmail ?? "unknown",
        });
        res.json({ ok: true, close: record });
      } catch (error: any) {
        if (error instanceof PeriodCloseError) {
          return res
            .status(periodCloseStatus(error.code))
            .json({ error: error.message, code: error.code, detail: error.detail });
        }
        res.status(500).json({ error: error.message, code: "MONTH_REOPEN_ERROR" });
      }
    },
  );
}
