/**
 * Vendor-expense / accounts-payable GL posting core (YCM Financial Core — Phase 4).
 *
 * Audit anchor:  docs/financial-completeness-and-quickbooks-migration-2026-06-30.md
 *                Gap #1 — "A/P + vendor bills → GL (expense side of the books)"
 *                (THE #1-ranked blocker: without expenses in the GL there is no
 *                real income statement, no A/P on the balance sheet, no full bank
 *                reconciliation — ~95% of a real HOA's GL activity was missing).
 * Build anchor:  founder-os#8171 — Cherry Hill financial core, the expense half of
 *                the fund-aware GL → statements money loop.
 * Hardening:     audits/BLINDSPOT-pass-2026-06-20.md F4 (forward-only / parallel).
 *
 * THIS FILE IS PURE — no DB, no I/O, no Date.now(). It turns one vendor_invoice's
 * STATE (amount + status + expense category) into a set of BALANCED double-entry
 * legs that post to the SAME fund-aware GL as the dues + amenity subledgers.
 * Being pure makes the double-entry invariants (Σdebit == Σcredit, A/P nets to
 * zero once paid) testable without a database, and keeps the live A/P path
 * untouched.
 *
 * FORWARD-ONLY / PARALLEL (per BLINDSPOT F4): the vendor_invoices row is the
 * source fact; the GL is DERIVED from it and is NOT authoritative. These postings
 * are gated by GL_ENABLED (default OFF) at the service boundary. Nothing in the
 * live vendor-invoice insert/update path is changed.
 *
 * MONEY IS INTEGER CENTS everywhere in here — vendor_invoices.amount is a dollar
 * float, so it is converted to cents at the DB boundary (`toCents`) before it
 * reaches this mapper, so the balance invariant is exact and cannot float-drift.
 *
 * ── The accounting model (accrual A/P) ────────────────────────────────────────
 *
 *   BILL RECORDED (status received / approved / paid — the expense is incurred):
 *       DR  5xxx Expense (by category)      (expense ↑ — the cost hits the books)
 *       CR  2000 Accounts Payable           (LIABILITY ↑ — the association owes it)
 *
 *   BILL PAID (status paid — additionally, the obligation is discharged):
 *       DR  2000 Accounts Payable           (liability ↓ — no longer owed)
 *       CR  1010 Operating Cash             (asset ↓ — cash paid out)
 *
 *   DRAFT / VOID → no postings (not yet — or no longer — a real liability). The
 *   GL is re-derived from the whole corpus on every sync (like dues), so a voided
 *   bill simply produces no legs; nothing to reverse.
 *
 * RESULT — the 2000 Accounts Payable balance (credit-normal) equals Σ of the
 * UNPAID bills (received + approved); a PAID bill credits 2000 (bill) then debits
 * 2000 (payment) and nets to 0¢. The 5xxx expense balance equals Σ of ALL
 * recorded bills (received + approved + paid). 1010 Operating Cash falls by Σ of
 * the PAID bills. These are exactly the figures the income statement, balance
 * sheet (A/P liability), and budget-vs-actual (real actuals) need.
 */

import type { GlFund } from "@shared/schema";
import {
  validateInvariants,
  type JournalEntry,
  type PostingLeg,
} from "./posting";

/** Account codes the vendor money loop touches. Centralised so the chart seed,
 *  the postings, and the tests all reference one source of truth. */
export const VENDOR_GL_CODES = {
  /** 1010 Operating Cash (asset) — credited when a bill is paid. */
  CASH: "1010",
  /** 2000 Accounts Payable (LIABILITY) — the unpaid-bill obligation. */
  ACCOUNTS_PAYABLE: "2000",
  /** 5900 Other Operating Expenses (expense) — the fail-safe fallback account. */
  EXPENSE_FALLBACK: "5900",
} as const;

/**
 * Map an expense category NAME to a chart expense account code. The mapping is
 * deterministic, case-insensitive, and substring-based so it tolerates the
 * free-text category names treasurers actually type ("Landscaping",
 * "Lawn & Grounds", "Pool maintenance"…). Anything unmatched degrades to
 * 5900 Other Operating Expenses — FAIL-SAFE: an unknown category is never
 * dropped, it is bucketed into Other so the expense still hits the GL.
 *
 * The order matters only where two patterns could both match a string; the
 * patterns are chosen to be disjoint in practice. Adding a new mapping is purely
 * additive (new chart account in posting.ts + a row here).
 */
export function expenseAccountForCategory(categoryName?: string | null): string {
  const name = (categoryName ?? "").trim().toLowerCase();
  if (!name) return VENDOR_GL_CODES.EXPENSE_FALLBACK;

  // [pattern fragments] → chart code. First matching row wins, so the SPECIFIC
  // categories are listed before the broad "repairs & maintenance" catch — e.g.
  // "Pool maintenance" must resolve to Pool (5060), not Repairs (5050). The
  // generic repairs/maintenance bucket is therefore LAST among the specific rules.
  const RULES: ReadonlyArray<[readonly string[], string]> = [
    [["management fee", "mgmt fee", "property management"], "5010"],
    [["insurance"], "5020"],
    [["landscap", "lawn", "grounds", "groundskeep"], "5030"],
    [["utilit", "electric", "gas", "water", "sewer"], "5040"],
    [["pool", "amenit", "clubhouse", "gym", "fitness"], "5060"],
    [["clean", "janitor", "housekeep"], "5070"],
    [["trash", "recycl", "waste", "garbage"], "5080"],
    [["pest", "extermin"], "5090"],
    [["snow", "ice", "plow"], "5100"],
    [["legal", "attorney", "law firm"], "5110"],
    [["account", "audit", "bookkeep", "tax prep"], "5120"],
    [["security", "guard", "patrol", "surveillance"], "5130"],
    // Broad catch — keep LAST so a specific category above wins first.
    [["repair", "maintenance", "handyman", "hvac", "plumb", "electrical"], "5050"],
  ];

  for (const [fragments, code] of RULES) {
    if (fragments.some((f) => name.includes(f))) return code;
  }
  return VENDOR_GL_CODES.EXPENSE_FALLBACK;
}

/**
 * The minimal money-state shape this mapper needs from a vendor_invoices row.
 * Kept structural so the pure core has no DB dependency. The amount is INTEGER
 * CENTS (converted from the schema's dollar `real` at the DB boundary via
 * `toCents`). The vendor expense loop is an OPERATING-fund concern in Phase 4.
 */
export interface VendorInvoiceMoneyLike {
  /** vendor_invoices.id — makes the postings idempotent + traceable. */
  id: string;
  /** Invoice amount in INTEGER CENTS (>= 0). */
  amountCents: number;
  /** Lifecycle status — drives whether a bill / payment journal is produced. */
  status: "draft" | "received" | "approved" | "paid" | "void";
  /** Expense category name (free text) → mapped to a 5xxx account. */
  categoryName?: string | null;
  /** When the bill posted (drives postedAt on the legs). */
  postedAt: Date;
  /** Optional human description for the legs. */
  description?: string | null;
}

const FUND: GlFund = "operating";

/** Guard: amount must be a non-negative integer cents. A negative or fractional
 *  value is a programming/data error, never silently posted. */
function assertCents(label: string, cents: number): void {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error(`vendor posting: ${label} must be a non-negative integer (cents), got ${cents}`);
  }
}

/** A bill is "recorded on the books" (a real expense + liability) once it has
 *  been received/approved/paid. Draft = not yet; void = never (or undone). */
function isRecorded(status: VendorInvoiceMoneyLike["status"]): boolean {
  return status === "received" || status === "approved" || status === "paid";
}

/**
 * Map ONE vendor invoice to its set of balanced journal entries — a BILL journal
 * (DR Expense / CR A/P) once the bill is recorded, plus a PAYMENT journal
 * (DR A/P / CR Cash) once it is paid. Each is a distinct, stable journalId so the
 * events post (and reconcile) independently and idempotently. Draft/void invoices
 * produce no journals (a balanced no-op).
 *
 * INVARIANT (proven by the test suite): after a bill is PAID the 2000 Accounts
 * Payable liability derived from these legs nets to 0¢; debits == credits
 * everywhere; the 5xxx expense balance equals the bill amount.
 */
export function postVendorInvoice(inv: VendorInvoiceMoneyLike): JournalEntry[] {
  assertCents("amountCents", inv.amountCents);

  // Not-yet-a-liability (draft) or undone (void), or a zero-dollar bill → no legs.
  if (!isRecorded(inv.status) || inv.amountCents === 0) {
    return [];
  }

  const expenseCode = expenseAccountForCategory(inv.categoryName);
  const baseDesc = inv.description ?? `vendor invoice ${inv.id}`;

  const leg = (accountCode: string, side: "debit" | "credit", amountCents: number): PostingLeg => ({
    accountCode,
    fund: FUND,
    side,
    amountCents,
  });

  const journals: JournalEntry[] = [];

  // ── BILL RECORDED — DR Expense, CR Accounts Payable ────────────────────────
  journals.push({
    journalId: `ven-bill-${inv.id}`,
    sourceType: "vendor_invoice",
    sourceId: inv.id,
    postedAt: inv.postedAt,
    description: `${baseDesc} — expense recorded`,
    legs: [
      leg(expenseCode, "debit", inv.amountCents),
      leg(VENDOR_GL_CODES.ACCOUNTS_PAYABLE, "credit", inv.amountCents),
    ],
  });

  // ── BILL PAID — DR Accounts Payable, CR Operating Cash ─────────────────────
  if (inv.status === "paid") {
    journals.push({
      journalId: `ven-pay-${inv.id}`,
      sourceType: "vendor_invoice",
      sourceId: inv.id,
      postedAt: inv.postedAt,
      description: `${baseDesc} — payment`,
      legs: [
        leg(VENDOR_GL_CODES.ACCOUNTS_PAYABLE, "debit", inv.amountCents),
        leg(VENDOR_GL_CODES.CASH, "credit", inv.amountCents),
      ],
    });
  }

  return journals;
}

/** Map a batch of vendor invoices to journal entries (flattened). */
export function postVendorInvoices(rows: VendorInvoiceMoneyLike[]): JournalEntry[] {
  return rows.flatMap(postVendorInvoice);
}

/**
 * The 2000 Accounts Payable liability balance (cents) derived from a corpus of
 * vendor journals — credit-normal, so balance = ΣCR − ΣDR. This is the number the
 * acceptance gate asserts: it appears (> 0) once a bill is recorded-and-unpaid
 * and clears to 0 once the bill is paid.
 */
export function accountsPayableCents(journals: JournalEntry[]): number {
  let credit = 0;
  let debit = 0;
  for (const j of journals) {
    for (const l of j.legs) {
      if (l.accountCode !== VENDOR_GL_CODES.ACCOUNTS_PAYABLE) continue;
      if (l.side === "credit") credit += l.amountCents;
      else debit += l.amountCents;
    }
  }
  // Liability is credit-normal: positive == amount still owed.
  return credit - debit;
}

/**
 * The total recorded expense (cents) derived from a corpus of vendor journals —
 * Σ of every 5xxx expense leg (debit-normal). This is what feeds a real income
 * statement total and the budget-vs-actual "actuals".
 */
export function totalExpenseCents(journals: JournalEntry[]): number {
  let total = 0;
  for (const j of journals) {
    for (const l of j.legs) {
      if (l.accountCode.startsWith("5") && l.side === "debit") total += l.amountCents;
    }
  }
  return total;
}

/** Re-export the shared invariant gate so callers can validate vendor journals
 *  with the SAME checks the dues + amenity GL use (balanced + interfund +
 *  positive legs). */
export { validateInvariants };
