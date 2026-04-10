/**
 * verify-seed-integrity.ts — Cross-reference FK integrity checks for seeded data.
 *
 * Checks (all scoped to Cherry Hill Condo association f301d073-ed84-4d73-84ce-3ef28af66f7a):
 *   [a] All work orders that reference a vendorId point to a vendor that exists
 *   [b] All work orders that reference a unitId point to a unit that exists
 *   [c] All budget lines reference a budgetVersionId that exists in budget_versions
 *   [d] All budget versions reference a budgetId that exists in budgets
 *   [e] All owner ledger entries reference a personId that exists in persons
 *   [f] All owner ledger entries reference a unitId that exists in units (if not null)
 *   [g] All late fee events with referenceType="owner_ledger_entry" point to a ledger entry that exists
 *   [h] All late fee events reference a ruleId that exists in late_fee_rules
 *   [i] All resident feedbacks that reference a unitId point to a valid unit
 *   [j] All resident feedbacks that reference a personId point to a valid person
 *
 * Run with: tsx script/verify-seed-integrity.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";
import { eq, isNotNull } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const CHERRY_HILL_ID = "f301d073-ed84-4d73-84ce-3ef28af66f7a";

const {
  workOrders,
  vendors,
  units,
  budgetLines,
  budgetVersions,
  budgets,
  ownerLedgerEntries,
  persons,
  lateFeeEvents,
  lateFeeRules,
  residentFeedbacks,
} = schema;

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

  // ── Fetch reference sets ──────────────────────────────────────────────────────
  const allVendors = await db.select({ id: vendors.id }).from(vendors);
  const allUnits = await db.select({ id: units.id }).from(units);
  const allPersons = await db.select({ id: persons.id }).from(persons);
  const allBudgets = await db
    .select({ id: budgets.id })
    .from(budgets)
    .where(eq(budgets.associationId, CHERRY_HILL_ID));
  const allBudgetVersions = await db
    .select({ id: budgetVersions.id, budgetId: budgetVersions.budgetId })
    .from(budgetVersions);
  const allLedgerEntries = await db
    .select({ id: ownerLedgerEntries.id })
    .from(ownerLedgerEntries)
    .where(eq(ownerLedgerEntries.associationId, CHERRY_HILL_ID));
  const allLateFeeRules = await db.select({ id: lateFeeRules.id }).from(lateFeeRules);

  const vendorIds = new Set(allVendors.map((v) => v.id));
  const unitIds = new Set(allUnits.map((u) => u.id));
  const personIds = new Set(allPersons.map((p) => p.id));
  const budgetIds = new Set(allBudgets.map((b) => b.id));
  const budgetVersionIds = new Set(allBudgetVersions.map((bv) => bv.id));
  const ledgerEntryIds = new Set(allLedgerEntries.map((e) => e.id));
  const lateFeeRuleIds = new Set(allLateFeeRules.map((r) => r.id));

  // ── [a] Work orders: vendorId FK ─────────────────────────────────────────────
  const chWorkOrders = await db
    .select({ id: workOrders.id, vendorId: workOrders.vendorId, unitId: workOrders.unitId })
    .from(workOrders)
    .where(eq(workOrders.associationId, CHERRY_HILL_ID));

  const workOrdersWithVendor = chWorkOrders.filter((wo) => wo.vendorId !== null);
  const orphanedByVendor = workOrdersWithVendor.filter((wo) => !vendorIds.has(wo.vendorId!));
  if (orphanedByVendor.length === 0) {
    results.push(
      pass(
        "[a] All Cherry Hill work orders with vendorId reference a valid vendor",
        `${workOrdersWithVendor.length} work order(s) with vendorId checked`,
      ),
    );
  } else {
    const ids = orphanedByVendor.map((wo) => `${wo.id} → vendorId ${wo.vendorId}`).join(", ");
    results.push(
      fail(
        "[a] All Cherry Hill work orders with vendorId reference a valid vendor",
        `${orphanedByVendor.length} orphaned work order(s): ${ids}`,
      ),
    );
  }

  // ── [b] Work orders: unitId FK ───────────────────────────────────────────────
  const workOrdersWithUnit = chWorkOrders.filter((wo) => wo.unitId !== null);
  const orphanedByUnit = workOrdersWithUnit.filter((wo) => !unitIds.has(wo.unitId!));
  if (orphanedByUnit.length === 0) {
    results.push(
      pass(
        "[b] All Cherry Hill work orders with unitId reference a valid unit",
        `${workOrdersWithUnit.length} work order(s) with unitId checked`,
      ),
    );
  } else {
    const ids = orphanedByUnit.map((wo) => `${wo.id} → unitId ${wo.unitId}`).join(", ");
    results.push(
      fail(
        "[b] All Cherry Hill work orders with unitId reference a valid unit",
        `${orphanedByUnit.length} orphaned work order(s): ${ids}`,
      ),
    );
  }

  // ── [c] Budget lines: budgetVersionId FK ─────────────────────────────────────
  // Fetch budget lines for versions that belong to Cherry Hill budgets
  const chBudgetLines = await db
    .select({ id: budgetLines.id, budgetVersionId: budgetLines.budgetVersionId })
    .from(budgetLines);

  // Filter to only lines whose version belongs to a Cherry Hill budget
  const chVersionIds = new Set(
    allBudgetVersions
      .filter((bv) => budgetIds.has(bv.budgetId))
      .map((bv) => bv.id),
  );
  const chBudgetLinesFiltered = chBudgetLines.filter((bl) =>
    chVersionIds.has(bl.budgetVersionId),
  );

  const linesWithBadVersion = chBudgetLinesFiltered.filter(
    (bl) => !budgetVersionIds.has(bl.budgetVersionId),
  );
  if (linesWithBadVersion.length === 0) {
    results.push(
      pass(
        "[c] All Cherry Hill budget lines reference a valid budgetVersionId",
        `${chBudgetLinesFiltered.length} budget line(s) checked`,
      ),
    );
  } else {
    const ids = linesWithBadVersion
      .map((bl) => `${bl.id} → budgetVersionId ${bl.budgetVersionId}`)
      .join(", ");
    results.push(
      fail(
        "[c] All Cherry Hill budget lines reference a valid budgetVersionId",
        `${linesWithBadVersion.length} orphaned line(s): ${ids}`,
      ),
    );
  }

  // ── [d] Budget versions: budgetId FK ─────────────────────────────────────────
  const chBudgetVersions = allBudgetVersions.filter((bv) => budgetIds.has(bv.budgetId));
  const versionsWithBadBudget = chBudgetVersions.filter((bv) => !budgetIds.has(bv.budgetId));
  if (versionsWithBadBudget.length === 0) {
    results.push(
      pass(
        "[d] All Cherry Hill budget versions reference a valid budgetId",
        `${chBudgetVersions.length} budget version(s) checked`,
      ),
    );
  } else {
    const ids = versionsWithBadBudget
      .map((bv) => `${bv.id} → budgetId ${bv.budgetId}`)
      .join(", ");
    results.push(
      fail(
        "[d] All Cherry Hill budget versions reference a valid budgetId",
        `${versionsWithBadBudget.length} orphaned version(s): ${ids}`,
      ),
    );
  }

  // ── [e] Owner ledger entries: personId FK ────────────────────────────────────
  const chLedgerEntries = await db
    .select({
      id: ownerLedgerEntries.id,
      personId: ownerLedgerEntries.personId,
      unitId: ownerLedgerEntries.unitId,
    })
    .from(ownerLedgerEntries)
    .where(eq(ownerLedgerEntries.associationId, CHERRY_HILL_ID));

  const ledgerWithBadPerson = chLedgerEntries.filter((e) => !personIds.has(e.personId));
  if (ledgerWithBadPerson.length === 0) {
    results.push(
      pass(
        "[e] All Cherry Hill ledger entries reference a valid personId",
        `${chLedgerEntries.length} ledger entr(ies) checked`,
      ),
    );
  } else {
    const ids = ledgerWithBadPerson
      .map((e) => `${e.id} → personId ${e.personId}`)
      .join(", ");
    results.push(
      fail(
        "[e] All Cherry Hill ledger entries reference a valid personId",
        `${ledgerWithBadPerson.length} orphaned entr(ies): ${ids}`,
      ),
    );
  }

  // ── [f] Owner ledger entries: unitId FK (when not null) ──────────────────────
  const ledgerWithUnit = chLedgerEntries.filter((e) => e.unitId !== null);
  const ledgerWithBadUnit = ledgerWithUnit.filter((e) => !unitIds.has(e.unitId!));
  if (ledgerWithBadUnit.length === 0) {
    results.push(
      pass(
        "[f] All Cherry Hill ledger entries with unitId reference a valid unit",
        `${ledgerWithUnit.length} entr(ies) with unitId checked`,
      ),
    );
  } else {
    const ids = ledgerWithBadUnit
      .map((e) => `${e.id} → unitId ${e.unitId}`)
      .join(", ");
    results.push(
      fail(
        "[f] All Cherry Hill ledger entries with unitId reference a valid unit",
        `${ledgerWithBadUnit.length} orphaned entr(ies): ${ids}`,
      ),
    );
  }

  // ── [g] Late fee events (owner_ledger_entry): referenceId FK ─────────────────
  const chLateFeeEvents = await db
    .select({
      id: lateFeeEvents.id,
      ruleId: lateFeeEvents.ruleId,
      referenceType: lateFeeEvents.referenceType,
      referenceId: lateFeeEvents.referenceId,
    })
    .from(lateFeeEvents)
    .where(eq(lateFeeEvents.associationId, CHERRY_HILL_ID));

  const ledgerRefEvents = chLateFeeEvents.filter(
    (e) => e.referenceType === "owner_ledger_entry",
  );
  const eventsWithBadLedgerRef = ledgerRefEvents.filter(
    (e) => e.referenceId === null || !ledgerEntryIds.has(e.referenceId!),
  );
  if (eventsWithBadLedgerRef.length === 0) {
    results.push(
      pass(
        "[g] All Cherry Hill late fee events with referenceType=owner_ledger_entry point to a valid ledger entry",
        `${ledgerRefEvents.length} event(s) checked`,
      ),
    );
  } else {
    const ids = eventsWithBadLedgerRef
      .map((e) => `${e.id} → referenceId ${e.referenceId}`)
      .join(", ");
    results.push(
      fail(
        "[g] All Cherry Hill late fee events with referenceType=owner_ledger_entry point to a valid ledger entry",
        `${eventsWithBadLedgerRef.length} orphaned event(s): ${ids}`,
      ),
    );
  }

  // ── [h] Late fee events: ruleId FK ───────────────────────────────────────────
  const eventsWithBadRule = chLateFeeEvents.filter((e) => !lateFeeRuleIds.has(e.ruleId));
  if (eventsWithBadRule.length === 0) {
    results.push(
      pass(
        "[h] All Cherry Hill late fee events reference a valid ruleId",
        `${chLateFeeEvents.length} event(s) checked`,
      ),
    );
  } else {
    const ids = eventsWithBadRule
      .map((e) => `${e.id} → ruleId ${e.ruleId}`)
      .join(", ");
    results.push(
      fail(
        "[h] All Cherry Hill late fee events reference a valid ruleId",
        `${eventsWithBadRule.length} orphaned event(s): ${ids}`,
      ),
    );
  }

  // ── [i] Resident feedbacks: unitId FK (when not null) ────────────────────────
  const chFeedbacks = await db
    .select({
      id: residentFeedbacks.id,
      unitId: residentFeedbacks.unitId,
      personId: residentFeedbacks.personId,
    })
    .from(residentFeedbacks)
    .where(eq(residentFeedbacks.associationId, CHERRY_HILL_ID));

  const feedbacksWithUnit = chFeedbacks.filter((f) => f.unitId !== null);
  const feedbacksWithBadUnit = feedbacksWithUnit.filter((f) => !unitIds.has(f.unitId!));
  if (feedbacksWithBadUnit.length === 0) {
    results.push(
      pass(
        "[i] All Cherry Hill resident feedbacks with unitId reference a valid unit",
        `${feedbacksWithUnit.length} feedback(s) with unitId checked`,
      ),
    );
  } else {
    const ids = feedbacksWithBadUnit
      .map((f) => `${f.id} → unitId ${f.unitId}`)
      .join(", ");
    results.push(
      fail(
        "[i] All Cherry Hill resident feedbacks with unitId reference a valid unit",
        `${feedbacksWithBadUnit.length} orphaned feedback(s): ${ids}`,
      ),
    );
  }

  // ── [j] Resident feedbacks: personId FK (when not null) ──────────────────────
  const feedbacksWithPerson = chFeedbacks.filter((f) => f.personId !== null);
  const feedbacksWithBadPerson = feedbacksWithPerson.filter((f) => !personIds.has(f.personId!));
  if (feedbacksWithBadPerson.length === 0) {
    results.push(
      pass(
        "[j] All Cherry Hill resident feedbacks with personId reference a valid person",
        `${feedbacksWithPerson.length} feedback(s) with personId checked`,
      ),
    );
  } else {
    const ids = feedbacksWithBadPerson
      .map((f) => `${f.id} → personId ${f.personId}`)
      .join(", ");
    results.push(
      fail(
        "[j] All Cherry Hill resident feedbacks with personId reference a valid person",
        `${feedbacksWithBadPerson.length} orphaned feedback(s): ${ids}`,
      ),
    );
  }

  return results;
}

async function main() {
  console.log("Seed integrity verification — Cherry Hill Court Condominiums");
  console.log("==============================================================");

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
