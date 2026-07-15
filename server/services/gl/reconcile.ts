/**
 * Reconcile-to-the-cent core (YCM Financial Core — Phase 1, ACCEPTANCE GATE).
 *
 * Audit anchor:  audits/AUDIT-financial-reporting-orchestration.md Gap F1 / F5+.
 * Hardening:     audits/BLINDSPOT-pass-2026-06-20.md F4 (the reconcile gate that
 *                must pass BEFORE the GL could ever become source-of-truth).
 *
 * PURE — no DB. Given the existing owner-ledger entries (the system of record),
 * it (a) computes the owner-ledger balance the live product already reports
 * (Σ amount, exactly as server/storage.ts getOwnerLedgerSummary does), and (b)
 * derives the parallel GL's Accounts-Receivable balance from the same source
 * facts, then asserts they match TO THE CENT.
 *
 * This is the gate from BLINDSPOT F4: "the GL must reproduce CHC's existing
 * reconciled balances to the cent before it's allowed to become the source of
 * truth." The flip itself stays out of scope — this only PROVES equivalence.
 */

import {
  postOwnerLedgerEntries,
  deriveAccountBalances,
  accountsReceivableCents,
  validateInvariants,
  type OwnerLedgerEntryLike,
  type JournalEntry,
} from "./posting";

export interface ReconcileReport {
  ok: boolean;
  /** Owner-ledger balance the live product reports today, in cents (Σ amount). */
  ownerLedgerBalanceCents: number;
  /** Accounts Receivable balance derived from the parallel GL, in cents. */
  glAccountsReceivableCents: number;
  /** ownerLedgerBalanceCents − glAccountsReceivableCents. MUST be 0 to pass. */
  differenceCents: number;
  /** Per-fund operating/reserve net (signed cents) from the GL, for the brief. */
  fundBalancesCents: Record<string, number>;
  /** Double-entry / interfund invariant violations (empty when clean). */
  invariantViolations: string[];
  entryCount: number;
}

/**
 * Compute the owner-ledger balance EXACTLY as the live product does
 * (server/storage.ts getOwnerLedgerSummary: balance += entry.amountCents). Both sides
 * are integer cents now (migration 0068), so the comparison with the GL is exact and
 * needs no toCents() conversion.
 */
export function ownerLedgerBalanceCents(entries: OwnerLedgerEntryLike[]): number {
  return entries.reduce((sum, e) => sum + e.amountCents, 0);
}

/** Per-fund signed net (operating/reserve) of the equity-relevant balances,
 *  reported for the brief. Sums every account balance grouped by fund. */
export function fundNetByFund(journals: JournalEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of deriveAccountBalances(journals)) {
    out[b.fund] = (out[b.fund] ?? 0) + b.balanceCents;
  }
  return out;
}

/**
 * Run the full reconcile from a set of owner-ledger entries. Builds the GL,
 * validates invariants, derives AR, and compares to the live owner-ledger
 * balance. `ok` is true ONLY when invariants are clean AND the difference is
 * exactly zero cents.
 */
export function reconcileFromOwnerLedger(entries: OwnerLedgerEntryLike[]): ReconcileReport {
  const journals = postOwnerLedgerEntries(entries);
  const invariantViolations = validateInvariants(journals).map((v) => `[${v.invariant}] ${v.detail}`);

  const ownerBalance = ownerLedgerBalanceCents(entries);
  const glAr = accountsReceivableCents(journals);
  const difference = ownerBalance - glAr;

  return {
    ok: invariantViolations.length === 0 && difference === 0,
    ownerLedgerBalanceCents: ownerBalance,
    glAccountsReceivableCents: glAr,
    differenceCents: difference,
    fundBalancesCents: fundNetByFund(journals),
    invariantViolations,
    entryCount: entries.length,
  };
}
