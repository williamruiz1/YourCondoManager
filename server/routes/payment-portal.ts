/**
 * Payment Portal Routes — Phase 1A Owner Payment Portal
 *
 * Portal routes (owner-facing):
 *   GET  /api/portal/balance-summary            — balance, open charges, pending payments
 *   GET  /api/portal/payment-transactions        — owner payment history
 *   GET  /api/portal/payment-transactions/:id    — single transaction detail / receipt
 *   POST /api/portal/pay                         — initiate payment via Stripe Checkout (ACH by
 *                                                   default; `paymentMethod: "card"` when the
 *                                                   association's CT convenience-fee flag is on —
 *                                                   see server/services/convenience-fee.ts)
 *   GET  /api/portal/payment-fee-preview         — CT convenience-fee preview for a given amount
 *
 * Admin routes:
 *   GET  /api/admin/payment-transactions         — all transactions with filters
 */

import type { Express, NextFunction, Request, Response } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { ownerships, units, persons, associations, savedPaymentMethods, autopayEnrollments } from "@shared/schema";
import type { AdminRole } from "@shared/schema";
import { storage } from "../storage";
import {
  createPaymentTransaction,
  initiateStripeCheckout,
  getPaymentTransactionById,
  getOwnerPaymentHistory,
  getOwnerBalanceSummary,
  getAdminPaymentTransactions,
  ensureStripeCustomer,
  initiateStripeSetupCheckout,
  fetchStripeCheckoutSession,
} from "../services/payment-service";
import { resolveConnectChargeRouting } from "../services/stripe-connect-resolver";
import { computeApplicationFeeCents } from "../services/stripe-charge-metadata";
import { resolveCheckoutFeeCents, listOwedPlatformFees } from "../services/convenience-fee";

// ── Types (mirrored from routes.ts / autopay.ts) ────────────────────────────
// `AdminRole` is imported from `@shared/schema` (Wave 38 / Phase 14 dedup —
// the canonical source of truth, derived from `adminUserRoleEnum.enumValues`).

type AdminRequest = Request & {
  adminUserId?: string;
  adminUserEmail?: string;
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

type PortalRequest = Request & {
  portalAccessId?: string;
  portalAssociationId?: string;
  portalPersonId?: string;
  portalUnitId?: string | null;
  portalEmail?: string;
  portalRole?: string;
  portalBoardRoleId?: string | null;
  portalHasBoardAccess?: boolean;
  portalEffectiveRole?: string;
};

export interface PaymentPortalRouteHelpers {
  requireAdmin: (req: any, res: Response, next: NextFunction) => any;
  requireAdminRole: (roles: AdminRole[]) => (req: any, res: Response, next: NextFunction) => any;
  requirePortal: (req: any, res: Response, next: NextFunction) => any;
  getAssociationIdQuery: (req: Request) => string | undefined;
  assertAssociationScope: (req: AdminRequest, associationId: string) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getOwnerUnitIds(associationId: string, personId: string): Promise<string[]> {
  const rows = await db
    .select({ unitId: units.id })
    .from(ownerships)
    .innerJoin(units, eq(ownerships.unitId, units.id))
    .where(
      and(
        eq(ownerships.personId, personId),
        eq(units.associationId, associationId),
        isNull(ownerships.endDate),
      ),
    );
  return [...new Set(rows.map((r) => r.unitId))];
}

// ── Route Registration ───────────────────────────────────────────────────────

export function registerPaymentPortalRoutes(
  app: Express,
  helpers: PaymentPortalRouteHelpers,
): void {
  const { requireAdmin, requireAdminRole, requirePortal, getAssociationIdQuery, assertAssociationScope } = helpers;

  // ── Portal: Balance Summary ──────────────────────────────────────────────

  app.get("/api/portal/balance-summary", requirePortal, async (req: PortalRequest, res: Response) => {
    try {
      if (!req.portalAssociationId || !req.portalPersonId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const unitIds = await getOwnerUnitIds(req.portalAssociationId, req.portalPersonId);
      const summary = await getOwnerBalanceSummary({
        associationId: req.portalAssociationId,
        personId: req.portalPersonId,
        unitIds,
      });
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Portal: Payment History ──────────────────────────────────────────────

  app.get("/api/portal/payment-transactions", requirePortal, async (req: PortalRequest, res: Response) => {
    try {
      if (!req.portalAssociationId || !req.portalPersonId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const transactions = await getOwnerPaymentHistory({
        associationId: req.portalAssociationId,
        personId: req.portalPersonId,
      });
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Portal: Single Transaction / Receipt ─────────────────────────────────

  app.get("/api/portal/payment-transactions/:id", requirePortal, async (req: PortalRequest, res: Response) => {
    try {
      if (!req.portalAssociationId || !req.portalPersonId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const id = typeof req.params.id === "string" ? req.params.id : Array.isArray(req.params.id) ? req.params.id[0] : "";
      const txn = await getPaymentTransactionById(id);
      if (!txn) return res.status(404).json({ message: "Transaction not found" });
      if (txn.personId !== req.portalPersonId || txn.associationId !== req.portalAssociationId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      res.json(txn);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Portal: Initiate ACH Payment ────────────────────────────────────────

  app.post("/api/portal/pay", requirePortal, async (req: PortalRequest, res: Response) => {
    try {
      if (!req.portalAssociationId || !req.portalPersonId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { amountCents, unitId, description, paymentMethod: paymentMethodRaw } = req.body as {
        amountCents: number;
        unitId: string;
        description?: string;
        /**
         * CT convenience-fee structure (founder-os
         * wiki/research/chc-processing-fee-legality-2026-07-14.md §6).
         * "ach" (default, omit entirely for legacy callers) or "card". `card`
         * is only honored when the association's `cardFeeEnabled` flag is on
         * — otherwise this endpoint stays byte-identical to its pre-existing
         * ACH-only behavior.
         */
        paymentMethod?: "ach" | "card";
      };
      const paymentMethod: "ach" | "card" = paymentMethodRaw === "card" ? "card" : "ach";

      if (!amountCents || typeof amountCents !== "number" || amountCents <= 0 || !Number.isInteger(amountCents)) {
        return res.status(400).json({ message: "amountCents must be a positive integer" });
      }
      if (!unitId || typeof unitId !== "string") {
        return res.status(400).json({ message: "unitId is required" });
      }

      // `amountCents` here is the ASSESSMENT amount the owner wants applied to
      // their account — the fee (if any) is computed on top of it, never
      // folded silently in by the caller. `resolveCheckoutFeeCents` returns 0
      // for "card" when the association's flag is off, so requesting "card"
      // on a not-enabled association degrades to a request with no fee — we
      // reject it explicitly below instead, so the owner never silently pays
      // (or silently doesn't pay) a fee they weren't shown.
      const { feeCents, settings: feeSettings } = await resolveCheckoutFeeCents({
        associationId: req.portalAssociationId,
        assessmentCents: amountCents,
        method: paymentMethod,
      });
      if (paymentMethod === "card" && !feeSettings.cardFeeEnabled) {
        return res.status(400).json({
          message: "Card payments are not available for this association yet. Pay by bank transfer (ACH) instead.",
        });
      }
      const totalAmountCents = amountCents + feeCents;

      // Verify the unit belongs to this owner
      const unitIds = await getOwnerUnitIds(req.portalAssociationId, req.portalPersonId);
      if (!unitIds.includes(unitId)) {
        return res.status(403).json({ message: "Not authorized for this unit" });
      }

      // Resolve charge routing. Prefer Stripe Connect (direct charge on the
      // HOA's connected sub-merchant via the platform key + Stripe-Account
      // header, with the YCM application fee) when the association is fully
      // onboarded + active. Otherwise fall back to the legacy manual-key path
      // (the HOA's own Stripe secret key on `payment_gateway_connections`).
      const connectRouting = await resolveConnectChargeRouting(req.portalAssociationId);

      // Load Stripe gateway connection (manual-key fallback).
      const gateway = await storage.getActivePaymentGatewayConnection({
        associationId: req.portalAssociationId,
        provider: "stripe",
      });

      // The charge needs EITHER an active Connect account (platform key + header)
      // OR a manual HOA secret key. If neither is present, ACH isn't configured.
      const checkoutSecretKey = connectRouting?.platformSecretKey ?? gateway?.secretKey ?? null;
      if (!checkoutSecretKey) {
        return res.status(400).json({ message: "Online ACH payment is not configured for this association" });
      }

      // Load association name and unit number for Stripe description
      const [assoc] = await db
        .select({ name: associations.name })
        .from(associations)
        .where(eq(associations.id, req.portalAssociationId))
        .limit(1);

      const [unit] = await db
        .select({ unitNumber: units.unitNumber })
        .from(units)
        .where(eq(units.id, unitId))
        .limit(1);

      // Load owner email for Stripe customer_email
      const [person] = await db
        .select({ email: persons.email })
        .from(persons)
        .where(eq(persons.id, req.portalPersonId))
        .limit(1);

      // Create internal payment record. `amountCents` here is the TOTAL
      // actually charged (assessment + fee) — matches what Stripe will
      // report on `amount_total`, so reconciliation against the real Stripe
      // charge keeps working unchanged. `platformFeeCents` carves out the
      // fee portion for the ledger-split + platform-revenue booking (see
      // storage.ts processPaymentWebhookEvent).
      const txn = await createPaymentTransaction({
        associationId: req.portalAssociationId,
        unitId,
        personId: req.portalPersonId,
        amountCents: totalAmountCents,
        description: description || undefined,
        platformFeeCents: feeCents,
        checkoutMethod: paymentMethod,
      });

      // Initiate Stripe Checkout. When routing through Connect, attach the
      // §1.2 base application fee (the platform's existing, pre-2026-07-14
      // cut of every Connect direct charge) PLUS the CT convenience/manual
      // fee — see server/services/convenience-fee.ts topology note.
      //
      // CORRECTED 2026-07-14 (William, voice — verified live against prod):
      // Cherry Hill Court Condominiums HAS an active Stripe Connect
      // sub-merchant (acct_1TnzDnArorHrelxs). The original PR wrongly
      // assumed a single shared platform account, so it only itemized the
      // convenience fee as a second Checkout line item without touching
      // `application_fee_amount` — meaning the fee money would have
      // actually landed in Cherry Hill's own connected account (the
      // opposite of "charged and kept by the platform"). The fix: when
      // Connect routing is active, fold `feeCents` INTO the
      // application_fee_amount too, so Stripe itself transfers the fee to
      // YCM's platform balance — a REAL money split, not just an
      // owner_ledger_entries bookkeeping split. When Connect is NOT active
      // (legacy manual-key, single account), there's no Connect mechanism
      // to route through — the accounting-only split (via platformFeeCents
      // netted out of the ledger credit) is the only separation available,
      // unchanged from the original design.
      const baseApplicationFeeCents = connectRouting ? computeApplicationFeeCents(amountCents) : 0;
      const totalApplicationFeeCents = connectRouting ? baseApplicationFeeCents + feeCents : null;
      const settlementMethod: "connect_application_fee" | "accounting_only" =
        connectRouting && feeCents > 0 ? "connect_application_fee" : "accounting_only";
      const appBaseUrl = `${req.protocol}://${req.get("host")}`;
      const result = await initiateStripeCheckout({
        transactionId: txn.id,
        secretKey: checkoutSecretKey,
        appBaseUrl,
        ownerEmail: person?.email ?? req.portalEmail,
        associationName: assoc?.name ?? "HOA",
        unitNumber: unit?.unitNumber ?? "Unit",
        stripeAccountHeader: connectRouting?.stripeAccountHeader ?? null,
        applicationFeeCents: totalApplicationFeeCents,
        statementDescriptorSuffix: connectRouting ? "DUES" : null,
        paymentMethodType: paymentMethod,
        // Read back by normalizeStripeWebhookPayload so the webhook handler
        // knows which settlement actually applies for this charge's fee.
        feeSettlementMethod: feeCents > 0 ? settlementMethod : null,
      });

      res.status(201).json({
        checkoutUrl: result.checkoutUrl,
        transactionId: txn.id,
        receiptReference: txn.receiptReference,
        status: "initiated",
        feeCents,
        totalAmountCents,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ── Portal: Convenience-Fee Preview (CT structure, §6) ──────────────────
  //
  // Lets the client show "Assessment $X.XX + processing fee $Y.YY = $Z.ZZ"
  // BEFORE the owner confirms — the memo's §6.5 disclosure requirement —
  // without duplicating the fee formula client-side. Returns
  // `cardFeeEnabled: false` (and feeCents: 0) for every association until its
  // flag is explicitly turned on; the client hides the card option entirely
  // in that case, keeping the UI byte-identical to pre-existing ACH-only.
  app.get("/api/portal/payment-fee-preview", requirePortal, async (req: PortalRequest, res: Response) => {
    try {
      if (!req.portalAssociationId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const amountCents = Number(req.query.amountCents);
      if (!Number.isFinite(amountCents) || amountCents <= 0 || !Number.isInteger(amountCents)) {
        return res.status(400).json({ message: "amountCents query param must be a positive integer" });
      }
      const [cardFee, achFee] = await Promise.all([
        resolveCheckoutFeeCents({ associationId: req.portalAssociationId, assessmentCents: amountCents, method: "card" }),
        resolveCheckoutFeeCents({ associationId: req.portalAssociationId, assessmentCents: amountCents, method: "ach" }),
      ]);
      res.json({
        assessmentCents: amountCents,
        cardFeeEnabled: cardFee.settings.cardFeeEnabled,
        cardFeeCents: cardFee.feeCents,
        cardTotalCents: amountCents + cardFee.feeCents,
        achFeeCents: achFee.feeCents,
        achTotalCents: amountCents + achFee.feeCents,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ── Portal: Platform Fees Owed (read-only — cash/check manual fee) ───────
  //
  // "collected with their next payment or payable directly" (William,
  // 2026-07-14) — this is the "directly" half: a read-only view so the
  // owner can see what they owe the PLATFORM (never the association).
  // Collecting it is still a treasurer/admin action
  // (POST /api/admin/platform-fees/:id/collect) — a self-serve owner
  // payment flow for this specific receivable is a follow-on, out of scope
  // here.
  app.get("/api/portal/platform-fees-owed", requirePortal, async (req: PortalRequest, res: Response) => {
    try {
      if (!req.portalAssociationId || !req.portalPersonId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const fees = await listOwedPlatformFees({
        associationId: req.portalAssociationId,
        personId: req.portalPersonId,
      });
      res.json({
        fees: fees.map((f) => ({
          id: f.id,
          feeType: f.feeType,
          amountCents: f.amountCents,
          currency: f.currency,
          createdAt: f.createdAt,
        })),
        totalOwedCents: fees.reduce((sum, f) => sum + f.amountCents, 0),
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ── Portal: Setup Saved Payment Method (Stripe Checkout setup mode) ─────

  app.post("/api/portal/payment-methods/setup", requirePortal, async (req: PortalRequest, res: Response) => {
    try {
      if (!req.portalAssociationId || !req.portalPersonId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // 2026-06-30 — Connect-awareness fix. The "Add method" button was dead for
      // CHC (and any Connect-onboarded association) because this endpoint only
      // looked at the legacy manual `gateway.secretKey`. CHC pays via Stripe
      // Connect (no manual key), so `gateway.secretKey` was null → 400 →
      // the client redirect never fired → the button "did nothing".
      //
      // Mirror /api/portal/pay: prefer the Connect platform key + Stripe-Account
      // header when the association has an ACTIVE connected account; otherwise
      // fall back to the manual HOA secret key (legacy path, unchanged).
      const connectRouting = await resolveConnectChargeRouting(req.portalAssociationId);
      const gateway = await storage.getActivePaymentGatewayConnection({
        associationId: req.portalAssociationId,
        provider: "stripe",
      });

      const setupSecretKey = connectRouting?.platformSecretKey ?? gateway?.secretKey ?? null;
      const stripeAccountHeader = connectRouting?.stripeAccountHeader ?? null;
      if (!setupSecretKey) {
        return res.status(400).json({ message: "Online payments are not configured for this association" });
      }

      const [person] = await db
        .select({ email: persons.email, firstName: persons.firstName, lastName: persons.lastName })
        .from(persons)
        .where(eq(persons.id, req.portalPersonId))
        .limit(1);

      const stripeCustomerId = await ensureStripeCustomer({
        secretKey: setupSecretKey,
        stripeAccountHeader,
        associationId: req.portalAssociationId,
        personId: req.portalPersonId,
        email: person?.email ?? req.portalEmail,
        name: person ? `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim() : undefined,
      });

      const appBaseUrl = `${req.protocol}://${req.get("host")}`;
      const result = await initiateStripeSetupCheckout({
        secretKey: setupSecretKey,
        stripeAccountHeader,
        stripeCustomerId,
        appBaseUrl,
        associationId: req.portalAssociationId,
        personId: req.portalPersonId,
      });

      res.json({ checkoutUrl: result.checkoutUrl, sessionId: result.sessionId });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ── Portal: Return from Stripe Setup Checkout ─────────────────────────────

  app.get("/api/portal/payment-methods/setup/return", requirePortal, async (req: PortalRequest, res: Response) => {
    try {
      if (!req.portalAssociationId || !req.portalPersonId) {
        return res.redirect(302, "/portal?setup=error");
      }

      const sessionId = typeof req.query.session_id === "string" ? req.query.session_id : "";
      if (!sessionId) {
        return res.redirect(302, "/portal?setup=error");
      }

      // 2026-06-30 — fetch with the SAME routing the setup session was created
      // with (Connect platform key + header, or manual key). A connected-account
      // session fetched without the Stripe-Account header 404s at Stripe.
      const connectRouting = await resolveConnectChargeRouting(req.portalAssociationId);
      const gateway = await storage.getActivePaymentGatewayConnection({
        associationId: req.portalAssociationId,
        provider: "stripe",
      });
      const returnSecretKey = connectRouting?.platformSecretKey ?? gateway?.secretKey ?? null;
      const returnAccountHeader = connectRouting?.stripeAccountHeader ?? null;
      if (!returnSecretKey) {
        return res.redirect(302, "/portal?setup=error");
      }

      const session = await fetchStripeCheckoutSession({
        secretKey: returnSecretKey,
        stripeAccountHeader: returnAccountHeader,
        sessionId,
      });

      if (!session) {
        return res.redirect(302, "/portal?setup=error");
      }

      // Extract setup_intent → payment_method details
      const setupIntent = session.setup_intent as Record<string, unknown> | null;
      const paymentMethod = setupIntent?.payment_method as Record<string, unknown> | null;
      const usBankAccount = paymentMethod?.us_bank_account as Record<string, unknown> | null;

      const pmId = typeof paymentMethod?.id === "string" ? paymentMethod.id : null;
      const customerId = typeof setupIntent?.customer === "string"
        ? setupIntent.customer
        : typeof session.customer === "string"
          ? session.customer
          : null;
      const bankName = typeof usBankAccount?.bank_name === "string" ? usBankAccount.bank_name : null;
      const last4 = typeof usBankAccount?.last4 === "string" ? usBankAccount.last4 : null;

      if (!pmId || !customerId) {
        return res.redirect(302, "/portal?setup=error");
      }

      const displayName = bankName && last4
        ? `${bankName} ••••${last4}`
        : last4
          ? `Bank account ••••${last4}`
          : "Bank account";

      // Check if this payment method already exists (idempotent)
      const [existing] = await db
        .select()
        .from(savedPaymentMethods)
        .where(
          and(
            eq(savedPaymentMethods.associationId, req.portalAssociationId),
            eq(savedPaymentMethods.personId, req.portalPersonId),
            eq(savedPaymentMethods.providerPaymentMethodId, pmId),
          ),
        )
        .limit(1);

      if (!existing) {
        // Check if this is the first method — make it default
        const [existingMethods] = await db
          .select({ count: eq(savedPaymentMethods.isActive, 1) })
          .from(savedPaymentMethods)
          .where(
            and(
              eq(savedPaymentMethods.associationId, req.portalAssociationId),
              eq(savedPaymentMethods.personId, req.portalPersonId),
              eq(savedPaymentMethods.isActive, 1),
            ),
          );

        const isFirstMethod = !existingMethods;

        await db.insert(savedPaymentMethods).values({
          associationId: req.portalAssociationId,
          personId: req.portalPersonId,
          methodType: "ach",
          displayName,
          last4,
          bankName,
          provider: "stripe",
          providerCustomerId: customerId,
          providerPaymentMethodId: pmId,
          status: "active",
          verifiedAt: new Date(),
          isDefault: isFirstMethod ? 1 : 0,
          isActive: 1,
        });
      }

      res.redirect(302, "/portal?setup=success");
    } catch (error: any) {
      console.error("[payment-methods/setup/return] Error:", error);
      res.redirect(302, "/portal?setup=error");
    }
  });

  // ── Admin: Payment Transactions ──────────────────────────────────────────

  app.get(
    "/api/admin/payment-transactions",
    requireAdmin,
    requireAdminRole(["platform-admin", "board-officer", "assisted-board", "pm-assistant", "manager"]),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req as any);
        if (associationId) {
          assertAssociationScope(req, associationId);
        }

        const status = typeof req.query.status === "string" ? req.query.status : undefined;
        const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
        const offset = typeof req.query.offset === "string" ? parseInt(req.query.offset, 10) : 0;

        const result = await getAdminPaymentTransactions({
          associationId: associationId || undefined,
          status,
          limit,
          offset,
        });
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );
}
