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
  findConnectConnection,
  getAssociationById,
  listConnectConnections,
  upsertConnectConnection,
} from "../services/stripe-connect-storage";
import { getSecret } from "../platform-secrets-store";

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
        const redirect = `/financials/payments?stripeConnect=callback&associationId=${encodeURIComponent(associationId)}`;
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
  app.get(
    "/api/financial/stripe-connect/connections",
    requireAdmin,
    requireAdminRole(ADMIN_ROLES_READ),
    async (req: AdminRequest, res: Response) => {
      try {
        const associationId = getAssociationIdQuery(req) ?? null;
        if (associationId) assertAssociationScope(req, associationId);
        const rows = await listConnectConnections(associationId);
        return res.json(rows);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return res.status(500).json({ message: msg });
      }
    },
  );

  // ── POST /api/webhooks/stripe-connect/account-updated ─────────────────────
  // Platform-level Stripe Connect webhook. Fires whenever ANY connected
  // account's state changes (charges_enabled, payouts_enabled, requirements).
  // Separate from per-HOA webhooks at /api/webhooks/payments — those use
  // each HOA's whsec; this one uses a single PLATFORM webhook secret.
  app.post(
    "/api/webhooks/stripe-connect/account-updated",
    async (req: Request, res: Response) => {
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

        const event = req.body as { type?: string; data?: { object?: StripeAccountSnapshot } };
        if (!event?.type) {
          return res.status(400).json({ message: "Malformed Stripe event" });
        }

        // Only act on account.updated for Connect onboarding. Other Connect
        // event types (capability.updated, etc.) are out of scope here.
        if (event.type !== "account.updated") {
          return res.status(200).json({ received: true, action: "ignored" });
        }

        const account = event.data?.object;
        if (!account?.id) {
          return res.status(400).json({ message: "Event missing account payload" });
        }

        const updated = await applyAccountUpdated(account);
        return res.status(200).json({
          received: true,
          action: updated ? "applied" : "not-tracked",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return res.status(500).json({ message: msg });
      }
    },
  );
}
