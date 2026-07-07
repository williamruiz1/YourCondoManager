/**
 * GL posting service — DB-bound, thin, idempotent (YCM Financial Core Phase 1).
 *
 * Audit anchor:  audits/AUDIT-financial-reporting-orchestration.md Gap F1.
 * Hardening:     audits/BLINDSPOT-pass-2026-06-20.md F4 (forward-only / parallel).
 *
 * This is the ONLY DB writer for the GL. It:
 *   1. seeds the per-association chart of accounts (idempotent upsert),
 *   2. reads the existing owner_ledger_entries (system of record — read-only),
 *   3. derives balanced journal entries via the PURE core (./posting.ts),
 *   4. validates the double-entry + interfund invariants BEFORE any write,
 *   5. inserts the legs idempotently (onConflictDoNothing on the source-leg
 *      unique index), so re-running is a safe no-op.
 *
 * FORWARD-ONLY / PARALLEL: it never writes to owner_ledger_entries or any live
 * table. It is gated by GL_ENABLED (default OFF). The owner ledger STAYS the
 * system of record; the GL is built alongside it and is NOT authoritative until
 * the reconcile-to-cent gate passes — a flip that is out of this phase's scope.
 */

import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  glAccounts,
  glEntries,
  ownerLedgerEntries,
  vendorInvoices,
  financialCategories,
  type GlAccount,
  type InsertGlEntry,
} from "@shared/schema";
import {
  CHART_OF_ACCOUNTS,
  postOwnerLedgerEntries,
  postVendorInvoices,
  expenseAccountCodeForCategory,
  validateInvariants,
  type JournalEntry,
  type OwnerLedgerEntryLike,
  type VendorInvoiceLike,
} from "./posting";
import { isGlEnabledForAssociation } from "./flag";

export interface GlPostingResult {
  skipped: boolean;
  reason?: string;
  accountsSeeded: number;
  journalsConsidered: number;
  legsInserted: number;
}

/**
 * Idempotently ensure the per-association chart of accounts exists. Returns a
 * map from `${code}|${fund}` → gl_accounts row (for leg → account-id resolution).
 */
export async function ensureChartOfAccounts(associationId: string): Promise<Map<string, GlAccount>> {
  const existing = await db
    .select()
    .from(glAccounts)
    .where(eq(glAccounts.associationId, associationId));

  const byKey = new Map<string, GlAccount>();
  for (const row of existing) byKey.set(`${row.accountCode}|${row.fund}`, row);

  const toInsert = CHART_OF_ACCOUNTS.filter((def) => !byKey.has(`${def.code}|${def.fund}`)).map((def) => ({
    associationId,
    accountCode: def.code,
    name: def.name,
    accountType: def.accountType,
    fund: def.fund,
    normalBalance: def.normalBalance,
  }));

  if (toInsert.length > 0) {
    // onConflictDoNothing against the (assoc, code, fund) unique index — safe
    // under concurrent seeders.
    const inserted = await db
      .insert(glAccounts)
      .values(toInsert)
      .onConflictDoNothing()
      .returning();
    for (const row of inserted) byKey.set(`${row.accountCode}|${row.fund}`, row);

    // Re-read any rows another writer inserted concurrently that we didn't get back.
    if (inserted.length !== toInsert.length) {
      const refreshed = await db
        .select()
        .from(glAccounts)
        .where(eq(glAccounts.associationId, associationId));
      for (const row of refreshed) byKey.set(`${row.accountCode}|${row.fund}`, row);
    }
  }

  return byKey;
}

/** Load owner-ledger rows for an association as the pure-core input shape. */
async function loadOwnerLedger(associationId: string): Promise<OwnerLedgerEntryLike[]> {
  const rows = await db
    .select()
    .from(ownerLedgerEntries)
    .where(eq(ownerLedgerEntries.associationId, associationId));

  return rows.map((r) => ({
    id: r.id,
    entryType: r.entryType,
    amount: r.amount,
    postedAt: r.postedAt,
    description: r.description,
  }));
}

/**
 * Load vendor invoices for an association as the pure-core input shape, resolving
 * each invoice's expense account from its financial_category name (falling back to
 * the vendor name, then to 5000 General Operating Expense). Read-only — never
 * mutates vendor_invoices. The pure mapper drops draft/void/zero invoices, so the
 * GL only carries committed costs (received/approved → A/P, paid → cash).
 */
async function loadVendorInvoices(associationId: string): Promise<VendorInvoiceLike[]> {
  const rows = await db
    .select({
      id: vendorInvoices.id,
      amount: vendorInvoices.amount,
      status: vendorInvoices.status,
      invoiceDate: vendorInvoices.invoiceDate,
      vendorName: vendorInvoices.vendorName,
      invoiceNumber: vendorInvoices.invoiceNumber,
      categoryName: financialCategories.name,
    })
    .from(vendorInvoices)
    .leftJoin(financialCategories, eq(vendorInvoices.categoryId, financialCategories.id))
    .where(eq(vendorInvoices.associationId, associationId));

  return rows.map((r) => ({
    id: r.id,
    amount: r.amount,
    status: r.status,
    // Vendor invoices carry no separate "posted" timestamp; the invoice date is
    // the economic event date for the expense leg.
    postedAt: r.invoiceDate,
    description: r.invoiceNumber
      ? `${r.vendorName} — invoice ${r.invoiceNumber}`
      : r.vendorName,
    // Category drives the 5xxx expense account; fall back to vendor name keywords.
    expenseAccountCode: expenseAccountCodeForCategory(r.categoryName ?? r.vendorName),
  }));
}

/** Turn validated journal entries into gl_entries insert rows. */
function toInsertRows(
  associationId: string,
  journals: JournalEntry[],
  accountByKey: Map<string, GlAccount>,
): InsertGlEntry[] {
  const rows: InsertGlEntry[] = [];
  for (const j of journals) {
    for (const leg of j.legs) {
      const account = accountByKey.get(`${leg.accountCode}|${leg.fund}`);
      if (!account) {
        // A missing account is a seeding bug, not a silent skip.
        throw new Error(`GL account missing for code=${leg.accountCode} fund=${leg.fund}`);
      }
      rows.push({
        associationId,
        journalId: j.journalId,
        glAccountId: account.id,
        fund: leg.fund,
        side: leg.side,
        amountCents: leg.amountCents,
        postedAt: j.postedAt,
        description: j.description,
        sourceType: j.sourceType,
        sourceId: j.sourceId,
      });
    }
  }
  return rows;
}

/**
 * Post (sync) the owner-ledger subledger into the parallel GL for one
 * association. Idempotent — re-running never double-posts.
 *
 * Returns a result describing what happened. If GL_ENABLED is off, returns
 * `{ skipped: true }` without touching the database.
 *
 * @param opts.force  ignore the GL enablement flags (used by the reconcile
 *                    script / tests, which must build the GL to compare it).
 *
 * Enablement honors BOTH the global GL_ENABLED flag AND the per-association
 * allowlist (GL_ENABLED_ASSOCIATIONS) — see flag.ts. The reconcile-to-cent gate
 * is applied one layer up (runtime-sync.ts maybeSyncAssociationGl), which is the
 * path the live money triggers call.
 */
export async function syncAssociationGl(
  associationId: string,
  opts: { force?: boolean } = {},
): Promise<GlPostingResult> {
  if (!opts.force && !isGlEnabledForAssociation(associationId)) {
    return {
      skipped: true,
      reason: "GL not enabled for this association (forward-only/parallel: GL not source-of-truth)",
      accountsSeeded: 0,
      journalsConsidered: 0,
      legsInserted: 0,
    };
  }

  const accountByKey = await ensureChartOfAccounts(associationId);
  const accountsSeeded = accountByKey.size;

  // The owner-ledger (dues/A-R, INCOME) side + the vendor-invoice (A-P/cash,
  // EXPENSE) side both derive into the same balanced-journal corpus. Posting them
  // together gives the GL a real income statement (income AND costs) and an A/P
  // balance. Each side is independently balanced, so the corpus balances.
  const ledger = await loadOwnerLedger(associationId);
  const invoices = await loadVendorInvoices(associationId);
  const journals = [
    ...postOwnerLedgerEntries(ledger),
    ...postVendorInvoices(invoices),
  ];

  // HARD GATE: validate double-entry + interfund invariants BEFORE writing.
  const violations = validateInvariants(journals);
  if (violations.length > 0) {
    throw new Error(
      `GL invariant violations (refusing to post): ${violations
        .map((v) => `[${v.invariant}] ${v.detail}`)
        .join("; ")}`,
    );
  }

  const rows = toInsertRows(associationId, journals, accountByKey);
  let legsInserted = 0;
  if (rows.length > 0) {
    // Idempotent insert against gl_entries_source_leg_uq — re-running is a no-op.
    const inserted = await db
      .insert(glEntries)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: glEntries.id });
    legsInserted = inserted.length;
  }

  return {
    skipped: false,
    accountsSeeded,
    journalsConsidered: journals.length,
    legsInserted,
  };
}

/** Convenience: has the GL been built for this association at all? */
export async function hasGlEntries(associationId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: glEntries.id })
    .from(glEntries)
    .where(eq(glEntries.associationId, associationId))
    .limit(1);
  return Boolean(row);
}

/** Load all persisted GL journals for an association, reshaped for the pure-core
 *  balance/invariant helpers (used by the reconcile script to read back the DB
 *  GL and re-derive balances). Joins gl_accounts so each leg carries its
 *  accountCode (needed for AR / fund-balance derivation). */
export async function loadGlJournals(associationId: string): Promise<JournalEntry[]> {
  const rows = await db
    .select({
      journalId: glEntries.journalId,
      sourceType: glEntries.sourceType,
      sourceId: glEntries.sourceId,
      postedAt: glEntries.postedAt,
      description: glEntries.description,
      fund: glEntries.fund,
      side: glEntries.side,
      amountCents: glEntries.amountCents,
      accountCode: glAccounts.accountCode,
    })
    .from(glEntries)
    .innerJoin(glAccounts, eq(glEntries.glAccountId, glAccounts.id))
    .where(eq(glEntries.associationId, associationId));

  const byJournal = new Map<string, JournalEntry>();
  for (const r of rows) {
    const j = byJournal.get(r.journalId) ?? {
      journalId: r.journalId,
      sourceType: (r.sourceType ?? "opening_balance") as JournalEntry["sourceType"],
      sourceId: r.sourceId ?? "",
      postedAt: r.postedAt,
      description: r.description ?? "",
      legs: [],
    };
    j.legs.push({
      accountCode: r.accountCode,
      fund: r.fund,
      side: r.side,
      amountCents: r.amountCents,
    });
    byJournal.set(r.journalId, j);
  }
  return Array.from(byJournal.values());
}

void and; // reserved for future scoped queries; keep import stable
