/**
 * Fund-aware double-entry GL posting core (YCM Financial Core — Phase 1).
 *
 * Audit anchor:  audits/AUDIT-financial-reporting-orchestration.md Gap F1.
 * Build anchor:  audits/YCM-financial-build-plan-2026-06-20.md Phase 1.
 * Hardening:     audits/BLINDSPOT-pass-2026-06-20.md F4 (forward-only / parallel).
 *
 * THIS FILE IS PURE — no DB, no I/O, no Date.now(). It turns a source financial
 * fact (an owner_ledger_entry today; vendor_invoice / bank_transaction /
 * amenity_reservation later) into a BALANCED set of double-entry legs, and
 * derives fund/account balances from those legs. Being pure makes the
 * double-entry invariants (Σdebit == Σcredit, interfund nets to zero) testable
 * without a database, and keeps the live money path untouched.
 *
 * FORWARD-ONLY / PARALLEL: the owner ledger stays the system of record. The GL
 * is DERIVED from it; it is NOT authoritative. The reconcile-to-cent gate
 * (script/verify-gl-reconcile.ts) must pass before any flip to source-of-truth —
 * which is intentionally out of this phase's scope.
 *
 * MONEY IS INTEGER CENTS everywhere in here. Floats are converted to cents at
 * the boundary (`toCents`) with banker-free rounding, so the balance invariant
 * is exact and cannot float-drift.
 */

import type { GlFund, GlSide, GlAccountType } from "@shared/schema";

// ──────────────────────────────────────────────────────────────────────────────
// Canonical chart of accounts (per-association seed).
//
// Codes follow the CINC/CAMS-class convention the Paddlers Cove benchmark uses.
// Phase 1 needs only the handful that the owner-ledger (dues) subledger touches;
// the full 40+ expense accounts arrive when vendor_invoices are wired (later).
// ──────────────────────────────────────────────────────────────────────────────

export interface GlAccountDef {
  code: string;
  name: string;
  accountType: GlAccountType;
  fund: GlFund;
  /** 'debit' for asset/expense, 'credit' for liability/equity/income. */
  normalBalance: GlSide;
}

/** Derive the normal balance side from the account type. The single source of
 *  truth for the asset/expense=debit, liability/equity/income=credit rule. */
export function normalBalanceFor(accountType: GlAccountType): GlSide {
  return accountType === "asset" || accountType === "expense" ? "debit" : "credit";
}

function acct(code: string, name: string, accountType: GlAccountType, fund: GlFund): GlAccountDef {
  return { code, name, accountType, fund, normalBalance: normalBalanceFor(accountType) };
}

/**
 * The Phase-1 chart. Operating + Reserve fund variants where it matters.
 * `accountCode` is unique per (association, code, fund) — see the schema's
 * `gl_accounts_assoc_code_fund_uq` index — so e.g. "1010" Cash exists once per
 * fund.
 */
export const CHART_OF_ACCOUNTS: readonly GlAccountDef[] = [
  // Assets
  acct("1010", "Operating Cash", "asset", "operating"),
  acct("1010", "Reserve Cash", "asset", "reserve"),
  acct("1200", "Accounts Receivable — Assessments", "asset", "operating"),
  acct("1015", "Interfund Receivable", "asset", "operating"),
  acct("1016", "Interfund Receivable", "asset", "reserve"),
  // Income — DUES vs SPECIAL ASSESSMENTS are SEPARATE income accounts (ratified
  // 2026-06-30). Recurring dues (entryType `charge`/`late-fee`) credit 4000;
  // special assessments (entryType `assessment`) credit the distinct 4200.
  acct("4000", "HOA Dues Income", "income", "operating"),
  acct("4200", "Special Assessment Income", "income", "operating"),
  acct("4010", "Reserve Fund Contributions", "income", "reserve"),
  acct("4445", "Amenity Rental Income", "income", "operating"),
  acct("4900", "Other Income / Adjustments", "income", "operating"),
  // Liabilities
  // A refundable amenity deposit is the association's money to GIVE BACK, so it is
  // a LIABILITY (not income) on the balance sheet from the moment it is held until
  // it is refunded (clears to 0) or forfeited (reclassed to income). (Phase 3 —
  // amenity money loop.)
  acct("2300", "Amenity Deposits Held", "liability", "operating"),
  // Accounts Payable — what the association OWES vendors for invoices it has
  // received/approved but not yet paid. A received (unpaid) vendor invoice credits
  // A/P; paying it later clears A/P against cash. (Expense→GL, ratified 2026-06-30.)
  acct("2000", "Accounts Payable", "liability", "operating"),
  // Expenses — the cost side of the books. A vendor invoice DEBITS one of these
  // (the expense incurred). Default 5000 when the invoice category doesn't map to
  // a more specific account. These are the 5xxx accounts the income statement +
  // budget-vs-actual need to show real HOA costs (Expense→GL, ratified 2026-06-30).
  acct("5000", "General Operating Expense", "expense", "operating"),
  acct("5100", "Management Fees", "expense", "operating"),
  acct("5200", "Insurance", "expense", "operating"),
  acct("5300", "Repairs & Maintenance", "expense", "operating"),
  acct("5400", "Utilities", "expense", "operating"),
  acct("5500", "Landscaping & Grounds", "expense", "operating"),
  // Equity
  acct("3900", "Fund Balance — Operating", "equity", "operating"),
  acct("3910", "Fund Balance — Reserve", "equity", "reserve"),
] as const;

/** The default expense account a vendor invoice posts to when its category does
 *  not map to a more specific 5xxx account. */
export const DEFAULT_EXPENSE_ACCOUNT_CODE = "5000";
/** The Accounts Payable account a received-but-unpaid vendor invoice credits. */
export const ACCOUNTS_PAYABLE_CODE = "2000";

/** Look up a chart account by (code, fund). Throws if undefined — a missing
 *  mapping is a programming error, never a silent skip. */
export function chartAccount(code: string, fund: GlFund): GlAccountDef {
  const found = CHART_OF_ACCOUNTS.find((a) => a.code === code && a.fund === fund);
  if (!found) {
    throw new Error(`GL chart account not found: code=${code} fund=${fund}`);
  }
  return found;
}

// ──────────────────────────────────────────────────────────────────────────────
// Money: floats → integer cents (the boundary).
// ──────────────────────────────────────────────────────────────────────────────

/** Convert a dollar float to integer cents. Rounds to the nearest cent. The
 *  `+ (Number.EPSILON ...)` guard avoids the classic `1.005 → 100` float error. */
export function toCents(dollars: number): number {
  if (!Number.isFinite(dollars)) {
    throw new Error(`toCents: non-finite amount ${dollars}`);
  }
  // Scale, nudge away from binary-float underestimates, round half-up on sign.
  const scaled = dollars * 100;
  return Math.round(scaled + (scaled >= 0 ? Number.EPSILON : -Number.EPSILON) * Math.abs(scaled));
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

// ──────────────────────────────────────────────────────────────────────────────
// The posting model.
// ──────────────────────────────────────────────────────────────────────────────

export type GlSourceType =
  | "owner_ledger_entry"
  | "vendor_invoice"
  | "bank_transaction"
  | "amenity_reservation"
  | "opening_balance";

/** One leg of a balanced journal entry. */
export interface PostingLeg {
  accountCode: string;
  fund: GlFund;
  side: GlSide;
  /** Positive integer cents. The `side` carries direction. */
  amountCents: number;
}

/** A balanced journal entry: ≥2 legs whose debits == credits. */
export interface JournalEntry {
  /** Stable, source-derived id so re-posting is idempotent. */
  journalId: string;
  sourceType: GlSourceType;
  sourceId: string;
  postedAt: Date;
  description: string;
  legs: PostingLeg[];
}

/**
 * The minimal shape of an owner_ledger_entry this mapper needs. Mirrors
 * `OwnerLedgerEntry` (shared/schema.ts) but kept structural so the pure core
 * has no DB dependency.
 *
 * Sign convention (matches the live ledger — verified in admin-payments.ts /
 * autopay.ts / assessment-execution.ts):
 *   - charge / assessment / late-fee : POSITIVE amount (owner now owes more)
 *   - payment / credit               : NEGATIVE amount (owner owes less)
 *   - adjustment                     : either sign
 * Owner balance == Σ amount. Positive == owner owes the association (an asset/AR).
 */
export interface OwnerLedgerEntryLike {
  id: string;
  entryType: "charge" | "assessment" | "payment" | "late-fee" | "credit" | "adjustment";
  /** Dollars (float), as stored in owner_ledger_entries.amount (a `real`). */
  amount: number;
  postedAt: Date;
  description?: string | null;
}

/**
 * Map ONE owner_ledger_entry to a balanced 2-leg journal entry.
 *
 * Phase-1 fund routing: the dues subledger is an OPERATING-fund concern, so all
 * owner-ledger postings land in the operating fund (a missing/unknown type tag
 * degrades to operating + the Other Income account — fail-safe, never throws on
 * an unexpected entryType). Reserve-fund postings arrive when reserve
 * contributions / transfers are modeled (later phase); the schema + balance
 * derivation already carry the fund dimension so that extension is additive.
 *
 * The double-entry model (owner ledger == the Accounts Receivable subledger):
 *
 *   CHARGE / LATE-FEE (amount > 0, owner billed for recurring dues):
 *       DR  1200 Accounts Receivable        (asset ↑)
 *       CR  4000 HOA Dues Income            (income ↑)
 *
 *   ASSESSMENT (amount > 0, owner billed a special assessment):
 *       DR  1200 Accounts Receivable        (asset ↑)
 *       CR  4200 Special Assessment Income  (income ↑ — SEPARATE from dues)
 *
 *   PAYMENT (amount < 0, owner pays):
 *       DR  1010 Operating Cash             (asset ↑)
 *       CR  1200 Accounts Receivable        (asset ↓  — clears what they owed)
 *
 *   CREDIT (amount < 0, owner credited / waiver):
 *       DR  4000 HOA Dues Income            (income ↓ — reverse the dues billing)
 *       CR  1200 Accounts Receivable        (asset ↓)
 *
 * INCOME SPLIT (ratified 2026-06-30): recurring dues and special assessments post
 * to SEPARATE income accounts — dues (`charge`/`late-fee`) → 4000 HOA Dues Income,
 * special assessments (`assessment`) → 4200 Special Assessment Income. Only the
 * INCOME (credit) leg differs by type; the AR (debit) leg is identical, so the AR
 * balance still equals the owner-ledger Σ amount to the cent — the reconcile gate
 * is unchanged. `credit` reverses the dues account (4000) by default.
 *
 *   ADJUSTMENT (+): treated as a billing → DR AR / CR Other Income.
 *   ADJUSTMENT (−): treated as a reduction → DR Other Income / CR AR.
 *
 * RESULT — the 1200 Accounts Receivable balance derived from these legs equals
 * the owner-ledger Σ amount to the cent. That equality is the reconcile gate.
 */
export function postOwnerLedgerEntry(entry: OwnerLedgerEntryLike): JournalEntry {
  const fund: GlFund = "operating";
  const cents = toCents(entry.amount);
  const magnitude = Math.abs(cents);
  const description = entry.description ?? `${entry.entryType} ${centsToDollars(cents).toFixed(2)}`;

  const base = {
    journalId: `oln-${entry.id}`,
    sourceType: "owner_ledger_entry" as const,
    sourceId: entry.id,
    postedAt: entry.postedAt,
    description,
  };

  // Zero-amount entries produce no postings (a balanced no-op).
  if (magnitude === 0) {
    return { ...base, legs: [] };
  }

  let legs: PostingLeg[];

  switch (entry.entryType) {
    case "charge":
    case "late-fee": {
      // Recurring-dues billing: DR Accounts Receivable, CR HOA Dues Income (4000).
      legs = [
        { accountCode: "1200", fund, side: "debit", amountCents: magnitude },
        { accountCode: "4000", fund, side: "credit", amountCents: magnitude },
      ];
      break;
    }
    case "assessment": {
      // Special-assessment billing: DR Accounts Receivable, CR Special Assessment
      // Income (4200) — a SEPARATE income account from recurring dues (ratified
      // 2026-06-30). AR leg is identical to a dues charge, so reconcile is unchanged.
      legs = [
        { accountCode: "1200", fund, side: "debit", amountCents: magnitude },
        { accountCode: "4200", fund, side: "credit", amountCents: magnitude },
      ];
      break;
    }
    case "payment": {
      // Cash in, AR down: DR Operating Cash, CR Accounts Receivable.
      legs = [
        { accountCode: "1010", fund, side: "debit", amountCents: magnitude },
        { accountCode: "1200", fund, side: "credit", amountCents: magnitude },
      ];
      break;
    }
    case "credit": {
      // Waiver/credit reverses billing: DR Income, CR Accounts Receivable.
      legs = [
        { accountCode: "4000", fund, side: "debit", amountCents: magnitude },
        { accountCode: "1200", fund, side: "credit", amountCents: magnitude },
      ];
      break;
    }
    case "adjustment":
    default: {
      // Adjustment (and any unexpected type — fail-safe): route to AR vs Other
      // Income by the sign so the AR balance still tracks Σ amount exactly.
      if (cents > 0) {
        // Owner owes more.
        legs = [
          { accountCode: "1200", fund, side: "debit", amountCents: magnitude },
          { accountCode: "4900", fund, side: "credit", amountCents: magnitude },
        ];
      } else {
        // Owner owes less.
        legs = [
          { accountCode: "4900", fund, side: "debit", amountCents: magnitude },
          { accountCode: "1200", fund, side: "credit", amountCents: magnitude },
        ];
      }
      break;
    }
  }

  return { ...base, legs };
}

/** Map a batch of owner-ledger entries to journal entries, dropping balanced
 *  no-ops (zero-amount entries). */
export function postOwnerLedgerEntries(entries: OwnerLedgerEntryLike[]): JournalEntry[] {
  return entries.map(postOwnerLedgerEntry).filter((j) => j.legs.length > 0);
}

// ──────────────────────────────────────────────────────────────────────────────
// Vendor invoices → GL (the EXPENSE side of the books — ratified 2026-06-30, the
// #1 financial-completeness gap). A vendor invoice is the cost the association
// incurs. Recording/paying one posts a balanced double-entry journal so the GL
// finally carries expenses (and A/P) — without which the income statement shows
// income with no costs.
//
//   RECEIVED / APPROVED (a bill OWED but not yet paid):
//       DR  5xxx Expense              (expense ↑ — the cost is incurred now)
//       CR  2000 Accounts Payable     (liability ↑ — we owe the vendor)
//
//   PAID (the money has left the bank):
//       DR  5xxx Expense              (expense ↑)
//       CR  1010 Operating Cash       (asset ↓ — cash out)
//
//   DRAFT / VOID: no posting (not a real, committed cost yet — fail-safe no-op).
//
// FORWARD-ONLY / PARALLEL: like the dues path, this DERIVES legs from the
// vendor_invoices system-of-record list; it never mutates it. The expense leg
// makes glTotalExpenseCents (and the balance-sheet expense→equity roll-up) real.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The minimal shape of a vendor_invoice this mapper needs. Mirrors `VendorInvoice`
 * (shared/schema.ts) but kept structural so the pure core has no DB dependency.
 *
 *   - `amount` is a positive dollar figure (a bill the association owes). A
 *     non-positive amount is treated as a balanced no-op (no legs).
 *   - `status` drives the credit side: 'paid' → cash; 'received'/'approved' →
 *     Accounts Payable; 'draft'/'void' → no posting.
 *   - `expenseAccountCode` lets the caller route to a specific 5xxx account
 *     (resolved from the invoice's category/notes upstream); when absent it
 *     defaults to 5000 General Operating Expense.
 */
export interface VendorInvoiceLike {
  id: string;
  /** Dollars (float), as stored in vendor_invoices.amount (a `real`). Positive. */
  amount: number;
  /** draft | received | approved | paid | void (invoice_status enum). */
  status: "draft" | "received" | "approved" | "paid" | "void";
  postedAt: Date;
  description?: string | null;
  /** A specific 5xxx expense account code; defaults to 5000 when undefined. */
  expenseAccountCode?: string | null;
}

/** Vendor invoices are operating-fund spend in this phase. */
const VENDOR_INVOICE_FUND: GlFund = "operating";

/**
 * Map a free-text expense CATEGORY name (from a vendor invoice's
 * financial_category, or its vendor name as a fallback) to a 5xxx expense account
 * code. Keyword-matched, conservative, and DEFAULTS to 5000 General Operating
 * Expense for anything unrecognized — so an un-mapped category is never dropped,
 * just bucketed honestly into general expense. Pure + deterministic.
 */
export function expenseAccountCodeForCategory(categoryName?: string | null): string {
  const name = (categoryName ?? "").toLowerCase();
  if (!name) return DEFAULT_EXPENSE_ACCOUNT_CODE;
  // Stem-prefix matches (a leading word boundary, then the stem can run into its
  // suffix — "manage"→"management", "landscap"→"landscaping", "mainten"→
  // "maintenance"). NOT a trailing \b, which would reject those suffixes.
  if (/\b(manage|mgmt|property manager)|\bhoa fee/.test(name)) return "5100";
  if (/\b(insurance|liability|umbrella)|\bd&o/.test(name)) return "5200";
  // Utilities BEFORE repairs so "electricity"/"electric utility" routes to 5400,
  // not the repairs "electric*" match below.
  if (/\b(util|water|sewer|gas|trash|waste|power|electric)/.test(name)) return "5400";
  if (/\b(repair|mainten|hvac|plumb|roof|elevator|fix)/.test(name)) return "5300";
  if (/\b(landscap|lawn|grounds|garden|tree|snow|irrigation)/.test(name)) return "5500";
  return DEFAULT_EXPENSE_ACCOUNT_CODE;
}

/** Resolve the expense account a vendor invoice debits — the caller-supplied
 *  5xxx code if it's a real expense account in the chart, else the default
 *  5000 General Operating Expense (fail-safe — an unknown code never crashes). */
export function resolveExpenseAccountCode(code?: string | null): string {
  if (code) {
    const def = CHART_OF_ACCOUNTS.find(
      (a) => a.code === code && a.fund === VENDOR_INVOICE_FUND && a.accountType === "expense",
    );
    if (def) return def.code;
  }
  return DEFAULT_EXPENSE_ACCOUNT_CODE;
}

/**
 * Map ONE vendor_invoice to a balanced 2-leg journal entry (the expense side).
 * A draft/void invoice — or a non-positive amount — produces a balanced no-op
 * (no legs) so the caller can post a whole list and let posted bills through.
 */
export function postVendorInvoice(invoice: VendorInvoiceLike): JournalEntry {
  const fund = VENDOR_INVOICE_FUND;
  const cents = toCents(invoice.amount);
  const magnitude = Math.abs(cents);
  const expenseCode = resolveExpenseAccountCode(invoice.expenseAccountCode);
  const description =
    invoice.description ?? `vendor invoice ${centsToDollars(magnitude).toFixed(2)}`;

  const base = {
    journalId: `vi-${invoice.id}`,
    sourceType: "vendor_invoice" as const,
    sourceId: invoice.id,
    postedAt: invoice.postedAt,
    description,
  };

  // Draft/void bills and zero/negative amounts are not committed costs → no legs.
  if (invoice.status === "draft" || invoice.status === "void" || magnitude === 0) {
    return { ...base, legs: [] };
  }

  // The credit side depends on whether the bill has been PAID (cash out) or is
  // still OWED (Accounts Payable). The expense (debit) leg is the same either way.
  const creditCode = invoice.status === "paid" ? "1010" : ACCOUNTS_PAYABLE_CODE;

  const legs: PostingLeg[] = [
    { accountCode: expenseCode, fund, side: "debit", amountCents: magnitude },
    { accountCode: creditCode, fund, side: "credit", amountCents: magnitude },
  ];

  return { ...base, legs };
}

/** Map a batch of vendor invoices to journal entries, dropping balanced no-ops
 *  (draft/void/zero invoices). */
export function postVendorInvoices(invoices: VendorInvoiceLike[]): JournalEntry[] {
  return invoices.map(postVendorInvoice).filter((j) => j.legs.length > 0);
}

// ──────────────────────────────────────────────────────────────────────────────
// Invariants — the hard checks. Every one is a pure predicate so tests + the
// reconcile script + the runtime posting service can all call the same gate.
// ──────────────────────────────────────────────────────────────────────────────

export interface InvariantViolation {
  invariant: "balanced" | "interfund" | "non_negative_legs";
  detail: string;
  journalId?: string;
}

/** A single journal entry is balanced when Σdebit cents == Σcredit cents. */
export function isJournalBalanced(journal: JournalEntry): boolean {
  let debit = 0;
  let credit = 0;
  for (const leg of journal.legs) {
    if (leg.side === "debit") debit += leg.amountCents;
    else credit += leg.amountCents;
  }
  return debit === credit;
}

/** Sum of a side across many journals (helper for the corpus check). */
function sumSide(journals: JournalEntry[], side: GlSide): number {
  let total = 0;
  for (const j of journals) for (const leg of j.legs) if (leg.side === side) total += leg.amountCents;
  return total;
}

/**
 * Validate the full invariant set over a corpus of journal entries:
 *   1. every leg amount is a positive integer (cents)        → non_negative_legs
 *   2. every journal individually balances (DR == CR)        → balanced
 *   3. the whole corpus balances (ΣDR == ΣCR)                → balanced
 *   4. each fund's interfund leg nets to zero                → interfund
 *      (interfund accounts are 1015/1016; with no interfund postings in Phase 1
 *       this is trivially satisfied, but the check is wired so the moment
 *       interfund transfers are added an unbalanced one is caught.)
 * Returns an empty array when all invariants hold.
 */
export function validateInvariants(journals: JournalEntry[]): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  for (const j of journals) {
    for (const leg of j.legs) {
      if (!Number.isInteger(leg.amountCents) || leg.amountCents <= 0) {
        violations.push({
          invariant: "non_negative_legs",
          detail: `leg amount must be a positive integer (cents), got ${leg.amountCents}`,
          journalId: j.journalId,
        });
      }
    }
    if (!isJournalBalanced(j)) {
      violations.push({
        invariant: "balanced",
        detail: `journal ${j.journalId} does not balance (DR != CR)`,
        journalId: j.journalId,
      });
    }
  }

  const totalDebit = sumSide(journals, "debit");
  const totalCredit = sumSide(journals, "credit");
  if (totalDebit !== totalCredit) {
    violations.push({
      invariant: "balanced",
      detail: `corpus does not balance: ΣDR=${totalDebit} != ΣCR=${totalCredit}`,
    });
  }

  // Interfund: per fund, the interfund receivable accounts (1015 operating /
  // 1016 reserve) must net to zero across the corpus.
  const interfundNet = interfundNetByFund(journals);
  for (const [fund, net] of Object.entries(interfundNet)) {
    if (net !== 0) {
      violations.push({
        invariant: "interfund",
        detail: `interfund for fund=${fund} does not net to zero (net=${net} cents)`,
      });
    }
  }

  return violations;
}

const INTERFUND_CODES = new Set(["1015", "1016"]);

/** Signed net (debit − credit) of the interfund accounts, per fund, in cents.
 *  Each fund's interfund must net to zero (you can't owe yourself). */
export function interfundNetByFund(journals: JournalEntry[]): Record<string, number> {
  const net: Record<string, number> = {};
  for (const j of journals) {
    for (const leg of j.legs) {
      if (!INTERFUND_CODES.has(leg.accountCode)) continue;
      const signed = leg.side === "debit" ? leg.amountCents : -leg.amountCents;
      net[leg.fund] = (net[leg.fund] ?? 0) + signed;
    }
  }
  return net;
}

// ──────────────────────────────────────────────────────────────────────────────
// Balance derivation — turn the journal corpus into account + fund balances.
// ──────────────────────────────────────────────────────────────────────────────

export interface AccountBalance {
  accountCode: string;
  fund: GlFund;
  /** Signed balance in cents, in the account's natural direction (a debit-
   *  normal account is positive when net-debit; a credit-normal account is
   *  positive when net-credit). */
  balanceCents: number;
}

/**
 * Derive per-(account, fund) balances from journal legs. The signed balance is
 * computed in the account's NORMAL direction: for a debit-normal account
 * (asset/expense) balance = ΣDR − ΣCR; for a credit-normal account
 * (liability/equity/income) balance = ΣCR − ΣDR. This is what makes "Accounts
 * Receivable balance" comparable, to the cent, with the owner-ledger Σ amount.
 */
export function deriveAccountBalances(journals: JournalEntry[]): AccountBalance[] {
  // key: `${code}|${fund}` → { debit, credit }
  const acc = new Map<string, { fund: GlFund; code: string; debit: number; credit: number }>();
  for (const j of journals) {
    for (const leg of j.legs) {
      const key = `${leg.accountCode}|${leg.fund}`;
      const cur = acc.get(key) ?? { fund: leg.fund, code: leg.accountCode, debit: 0, credit: 0 };
      if (leg.side === "debit") cur.debit += leg.amountCents;
      else cur.credit += leg.amountCents;
      acc.set(key, cur);
    }
  }

  const out: AccountBalance[] = [];
  for (const { fund, code, debit, credit } of acc.values()) {
    const def = CHART_OF_ACCOUNTS.find((a) => a.code === code && a.fund === fund);
    const normal = def?.normalBalance ?? "debit";
    const balanceCents = normal === "debit" ? debit - credit : credit - debit;
    out.push({ accountCode: code, fund, balanceCents });
  }
  return out;
}

/** The Accounts Receivable (1200) balance in cents — the number that must
 *  reconcile to the owner-ledger Σ amount. Returns 0 if no AR activity. */
export function accountsReceivableCents(journals: JournalEntry[]): number {
  return deriveAccountBalances(journals)
    .filter((b) => b.accountCode === "1200")
    .reduce((s, b) => s + b.balanceCents, 0);
}
