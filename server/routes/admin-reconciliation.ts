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
import { auditLogs, type AdminRole } from "@shared/schema";
import {
  runAutoMatch,
  listManualReviewCandidates,
  findOwnerSuggestionsForUnmatchedCredits,
  createPaymentFromSuggestion,
} from "../services/reconciliation/auto-matcher";
import { buildReconciliationReport } from "../services/reconciliation/report";
import {
  manualMatchBankTransaction,
  listPendingReconciliation,
} from "../services/plaid-reconciliation";

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
}
