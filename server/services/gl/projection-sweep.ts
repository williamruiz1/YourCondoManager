import { db } from "../../db";
import { ownerLedgerEntries } from "@shared/schema";
import { isGlEnabledForAssociation } from "./flag";
import { maybeSyncAssociationGl } from "./runtime-sync";

export interface GlProjectionSweepResult {
  scanned: number;
  enabled: number;
  reconciled: number;
  skipped: number;
  failed: number;
}

/**
 * Recovery backstop for every owner-ledger write path.
 *
 * The canonical payment writer performs an immediate projection, but a process
 * can still terminate after committing the owner ledger and before completing
 * the derived GL write. Other legacy/manual ledger writers may also predate the
 * canonical payment service. This sweep re-derives each enabled association
 * every automation cycle, so missed work is recovered after restart without
 * replaying a provider event or touching the owner ledger.
 */
export async function runGlProjectionContinuitySweep(): Promise<GlProjectionSweepResult> {
  const associationRows = await db
    .select({ associationId: ownerLedgerEntries.associationId })
    .from(ownerLedgerEntries)
    .groupBy(ownerLedgerEntries.associationId);

  const result: GlProjectionSweepResult = {
    scanned: associationRows.length,
    enabled: 0,
    reconciled: 0,
    skipped: 0,
    failed: 0,
  };

  for (const { associationId } of associationRows) {
    if (!isGlEnabledForAssociation(associationId)) {
      result.skipped += 1;
      continue;
    }
    result.enabled += 1;
    const outcome = await maybeSyncAssociationGl(
      associationId,
      "continuity-sweep",
    );
    if (outcome.posted) {
      result.reconciled += 1;
    } else {
      result.failed += 1;
    }
  }

  return result;
}

