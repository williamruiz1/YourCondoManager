#!/usr/bin/env node
/**
 * scripts/check-money-migrations.cjs — money-table migration review guard
 * (founder-os#10739, audit findings A-REL-004 / CQ-005).
 *
 * WHY: Drizzle migrations here are forward-only (no down-migration) and
 * `release_command` auto-applies them to the LIVE Cherry Hill ledger on every
 * deploy. A destructive change to a money table (DROP COLUMN/TABLE, a column
 * TYPE change, DROP NOT NULL) can silently damage data-shape with no automated
 * revert. This guard makes such a migration REQUIRE an explicit human review
 * marker before it can ship — an additive column/table is unaffected.
 *
 * WHAT it does: for the migration `.sql` files ADDED in this push (git diff
 * BASE..HEAD), scan for destructive DDL against a money table. If any is found
 * and the change is NOT marked reviewed, exit 1 (blocks the deploy pipeline).
 *
 * Marked reviewed = any commit message in BASE..HEAD contains
 * `[money-migration-reviewed]`, OR env MONEY_MIGRATION_REVIEWED=1.
 *
 * Refs: BASE from env GUARD_BASE / GITHUB_EVENT_BEFORE, HEAD from GUARD_HEAD /
 * GITHUB_SHA; default HEAD~1..HEAD. Additive-only pushes exit 0 immediately.
 */
"use strict";
const { execSync } = require("node:child_process");

const MONEY_TABLES = [
  "owner_ledger_entries",
  "payment_transactions",
  "special_assessments",
  "utility_payments",
  "bank_statement_transactions",
  "bank_transactions",
  "payments",
  "assessments",
  "payment_methods",
  "autopay_enrollments",
];

// Destructive DDL patterns against a money table (case-insensitive). Additive
// (CREATE TABLE / ADD COLUMN / CREATE INDEX) is intentionally NOT matched.
function destructiveHits(sql, table) {
  const t = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pats = [
    new RegExp(`drop\\s+table\\s+(if\\s+exists\\s+)?"?${t}"?`, "i"),
    new RegExp(`alter\\s+table\\s+"?${t}"?[^;]*?\\bdrop\\s+column\\b`, "is"),
    new RegExp(`alter\\s+table\\s+"?${t}"?[^;]*?\\balter\\s+column\\b[^;]*?\\b(type|set\\s+data\\s+type|drop\\s+not\\s+null)\\b`, "is"),
    new RegExp(`alter\\s+table\\s+"?${t}"?[^;]*?\\brename\\s+column\\b`, "is"),
    new RegExp(`truncate\\s+(table\\s+)?"?${t}"?`, "i"),
  ];
  return pats.some((p) => p.test(sql));
}

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}
function shSafe(cmd) {
  try { return sh(cmd); } catch { return ""; }
}

// Only top-level SQL files are forward migrations consumed by migrate.cjs.
// Operational rollback files live under migrations/rollback/ and are invoked
// manually; scanning them as deploy inputs creates a false production block.
function isForwardMigrationPath(file) {
  return /^migrations\/[^/]+\.sql$/.test(file);
}

function main() {
  const head = process.env.GUARD_HEAD || process.env.GITHUB_SHA || "HEAD";
  let base = process.env.GUARD_BASE || process.env.GITHUB_EVENT_BEFORE || "";
  // A first-push / zero sha → fall back to HEAD~1.
  if (!base || /^0{40}$/.test(base)) base = `${head}~1`;

  const range = `${base}..${head}`;
  const changed = shSafe(`git diff --name-only --diff-filter=A ${range} -- migrations/`)
    .split("\n").map((s) => s.trim()).filter(isForwardMigrationPath);

  if (changed.length === 0) {
    console.log(`[money-migration-guard] no new migrations added in ${range} — nothing to review. PASS.`);
    return process.exit(0);
  }

  const findings = [];
  for (const file of changed) {
    const sql = shSafe(`git show ${head}:${file}`);
    if (!sql) continue;
    for (const table of MONEY_TABLES) {
      if (destructiveHits(sql, table)) findings.push({ file, table });
    }
  }

  if (findings.length === 0) {
    console.log(`[money-migration-guard] ${changed.length} new migration(s), no destructive money-table DDL. PASS.`);
    console.log(changed.map((f) => `  + ${f}`).join("\n"));
    return process.exit(0);
  }

  const commits = shSafe(`git log --format=%B ${range}`);
  const reviewed = process.env.MONEY_MIGRATION_REVIEWED === "1" || /\[money-migration-reviewed\]/i.test(commits);

  console.log(`[money-migration-guard] DESTRUCTIVE money-table DDL detected:`);
  for (const f of findings) console.log(`  ⚠ ${f.file} → ${f.table}`);

  if (reviewed) {
    console.log(`[money-migration-guard] marked reviewed ([money-migration-reviewed] present) — allowing. PASS.`);
    return process.exit(0);
  }

  console.error(`\n[money-migration-guard] BLOCKED. A migration changes an existing money table's shape on the live ledger.`);
  console.error(`This is a William-ratify gate (money-safety). After human review, add [money-migration-reviewed] to a`);
  console.error(`commit message in this push (or set MONEY_MIGRATION_REVIEWED=1 on a workflow_dispatch) to proceed.`);
  return process.exit(1);
}

if (require.main === module) main();

module.exports = { destructiveHits, isForwardMigrationPath };
