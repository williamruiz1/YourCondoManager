/**
 * Vendor-expense / accounts-payable GL posting service — DB-bound, thin,
 * idempotent (YCM Financial Core — Phase 4).
 *
 * Audit anchor:  docs/financial-completeness-and-quickbooks-migration-2026-06-30.md
 *                Gap #1 (the #1-ranked blocker: vendor expenses → GL).
 * Build anchor:  founder-os#8171.
 * Hardening:     audits/BLINDSPOT-pass-2026-06-20.md F4 (forward-only / parallel).
 *
 * This is the ONLY DB writer for vendor GL postings. It:
 *   1. ensures the per-association chart of accounts (reuses the dues GL seeder —
 *      the chart now includes 2000 Accounts Payable + the 5xxx expense accounts),
 *   2. reads vendor_invoices joined to financial_categories for the category name
 *      (source of record — read-only),
 *   3. converts the dollar amount to integer cents at this boundary (toCents),
 *   4. derives balanced journal entries via the PURE core (./vendor-posting.ts),
 *   5. validates the double-entry invariants BEFORE any write,
 *   6. inserts the legs idempotently (onConflictDoNothing on the source-leg unique
 *      index), so re-running is a safe no-op.
 *
 * FORWARD-ONLY / PARALLEL: it never writes to vendor_invoices or any live table.
 * It is gated by GL_ENABLED (default OFF). The vendor_invoices row STAYS the
 * source of record; the GL is built alongside it and is NOT authoritative.
 */

import { eq } from "drizzle-orm";
import { db } from "../../db";
import {
  vendorInvoices,
  financialCategories,
  glEntries,
  type GlAccount,
  type InsertGlEntry,
} from "@shared/schema";
import { toCents, type JournalEntry } from "./posting";
import {
  postVendorInvoices,
  validateInvariants,
  type VendorInvoiceMoneyLike,
} from "./vendor-posting";
import { ensureChartOfAccounts } from "./gl-posting-service";
import { isGlEnabledForAssociation } from "./flag";

export interface VendorGlPostingResult {
  skipped: boolean;
  reason?: string;
  accountsSeeded: number;
  invoicesConsidered: number;
  journalsConsidered: number;
  legsInserted: number;
}

/** Load vendor-invoice money state for an association as the pure-core input
 *  shape, joining financial_categories for the category name. Draft/void/zero
 *  invoices are kept (the pure mapper drops them) so the corpus re-derivation is
 *  total and the idempotent insert stays a no-op on already-posted facts. */
async function loadVendorInvoiceMoneyState(
  associationId: string,
): Promise<VendorInvoiceMoneyLike[]> {
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
    amountCents: toCents(r.amount),
    status: r.status,
    categoryName: r.categoryName,
    postedAt: r.invoiceDate,
    description:
      `${r.vendorName}${r.invoiceNumber ? ` #${r.invoiceNumber}` : ""}`.trim() ||
      `vendor invoice ${r.id}`,
  }));
}

/** Turn validated vendor journal entries into gl_entries insert rows. */
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
 * Post (sync) the vendor-expense / A-P subledger into the parallel GL for one
 * association. Idempotent — re-running never double-posts.
 *
 * Returns a result describing what happened. If the GL is not enabled for this
 * association, returns `{ skipped: true }` without touching the database.
 *
 * @param opts.force  ignore the GL enablement flags (used by the verify script /
 *                    tests, which must build the GL to compare it).
 */
export async function syncAssociationVendorGl(
  associationId: string,
  opts: { force?: boolean } = {},
): Promise<VendorGlPostingResult> {
  if (!opts.force && !isGlEnabledForAssociation(associationId)) {
    return {
      skipped: true,
      reason: "GL not enabled for this association (forward-only/parallel: GL not source-of-truth)",
      accountsSeeded: 0,
      invoicesConsidered: 0,
      journalsConsidered: 0,
      legsInserted: 0,
    };
  }

  const accountByKey = await ensureChartOfAccounts(associationId);
  const accountsSeeded = accountByKey.size;

  const moneyState = await loadVendorInvoiceMoneyState(associationId);
  const journals = postVendorInvoices(moneyState);

  // HARD GATE: validate double-entry + interfund invariants BEFORE writing.
  const violations = validateInvariants(journals);
  if (violations.length > 0) {
    throw new Error(
      `vendor GL invariant violations (refusing to post): ${violations
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
    invoicesConsidered: moneyState.length,
    journalsConsidered: journals.length,
    legsInserted,
  };
}
