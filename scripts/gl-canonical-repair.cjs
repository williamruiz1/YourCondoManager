#!/usr/bin/env node
/**
 * Audit or repair persisted owner-ledger GL journals against the current
 * canonical posting policy.
 *
 * Safe default:
 *   node scripts/gl-canonical-repair.cjs audit <association-id>
 *
 * Read-only release gate:
 *   node scripts/gl-canonical-repair.cjs assert <association-id>
 *
 * Separately authorized derived-GL repair:
 *   GL_REPAIR_APPROVAL_REF=<change-record> \
 *     node scripts/gl-canonical-repair.cjs repair <association-id> \
 *     --confirm-derived-gl-rebuild
 *
 * The repair never writes owner_ledger_entries, payments, protected balances,
 * or Stripe records. It replaces only non-canonical/missing GL legs derived
 * from the owner ledger, inside one transaction and one association-scoped
 * advisory lock. Output and audit evidence are aggregate-only.
 */

const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

const REQUIRED_CONFIRMATION = "--confirm-derived-gl-rebuild";
const VALID_MODES = new Set(["audit", "assert", "repair"]);

function accountKey(code, fund = "operating") {
  return `${code}\u0000${fund}`;
}

function legKey(leg) {
  return [
    leg.accountCode,
    leg.fund,
    leg.side,
    String(leg.amountCents),
  ].join("\u0000");
}

function sourceLegCounts(rows) {
  const counts = new Map();
  for (const row of rows) {
    const key = legKey(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function countDifference(left, right) {
  let total = 0;
  for (const [key, count] of left) {
    total += Math.max(0, count - (right.get(key) || 0));
  }
  return total;
}

function resolveAccount(accountByKey, code, fund = "operating") {
  const account = accountByKey.get(accountKey(code, fund));
  if (!account) {
    throw new Error(`required GL account is missing: code=${code} fund=${fund}`);
  }
  return account;
}

function makeLeg(accountByKey, accountCode, side, amountCents) {
  const fund = "operating";
  const account = resolveAccount(accountByKey, accountCode, fund);
  return {
    glAccountId: account.id,
    accountCode,
    fund,
    side,
    amountCents,
  };
}

/**
 * Mirrors server/services/gl/posting.ts postOwnerLedgerEntry. A parity test
 * prevents the operational repair tool from drifting away from runtime policy.
 */
function expectedLegsForLedgerRow(row, accountByKey) {
  if (!Number.isSafeInteger(row.amountCents)) {
    throw new Error("owner-ledger canonical cents are missing or invalid");
  }
  const magnitude = Math.abs(row.amountCents);
  if (magnitude === 0) return [];

  switch (row.entryType) {
    case "charge":
    case "late-fee":
      return [
        makeLeg(accountByKey, "1200", "debit", magnitude),
        makeLeg(accountByKey, "4000", "credit", magnitude),
      ];
    case "assessment":
      return [
        makeLeg(accountByKey, "1200", "debit", magnitude),
        makeLeg(accountByKey, "4200", "credit", magnitude),
      ];
    case "payment":
      return [
        makeLeg(accountByKey, "1010", "debit", magnitude),
        makeLeg(accountByKey, "1200", "credit", magnitude),
      ];
    case "credit":
      return [
        makeLeg(accountByKey, "4000", "debit", magnitude),
        makeLeg(accountByKey, "1200", "credit", magnitude),
      ];
    case "adjustment":
    default:
      return row.amountCents > 0
        ? [
            makeLeg(accountByKey, "1200", "debit", magnitude),
            makeLeg(accountByKey, "4900", "credit", magnitude),
          ]
        : [
            makeLeg(accountByKey, "4900", "debit", magnitude),
            makeLeg(accountByKey, "1200", "credit", magnitude),
          ];
  }
}

function buildExpectedJournals(ledgerRows, accountByKey) {
  const expected = new Map();
  for (const row of ledgerRows) {
    const legs = expectedLegsForLedgerRow(row, accountByKey);
    if (legs.length === 0) continue;
    expected.set(row.id, {
      sourceId: row.id,
      journalId: `oln-${row.id}`,
      postedAt: row.postedAt,
      description:
        row.description ||
        `${row.entryType} ${(row.amountCents / 100).toFixed(2)}`,
      legs,
    });
  }
  return expected;
}

function groupActualRows(actualRows) {
  const actual = new Map();
  for (const row of actualRows) {
    const rows = actual.get(row.sourceId) || [];
    rows.push(row);
    actual.set(row.sourceId, rows);
  }
  return actual;
}

function signedAccountBalance(rows, accountCode) {
  return rows
    .filter((row) => row.accountCode === accountCode)
    .reduce(
      (sum, row) =>
        sum + (row.side === "debit" ? row.amountCents : -row.amountCents),
      0,
    );
}

function flattenExpected(expected) {
  const rows = [];
  for (const journal of expected.values()) rows.push(...journal.legs);
  return rows;
}

function unbalancedJournalCount(actual) {
  let count = 0;
  for (const rows of actual.values()) {
    const net = rows.reduce(
      (sum, row) =>
        sum + (row.side === "debit" ? row.amountCents : -row.amountCents),
      0,
    );
    if (net !== 0) count += 1;
  }
  return count;
}

function compareExpectedToActual(expected, actualRows) {
  const actual = groupActualRows(actualRows);
  const affectedSourceIds = new Set();
  let exactJournalCount = 0;
  let missingJournalCount = 0;
  let unexpectedSourceCount = 0;
  let missingLegCount = 0;
  let unexpectedLegCount = 0;

  for (const [sourceId, actualLegs] of actual) {
    const expectedJournal = expected.get(sourceId);
    if (!expectedJournal) {
      unexpectedSourceCount += 1;
      unexpectedLegCount += actualLegs.length;
      affectedSourceIds.add(sourceId);
      continue;
    }

    const expectedCounts = sourceLegCounts(expectedJournal.legs);
    const actualCounts = sourceLegCounts(actualLegs);
    const missing = countDifference(expectedCounts, actualCounts);
    const unexpected = countDifference(actualCounts, expectedCounts);
    missingLegCount += missing;
    unexpectedLegCount += unexpected;
    if (missing === 0 && unexpected === 0) {
      exactJournalCount += 1;
    } else {
      affectedSourceIds.add(sourceId);
    }
  }

  for (const [sourceId, journal] of expected) {
    if (actual.has(sourceId)) continue;
    missingJournalCount += 1;
    missingLegCount += journal.legs.length;
    affectedSourceIds.add(sourceId);
  }

  const expectedRows = flattenExpected(expected);
  const expectedArCents = signedAccountBalance(expectedRows, "1200");
  const persistedArCents = signedAccountBalance(actualRows, "1200");
  const debitCents = actualRows
    .filter((row) => row.side === "debit")
    .reduce((sum, row) => sum + row.amountCents, 0);
  const creditCents = actualRows
    .filter((row) => row.side === "credit")
    .reduce((sum, row) => sum + row.amountCents, 0);
  const unbalancedJournals = unbalancedJournalCount(actual);
  const isExact =
    affectedSourceIds.size === 0 &&
    missingLegCount === 0 &&
    unexpectedLegCount === 0 &&
    expectedArCents === persistedArCents &&
    unbalancedJournals === 0;

  return {
    summary: {
      expectedJournalCount: expected.size,
      persistedJournalCount: actual.size,
      exactJournalCount,
      affectedJournalCount: affectedSourceIds.size,
      missingJournalCount,
      unexpectedSourceCount,
      missingLegCount,
      unexpectedLegCount,
      unbalancedJournalCount: unbalancedJournals,
      expectedArCents,
      persistedArCents,
      arDriftCents: persistedArCents - expectedArCents,
      persistedDebitCents: debitCents,
      persistedCreditCents: creditCents,
      corpusImbalanceCents: debitCents - creditCents,
      isExact,
    },
    affectedSourceIds,
  };
}

async function loadLedgerRows(client, associationId, forUpdate = false) {
  const lock = forUpdate ? " FOR UPDATE" : "";
  const result = await client.query(
    `SELECT id,
            entry_type AS "entryType",
            amount_cents AS "amountCents",
            posted_at AS "postedAt",
            description
       FROM owner_ledger_entries
      WHERE association_id = $1
      ORDER BY id${lock}`,
    [associationId],
  );
  return result.rows.map((row) => ({
    ...row,
    amountCents: Number(row.amountCents),
  }));
}

async function loadAccountMap(client, associationId) {
  const result = await client.query(
    `SELECT id, account_code AS "accountCode", fund::text AS fund
       FROM gl_accounts
      WHERE association_id = $1`,
    [associationId],
  );
  const map = new Map();
  for (const row of result.rows) {
    map.set(accountKey(row.accountCode, row.fund), row);
  }
  return map;
}

async function loadPersistedRows(client, associationId, forUpdate = false) {
  const lock = forUpdate ? " FOR UPDATE OF e" : "";
  const result = await client.query(
    `SELECT e.source_id AS "sourceId",
            e.journal_id AS "journalId",
            e.gl_account_id AS "glAccountId",
            a.account_code AS "accountCode",
            e.fund::text AS fund,
            e.side::text AS side,
            e.amount_cents AS "amountCents",
            e.posted_at AS "postedAt",
            e.description
       FROM gl_entries e
       JOIN gl_accounts a ON a.id = e.gl_account_id
      WHERE e.association_id = $1
        AND e.source_type = 'owner_ledger_entry'
      ORDER BY e.source_id, e.id${lock}`,
    [associationId],
  );
  return result.rows.map((row) => ({
    ...row,
    amountCents: Number(row.amountCents),
  }));
}

async function inspect(client, associationId, forUpdate = false) {
  const [ledgerRows, accountByKey, persistedRows] = await Promise.all([
    loadLedgerRows(client, associationId, forUpdate),
    loadAccountMap(client, associationId),
    loadPersistedRows(client, associationId, forUpdate),
  ]);
  const expected = buildExpectedJournals(ledgerRows, accountByKey);
  const comparison = compareExpectedToActual(expected, persistedRows);
  return { expected, ...comparison };
}

async function insertExpectedRows(client, associationId, expected, sourceIds) {
  const rows = [];
  for (const sourceId of sourceIds) {
    const journal = expected.get(sourceId);
    if (!journal) continue;
    for (const leg of journal.legs) {
      rows.push({
        associationId,
        journalId: journal.journalId,
        glAccountId: leg.glAccountId,
        fund: leg.fund,
        side: leg.side,
        amountCents: leg.amountCents,
        postedAt: journal.postedAt,
        description: journal.description,
        sourceType: "owner_ledger_entry",
        sourceId,
      });
    }
  }
  if (rows.length === 0) return 0;

  const columns = 10;
  const valuesSql = rows
    .map((_, rowIndex) => {
      const first = rowIndex * columns + 1;
      return `(${Array.from({ length: columns }, (_unused, columnIndex) => `$${first + columnIndex}`).join(",")})`;
    })
    .join(",");
  const params = rows.flatMap((row) => [
    row.associationId,
    row.journalId,
    row.glAccountId,
    row.fund,
    row.side,
    row.amountCents,
    row.postedAt,
    row.description,
    row.sourceType,
    row.sourceId,
  ]);

  const result = await client.query(
    `INSERT INTO gl_entries (
       association_id, journal_id, gl_account_id, fund, side, amount_cents,
       posted_at, description, source_type, source_id
     ) VALUES ${valuesSql}`,
    params,
  );
  return result.rowCount || 0;
}

async function repair(client, associationId, approvalRef) {
  const runId = randomUUID();
  await client.query("BEGIN");
  try {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('ycm-gl-canonical-repair'), hashtext($1))",
      [associationId],
    );
    const before = await inspect(client, associationId, true);
    if (before.summary.isExact) {
      await client.query("COMMIT");
      return {
        runId,
        deletedLegCount: 0,
        insertedLegCount: 0,
        before: before.summary,
        after: before.summary,
      };
    }

    const sourceIds = Array.from(before.affectedSourceIds);
    const deleted = await client.query(
      `DELETE FROM gl_entries
        WHERE association_id = $1
          AND source_type = 'owner_ledger_entry'
          AND source_id = ANY($2::text[])`,
      [associationId, sourceIds],
    );
    const insertedLegCount = await insertExpectedRows(
      client,
      associationId,
      before.expected,
      sourceIds,
    );
    const after = await inspect(client, associationId, false);
    if (!after.summary.isExact) {
      throw new Error("post-repair canonical GL assertion failed");
    }

    await client.query(
      `INSERT INTO audit_logs (
         actor_email, action, entity_type, entity_id, association_id,
         before_json, after_json
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
      [
        "system@ycm.internal",
        "gl-canonical-repair",
        "association-derived-gl",
        runId,
        associationId,
        JSON.stringify({
          runId,
          approvalRef,
          summary: before.summary,
        }),
        JSON.stringify({
          runId,
          approvalRef,
          deletedLegCount: deleted.rowCount || 0,
          insertedLegCount,
          summary: after.summary,
        }),
      ],
    );
    await client.query("COMMIT");
    return {
      runId,
      deletedLegCount: deleted.rowCount || 0,
      insertedLegCount,
      before: before.summary,
      after: after.summary,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  const mode = process.argv[2] || "audit";
  const associationId = process.argv[3] || process.env.GL_REPAIR_ASSOCIATION_ID;
  if (!VALID_MODES.has(mode)) {
    throw new Error("mode must be audit, assert, or repair");
  }
  if (!associationId) {
    throw new Error("association id is required");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  if (mode === "repair") {
    if (!process.argv.includes(REQUIRED_CONFIRMATION)) {
      throw new Error(`repair requires ${REQUIRED_CONFIRMATION}`);
    }
    if (!process.env.GL_REPAIR_APPROVAL_REF) {
      throw new Error("repair requires GL_REPAIR_APPROVAL_REF");
    }
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    if (mode === "repair") {
      const result = await repair(
        client,
        associationId,
        process.env.GL_REPAIR_APPROVAL_REF,
      );
      console.log(
        JSON.stringify(
          {
            mode,
            runId: result.runId,
            deletedLegCount: result.deletedLegCount,
            insertedLegCount: result.insertedLegCount,
            before: result.before,
            after: result.after,
          },
          null,
          2,
        ),
      );
      return;
    }

    const result = await inspect(client, associationId, false);
    console.log(JSON.stringify({ mode, summary: result.summary }, null, 2));
    if (mode === "assert" && !result.summary.isExact) {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

module.exports = {
  accountKey,
  expectedLegsForLedgerRow,
  buildExpectedJournals,
  compareExpectedToActual,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(`gl-canonical-repair failed: ${error.message}`);
    process.exit(1);
  });
}
