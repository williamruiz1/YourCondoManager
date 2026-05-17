/**
 * Stripe Connect — storage helpers.
 *
 * Reads/writes `payment_gateway_connections` rows for Connect-mode HOAs.
 * Connect-specific state is persisted in `metadataJson._connect` to avoid
 * a schema migration; existing manual-key onboarding (storage.ts
 * `validateAndUpsertPaymentGatewayConnection`) is untouched.
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { associations, paymentGatewayConnections, type PaymentGatewayConnection } from "../../shared/schema";
import type { ConnectMetadataState, StripeAccountSnapshot } from "./stripe-connect";
import { buildConnectMetadataState } from "./stripe-connect";

const CONNECT_META_KEY = "_connect";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export interface ConnectConnectionView {
  id: string;
  associationId: string;
  associationName: string | null;
  providerAccountId: string | null;
  isActive: number;
  connectState: ConnectMetadataState | null;
  updatedAt: Date;
  createdAt: Date;
}

export function readConnectStateFromConnection(
  row: Pick<PaymentGatewayConnection, "metadataJson">,
): ConnectMetadataState | null {
  if (!isRecord(row.metadataJson)) return null;
  const raw = row.metadataJson[CONNECT_META_KEY];
  if (!isRecord(raw)) return null;
  if (raw.mode !== "connect") return null;
  return raw as unknown as ConnectMetadataState;
}

export async function getAssociationById(
  associationId: string,
): Promise<{ id: string; name: string } | null> {
  const rows = await db
    .select({ id: associations.id, name: associations.name })
    .from(associations)
    .where(eq(associations.id, associationId))
    .limit(1);
  return rows[0] ?? null;
}

/** Find an existing Connect-mode connection for the given association, if any. */
export async function findConnectConnection(
  associationId: string,
): Promise<PaymentGatewayConnection | null> {
  const rows = await db
    .select()
    .from(paymentGatewayConnections)
    .where(
      and(
        eq(paymentGatewayConnections.associationId, associationId),
        eq(paymentGatewayConnections.provider, "stripe"),
      ),
    )
    .orderBy(desc(paymentGatewayConnections.updatedAt))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  // Only treat as a Connect-mode row if the metadata says so. A manual-mode
  // row coexists (different `_gatewayCredentials` shape) and is left alone.
  if (!readConnectStateFromConnection(row)) return null;
  return row;
}

/**
 * Upsert a Connect-mode connection row. Preserves any pre-existing
 * `_gatewayCredentials` metadata if a manual-mode row already exists for
 * the same (association, provider) pair (defensive — we don't expect both
 * coexisting in production, but the unique index permits only one row
 * per (associationId, provider) so we must merge gracefully).
 */
export async function upsertConnectConnection(input: {
  associationId: string;
  accountId: string;
  account: StripeAccountSnapshot;
  initialStatementDescriptor?: string | null;
}): Promise<PaymentGatewayConnection> {
  const connectState = buildConnectMetadataState(input.account);
  if (input.initialStatementDescriptor && !connectState.statementDescriptor) {
    connectState.statementDescriptor = input.initialStatementDescriptor;
  }

  const existingRows = await db
    .select()
    .from(paymentGatewayConnections)
    .where(
      and(
        eq(paymentGatewayConnections.associationId, input.associationId),
        eq(paymentGatewayConnections.provider, "stripe"),
      ),
    )
    .limit(1);
  const existing = existingRows[0];

  const existingMeta = isRecord(existing?.metadataJson) ? existing!.metadataJson : {};
  const mergedMeta = {
    ...existingMeta,
    [CONNECT_META_KEY]: connectState,
  } as Record<string, unknown>;

  if (existing) {
    const [updated] = await db
      .update(paymentGatewayConnections)
      .set({
        providerAccountId: input.accountId,
        validationStatus: connectState.status === "active" ? "valid" : "invalid",
        validationMessage:
          connectState.status === "active"
            ? `Stripe Connect account ${input.accountId} active.`
            : `Stripe Connect account ${input.accountId} status: ${connectState.status}.`,
        isActive: connectState.status === "active" ? 1 : 0,
        metadataJson: mergedMeta,
        lastValidatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paymentGatewayConnections.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(paymentGatewayConnections)
    .values({
      associationId: input.associationId,
      provider: "stripe",
      providerAccountId: input.accountId,
      publishableKey: null,
      secretKeyMasked: null,
      webhookSecretMasked: null,
      validationStatus: connectState.status === "active" ? "valid" : "invalid",
      validationMessage:
        connectState.status === "active"
          ? `Stripe Connect account ${input.accountId} active.`
          : `Stripe Connect account ${input.accountId} status: ${connectState.status}.`,
      isActive: connectState.status === "active" ? 1 : 0,
      metadataJson: mergedMeta,
      lastValidatedAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return created;
}

/** Apply a webhook-derived account.updated event to the connection row. */
export async function applyAccountUpdated(
  account: StripeAccountSnapshot,
): Promise<PaymentGatewayConnection | null> {
  if (!account.id) return null;
  const rows = await db
    .select()
    .from(paymentGatewayConnections)
    .where(
      and(
        eq(paymentGatewayConnections.providerAccountId, account.id),
        eq(paymentGatewayConnections.provider, "stripe"),
      ),
    )
    .limit(1);
  const existing = rows[0];
  if (!existing) return null;
  // Only update if it's a Connect-mode row; ignore stray account.updated
  // events for manual-mode connections (those represent the HOA's own
  // platform account, not a connected sub-merchant).
  if (!readConnectStateFromConnection(existing)) return null;

  const connectState = buildConnectMetadataState(account);
  const existingMeta = isRecord(existing.metadataJson) ? existing.metadataJson : {};
  const mergedMeta = {
    ...existingMeta,
    [CONNECT_META_KEY]: connectState,
  } as Record<string, unknown>;

  const [updated] = await db
    .update(paymentGatewayConnections)
    .set({
      validationStatus: connectState.status === "active" ? "valid" : "invalid",
      validationMessage: `Stripe Connect account ${account.id} status: ${connectState.status}.`,
      isActive: connectState.status === "active" ? 1 : 0,
      metadataJson: mergedMeta,
      lastValidatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(paymentGatewayConnections.id, existing.id))
    .returning();
  return updated;
}

/** Admin listing — all Connect-mode connections with denormalized association name. */
export async function listConnectConnections(
  associationId?: string | null,
): Promise<ConnectConnectionView[]> {
  const query = db
    .select({
      conn: paymentGatewayConnections,
      assocName: associations.name,
    })
    .from(paymentGatewayConnections)
    .leftJoin(associations, eq(paymentGatewayConnections.associationId, associations.id))
    .where(
      associationId
        ? and(
            eq(paymentGatewayConnections.associationId, associationId),
            eq(paymentGatewayConnections.provider, "stripe"),
          )
        : eq(paymentGatewayConnections.provider, "stripe"),
    )
    .orderBy(desc(paymentGatewayConnections.updatedAt));

  const rows = await query;
  const views: ConnectConnectionView[] = [];
  for (const { conn, assocName } of rows) {
    const connectState = readConnectStateFromConnection(conn);
    if (!connectState) continue;
    views.push({
      id: conn.id,
      associationId: conn.associationId,
      associationName: assocName ?? null,
      providerAccountId: conn.providerAccountId,
      isActive: conn.isActive,
      connectState,
      updatedAt: conn.updatedAt,
      createdAt: conn.createdAt,
    });
  }
  return views;
}
