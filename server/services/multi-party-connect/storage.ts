/**
 * Multi-party Connect — storage helpers (Flows 2 + 3).
 *
 * Persists the PM↔HOA relationship additively in the managed HOA's
 * `payment_gateway_connections.metadataJson._pmRelationship`, mirroring how
 * Connect state was added via `_connect` without a schema migration. The
 * existing manual-key + `_connect` metadata on the same row is preserved.
 *
 * Reversibility: when MULTI_PARTY_CONNECT_ENABLED is off, none of these reads
 * are consulted by the live charge path; the rows are inert additive metadata.
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { paymentGatewayConnections, type PaymentGatewayConnection } from "../../../shared/schema";
import type { PmRelationshipState, UpsertPmRelationshipInput } from "./types";
import { PM_REL_META_KEY, readPmRelationshipFromConnection } from "./metadata";

// Re-export the pure reader so existing imports of it from "./storage" keep working.
export { readPmRelationshipFromConnection } from "./metadata";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Find the PM relationship for a managed HOA, if any. */
export async function findPmRelationship(
  managedAssociationId: string,
): Promise<{ connection: PaymentGatewayConnection; relationship: PmRelationshipState } | null> {
  if (!managedAssociationId) return null;
  const rows = await db
    .select()
    .from(paymentGatewayConnections)
    .where(
      and(
        eq(paymentGatewayConnections.associationId, managedAssociationId),
        eq(paymentGatewayConnections.provider, "stripe"),
      ),
    )
    .orderBy(desc(paymentGatewayConnections.updatedAt))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const relationship = readPmRelationshipFromConnection(row);
  if (!relationship) return null;
  return { connection: row, relationship };
}

/**
 * Upsert a PM relationship onto a managed HOA's gateway row. Preserves all
 * pre-existing metadata (`_connect`, `_gatewayCredentials`, etc.) and only
 * sets/replaces the `_pmRelationship` key. The unique index permits one row per
 * (associationId, provider); we merge gracefully.
 *
 * Requires an existing gateway row for the HOA (Connect onboarding already
 * created it). Does NOT create a new row from scratch — the managed HOA must
 * already be a Connect sub-merchant for Flow 3 to settle dues to it.
 */
export async function upsertPmRelationship(
  input: UpsertPmRelationshipInput,
): Promise<PmRelationshipState> {
  const existingRows = await db
    .select()
    .from(paymentGatewayConnections)
    .where(
      and(
        eq(paymentGatewayConnections.associationId, input.managedAssociationId),
        eq(paymentGatewayConnections.provider, "stripe"),
      ),
    )
    .limit(1);
  const existing = existingRows[0];
  if (!existing) {
    throw new Error(
      `No Stripe gateway connection for managed association ${input.managedAssociationId}; ` +
        `the HOA must be a Connect sub-merchant before a PM relationship can be attached.`,
    );
  }

  const relationship: PmRelationshipState = {
    mode: "pm-relationship",
    pmConnectedAccountId: input.pmConnectedAccountId,
    pmDisplayName: input.pmDisplayName ?? null,
    pmFeeBps: typeof input.pmFeeBps === "number" ? input.pmFeeBps : null,
    flow3Routing: input.flow3Routing ?? "hoa-direct",
    trustAccountId: input.trustAccountId ?? null,
    updatedAt: new Date().toISOString(),
  };

  const existingMeta = isRecord(existing.metadataJson) ? existing.metadataJson : {};
  const mergedMeta = {
    ...existingMeta,
    [PM_REL_META_KEY]: relationship,
  } as Record<string, unknown>;

  await db
    .update(paymentGatewayConnections)
    .set({ metadataJson: mergedMeta, updatedAt: new Date() })
    .where(eq(paymentGatewayConnections.id, existing.id));

  return relationship;
}
