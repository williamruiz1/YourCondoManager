/**
 * Bank-feed sync engine — Plaid transactions fetch + per-connection reconcile
 * (founder-os#2478).
 *
 * Historically the 5-min automation sweep had no bank-feed step, the Plaid
 * webhook handler dropped SYNC_UPDATES_AVAILABLE with a TODO comment, and
 * `bank_connections.last_synced_at` stayed NULL despite repeated webhook hits.
 * This service is the central pump that turns those signals into actual rows.
 *
 * Three entry points share the same `syncOneConnection` core:
 *   - runBankFeedSweep()           — called by the 5-min automation sweep;
 *                                    picks every connection past its
 *                                    staleness threshold and syncs each.
 *   - syncBankFeedForItemId(...)   — called by the Plaid webhook handler;
 *                                    resolves item_id → connection and syncs
 *                                    that one immediately (debounced).
 *   - syncBankFeedForConnection(...) — called by the admin manual button;
 *                                      bypasses staleness gate, still
 *                                      respects the advisory lock.
 *
 * Concurrency model:
 *   - Per-connection Postgres advisory lock (pg_try_advisory_lock) — two
 *     concurrent runs for the same connection acquire-skip; the loser
 *     returns immediately without writing duplicate sync_runs rows.
 *   - Per-item_id in-memory debounce (1 min) for the webhook path — Plaid
 *     can fire SYNC_UPDATES_AVAILABLE in bursts; we coalesce.
 *
 * Audit trail: every attempt (success / lock-collision / error) writes a
 * `bank_feed_sync_runs` row with started_at + finished_at + counts + error.
 * Sole exception is the debounced webhook bursts that never start a run.
 */
import { and, eq, isNull, or, lt, sql } from "drizzle-orm";
import { db, pool } from "../db";
import {
  bankAccounts,
  bankConnections,
  bankFeedSyncRuns,
  bankTransactions,
  type BankConnection,
} from "@shared/schema";
import { bankFeedProvider } from "./bank-feed";
import { decryptPlaidToken } from "./bank-feed/token-crypto";
import { reconcileBankTransactions } from "./plaid-reconciliation";
import { log } from "../logger";

// Connections older than this are picked up by the sweep. Webhook + manual
// paths bypass this gate.
const STALENESS_MS = Number(process.env.BANK_FEED_SYNC_STALENESS_MS || 15 * 60 * 1000);

// Transactions horizon: how far back the sync looks when calling
// /transactions/get. Plaid's /transactions/sync would be more efficient at
// scale, but the existing PlaidProvider.getTransactions(since) interface is
// what's wired today — keep that contract and pull the last 30 days.
const SYNC_LOOKBACK_DAYS = Number(process.env.BANK_FEED_SYNC_LOOKBACK_DAYS || 30);

// Per-item_id webhook debounce window. Plaid can fire SYNC_UPDATES_AVAILABLE
// repeatedly in a burst; we coalesce to at most one sync per minute per item.
// Manual button + sweep paths are NOT debounced — only the webhook.
const WEBHOOK_DEBOUNCE_MS = Number(process.env.BANK_FEED_WEBHOOK_DEBOUNCE_MS || 60_000);

// Postgres advisory-lock namespace (first arg of pg_try_advisory_lock). The
// second arg is a stable hash of the connection_id. Pick an unused number;
// 0x42434653 = "BCFS" (Bank Connection Feed Sync). 32-bit signed.
const ADVISORY_LOCK_NAMESPACE = 0x42434653;

// In-memory debounce map. Singleton-process assumption: YCM runs as one
// Fly machine in production today. If we scale horizontally, this needs to
// move to Redis or a Postgres row — but the per-connection advisory lock
// would still keep things correct (debounce is a perf hint, not correctness).
const lastWebhookSyncByItemId = new Map<string, number>();

export type SyncOneResult = {
  connectionId: string;
  associationId: string;
  trigger: "sweep" | "webhook" | "manual";
  transactionsImported: number;
  matchesMade: number;
  unmatchedCount: number;
  durationMs: number;
  skipped?: "lock-collision" | "debounced";
  error?: string;
};

export type SweepResult = {
  scanned: number;
  synced: number;
  skipped: number;
  failed: number;
  totalTransactions: number;
  totalMatches: number;
};

/**
 * Compute a stable 32-bit signed integer from a connection-id varchar so we
 * can pass it as the second arg to pg_try_advisory_lock(int, int). Postgres
 * advisory locks take two int4 args; the second is the per-connection key.
 *
 * Drizzle's `sql` template handles the hash inline against the column.
 */
function lockKeyForConnection(connectionId: string): string {
  // hashtext returns int4; we use it inline in the SQL below.
  return connectionId;
}

/**
 * Acquire the per-connection advisory lock for the duration of `fn`. Returns
 * { acquired: false } if another caller holds the lock — caller decides
 * whether to skip or retry. The release is unconditional in `finally`.
 */
async function withConnectionLock<T>(
  connectionId: string,
  fn: () => Promise<T>,
): Promise<{ acquired: true; value: T } | { acquired: false }> {
  const client = await pool.connect();
  try {
    const acquired = await client.query<{ locked: boolean }>(
      `SELECT pg_try_advisory_lock($1, hashtext($2)) AS locked`,
      [ADVISORY_LOCK_NAMESPACE, lockKeyForConnection(connectionId)],
    );
    if (!acquired.rows[0]?.locked) {
      return { acquired: false };
    }
    try {
      const value = await fn();
      return { acquired: true, value };
    } finally {
      await client.query(
        `SELECT pg_advisory_unlock($1, hashtext($2))`,
        [ADVISORY_LOCK_NAMESPACE, lockKeyForConnection(connectionId)],
      );
    }
  } finally {
    client.release();
  }
}

/**
 * Core: pull transactions for one connection, upsert them, then run the
 * association-scoped auto-matcher. Writes one bank_feed_sync_runs row.
 *
 * Caller is responsible for the advisory lock; this fn assumes it holds it.
 */
async function syncOneConnectionLocked(
  conn: BankConnection,
  trigger: "sweep" | "webhook" | "manual",
): Promise<SyncOneResult> {
  const startedAt = new Date();
  const startTime = Date.now();

  const [runRow] = await db
    .insert(bankFeedSyncRuns)
    .values({
      connectionId: conn.id,
      associationId: conn.associationId,
      trigger,
      startedAt,
    })
    .returning({ id: bankFeedSyncRuns.id });

  let transactionsImported = 0;
  let matchesMade = 0;
  let unmatchedCount = 0;
  let errorMessage: string | null = null;

  try {
    const accessToken = decryptPlaidToken(conn.accessTokenEncrypted);
    const sinceDate = new Date(Date.now() - SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    // Refresh account balances + record lastSyncedAt on each account.
    const accountSnapshots = await bankFeedProvider.getAccounts(accessToken);
    for (const acct of accountSnapshots) {
      await db
        .update(bankAccounts)
        .set({
          currentBalanceCents: acct.currentBalanceCents,
          availableBalanceCents: acct.availableBalanceCents,
          lastSyncedAt: new Date(),
        })
        .where(
          and(
            eq(bankAccounts.associationId, conn.associationId),
            eq(bankAccounts.providerAccountId, acct.providerAccountId),
          ),
        );
    }

    // Fetch + upsert transactions.
    const txns = await bankFeedProvider.getTransactions(accessToken, sinceDate);
    const dbAccounts = await db
      .select({ id: bankAccounts.id, providerAccountId: bankAccounts.providerAccountId })
      .from(bankAccounts)
      .where(eq(bankAccounts.bankConnectionId, conn.id));
    const accountIdMap = new Map(dbAccounts.map((a) => [a.providerAccountId, a.id]));

    for (const txn of txns) {
      const bankAccountId = accountIdMap.get(txn.providerAccountId);
      if (!bankAccountId) continue;

      const inserted = await db
        .insert(bankTransactions)
        .values({
          bankAccountId,
          associationId: conn.associationId,
          providerTransactionId: txn.providerTransactionId,
          amountCents: txn.amountCents,
          isoCurrencyCode: txn.isoCurrencyCode,
          date: txn.date,
          name: txn.name,
          merchantName: txn.merchantName,
          category: txn.category,
          pending: txn.pending ? 1 : 0,
        })
        .onConflictDoNothing()
        .returning({ id: bankTransactions.id });

      if (inserted.length > 0) transactionsImported++;
    }

    // Stamp last_synced_at on the connection — this is the load-bearing
    // observability signal ("did the sync engine actually run for Cherry
    // Hill?"). Bumped on success only.
    await db
      .update(bankConnections)
      .set({ lastSyncedAt: new Date() })
      .where(eq(bankConnections.id, conn.id));

    // Auto-reconcile: run the association-scoped matcher.
    const recon = await reconcileBankTransactions(conn.associationId);
    matchesMade = recon.matched.length;
    unmatchedCount = recon.unmatchedCreditIds.length;
  } catch (err: any) {
    errorMessage = (err?.message ?? String(err)).slice(0, 500);
    log(
      `[bank-feed-sync] connection=${conn.id} trigger=${trigger} err=${errorMessage}`,
      "bank-feed-sync",
    );
  }

  const finishedAt = new Date();
  await db
    .update(bankFeedSyncRuns)
    .set({
      finishedAt,
      transactionsImported,
      matchesMade,
      unmatchedCount,
      error: errorMessage,
    })
    .where(eq(bankFeedSyncRuns.id, runRow.id));

  const result: SyncOneResult = {
    connectionId: conn.id,
    associationId: conn.associationId,
    trigger,
    transactionsImported,
    matchesMade,
    unmatchedCount,
    durationMs: Date.now() - startTime,
  };
  if (errorMessage) result.error = errorMessage;

  log(
    `[bank-feed-sync] connection=${conn.id} trigger=${trigger} txns=${transactionsImported} matches=${matchesMade} unmatched=${unmatchedCount} ms=${result.durationMs}${errorMessage ? ` err=${errorMessage}` : ""}`,
    "bank-feed-sync",
  );

  return result;
}

/**
 * Acquire the advisory lock + invoke `syncOneConnectionLocked`. If the lock
 * is unavailable (another run is in flight for this connection), returns
 * `skipped: "lock-collision"` and writes NO sync_runs row — the in-flight
 * run is already going to write one.
 */
export async function syncOneConnection(
  conn: BankConnection,
  trigger: "sweep" | "webhook" | "manual",
): Promise<SyncOneResult> {
  const locked = await withConnectionLock(conn.id, () => syncOneConnectionLocked(conn, trigger));
  if (!locked.acquired) {
    return {
      connectionId: conn.id,
      associationId: conn.associationId,
      trigger,
      transactionsImported: 0,
      matchesMade: 0,
      unmatchedCount: 0,
      durationMs: 0,
      skipped: "lock-collision",
    };
  }
  return locked.value;
}

/**
 * Look up a connection by id; null if not found.
 */
async function loadConnectionById(connectionId: string): Promise<BankConnection | null> {
  const [conn] = await db
    .select()
    .from(bankConnections)
    .where(eq(bankConnections.id, connectionId))
    .limit(1);
  return conn ?? null;
}

/**
 * Look up a connection by its Plaid item_id; null if not found. Used by the
 * webhook path — Plaid identifies the item, we resolve to the row.
 */
async function loadConnectionByItemId(itemId: string): Promise<BankConnection | null> {
  const [conn] = await db
    .select()
    .from(bankConnections)
    .where(eq(bankConnections.providerItemId, itemId))
    .limit(1);
  return conn ?? null;
}

/**
 * Manual + admin-button entry: sync one connection regardless of staleness.
 * No debounce. Per-connection lock still respected.
 */
export async function syncBankFeedForConnection(
  connectionId: string,
  trigger: "manual" | "sweep" = "manual",
): Promise<SyncOneResult | null> {
  const conn = await loadConnectionById(connectionId);
  if (!conn) return null;
  if (conn.status !== "active") {
    log(`[bank-feed-sync] connection=${connectionId} skipped status=${conn.status}`, "bank-feed-sync");
    return null;
  }
  return syncOneConnection(conn, trigger);
}

/**
 * Webhook entry: sync the connection matching item_id, debounced to at most
 * once per WEBHOOK_DEBOUNCE_MS. Returns null if debounced (no work done).
 *
 * Idempotent: a burst of webhooks for the same item_id collapses to one sync.
 */
export async function syncBankFeedForItemId(itemId: string): Promise<SyncOneResult | null> {
  const now = Date.now();
  const lastRun = lastWebhookSyncByItemId.get(itemId) ?? 0;
  if (now - lastRun < WEBHOOK_DEBOUNCE_MS) {
    log(
      `[bank-feed-sync] item=${itemId} trigger=webhook skipped=debounced (last=${now - lastRun}ms ago)`,
      "bank-feed-sync",
    );
    return {
      connectionId: "",
      associationId: "",
      trigger: "webhook",
      transactionsImported: 0,
      matchesMade: 0,
      unmatchedCount: 0,
      durationMs: 0,
      skipped: "debounced",
    };
  }
  lastWebhookSyncByItemId.set(itemId, now);

  const conn = await loadConnectionByItemId(itemId);
  if (!conn) {
    log(`[bank-feed-sync] item=${itemId} trigger=webhook err=connection-not-found`, "bank-feed-sync");
    return null;
  }
  if (conn.status !== "active") {
    log(`[bank-feed-sync] item=${itemId} trigger=webhook skipped status=${conn.status}`, "bank-feed-sync");
    return null;
  }
  return syncOneConnection(conn, "webhook");
}

/**
 * Sweep entry: every 5-min automation tick. Picks every active connection
 * whose last_synced_at is NULL or older than STALENESS_MS, syncs each.
 *
 * Returns aggregate counters for the sweep log line.
 */
export async function runBankFeedSweep(): Promise<SweepResult> {
  const staleBefore = new Date(Date.now() - STALENESS_MS);

  // Eligible: active connections with no sync yet, OR last sync older than the
  // staleness window.
  const eligible = await db
    .select()
    .from(bankConnections)
    .where(
      and(
        eq(bankConnections.status, "active"),
        or(
          isNull(bankConnections.lastSyncedAt),
          lt(bankConnections.lastSyncedAt, staleBefore),
        ),
      ),
    );

  let synced = 0;
  let skipped = 0;
  let failed = 0;
  let totalTransactions = 0;
  let totalMatches = 0;

  for (const conn of eligible) {
    try {
      const result = await syncOneConnection(conn, "sweep");
      if (result.skipped === "lock-collision") {
        skipped++;
      } else if (result.error) {
        failed++;
      } else {
        synced++;
        totalTransactions += result.transactionsImported;
        totalMatches += result.matchesMade;
      }
    } catch (err: any) {
      // syncOneConnection swallows its own errors into the sync_runs row,
      // so reaching here means something pathological (e.g. lock-helper
      // crashed). Count it as failed and keep going.
      failed++;
      log(
        `[bank-feed-sync] sweep connection=${conn.id} unexpected-throw err=${err?.message ?? err}`,
        "bank-feed-sync",
      );
    }
  }

  return {
    scanned: eligible.length,
    synced,
    skipped,
    failed,
    totalTransactions,
    totalMatches,
  };
}

/**
 * Test-only helper to clear the in-memory webhook debounce map. Not exported
 * via the public surface; tests reach in via the module reference.
 */
export function __clearWebhookDebounceForTests(): void {
  lastWebhookSyncByItemId.clear();
}
