/**
 * The ONE canonical writer for every "payment"-credit `owner_ledger_entries`
 * row (A-WEBHOOK-001 / A-WEBHOOK-002, founder-os#10737).
 *
 * WHY THIS EXISTS: three independent code paths each write a NEGATIVE
 * `owner_ledger_entries` "payment" row when a Stripe charge succeeds, each
 * with its OWN idempotency namespace:
 *   1. `storage.processPaymentWebhookEvent` — referenceType='payment-webhook'
 *      (per-HOA `/api/webhooks/payments`), historically deduped only on the
 *      Stripe EVENT id.
 *   2. the autopay ledger write (routes.ts webhook block + routes/autopay.ts
 *      synchronous charge) — referenceType='autopay_payment_transaction',
 *      deduped on the internal paymentTransactions row id.
 *   3. `writeLedgerEntryForCharge` (platform Connect `charge.succeeded` /
 *      `payout.paid`) — referenceType='stripe_charge', deduped on the Stripe
 *      charge id.
 *
 * A single successful payment can surface through MORE THAN ONE of these
 * (e.g. `checkout.session.completed` AND `payment_intent.succeeded` are
 * distinct Stripe event ids for the SAME payment_intent; the per-HOA webhook
 * and the platform Connect webhook can both fire for the SAME charge) — each
 * dedup check above passes independently, so the SAME money gets credited
 * twice (or three times).
 *
 * THE FIX: every write path resolves the underlying Stripe `payment_intent`
 * id (the one identity every one of those events carries in common) and
 * posts through `postPaymentLedgerEntry` here, which enforces uniqueness on
 * `(associationId, entryType, paymentIdentityKey)` via the partial unique
 * index `owner_ledger_entries_payment_identity_uq` (shared/schema.ts) using
 * `INSERT ... ON CONFLICT DO NOTHING` — a DB-level constraint, not a
 * check-then-insert race (A-WEBHOOK-002). Whichever event/endpoint arrives
 * FIRST posts the row; every later arrival for the SAME payment_intent is a
 * safe, idempotent no-op that still returns the original entry.
 *
 * Each caller keeps its OWN logic for resolving associationId/unitId/
 * personId/amount/description (those legitimately differ per path and are
 * unchanged here) — this module only unifies the IDENTITY KEY + the INSERT
 * mechanism, which is the minimum surface needed to close A-WEBHOOK-001/002
 * without touching how any individual path computes what it charges.
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { ownerLedgerEntries, type OwnerLedgerEntry } from "@shared/schema";
import { log } from "../logger";

const AUDIT_SOURCE = "ledger-payment-identity";

export interface PostPaymentLedgerEntryInput {
  associationId: string;
  unitId: string;
  personId: string;
  /** Signed dollar amount — caller computes this exactly as before (negative for a payment credit). */
  amount: number;
  postedAt?: Date;
  description?: string | null;
  /** Kept for reporting/back-compat — unchanged per-path label ('payment-webhook' | 'autopay_payment_transaction' | 'stripe_charge'). */
  referenceType: string;
  /** Kept for reporting/back-compat — unchanged per-path identifier (webhook-event row id / transaction id / charge id). */
  referenceId: string;
  /**
   * THE canonical cross-path idempotency key — normally the Stripe
   * payment_intent id. Pass `null` only when the caller genuinely has no way
   * to resolve one (a legacy/non-Stripe caller); in that case this function
   * falls back to the EXACT pre-existing (referenceType, referenceId)
   * check-then-insert behavior for that single write, adding no new
   * cross-path protection but also no regression.
   */
  paymentIdentityKey: string | null;
  /** Audit-log label — which caller/event triggered this write. */
  source: string;
}

export interface PostPaymentLedgerEntryResult {
  created: boolean;
  entry: OwnerLedgerEntry | null;
}

function normalizeKey(key: string | null | undefined): string | null {
  const trimmed = key?.trim();
  return trimmed ? trimmed : null;
}

export async function postPaymentLedgerEntry(
  input: PostPaymentLedgerEntryInput,
): Promise<PostPaymentLedgerEntryResult> {
  const key = normalizeKey(input.paymentIdentityKey);
  const logRef = `${input.referenceType}:${input.referenceId}`;

  if (key) {
    // The canonical, DB-enforced path (A-WEBHOOK-001/002 fix). A concurrent
    // duplicate delivery, OR a totally different event/endpoint that resolves
    // to the SAME payment_intent, races against the SAME unique index — only
    // one insert can ever win.
    const [inserted] = await db
      .insert(ownerLedgerEntries)
      .values({
        associationId: input.associationId,
        unitId: input.unitId,
        personId: input.personId,
        entryType: "payment",
        amount: input.amount,
        postedAt: input.postedAt ?? new Date(),
        description: input.description?.trim() || null,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        paymentIdentityKey: key,
      })
      .onConflictDoNothing({
        target: [
          ownerLedgerEntries.associationId,
          ownerLedgerEntries.entryType,
          ownerLedgerEntries.paymentIdentityKey,
        ],
        where: sql`${ownerLedgerEntries.paymentIdentityKey} is not null`,
      })
      .returning();

    if (inserted) {
      log(
        `[${input.source}] wrote ledger entry id=${inserted.id} identity=${key} ref=${logRef} amount=${input.amount}`,
        AUDIT_SOURCE,
      );
      return { created: true, entry: inserted };
    }

    // Conflict — some other event/endpoint already posted this payment_intent.
    // Look up the existing row so the caller can still link/report against it
    // (e.g. paymentWebhookEvents.ownerLedgerEntryId, autopay's ledgerEntryId).
    const [existing] = await db
      .select()
      .from(ownerLedgerEntries)
      .where(
        and(
          eq(ownerLedgerEntries.associationId, input.associationId),
          eq(ownerLedgerEntries.entryType, "payment"),
          eq(ownerLedgerEntries.paymentIdentityKey, key),
        ),
      )
      .limit(1);
    log(
      `[${input.source}] skip ledger write — payment identity already recorded identity=${key} existing=${existing?.id ?? "unknown"} attempted-ref=${logRef}`,
      AUDIT_SOURCE,
    );
    return { created: false, entry: existing ?? null };
  }

  // No canonical payment identity available. Fall back to the EXACT
  // pre-existing per-path check on (referenceType, referenceId) — preserves
  // prior behavior for callers that cannot supply the cross-path key.
  const [existing] = await db
    .select()
    .from(ownerLedgerEntries)
    .where(
      and(
        eq(ownerLedgerEntries.referenceType, input.referenceType),
        eq(ownerLedgerEntries.referenceId, input.referenceId),
      ),
    )
    .limit(1);
  if (existing) {
    log(`[${input.source}] skip ledger write — reference already exists ref=${logRef} id=${existing.id}`, AUDIT_SOURCE);
    return { created: false, entry: existing };
  }

  const [inserted] = await db
    .insert(ownerLedgerEntries)
    .values({
      associationId: input.associationId,
      unitId: input.unitId,
      personId: input.personId,
      entryType: "payment",
      amount: input.amount,
      postedAt: input.postedAt ?? new Date(),
      description: input.description?.trim() || null,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      paymentIdentityKey: null,
    })
    .returning();
  log(`[${input.source}] wrote ledger entry id=${inserted.id} (no payment identity key) ref=${logRef} amount=${input.amount}`, AUDIT_SOURCE);
  return { created: true, entry: inserted };
}
