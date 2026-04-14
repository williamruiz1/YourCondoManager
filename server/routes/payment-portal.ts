/**
 * Payment Portal Routes — Phase 1A Owner Payment Portal
 *
 * Portal routes (owner-facing):
 *   GET  /api/portal/balance-summary            — balance, open charges, pending payments
 *   GET  /api/portal/payment-transactions        — owner payment history
 *   GET  /api/portal/payment-transactions/:id    — single transaction detail / receipt
 *   POST /api/portal/pay                         — initiate ACH payment via Stripe Checkout
 *
 * Admin routes:
 *   GET  /api/admin/payment-transactions         — all transactions with filters
 */

import type { Express, NextFunction, Request, Response } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { ownerships, units, persons, associations, savedPaymentMethods, autopayEnrollments } from "@shared/schema";
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

// ── Types (mirrored from routes.ts / autopay.ts) ────────────────────────────

type AdminRole = "platform-admin" | "board-admin" | "manager" | "viewer";

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

      const { amountCents, unitId, description } = req.body as {
        amountCents: number;
        unitId: string;
        description?: string;
      };

      if (!amountCents || typeof amountCents !== "number" || amountCents <= 0 || !Number.isInteger(amountCents)) {
        return res.status(400).json({ message: "amountCents must be a positive integer" });
      }
      if (!unitId || typeof unitId !== "string") {
        return res.status(400).json({ message: "unitId is required" });
      }

      // Verify the unit belongs to this owner
      const unitIds = await getOwnerUnitIds(req.portalAssociationId, req.portalPersonId);
      if (!unitIds.includes(unitId)) {
        return res.status(403).json({ message: "Not authorized for this unit" });
      }

      // Load Stripe gateway connection
      const gateway = await storage.getActivePaymentGatewayConnection({
        associationId: req.portalAssociationId,
        provider: "stripe",
      });
      if (!gateway?.secretKey) {
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

      // Create internal payment record
      const txn = await createPaymentTransaction({
        associationId: req.portalAssociationId,
        unitId,
        personId: req.portalPersonId,
        amountCents,
        description: description || undefined,
      });

      // Initiate Stripe Checkout
      const appBaseUrl = `${req.protocol}://${req.get("host")}`;
      const result = await initiateStripeCheckout({
        transactionId: txn.id,
        secretKey: gateway.secretKey,
        appBaseUrl,
        ownerEmail: person?.email ?? req.portalEmail,
        associationName: assoc?.name ?? "HOA",
        unitNumber: unit?.unitNumber ?? "Unit",
      });

      res.status(201).json({
        checkoutUrl: result.checkoutUrl,
        transactionId: txn.id,
        receiptReference: txn.receiptReference,
        status: "initiated",
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

      const gateway = await storage.getActivePaymentGatewayConnection({
        associationId: req.portalAssociationId,
        provider: "stripe",
      });
      if (!gateway?.secretKey) {
        return res.status(400).json({ message: "Online payments are not configured for this association" });
      }

      const [person] = await db
        .select({ email: persons.email, firstName: persons.firstName, lastName: persons.lastName })
        .from(persons)
        .where(eq(persons.id, req.portalPersonId))
        .limit(1);

      const stripeCustomerId = await ensureStripeCustomer({
        secretKey: gateway.secretKey,
        associationId: req.portalAssociationId,
        personId: req.portalPersonId,
        email: person?.email ?? req.portalEmail,
        name: person ? `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim() : undefined,
      });

      const appBaseUrl = `${req.protocol}://${req.get("host")}`;
      const result = await initiateStripeSetupCheckout({
        secretKey: gateway.secretKey,
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

      const gateway = await storage.getActivePaymentGatewayConnection({
        associationId: req.portalAssociationId,
        provider: "stripe",
      });
      if (!gateway?.secretKey) {
        return res.redirect(302, "/portal?setup=error");
      }

      const session = await fetchStripeCheckoutSession({
        secretKey: gateway.secretKey,
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
    requireAdminRole(["platform-admin", "board-admin", "manager"]),
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
