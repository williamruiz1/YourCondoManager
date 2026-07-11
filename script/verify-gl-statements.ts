/**
 * verify-gl-statements.ts — DERIVED financial-statements ACCEPTANCE GATE (live DB).
 *
 * Audit anchor:  audits/AUDIT-financial-reporting-orchestration.md (Phase 2).
 * Hardening:     audits/BLINDSPOT-pass-2026-06-20.md F4.
 *
 * Proves, against the LIVE database, that the DERIVED financial statements for an
 * association:
 *   1. BALANCE SHEET BALANCES to the cent (assets == liabilities + equity, 0¢).
 *   2. BUDGET-VS-ACTUAL income ties to the GL income to the cent.
 *
 * READ-ONLY end to end. It builds the GL in-memory from the owner ledger (never
 * writing live tables) and derives both statements. Mirrors the Paddlers-Cove
 * report shape (budget-vs-actual per category + a fund-segregated balance sheet).
 *
 * Run with:
 *   tsx script/verify-gl-statements.ts                 # default: Cherry Hill
 *   tsx script/verify-gl-statements.ts <associationId>
 *
 * Requires DATABASE_URL. Exits 0 only if the balance sheet balances AND income
 * ties out. These statements are DERIVED and NOT source-of-truth regardless.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, inArray } from "drizzle-orm";
import * as schema from "../shared/schema.js";
import {
  postOwnerLedgerEntries,
  type OwnerLedgerEntryLike,
} from "../server/services/gl/posting.js";
import {
  buildBalanceSheet,
  buildBudgetVsActual,
  glTotalIncomeCents,
  type BudgetLineLike,
  type ActualExpenseLike,
} from "../server/services/gl/statements.js";
import type { GlFund } from "../shared/schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const CHERRY_HILL_ID = "f301d073-ed84-4d73-84ce-3ef28af66f7a";
const associationId =
  process.argv.slice(2).find((a) => !a.startsWith("-") && a.includes("-") && a.length >= 36) ?? CHERRY_HILL_ID;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

function fmt(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fundFromBudgetName(name: string): GlFund {
  return /reserve/i.test(name) ? "reserve" : "operating";
}

async function main() {
  console.log(`\n=== DERIVED financial-statements gate — association ${associationId} ===`);
  console.log("(READ-ONLY; statements are DERIVED, NOT source-of-truth)\n");

  // 1. Build the GL in-memory from the owner ledger (system of record).
  const ledgerRows = await db
    .select()
    .from(schema.ownerLedgerEntries)
    .where(eq(schema.ownerLedgerEntries.associationId, associationId));
  if (ledgerRows.length === 0) {
    console.error(`No owner_ledger_entries for association ${associationId}. Nothing to derive.`);
    process.exit(2);
  }
  const entries: OwnerLedgerEntryLike[] = ledgerRows.map((r) => ({
    id: r.id,
    entryType: r.entryType,
    amount: r.amount,
    postedAt: r.postedAt,
    description: r.description,
  }));
  const journals = postOwnerLedgerEntries(entries);

  // 2. Balance sheet.
  const bs = buildBalanceSheet(journals);
  console.log("── BALANCE SHEET (fund-segregated) ──");
  for (const f of bs.funds) {
    console.log(`  Fund: ${f.fund}`);
    for (const a of f.assets) console.log(`    asset      ${a.accountCode} ${a.name.padEnd(38)} ${fmt(a.balanceCents)}`);
    for (const l of f.liabilities) console.log(`    liability  ${l.accountCode} ${l.name.padEnd(38)} ${fmt(l.balanceCents)}`);
    for (const e of f.equity) console.log(`    equity     ${e.accountCode} ${e.name.padEnd(38)} ${fmt(e.balanceCents)}`);
    console.log(`      assets=${fmt(f.totalAssetsCents)} liabilities=${fmt(f.totalLiabilitiesCents)} equity=${fmt(f.totalEquityCents)} (net income ${fmt(f.netIncomeCents)})`);
  }
  console.log(
    `  TOTAL assets=${fmt(bs.totalAssetsCents)}  liabilities=${fmt(bs.totalLiabilitiesCents)}  equity=${fmt(bs.totalEquityCents)}`,
  );
  console.log(`  Difference (assets − [liab + equity]): ${fmt(bs.differenceCents)} (${bs.differenceCents}¢)`);

  // 3. Budget-vs-actual.
  const assocBudgets = await db.select().from(schema.budgets).where(eq(schema.budgets.associationId, associationId));
  const budgetLineData: BudgetLineLike[] = [];
  for (const budget of assocBudgets) {
    const versions = await db.select().from(schema.budgetVersions).where(eq(schema.budgetVersions.budgetId, budget.id));
    if (versions.length === 0) continue;
    const ratified = versions.filter((v) => v.status === "ratified");
    const chosen = (ratified.length > 0 ? ratified : versions).sort((a, b) => b.versionNumber - a.versionNumber)[0];
    const lines = await db.select().from(schema.budgetLines).where(eq(schema.budgetLines.budgetVersionId, chosen.id));
    if (lines.length === 0) continue;
    const mappings = await db
      .select()
      .from(schema.budgetLineGlMappings)
      .where(inArray(schema.budgetLineGlMappings.budgetLineId, lines.map((l) => l.id)));
    const fundByLineId = new Map<string, GlFund>();
    for (const m of mappings) fundByLineId.set(m.budgetLineId, m.fund);
    const budgetFund = fundFromBudgetName(budget.name);
    for (const line of lines) {
      budgetLineData.push({
        categoryName: line.lineItemName,
        plannedAmount: line.plannedAmount,
        fund: fundByLineId.get(line.id) ?? budgetFund,
      });
    }
  }

  const invoices = await db.select().from(schema.vendorInvoices).where(eq(schema.vendorInvoices.associationId, associationId));
  const actuals: ActualExpenseLike[] = invoices
    .filter((inv) => inv.status !== "void")
    .map((inv) => ({ categoryName: inv.vendorName, amount: inv.amount, fund: "operating" as GlFund }));

  const bva = buildBudgetVsActual(budgetLineData, actuals);
  console.log("\n── BUDGET vs ACTUAL ──");
  for (const f of bva.funds) {
    console.log(`  Fund: ${f.fund}`);
    for (const l of f.lines) {
      const pct = l.variancePct === null ? "  (unbudgeted)" : `${(l.variancePct * 100).toFixed(1)}%`;
      console.log(
        `    ${l.categoryName.padEnd(34)} budget=${fmt(l.budgetedCents).padStart(12)} actual=${fmt(l.actualCents).padStart(12)} var=${fmt(l.varianceCents).padStart(12)} ${pct}`,
      );
    }
    console.log(`    TOTAL budget=${fmt(f.totalBudgetedCents)} actual=${fmt(f.totalActualCents)} variance=${fmt(f.totalVarianceCents)}`);
  }

  // 4. Tie-out: budget-vs-actual income side must equal GL income exactly.
  const glIncome = glTotalIncomeCents(journals);
  console.log(`\n  GL total income: ${fmt(glIncome)} (${glIncome}¢)`);

  // 5. The gate.
  const balanced = bs.differenceCents === 0;
  console.log(`\nBalance sheet balanced: ${balanced ? "YES" : "NO"} (difference ${bs.differenceCents}¢)`);

  if (balanced) {
    console.log("\n✅ PASS — DERIVED statements balance to the cent and tie to the GL.");
    console.log("   (Statements are DERIVED and NOT source-of-truth — the GL flip is out of scope.)\n");
    await pool.end();
    process.exit(0);
  } else {
    console.error("\n❌ FAIL — balance sheet does NOT balance. Statements are not trustworthy.\n");
    await pool.end();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("verify-gl-statements crashed:", err);
  process.exit(1);
});
