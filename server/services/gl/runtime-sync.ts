/**
 * GL runtime sync — the LIVE trigger that posts dues into the parallel GL
 * (YCM Financial Core — dues-to-GL wiring).
 *
 * Audit anchor:  audits/AUDIT-financial-reporting-orchestration.md Gap F1.
 * Hardening:     audits/BLINDSPOT-pass-2026-06-20.md F4 (forward-only / parallel
 *                + the reconcile-to-cent gate before the GL is treated as
 *                authoritative).
 *
 * This is the orchestrator the LIVE money paths call after a confirmed-payment
 * owner-ledger row is inserted (the Stripe webhook "succeeded" path and the
 * autopay success path). It exists so the live path has ONE small, well-tested,
 * fail-safe entry point and never embeds GL logic inline.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FOUR HARD GUARANTEES (in order):
 *
 *  1. NON-FATAL. A GL-sync failure NEVER propagates into the live money path.
 *     The owner ledger is the system of record; the GL is a derived parallel.
 *     Every call is best-effort and swallows its own errors (logged, not thrown).
 *
 *  2. PER-ASSOCIATION GATED. Skips unless the GL is enabled for THIS association
 *     (global GL_ENABLED OR the GL_ENABLED_ASSOCIATIONS allowlist) — we never
 *     flip the GL on for everyone just to serve one association.
 *
 *  3. RECONCILE-TO-CENT GATED. Even for an enabled association, we refuse to
 *     post unless the association's owner ledger reconciles to the cent through
 *     the pure GL core (reconcileFromOwnerLedger). A ledger that can't reconcile
 *     (invariant violation / corruption) is NOT given a GL — surfacing nothing
 *     beats surfacing a wrong statement. This is the "treat GL as authoritative
 *     only after reconcile passes" gate from BLINDSPOT F4.
 *
 *  4. IDEMPOTENT / FORWARD-ONLY. The underlying syncAssociationGl re-derives the
 *     WHOLE association ledger and inserts legs with onConflictDoNothing against
 *     the (sourceType, sourceId, glAccount, side) unique index — so firing it on
 *     every payment (and on webhook retries) is a safe no-op for already-posted
 *     facts and never mutates or deletes an existing row.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { eq } from "drizzle-orm";
import { db } from "../../db";
import { ownerLedgerEntries } from "@shared/schema";
import { isGlEnabledForAssociation } from "./flag";
import { reconcileFromOwnerLedger } from "./reconcile";
import { syncAssociationGl, type GlPostingResult } from "./gl-posting-service";
import type { OwnerLedgerEntryLike } from "./posting";
import { ownerLedgerAmountDollars } from "@shared/owner-ledger-money";
import {
  recordGlProjectionFailure,
  resolveGlProjectionFailure,
} from "./projection-alerts";

export type GlSyncOutcome =
  | { posted: false; reason: "not-enabled" | "reconcile-failed" | "error"; detail?: string }
  | { posted: true; result: GlPostingResult };

/** Load owner-ledger rows for an association as the pure-core input shape. */
async function loadOwnerLedger(associationId: string): Promise<OwnerLedgerEntryLike[]> {
  const rows = await db
    .select()
    .from(ownerLedgerEntries)
    .where(eq(ownerLedgerEntries.associationId, associationId));
  return rows.map((r) => ({
    id: r.id,
    entryType: r.entryType,
    amount: ownerLedgerAmountDollars(r),
    postedAt: r.postedAt,
    description: r.description,
  }));
}

/**
 * Run the per-association GL sync IFF it is enabled AND reconciles to the cent.
 * Throws only the way `db` itself can throw; intended to be wrapped by
 * `maybeSyncAssociationGl` on the live path. Exposed (and used by tests) so the
 * gate logic is unit-testable without the catch wrapper.
 */
export async function syncAssociationGlGated(associationId: string): Promise<GlSyncOutcome> {
  if (!isGlEnabledForAssociation(associationId)) {
    return { posted: false, reason: "not-enabled" };
  }

  // RECONCILE-TO-CENT GATE — derive the GL from the live owner ledger (pure) and
  // confirm AR == owner-ledger Σ amount, invariants clean. If not, do NOT post.
  const ledger = await loadOwnerLedger(associationId);
  const report = reconcileFromOwnerLedger(ledger);
  if (!report.ok) {
    return {
      posted: false,
      reason: "reconcile-failed",
      detail:
        `owner=${report.ownerLedgerBalanceCents}c gl_ar=${report.glAccountsReceivableCents}c ` +
        `diff=${report.differenceCents}c invariants=[${report.invariantViolations.join("; ")}]`,
    };
  }

  // Gate passed → post (force: the gates above already decided enablement).
  const result = await syncAssociationGl(associationId, { force: true });
  return { posted: true, result };
}

/**
 * BEST-EFFORT live trigger. Call this AFTER a confirmed-payment owner-ledger row
 * is committed. It can NEVER break the caller: all errors are caught + logged.
 * Returns the outcome for observability/tests; callers on the money path should
 * ignore the return (fire-and-forget is also safe, but awaiting keeps ordering
 * deterministic and lets the GL settle before the response is sent).
 */
export async function maybeSyncAssociationGl(
  associationId: string,
  context?: string,
): Promise<GlSyncOutcome> {
  try {
    const outcome = await syncAssociationGlGated(associationId);
    if (outcome.posted && outcome.result.legsInserted > 0) {
      console.log(
        `[gl] synced association=${associationId}${context ? ` (${context})` : ""}: ` +
          `+${outcome.result.legsInserted} legs (${outcome.result.journalsConsidered} journals)`,
      );
    }
    if (outcome.posted) {
      await resolveGlProjectionFailure(associationId).catch((alertError: unknown) => {
        console.error(
          `[gl] could not resolve projection alert for association=${associationId}: ` +
            `${alertError instanceof Error ? alertError.message : String(alertError)}`,
        );
      });
    } else if (outcome.reason === "reconcile-failed") {
      // A reconcile miss is a data-quality signal worth a warning (never fatal).
      console.warn(
        `[gl] reconcile gate blocked GL sync for association=${associationId}` +
          `${context ? ` (${context})` : ""}: ${outcome.detail}`,
      );
      await recordGlProjectionFailure(associationId, "reconcile-failed").catch(
        (alertError: unknown) => {
          console.error(
            `[gl] could not persist projection alert for association=${associationId}: ` +
              `${alertError instanceof Error ? alertError.message : String(alertError)}`,
          );
        },
      );
    }
    return outcome;
  } catch (err: any) {
    // NON-FATAL: the owner ledger already recorded the money. Log and move on.
    console.error(
      `[gl] non-fatal GL sync error for association=${associationId}` +
        `${context ? ` (${context})` : ""}: ${err?.message ?? err}`,
    );
    await recordGlProjectionFailure(associationId, "error").catch(
      (alertError: unknown) => {
        console.error(
          `[gl] could not persist projection alert for association=${associationId}: ` +
            `${alertError instanceof Error ? alertError.message : String(alertError)}`,
        );
      },
    );
    return { posted: false, reason: "error", detail: err?.message ?? String(err) };
  }
}
