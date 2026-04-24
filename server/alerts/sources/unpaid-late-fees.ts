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
 */

import { storage } from "../../storage";
import type { AlertItem, AlertSeverity } from "../types";
import { FEATURE_DOMAINS } from "../types";

const PAYMENT_MATCH_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const CENT_EPSILON = 0.005;

export async function resolve(
  associationId: string,
  context: { associationName: string; now?: Date },
): Promise<AlertItem[]> {
  const now = context.now ?? new Date();

  const [events, ledgerEntries] = await Promise.all([
    storage.getLateFeeEvents(associationId),
    storage.getOwnerLedgerEntries(associationId),
  ]);

  // Pre-filter payments once — keeps the per-event match O(events × payments).
  const payments = ledgerEntries
    .filter((e) => e.entryType === "payment")
    .map((e) => ({
      postedAt: new Date(e.postedAt),
      amount: Math.abs(e.amount ?? 0),
    }));

  return events
    .filter((event) => {
      if (!event.createdAt) return false;
      if (!Number.isFinite(event.calculatedFee) || event.calculatedFee <= 0) return false;
      const createdAt = new Date(event.createdAt);
      const windowEnd = new Date(createdAt.getTime() + PAYMENT_MATCH_WINDOW_DAYS * MS_PER_DAY);
      const matched = payments.some((p) => {
        if (p.postedAt < createdAt || p.postedAt > windowEnd) return false;
        return p.amount + CENT_EPSILON >= event.calculatedFee;
      });
      return !matched;
    })
    .map((event): AlertItem => {
      const createdAt = new Date(event.createdAt);
      const daysOld = Math.floor((now.getTime() - createdAt.getTime()) / MS_PER_DAY);
      const severity: AlertSeverity = daysOld > PAYMENT_MATCH_WINDOW_DAYS ? "critical" : "medium";
      return {
        alertId: `unpaid-late-fee:late_fee_events:${event.id}`,
        associationId,
        associationName: context.associationName,
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
      };
    });
}
