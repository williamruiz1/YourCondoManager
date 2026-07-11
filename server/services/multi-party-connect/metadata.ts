/**
 * Multi-party Connect — pure metadata parsing (no DB, no Stripe).
 *
 * Split out from storage.ts so the pure reader can be imported (and unit-
 * tested) without dragging in the DB connection (which throws if DATABASE_URL
 * is unset). storage.ts re-exports this.
 */

import type { PaymentGatewayConnection } from "../../../shared/schema";
import type { PmRelationshipState } from "./types";

export const PM_REL_META_KEY = "_pmRelationship";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Read the PM relationship from a gateway row's metadata, if present. */
export function readPmRelationshipFromConnection(
  row: Pick<PaymentGatewayConnection, "metadataJson">,
): PmRelationshipState | null {
  if (!isRecord(row.metadataJson)) return null;
  const raw = row.metadataJson[PM_REL_META_KEY];
  if (!isRecord(raw)) return null;
  if (raw.mode !== "pm-relationship") return null;
  if (typeof raw.pmConnectedAccountId !== "string" || !raw.pmConnectedAccountId) return null;
  return raw as unknown as PmRelationshipState;
}
