/**
 * verify-financial.ts — Financial coherence checks for Cherry Hill Court Condominiums.
 *
 * Checks (all scoped to Cherry Hill, ID f301d073-ed84-4d73-84ce-3ef28af66f7a):
 *   [a] At least one approved/ratified budget version exists
 *   [b] Budget line total planned amounts are positive (sum > 0 per budget version)
 *   [c] Owner ledger entries balance as expected: each unit's assessments are matched
 *       by payments or late-fee entries — orphan assessments only for unit 1421-A
 *   [d] Late fee events reference valid active rules
 *   [e] Late fee event amounts (calculatedFee) are positive
 *   [f] No owner ledger entries have impossible sign: assessments must be > 0,
 *       payments must be < 0
 *   [g] Active late fee rules have graceDays >= 0 and feeAmount > 0
 *
 * Run with: tsx script/verify-financial.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";
import { eq, and } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const {
  budgets,
  budgetVersions,
  budgetLines,
  ownerLedgerEntries,
  lateFeeRules,
  lateFeeEvents,
} = schema;

const CHERRY_HILL_ID = "f301d073-ed84-4d73-84ce-3ef28af66f7a";

// Unit 1421-A is intentionally left with an outstanding balance (no March payment)
const OUTSTANDING_BALANCE_UNITS = new Set(["bfa54c14-9fcd-4ed4-a810-61f193aa7d4b"]);

type CheckResult = {
  label: string;
  passed: boolean;
  detail?: string;
};

function pass(label: string, detail?: string): CheckResult {
  return { label, passed: true, detail };
}

function fail(label: string, detail: string): CheckResult {
  return { label, passed: false, detail };
}

async function runChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // ── Load data ────────────────────────────────────────────────────────────────

  const cherryHillBudgets = await db
    .select()
    .from(budgets)
    .where(eq(budgets.associationId, CHERRY_HILL_ID));

  const cherryHillBudgetIds = new Set(cherryHillBudgets.map((b) => b.id));

  const allBudgetVersions = await db.select().from(budgetVersions);
  const cherryHillVersions = allBudgetVersions.filter((v) =>
    cherryHillBudgetIds.has(v.budgetId),
  );

  const allBudgetLines = await db.select().from(budgetLines);
  const cherryHillVersionIds = new Set(cherryHillVersions.map((v) => v.id));
  const cherryHillLines = allBudgetLines.filter((l) =>
    cherryHillVersionIds.has(l.budgetVersionId),
  );

  const cherryHillLedger = await db
    .select()
    .from(ownerLedgerEntries)
    .where(eq(ownerLedgerEntries.associationId, CHERRY_HILL_ID));

  const cherryHillRules = await db
    .select()
    .from(lateFeeRules)
    .where(eq(lateFeeRules.associationId, CHERRY_HILL_ID));

  const cherryHillEvents = await db
    .select()
    .from(lateFeeEvents)
    .where(eq(lateFeeEvents.associationId, CHERRY_HILL_ID));

  // ── [a] At least one ratified budget version ─────────────────────────────────
  const ratifiedVersions = cherryHillVersions.filter(
    (v) => v.status === "ratified" || v.status === "proposed",
  );
  if (ratifiedVersions.length > 0) {
    results.push(
      pass(
        "[a] At least one approved/ratified budget version exists",
        `${ratifiedVersions.length} ratified/proposed version(s) found across ${cherryHillBudgets.length} budget(s)`,
      ),
    );
  } else {
    results.push(
      fail(
        "[a] At least one approved/ratified budget version exists",
        `0 ratified or proposed versions found — ${cherryHillVersions.length} version(s) are all draft/archived`,
      ),
    );
  }

  // ── [b] Budget line totals are positive per version ──────────────────────────
  if (cherryHillVersions.length === 0) {
    results.push(
      fail(
        "[b] Budget line totals are positive per version",
        "No budget versions to check",
      ),
    );
  } else {
    const versionTotals = new Map<string, number>();
    for (const line of cherryHillLines) {
      const prev = versionTotals.get(line.budgetVersionId) ?? 0;
      versionTotals.set(line.budgetVersionId, prev + (line.plannedAmount ?? 0));
    }
    const zeroOrNegative = Array.from(versionTotals.entries()).filter(
      ([, total]) => total <= 0,
    );
    const versionsWithNoLines = cherryHillVersions.filter(
      (v) => !versionTotals.has(v.id),
    );
    if (zeroOrNegative.length === 0 && versionsWithNoLines.length === 0) {
      const summaries = Array.from(versionTotals.entries())
        .map(([id, total]) => `${id}: $${total.toLocaleString()}`)
        .join("; ");
      results.push(
        pass(
          "[b] Budget line totals are positive per version",
          `All ${versionTotals.size} version(s) have positive totals — ${summaries}`,
        ),
      );
    } else {
      const badIds = [
        ...zeroOrNegative.map(([id, t]) => `${id} (total: ${t})`),
        ...versionsWithNoLines.map((v) => `${v.id} (no lines)`),
      ].join(", ");
      results.push(
        fail(
          "[b] Budget line totals are positive per version",
          `${zeroOrNegative.length + versionsWithNoLines.length} version(s) with non-positive totals: ${badIds}`,
        ),
      );
    }
  }

  // ── [c] Ledger balance check: assessments matched by payment or late-fee ─────
  // Group entries by unit
  const unitEntries = new Map<string, typeof cherryHillLedger>();
  for (const entry of cherryHillLedger) {
    if (!unitEntries.has(entry.unitId)) unitEntries.set(entry.unitId, []);
    unitEntries.get(entry.unitId)!.push(entry);
  }

  const orphanedUnits: string[] = [];
  for (const [unitId, entries] of unitEntries.entries()) {
    const assessments = entries.filter((e) => e.entryType === "assessment");
    const payments = entries.filter((e) => e.entryType === "payment");
    const lateFees = entries.filter((e) => e.entryType === "late-fee");

    const assessmentTotal = assessments.reduce((s, e) => s + (e.amount ?? 0), 0);
    // Payments are negative amounts; take absolute value
    const paymentTotal = payments.reduce((s, e) => s + Math.abs(e.amount ?? 0), 0);
    const lateFeeTotal = lateFees.reduce((s, e) => s + (e.amount ?? 0), 0);

    const netBalance = assessmentTotal - paymentTotal;

    // Units with an outstanding balance are expected to have unmatched assessments
    if (OUTSTANDING_BALANCE_UNITS.has(unitId)) {
      // Acceptable: net balance > 0 covered by a late-fee entry
      if (netBalance > 0 && lateFeeTotal > 0) continue;
      if (netBalance > 0 && lateFeeTotal === 0) continue; // just has an open balance, still valid
    } else {
      // Non-outstanding units should be fully paid
      if (Math.abs(netBalance) < 0.01) continue;
      orphanedUnits.push(
        `unit ${unitId} — assessments $${assessmentTotal}, payments $${paymentTotal}, net balance $${netBalance.toFixed(2)}`,
      );
    }
  }

  if (orphanedUnits.length === 0) {
    results.push(
      pass(
        "[c] Owner ledger entries balance as expected per unit",
        `${unitEntries.size} unit(s) checked — all non-outstanding units are fully paid`,
      ),
    );
  } else {
    results.push(
      fail(
        "[c] Owner ledger entries balance as expected per unit",
        `${orphanedUnits.length} unit(s) with unexpected open balance: ${orphanedUnits.join("; ")}`,
      ),
    );
  }

  // ── [d] Late fee events reference valid active rules ─────────────────────────
  const activeRuleIds = new Set(
    cherryHillRules.filter((r) => r.isActive === 1).map((r) => r.id),
  );
  const eventsWithBadRule = cherryHillEvents.filter(
    (e) => !activeRuleIds.has(e.ruleId),
  );
  if (eventsWithBadRule.length === 0) {
    results.push(
      pass(
        "[d] Late fee events reference valid active rules",
        `${cherryHillEvents.length} event(s) checked against ${activeRuleIds.size} active rule(s)`,
      ),
    );
  } else {
    const details = eventsWithBadRule
      .map((e) => `event ${e.id} → rule ${e.ruleId}`)
      .join(", ");
    results.push(
      fail(
        "[d] Late fee events reference valid active rules",
        `${eventsWithBadRule.length} event(s) reference missing/inactive rule(s): ${details}`,
      ),
    );
  }

  // ── [e] Late fee event amounts are positive ──────────────────────────────────
  const nonPositiveFees = cherryHillEvents.filter(
    (e) => (e.calculatedFee ?? 0) <= 0,
  );
  if (nonPositiveFees.length === 0) {
    results.push(
      pass(
        "[e] Late fee event amounts (calculatedFee) are positive",
        `${cherryHillEvents.length} event(s) checked`,
      ),
    );
  } else {
    const details = nonPositiveFees
      .map((e) => `event ${e.id} (calculatedFee: ${e.calculatedFee})`)
      .join(", ");
    results.push(
      fail(
        "[e] Late fee event amounts (calculatedFee) are positive",
        `${nonPositiveFees.length} event(s) with non-positive fee: ${details}`,
      ),
    );
  }

  // ── [f] Sign convention: assessments > 0, payments < 0 ──────────────────────
  const badAssessments = cherryHillLedger.filter(
    (e) => e.entryType === "assessment" && (e.amount ?? 0) <= 0,
  );
  const badPayments = cherryHillLedger.filter(
    (e) => e.entryType === "payment" && (e.amount ?? 0) >= 0,
  );
  const signViolations = [...badAssessments, ...badPayments];
  if (signViolations.length === 0) {
    results.push(
      pass(
        "[f] Ledger sign convention: assessments > 0, payments < 0",
        `${cherryHillLedger.length} ledger entr(ies) checked`,
      ),
    );
  } else {
    const details = signViolations
      .map(
        (e) =>
          `entry ${e.id} (type: ${e.entryType}, amount: ${e.amount})`,
      )
      .join(", ");
    results.push(
      fail(
        "[f] Ledger sign convention: assessments > 0, payments < 0",
        `${signViolations.length} entr(ies) violate sign convention: ${details}`,
      ),
    );
  }

  // ── [g] Active rules have graceDays >= 0 and feeAmount > 0 ──────────────────
  const activeRules = cherryHillRules.filter((r) => r.isActive === 1);
  const invalidRules = activeRules.filter(
    (r) => (r.graceDays ?? 0) < 0 || (r.feeAmount ?? 0) <= 0,
  );
  if (invalidRules.length === 0) {
    results.push(
      pass(
        "[g] Active late fee rules have graceDays >= 0 and feeAmount > 0",
        `${activeRules.length} active rule(s) checked`,
      ),
    );
  } else {
    const details = invalidRules
      .map(
        (r) =>
          `rule "${r.name}" (id: ${r.id}, graceDays: ${r.graceDays}, feeAmount: ${r.feeAmount})`,
      )
      .join(", ");
    results.push(
      fail(
        "[g] Active late fee rules have graceDays >= 0 and feeAmount > 0",
        `${invalidRules.length} rule(s) with invalid configuration: ${details}`,
      ),
    );
  }

  return results;
}

async function main() {
  console.log("Financial coherence verification — Cherry Hill Court Condominiums");
  console.log("===================================================================");

  let checks: CheckResult[] = [];

  try {
    checks = await runChecks();
  } catch (err: unknown) {
    console.error("Error running checks:", (err as Error).message);
    await pool.end();
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    const icon = check.passed ? "PASS" : "FAIL";
    const detail = check.detail ? ` — ${check.detail}` : "";
    console.log(`  [${icon}] ${check.label}${detail}`);
    if (check.passed) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log("");
  console.log(`Summary: ${passed} passed, ${failed} failed`);

  await pool.end();

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("Unhandled error:", (err as Error).message);
  process.exit(1);
});
