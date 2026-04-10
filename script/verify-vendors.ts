/**
 * verify-vendors.ts — Data integrity checks for the vendors table.
 *
 * Checks:
 *   [a] At least 1 active vendor exists
 *   [b] All vendors have a non-empty name and trade
 *   [c] At least 2 distinct trades represented
 *   [d] No duplicate vendor names within the same association
 *   [e] Vendors with contact email have valid email format
 *   [f] All vendors reference a valid association ID
 *
 * Run with: tsx script/verify-vendors.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";
import { eq } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const { vendors, associations } = schema;

const EMAIL_RE = /.+@.+\..+/;

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

  const allVendors = await db.select().from(vendors);

  if (allVendors.length === 0) {
    results.push(fail("[a] At least 1 active vendor exists", "No vendors found in database"));
    results.push(fail("[b] All vendors have non-empty name and trade", "No vendors to check"));
    results.push(fail("[c] At least 2 distinct trades represented", "No vendors to check"));
    results.push(fail("[d] No duplicate vendor names within same association", "No vendors to check"));
    results.push(pass("[e] Vendors with contact email have valid email format", "No vendors to check"));
    results.push(fail("[f] All vendors reference a valid association ID", "No vendors to check"));
    return results;
  }

  // [a] At least 1 active vendor exists
  const activeVendors = allVendors.filter((v) => v.status === "active");
  if (activeVendors.length > 0) {
    results.push(pass("[a] At least 1 active vendor exists", `${activeVendors.length} active vendor(s) found`));
  } else {
    results.push(fail("[a] At least 1 active vendor exists", `0 active vendors — all ${allVendors.length} vendor(s) are inactive or pending-renewal`));
  }

  // [b] All vendors have a non-empty name and trade
  const missingNameOrTrade = allVendors.filter((v) => !v.name?.trim() || !v.trade?.trim());
  if (missingNameOrTrade.length === 0) {
    results.push(pass("[b] All vendors have non-empty name and trade", `${allVendors.length} vendor(s) checked`));
  } else {
    const ids = missingNameOrTrade.map((v) => v.id).join(", ");
    results.push(fail("[b] All vendors have non-empty name and trade", `${missingNameOrTrade.length} vendor(s) missing name or trade: ${ids}`));
  }

  // [c] At least 2 distinct trades represented
  const trades = new Set(allVendors.map((v) => v.trade?.trim()).filter(Boolean));
  if (trades.size >= 2) {
    results.push(pass("[c] At least 2 distinct trades represented", `${trades.size} trade(s): ${Array.from(trades).sort().join(", ")}`));
  } else {
    results.push(fail("[c] At least 2 distinct trades represented", `Only ${trades.size} trade(s) found: ${Array.from(trades).join(", ") || "(none)"}`));
  }

  // [d] No duplicate vendor names within the same association
  const seenKeys = new Map<string, string[]>();
  for (const v of allVendors) {
    const key = `${v.associationId}::${v.name?.trim().toLowerCase()}`;
    if (!seenKeys.has(key)) seenKeys.set(key, []);
    seenKeys.get(key)!.push(v.id);
  }
  const duplicates = Array.from(seenKeys.entries()).filter(([, ids]) => ids.length > 1);
  if (duplicates.length === 0) {
    results.push(pass("[d] No duplicate vendor names within same association", `${allVendors.length} vendor(s) checked`));
  } else {
    const details = duplicates
      .map(([key, ids]) => {
        const [assocId, name] = key.split("::");
        return `"${name}" in association ${assocId} (ids: ${ids.join(", ")})`;
      })
      .join("; ");
    results.push(fail("[d] No duplicate vendor names within same association", `${duplicates.length} duplicate(s): ${details}`));
  }

  // [e] Vendors with contact email have valid email format
  const vendorsWithEmail = allVendors.filter((v) => v.primaryEmail?.trim());
  const invalidEmails = vendorsWithEmail.filter((v) => !EMAIL_RE.test(v.primaryEmail!.trim()));
  if (invalidEmails.length === 0) {
    results.push(pass("[e] Vendors with contact email have valid email format", `${vendorsWithEmail.length} email(s) checked`));
  } else {
    const details = invalidEmails
      .map((v) => `"${v.primaryEmail}" (id: ${v.id})`)
      .join(", ");
    results.push(fail("[e] Vendors with contact email have valid email format", `${invalidEmails.length} invalid email(s): ${details}`));
  }

  // [f] All vendors reference a valid association ID
  const allAssociations = await db.select({ id: associations.id }).from(associations);
  const validAssocIds = new Set(allAssociations.map((a) => a.id));
  const orphanedVendors = allVendors.filter((v) => !validAssocIds.has(v.associationId));
  if (orphanedVendors.length === 0) {
    results.push(pass("[f] All vendors reference a valid association ID", `${allVendors.length} vendor(s) checked against ${validAssocIds.size} association(s)`));
  } else {
    const details = orphanedVendors
      .map((v) => `"${v.name}" (id: ${v.id}, associationId: ${v.associationId})`)
      .join(", ");
    results.push(fail("[f] All vendors reference a valid association ID", `${orphanedVendors.length} vendor(s) with invalid association: ${details}`));
  }

  return results;
}

async function main() {
  console.log("Vendors data verification");
  console.log("=========================");

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
