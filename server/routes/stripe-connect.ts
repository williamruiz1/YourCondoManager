/**
 * YCM — Stripe Connect (Standard) platform onboarding routes.
 *
 * Canonical spec:
 *   founder-os/wiki/products/ycm/stripe-connect-spec.md §6 dispatch #1 + §7.1
 *
 * Endpoints:
 *   POST /api/financial/stripe-connect/onboarding-link  — admin clicks "Connect with Stripe"
 *   GET  /api/financial/stripe-connect/callback         — Stripe redirects here after KYC
 *   GET  /api/financial/stripe-connect/connections      — admin listing of connected HOAs
 *   POST /api/webhooks/stripe-connect/account-updated   — platform webhook listener
 *
 * Storage: `payment_gateway_connections` (Connect-mode rows have `metadataJson._connect` set).
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { Express, NextFunction, Request, Response } from "express";
import type { AdminRole } from "@shared/schema";
import {
  buildStatementDescriptorPrefix,
  createAccountOnboardingLink,
  createConnectedAccount,
  getYcmBaseUrl,
  retrieveConnectedAccount,
  type StripeAccountSnapshot,
} from "../services/stripe-connect";
import {
  applyAccountUpdated,
  findAssociationIdByConnectedAccount,
  findConnectConnection,
  getAssociationById,
  listConnectConnections,
  upsertConnectConnection,
} from "../services/stripe-connect-storage";
import {
  getReconciliationReport,
  reconcilePayout,
  writeLedgerEntryForCharge,
  writeReversalLedgerEntry,
} from "../services/stripe-reconciliation";
import { getPlatformKeyMode } from "../services/stripe-connect";
import { getSecret } from "../platform-secrets-store";
import { log } from "../logger";
import { handleAchFailureEvent } from "../services/ach-failure-service";

export type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

export interface StripeConnectRouteDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requireAdmin: (req: any, res: Response, next: NextFunction) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requireAdminRole: (roles: AdminRole[]) => (req: any, res: Response, next: NextFunction) => any;
  getAssociationIdQuery: (req: Request) => string | undefined;
  assertAssociationScope: (req: AdminRequest, associationId: string) => void;
}

function getParam(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") return value[0];
  return "";
}

/**
 * Verify a Stripe webhook signature using the standard
 * `t=<unix>,v1=<hex>` format. We don't pull in the official Stripe SDK so
 * this implements the documented HMAC-SHA256-of-`${timestamp}.${rawBody}`
 * verification (same as `server/routes.ts` does for per-HOA webhooks).
 */
function verifyStripeWebhookSignature(rawBody: string, header: string, secret: string): boolean {
  const parts = header.split(",").reduce<Record<string, string>>((acc, p) => {
    const [k, v] = p.split("=");
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expBuf = Buffer.from(expected, "utf8");
  const gotBuf = Buffer.from(signature, "utf8");
  if (expBuf.length !== gotBuf.length) return false;
  try {
    return timingSafeEqual(expBuf, gotBuf);
  } catch {
    return false;
  }
}

const ADMIN_ROLES_WRITE: AdminRole[] = ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"];
const ADMIN_ROLES_READ: AdminRole[] = ["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager", "viewer"];

export function registerStripeConnectRoutes(app: Express, deps: StripeConnectRouteDeps) {
  const { requireAdmin, requireAdminRole, getAssociationIdQuery, assertAssociationScope } = deps;

  // ── POST /api/financial/stripe-connect/onboarding-link ────────────────────
  // Admin clicks "Connect with Stripe" on an association settings page.
  // - Creates a Stripe Standard Connect account (or reuses an existing one
  //   from a prior partial onboarding).
  // - Sets the statement_descriptor on the account per spec §2.2.
  // - Generates an Account Links URL the admin redirects to.
  app.post(
    "/api/financial/stripe-connect/onboarding-link",
    requireAdmin,
    requireAdminRole(ADMIN_ROLES_WRITE),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getParam(req.body?.associationId);
        if (!associationId) {
          return res.status(400).json({ message: "associationId is required" });
        }
        assertAssociationScope(req, associationId);

        const association = await getAssociationById(associationId);
        if (!association) {
          return res.status(404).json({ message: "Association not found" });
        }

        const baseUrl = getYcmBaseUrl();
        const refreshUrl = `${baseUrl}/api/financial/stripe-connect/refresh?associationId=${encodeURIComponent(associationId)}`;
        const returnUrl = `${baseUrl}/api/financial/stripe-connect/callback?associationId=${encodeURIComponent(associationId)}`;

        // Reuse an existing Connect account if onboarding was started before.
        let accountId: string | null = null;
        const existing = await findConnectConnection(associationId);
        if (existing?.providerAccountId) {
          accountId = existing.providerAccountId;
        }

        if (!accountId) {
          const created = await createConnectedAccount({
            hoaName: association.name,
            email: typeof req.body?.email === "string" ? req.body.email : null,
          });
          accountId = created.accountId;
          await upsertConnectConnection({
            associationId,
            accountId,
            account: created.raw,
            initialStatementDescriptor: created.statementDescriptor,
          });
        }

        const link = await createAccountOnboardingLink({
          accountId,
          refreshUrl,
          returnUrl,
        });

        return res.status(201).json({
          url: link.url,
          expiresAt: link.expiresAt,
          accountId,
          statementDescriptor: buildStatementDescriptorPrefix(association.name),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return res.status(400).json({ message: msg });
      }
    },
  );

  // ── GET /api/financial/stripe-connect/callback ────────────────────────────
  // Stripe redirects the admin here after the hosted onboarding flow.
  // We re-fetch the account snapshot and apply the latest status.
  // (Stripe also fires `account.updated` — this is the synchronous return path.)
  app.get(
    "/api/financial/stripe-connect/callback",
    requireAdmin,
    requireAdminRole(ADMIN_ROLES_WRITE),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getParam(req.query.associationId as string | string[] | undefined);
        if (!associationId) {
          return res.status(400).json({ message: "associationId is required" });
        }
        assertAssociationScope(req, associationId);

        const existing = await findConnectConnection(associationId);
        if (!existing?.providerAccountId) {
          return res.status(404).json({ message: "No Connect account in progress for this association" });
        }
        const snapshot = await retrieveConnectedAccount(existing.providerAccountId);
        const updated = await upsertConnectConnection({
          associationId,
          accountId: existing.providerAccountId,
          account: snapshot,
        });

        // Render a small HTML page that the admin can close — UI then
        // refetches via the listing endpoint. We don't redirect to a
        // wouter route because this is a backend GET landing page reached
        // through Stripe's hosted return URL.
        const redirect = `/app/financial/payments?stripeConnect=callback&associationId=${encodeURIComponent(associationId)}`;
        return res.redirect(302, redirect);
        void updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return res.status(400).json({ message: msg });
      }
    },
  );

  // ── GET /api/financial/stripe-connect/refresh ────────────────────────────
  // Stripe redirects here when the Account Links session expires before
  // the admin completes onboarding. We regenerate a fresh link and 302 to
  // it so the admin can pick back up.
  app.get(
    "/api/financial/stripe-connect/refresh",
    requireAdmin,
    requireAdminRole(ADMIN_ROLES_WRITE),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getParam(req.query.associationId as string | string[] | undefined);
        if (!associationId) {
          return res.status(400).json({ message: "associationId is required" });
        }
        assertAssociationScope(req, associationId);
        const existing = await findConnectConnection(associationId);
        if (!existing?.providerAccountId) {
          return res.status(404).json({ message: "No Connect account in progress for this association" });
        }
        const baseUrl = getYcmBaseUrl();
        const link = await createAccountOnboardingLink({
          accountId: existing.providerAccountId,
          refreshUrl: `${baseUrl}/api/financial/stripe-connect/refresh?associationId=${encodeURIComponent(associationId)}`,
          returnUrl: `${baseUrl}/api/financial/stripe-connect/callback?associationId=${encodeURIComponent(associationId)}`,
        });
        return res.redirect(302, link.url);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return res.status(400).json({ message: msg });
      }
    },
  );

  // ── GET /api/financial/stripe-connect/connections ─────────────────────────
  // Admin listing — Connect-mode connections with status at-a-glance.
  // Per audit Gap D: each row carries `keyMode` (test/live) so an operator can
  // tell a sandbox connection from a production one at a glance. keyMode is
  // platform-wide (derived from the platform secret key) so it's attached at
  // the response envelope AND mirrored onto each row for table rendering.
  app.get(
    "/api/financial/stripe-connect/connections",
    requireAdmin,
    requireAdminRole(ADMIN_ROLES_READ),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req) ?? null;
        if (associationId) assertAssociationScope(req, associationId);
        const [rows, keyMode] = await Promise.all([
          listConnectConnections(associationId),
          getPlatformKeyMode(),
        ]);
        return res.json(rows.map((row) => ({ ...row, keyMode })));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return res.status(500).json({ message: msg });
      }
    },
  );

  // ── GET /api/financial/stripe-connect/reconciliation ──────────────────────
  // Admin reconciliation report (spec §4.1 step 6): payouts per HOA, each
  // expanded to a per-owner breakdown whose net total matches the bank deposit
  // exactly (varianceCents == 0). Optional `?associationId=` scopes to one HOA;
  // omitted = portfolio-wide (platform-admin only via scope assertion).
  app.get(
    "/api/financial/stripe-connect/reconciliation",
    requireAdmin,
    requireAdminRole(ADMIN_ROLES_READ),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req) ?? null;
        if (associationId) assertAssociationScope(req, associationId);
        const [payouts, keyMode] = await Promise.all([
          getReconciliationReport(associationId),
          getPlatformKeyMode(),
        ]);
        const totals = payouts.reduce(
          (acc, p) => {
            acc.payoutAmountCents += p.payoutAmountCents;
            acc.reconciledNetCents += p.reconciledNetCents;
            acc.varianceCents += p.varianceCents;
            return acc;
          },
          { payoutAmountCents: 0, reconciledNetCents: 0, varianceCents: 0 },
        );
        return res.json({ keyMode, payoutCount: payouts.length, totals, payouts });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return res.status(500).json({ message: msg });
      }
    },
  );

  // ── Platform-level Stripe Connect webhook ─────────────────────────────────
  // Fires for events on ANY connected account (event.account = acct_…).
  // Verified with a single PLATFORM webhook secret — distinct from per-HOA
  // webhooks at /api/webhooks/payments (those use each HOA's whsec).
  //
  // Handled event types:
  //   account.updated  — onboarding KYC/payout/charges state (dispatch #1)
  //   charge.succeeded — Gap C: write the owner ledger entry immediately so
  //                      balances don't go stale waiting for the daily payout
  //   payout.paid      — explode the payout into per-owner ledger entries +
  //                      persist the reconciliation breakdown (spec §4.1)
  //
  // Registered at two paths: the original `/account-updated` (backward compat
  // with the dispatch-#1 webhook config) and the general `/events` path. Both
  // dispatch identically, so the Stripe dashboard may point at either.
  const handlePlatformConnectWebhook = async (req: Request, res: Response) => {
    try {
      const signature = req.header("stripe-signature");
      if (!signature) {
        return res.status(400).json({ message: "Missing Stripe-Signature header" });
      }
      const secret =
        (await getSecret("PLATFORM_STRIPE_CONNECT_WEBHOOK_SECRET", "platform_stripe_connect_webhook_secret")) || "";
      if (!secret) {
        return res.status(503).json({ message: "Platform Stripe Connect webhook secret not configured" });
      }
      const rawBody = Buffer.isBuffer((req as Request & { rawBody?: Buffer }).rawBody)
        ? (req as Request & { rawBody?: Buffer }).rawBody!.toString("utf8")
        : JSON.stringify(req.body);
      if (!verifyStripeWebhookSignature(rawBody, signature, secret)) {
        return res.status(403).json({ message: "Invalid Stripe webhook signature" });
      }

      const event = req.body as {
        id?: string;
        type?: string;
        account?: string; // the connected account the event belongs to
        data?: { object?: Record<string, unknown> };
      };
      if (!event?.type) {
        return res.status(400).json({ message: "Malformed Stripe event" });
      }
      const connectedAccountId = typeof event.account === "string" ? event.account : null;

      switch (event.type) {
        case "account.updated": {
          const account = event.data?.object as StripeAccountSnapshot | undefined;
          if (!account?.id) {
            return res.status(400).json({ message: "Event missing account payload" });
          }
          const updated = await applyAccountUpdated(account);
          return res.status(200).json({
            received: true,
            type: event.type,
            action: updated ? "applied" : "not-tracked",
          });
        }

        case "charge.succeeded": {
          // Gap C — write the ledger entry immediately (don't wait for payout).
          const charge = event.data?.object as
            | { id?: string; amount?: number; metadata?: Record<string, string> | null }
            | undefined;
          if (!charge?.id) {
            return res.status(400).json({ message: "Event missing charge payload" });
          }
          const result = await writeLedgerEntryForCharge({
            chargeId: charge.id,
            amountCents: typeof charge.amount === "number" ? charge.amount : 0,
            metadata: charge.metadata,
            source: "charge.succeeded",
          });
          return res.status(200).json({
            received: true,
            type: event.type,
            action: result.created ? "ledger-written" : `skipped:${result.skipped ?? "unknown"}`,
            ledgerEntryId: result.ledgerEntryId,
          });
        }

        case "payout.paid": {
          const payout = event.data?.object as
            | { id?: string; amount?: number; currency?: string; status?: string; arrival_date?: number }
            | undefined;
          if (!payout?.id) {
            return res.status(400).json({ message: "Event missing payout payload" });
          }
          if (!connectedAccountId) {
            // payout.paid is always a connected-account event; without the
            // account header we cannot attribute it to a HOA.
            return res.status(400).json({ message: "payout.paid event missing connected account" });
          }
          const resolved = await findAssociationIdByConnectedAccount(connectedAccountId);
          if (!resolved) {
            log(`[payout.paid] no association for connected account ${connectedAccountId}`, "stripe-recon");
            return res.status(200).json({ received: true, type: event.type, action: "not-tracked" });
          }
          const summary = await reconcilePayout({
            connectedAccountId,
            payoutId: payout.id,
            associationId: resolved.associationId,
            payout: {
              id: payout.id,
              amount: typeof payout.amount === "number" ? payout.amount : 0,
              currency: payout.currency ?? "usd",
              status: payout.status,
              arrival_date: payout.arrival_date,
            },
          });
          return res.status(200).json({ received: true, type: event.type, action: "reconciled", summary });
        }

        case "payment_intent.payment_failed":
        case "charge.failed": {
          // ACH return / failed charge (delayed-notification). Mark the linked
          // transaction delinquent + queue the explicit retry (ACH is the
          // Smart-Retries exception — Stripe does not auto-retry a bank return).
          const obj = event.data?.object as
            | {
                id?: string;
                payment_intent?: string | null;
                failure_code?: string | null;
                failure_message?: string | null;
                last_payment_error?: { code?: string; message?: string } | null;
              }
            | undefined;
          const result = await handleAchFailureEvent({
            eventId: event.id ?? "",
            eventType: event.type,
            object: obj,
          });
          return res.status(200).json({
            received: true,
            type: event.type,
            action: result.action,
            transactionId: result.transactionId,
          });
        }

        case "charge.refunded": {
          // A-RECON-006 (founder-os#10754): a refund returns money to the owner,
          // so post a POSITIVE reversing owner-ledger entry — otherwise the
          // ledger keeps the owner's balance reduced as if they had paid. The
          // event's charge carries its refunds; the NEWEST (`refunds.data[0]`)
          // is the one this delivery is for → key the reversal on that refund id
          // so a partial refund posts its own partial reversal and a retried
          // webhook is idempotent (dedup on referenceType+referenceId).
          const charge = event.data?.object as
            | { id?: string; refunds?: { data?: Array<{ id?: string; amount?: number }> } | null }
            | undefined;
          const refund = charge?.refunds?.data?.[0];
          if (!charge?.id || !refund?.id || typeof refund.amount !== "number") {
            return res.status(200).json({ received: true, type: event.type, action: "acknowledged:no-refund-payload" });
          }
          const result = await writeReversalLedgerEntry({
            reversalId: refund.id,
            chargeId: charge.id,
            amountCents: refund.amount,
            kind: "refund",
            source: "charge.refunded",
          });
          return res.status(200).json({
            received: true,
            type: event.type,
            action: result.created ? "ledger-reversed" : `skipped:${result.skipped ?? "unknown"}`,
            ledgerEntryId: result.ledgerEntryId,
          });
        }

        case "charge.dispute.closed": {
          // A-RECON-006: a LOST dispute (chargeback) removes money from the HOA
          // permanently → post the reversal, keyed on the dispute id. A
          // won/warning-closed dispute returns the money to the HOA, so no
          // reversal. (The dispute FEE reversal needs a balance-transaction
          // lookup and remains the documented follow-on.)
          const dispute = event.data?.object as
            | { id?: string; status?: string; amount?: number; charge?: string | null }
            | undefined;
          if (dispute?.status !== "lost") {
            return res.status(200).json({ received: true, type: event.type, action: `acknowledged:dispute-${dispute?.status ?? "unknown"}` });
          }
          if (!dispute.id || !dispute.charge || typeof dispute.amount !== "number") {
            return res.status(200).json({ received: true, type: event.type, action: "acknowledged:no-dispute-payload" });
          }
          const result = await writeReversalLedgerEntry({
            reversalId: dispute.id,
            chargeId: dispute.charge,
            amountCents: dispute.amount,
            kind: "dispute",
            source: "charge.dispute.closed",
          });
          return res.status(200).json({
            received: true,
            type: event.type,
            action: result.created ? "ledger-reversed" : `skipped:${result.skipped ?? "unknown"}`,
            ledgerEntryId: result.ledgerEntryId,
          });
        }

        case "charge.dispute.created": {
          // Money is not yet returned on dispute-created (only on close-lost).
          // Acknowledge so Stripe stops retrying; the reversal fires on close.
          return res.status(200).json({ received: true, type: event.type, action: "acknowledged" });
        }

        default:
          // Other Connect event types (capability.updated, payout.failed, etc.)
          // are out of scope for this dispatch.
          return res.status(200).json({ received: true, type: event.type, action: "ignored" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return res.status(500).json({ message: msg });
    }
  };

  app.post("/api/webhooks/stripe-connect/account-updated", handlePlatformConnectWebhook);
  app.post("/api/webhooks/stripe-connect/events", handlePlatformConnectWebhook);
}
