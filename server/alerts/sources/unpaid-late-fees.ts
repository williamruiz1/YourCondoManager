/**
 * 4.1 Tier 2 resolver — unpaid late fees (4.1 Q1 Tier 2).
 *
 * Spec wording: "Late fee events with no matching payment within 30
 * days of `createdAt`."
 *
 * YCM has no direct foreign-key link from `late_fee_events` to a payment
 * record. The payment tracking surface we DO have is the owner ledger —
 * `ownerLedgerEntries` exposes `entryType = 'payment'` rows per
 * association. For each late fee event we therefore check: was there
 * any owner-ledger payment entry for this association whose posting
 * date is within 30 days AFTER the fee's `createdAt` AND whose absolute
 * amount is >= the calculated fee? If not, the fee is considered unpaid
 * and the resolver emits an alert.
 *
 * Resolver assigns:
 *   zone          = "financials"
 *   featureDomain = "financials.delinquency"
 *   ruleType      = "unpaid-late-fee"
 *   recordType    = "late_fee_events"
 *   recordId      = event.id
 *
 * `alertId` therefore is `unpaid-late-fee:late_fee_events:<id>`.
 *
 * Severity (task heuristics):
 *   critical — event `createdAt` > 30 days old AND still unpaid
 *   high     — not used
 *   medium   — event still inside the 30-day matching window (i.e. we
 *              already know no payment has landed yet, but it has not
 *              yet crossed the critical threshold)
 *
 * Wave 16b (5.4-F1): `resolveMany` runs ONE storage call each for
 * late-fee events and ledger entries (no associationId filter), then
 * groups payments per association in JS. The single-association
 * `resolve()` wrapper preserves the original signature so existing
 * per-source tests still pass.
 */

import { storage } from "../../storage";
import type { AlertItem, AlertSeverity } from "../types";
import { FEATURE_DOMAINS } from "../types";

const PAYMENT_MATCH_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const CENT_EPSILON = 0.005;

export interface AssociationContext {
  id: string;
  name: string;
}

export interface ResolveContext {
  associationName: string;
  now?: Date;
}

export interface ResolveManyContext {
  now?: Date;
}

export async function resolveMany(
  associations: AssociationContext[],
  context: ResolveManyContext = {},
): Promise<AlertItem[]> {
  if (associations.length === 0) return [];
  const now = context.now ?? new Date();
  const nameById = new Map(associations.map((a) => [a.id, a.name]));

  const isSingleAssoc = associations.length === 1;
  const [allEvents, allLedgerEntries] = await Promise.all([
    isSingleAssoc
      ? storage.getLateFeeEvents(associations[0].id)
      : storage.getLateFeeEvents(),
    isSingleAssoc
      ? storage.getOwnerLedgerEntries(associations[0].id)
      : storage.getOwnerLedgerEntries(),
  ]);

  // Pre-filter payments per association once.
  const paymentsByAssoc = new Map<string, Array<{ postedAt: Date; amount: number }>>();
  for (const e of allLedgerEntries) {
    if (e.entryType !== "payment") continue;
    if (!nameById.has(e.associationId)) continue;
    const list = paymentsByAssoc.get(e.associationId) ?? [];
    list.push({ postedAt: new Date(e.postedAt), amount: Math.abs(e.amount ?? 0) });
    paymentsByAssoc.set(e.associationId, list);
  }
  // Single-assoc legacy mock: ledger rows may not be tagged with
  // associationId (older fixtures); the existing test fixture DOES set
  // `associationId: "assoc-1"` on every entry, so the per-assoc grouping
  // matches. As a defensive fallback, when there is exactly one
  // permitted association and no payments grouped under it, fall back to
  // treating ALL payment entries as belonging to that single association
  // (preserves existing test semantics where `associationId` was
  // assumed implicit).
  if (isSingleAssoc && !paymentsByAssoc.has(associations[0].id)) {
    const fallback = allLedgerEntries
      .filter((e) => e.entryType === "payment")
      .map((e) => ({ postedAt: new Date(e.postedAt), amount: Math.abs(e.amount ?? 0) }));
    paymentsByAssoc.set(associations[0].id, fallback);
  }

  const alerts: AlertItem[] = [];
  for (const event of allEvents) {
    if (!nameById.has(event.associationId)) continue;
    if (!event.createdAt) continue;
    if (!Number.isFinite(event.calculatedFee) || event.calculatedFee <= 0) continue;
    const createdAt = new Date(event.createdAt);
    const windowEnd = new Date(createdAt.getTime() + PAYMENT_MATCH_WINDOW_DAYS * MS_PER_DAY);
    const payments = paymentsByAssoc.get(event.associationId) ?? [];
    const matched = payments.some((p) => {
      if (p.postedAt < createdAt || p.postedAt > windowEnd) return false;
      return p.amount + CENT_EPSILON >= event.calculatedFee;
    });
    if (matched) continue;

    const daysOld = Math.floor((now.getTime() - createdAt.getTime()) / MS_PER_DAY);
    const severity: AlertSeverity =
      daysOld > PAYMENT_MATCH_WINDOW_DAYS ? "critical" : "medium";

    alerts.push({
      alertId: `unpaid-late-fee:late_fee_events:${event.id}`,
      associationId: event.associationId,
      associationName: nameById.get(event.associationId) ?? "",
      zone: "financials",
      featureDomain: FEATURE_DOMAINS.FINANCIALS_DELINQUENCY,
      ruleType: "unpaid-late-fee",
      recordType: "late_fee_events",
      recordId: event.id,
      severity,
      title: `Unpaid late fee: $${event.calculatedFee.toFixed(2)}`,
      description: `Assessed ${createdAt.toISOString().slice(0, 10)} (${daysOld} day${daysOld === 1 ? "" : "s"} ago) — no matching payment recorded.`,
      createdAt,
      resolutionHref: `/app/financials/late-fees/${event.id}`,
      sourceRecord: event,
    });
  }

  return alerts;
}

export async function resolve(
  associationId: string,
  context: ResolveContext,
): Promise<AlertItem[]> {
  return resolveMany([{ id: associationId, name: context.associationName }], { now: context.now });
}
