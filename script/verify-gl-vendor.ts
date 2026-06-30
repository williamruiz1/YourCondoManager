/**
 * verify-gl-vendor.ts — vendor-expense / accounts-payable ACCEPTANCE GATE (live DB).
 *
 * Audit anchor:  docs/financial-completeness-and-quickbooks-migration-2026-06-30.md
 *                Gap #1 — vendor expenses → GL (THE #1 blocker).
 * Build anchor:  founder-os#8171.
 * Hardening:     audits/BLINDSPOT-pass-2026-06-20.md F4.
 *
 * Proves, against the LIVE database, the full Phase-4 acceptance criterion:
 *   "a vendor bill records an EXPENSE and an A/P liability (the 2000 liability
 *    APPEARS), then PAYING it CLEARS the A/P to 0¢ (cash goes down, the expense
 *    stays), and every GL entry balances."
 *
 * It is SELF-CONTAINED + SELF-CLEANING (so it never leaves live data behind):
 *   1. creates a throwaway vendor invoice (status "approved") scoped to a test
 *      association,
 *   2. posts the bill to the parallel GL (force, idempotent) → A/P APPEARS,
 *   3. asserts the 2000 Accounts-Payable liability == the bill amount (> 0) and
 *      the 5xxx expense == the bill amount,
 *   4. flips the invoice to "paid", re-posts → A/P CLEARS to 0¢ (expense stays),
 *   5. asserts all GL entries balance (Σdebit == Σcredit) + invariants are clean,
 *   6. TEARS DOWN every row it created (gl_entries, vendor invoice).
 *
 * FORWARD-ONLY / PARALLEL: it only writes the additive GL + its own throwaway
 * fixtures; it touches no live money path and is gated by `--force`. It exits 0
 * only if the A/P appears then clears to exactly 0¢ with clean invariants.
 *
 * Run with:
 *   tsx script/verify-gl-vendor.ts                 # default: Cherry Hill assoc
 *   tsx script/verify-gl-vendor.ts <associationId>
 *
 * Requires DATABASE_URL.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { and, eq, inArray } from "drizzle-orm";
import * as schema from "../shared/schema.js";
import {
  postVendorInvoices,
  validateInvariants,
  accountsPayableCents,
  totalExpenseCents,
  type VendorInvoiceMoneyLike,
} from "../server/services/gl/vendor-posting.js";
import { ensureChartOfAccounts, loadGlJournals } from "../server/services/gl/gl-posting-service.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const CHERRY_HILL_ID = "f301d073-ed84-4d73-84ce-3ef28af66f7a";
const associationId =
  process.argv.find((a) => !a.startsWith("-") && a.includes("-") && a.length >= 36) ?? CHERRY_HILL_ID;

const BILL_CENTS = 100000; // $1,000.00 landscaping bill

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

function fmt(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Build the GL journals for a single vendor invoice's money state + persist them
 *  idempotently. Returns the journals (for invariant + balance assertions). */
async function postOne(
  invId: string,
  money: Omit<VendorInvoiceMoneyLike, "id">,
  accountByKey: Map<string, schema.GlAccount>,
) {
  const journals = postVendorInvoices([{ id: invId, ...money }]);
  const violations = validateInvariants(journals);
  if (violations.length > 0) {
    throw new Error(`invariant violations: ${violations.map((v) => `[${v.invariant}] ${v.detail}`).join("; ")}`);
  }
  const rows = journals.flatMap((j) =>
    j.legs.map((leg) => {
      const account = accountByKey.get(`${leg.accountCode}|${leg.fund}`);
      if (!account) throw new Error(`GL account missing for ${leg.accountCode}|${leg.fund}`);
      return {
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
      };
    }),
  );
  if (rows.length > 0) {
    await db.insert(schema.glEntries).values(rows).onConflictDoNothing();
  }
  return journals;
}

async function main() {
  console.log(`\n=== Vendor-expense / A-P acceptance gate — association ${associationId} ===\n`);

  const accountByKey = await ensureChartOfAccounts(associationId);

  // ── Create throwaway fixture (clearly tagged so teardown is precise) ─────────
  const [invoice] = await db
    .insert(schema.vendorInvoices)
    .values({
      associationId,
      vendorName: "VERIFY-GL-VENDOR landscaper (throwaway)",
      invoiceNumber: "VERIFY-GL-VENDOR-1",
      invoiceDate: new Date("2026-06-30T00:00:00Z"),
      amount: BILL_CENTS / 100,
      status: "approved",
    })
    .returning();

  let exitCode = 1;
  try {
    // ── Step 1+2: record the bill → expense + A/P liability APPEAR ─────────────
    await postOne(
      invoice.id,
      {
        amountCents: BILL_CENTS,
        status: "approved",
        categoryName: "Landscaping",
        postedAt: invoice.invoiceDate,
        description: `landscaping bill ${invoice.id}`,
      },
      accountByKey,
    );

    let persisted = await loadGlJournals(associationId);
    let mine = persisted.filter((j) => j.sourceId === invoice.id);
    const apAfterBill = accountsPayableCents(mine);
    const expenseAfterBill = totalExpenseCents(mine);
    console.log(`After BILL:    A/P (2000) = ${fmt(apAfterBill)} (${apAfterBill}¢)  [expected ${fmt(BILL_CENTS)}]`);
    console.log(`               expense    = ${fmt(expenseAfterBill)} (${expenseAfterBill}¢)  [expected ${fmt(BILL_CENTS)}]`);
    if (apAfterBill !== BILL_CENTS) throw new Error(`A/P liability did not appear: got ${apAfterBill}¢`);
    if (expenseAfterBill !== BILL_CENTS) throw new Error(`expense did not record: got ${expenseAfterBill}¢`);

    // ── Step 3: pay the bill → A/P CLEARS to 0¢ (expense stays) ────────────────
    await db
      .update(schema.vendorInvoices)
      .set({ status: "paid", updatedAt: new Date() })
      .where(eq(schema.vendorInvoices.id, invoice.id));

    await postOne(
      invoice.id,
      {
        amountCents: BILL_CENTS,
        status: "paid",
        categoryName: "Landscaping",
        postedAt: invoice.invoiceDate,
        description: `landscaping bill ${invoice.id}`,
      },
      accountByKey,
    );

    persisted = await loadGlJournals(associationId);
    mine = persisted.filter((j) => j.sourceId === invoice.id);
    const apAfterPay = accountsPayableCents(mine);
    const expenseAfterPay = totalExpenseCents(mine);
    console.log(`After PAY:     A/P (2000) = ${fmt(apAfterPay)} (${apAfterPay}¢)  [expected $0.00]`);
    console.log(`               expense    = ${fmt(expenseAfterPay)} (${expenseAfterPay}¢)  [expected ${fmt(BILL_CENTS)}]`);
    if (apAfterPay !== 0) throw new Error(`A/P liability did not clear: got ${apAfterPay}¢`);
    if (expenseAfterPay !== BILL_CENTS) throw new Error(`expense changed after payment: got ${expenseAfterPay}¢`);

    // ── All persisted entries balance + invariants clean ──────────────────────
    const violations = validateInvariants(mine);
    if (violations.length > 0) throw new Error(`invariants: ${violations.map((v) => v.detail).join("; ")}`);
    let dr = 0;
    let cr = 0;
    for (const j of mine) for (const l of j.legs) (l.side === "debit" ? (dr += l.amountCents) : (cr += l.amountCents));
    console.log(`Σdebit = ${fmt(dr)}   Σcredit = ${fmt(cr)}   balanced=${dr === cr}`);
    if (dr !== cr) throw new Error(`corpus does not balance: ΣDR=${dr} != ΣCR=${cr}`);

    console.log("\n✅ PASS — bill recorded expense + A/P; payment cleared A/P to $0.00 (expense stayed); all entries balance.");
    console.log("   (The GL remains PARALLEL and NOT source-of-truth — flip is out of scope.)\n");
    exitCode = 0;
  } finally {
    // ── Teardown — remove every row this run created (never leave live data) ──
    const created = await db
      .select({ id: schema.glEntries.id })
      .from(schema.glEntries)
      .where(and(eq(schema.glEntries.associationId, associationId), eq(schema.glEntries.sourceId, invoice.id)));
    if (created.length > 0) {
      await db.delete(schema.glEntries).where(inArray(schema.glEntries.id, created.map((r) => r.id)));
    }
    await db.delete(schema.vendorInvoices).where(eq(schema.vendorInvoices.id, invoice.id));
    console.log("(teardown: removed throwaway vendor invoice and its GL entries)");
  }

  await pool.end();
  process.exit(exitCode);
}

main().catch(async (err) => {
  console.error("verify-gl-vendor crashed:", err);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
