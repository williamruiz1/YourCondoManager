/**
 * verify-gl-reconcile.ts — Reconcile-to-the-cent ACCEPTANCE GATE (live DB).
 *
 * Audit anchor:  audits/AUDIT-financial-reporting-orchestration.md Gap F1 / F5+.
 * Hardening:     audits/BLINDSPOT-pass-2026-06-20.md F4.
 *
 * Proves, against the LIVE database, that the parallel fund-aware GL reproduces
 * an association's reconciled owner-ledger balance EXACTLY (to the cent), with
 * all double-entry + interfund invariants intact. This is the gate BLINDSPOT F4
 * requires before the GL could ever become source-of-truth — a flip that is
 * deliberately OUT of scope for Phase 1.
 *
 * What it does (READ-mostly, fully additive):
 *   1. Seeds the per-association GL chart of accounts (idempotent).
 *   2. Posts the owner-ledger subledger into gl_entries (idempotent — re-running
 *      is a no-op via the source-leg unique index). Never touches the owner
 *      ledger or any live table.
 *   3. Reads the GL back, derives the Accounts-Receivable balance, and compares
 *      it to the owner-ledger Σ amount the live product already reports.
 *   4. Exits 0 only if invariants are clean AND difference == 0¢.
 *
 * Run with:
 *   tsx script/verify-gl-reconcile.ts                 # default: Cherry Hill
 *   tsx script/verify-gl-reconcile.ts <associationId>
 *
 * Requires DATABASE_URL. Honors --dry-run (compute from the owner ledger only,
 * never write gl_entries).
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq } from "drizzle-orm";
import * as schema from "../shared/schema.js";
import {
  postOwnerLedgerEntries,
  validateInvariants,
  accountsReceivableCents,
  type OwnerLedgerEntryLike,
} from "../server/services/gl/posting.js";
import { ownerLedgerBalanceCents, fundNetByFund } from "../server/services/gl/reconcile.js";
import { ensureChartOfAccounts, syncAssociationGl, loadGlJournals } from "../server/services/gl/gl-posting-service.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const CHERRY_HILL_ID = "f301d073-ed84-4d73-84ce-3ef28af66f7a";
const associationId = process.argv.slice(2).find((a) => !a.startsWith("-") && a.includes("-") && a.length >= 36) ?? CHERRY_HILL_ID;
const dryRun = process.argv.includes("--dry-run");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

function fmt(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function main() {
  console.log(`\n=== GL reconcile-to-the-cent gate — association ${associationId} ===`);
  console.log(dryRun ? "(dry-run: computing from owner ledger only; no GL writes)\n" : "");

  // 1. Owner-ledger truth (the live system of record).
  const ledgerRows = await db
    .select()
    .from(schema.ownerLedgerEntries)
    .where(eq(schema.ownerLedgerEntries.associationId, associationId));

  if (ledgerRows.length === 0) {
    console.error(`No owner_ledger_entries for association ${associationId}. Nothing to reconcile.`);
    process.exit(2);
  }

  const entries: OwnerLedgerEntryLike[] = ledgerRows.map((r) => ({
    id: r.id,
    entryType: r.entryType,
    amount: r.amount,
    postedAt: r.postedAt,
    description: r.description,
  }));

  const ownerBalance = ownerLedgerBalanceCents(entries);
  console.log(`Owner-ledger entries:          ${entries.length}`);
  console.log(`Owner-ledger reconciled bal.:  ${fmt(ownerBalance)} (${ownerBalance}¢)`);

  // Build the GL in-memory for the invariant check + AR derivation.
  const journals = postOwnerLedgerEntries(entries);
  const violations = validateInvariants(journals);
  if (violations.length > 0) {
    console.error("\nINVARIANT VIOLATIONS:");
    for (const v of violations) console.error(`  [${v.invariant}] ${v.detail}`);
    process.exit(1);
  }
  console.log("Invariants:                    clean (DR==CR, corpus balances, interfund nets to 0)");

  // 2. Persist the GL (idempotent) unless dry-run — proves the DB path too.
  let glArCents: number;
  if (dryRun) {
    glArCents = accountsReceivableCents(journals);
  } else {
    await ensureChartOfAccounts(associationId);
    const result = await syncAssociationGl(associationId, { force: true });
    console.log(
      `GL sync:                       seeded=${result.accountsSeeded} accounts, ` +
        `journals=${result.journalsConsidered}, legsInserted=${result.legsInserted}`,
    );
    // Read the GL back from the DB and derive AR from the persisted rows.
    const persisted = await loadGlJournals(associationId);
    glArCents = accountsReceivableCents(persisted);
  }

  console.log(`GL Accounts-Receivable bal.:   ${fmt(glArCents)} (${glArCents}¢)`);

  const fundNets = fundNetByFund(journals);
  console.log("Fund balances (net):");
  for (const [fund, cents] of Object.entries(fundNets)) {
    console.log(`  ${fund.padEnd(10)} ${fmt(cents)}`);
  }

  // 3. The gate.
  const difference = ownerBalance - glArCents;
  console.log(`\nDifference (owner − GL AR):     ${fmt(difference)} (${difference}¢)`);

  if (difference === 0) {
    console.log("\n✅ PASS — GL reproduces the reconciled owner-ledger balance to the cent.");
    console.log("   (The GL remains PARALLEL and NOT source-of-truth — flip is out of scope.)\n");
    await pool.end();
    process.exit(0);
  } else {
    console.error("\n❌ FAIL — GL does NOT reconcile to the owner ledger.");
    console.error("   The GL must NOT become source-of-truth until this passes.\n");
    await pool.end();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("verify-gl-reconcile crashed:", err);
  process.exit(1);
});
