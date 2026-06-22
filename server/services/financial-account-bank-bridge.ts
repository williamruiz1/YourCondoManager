/**
 * Bank-account → Chart-of-Accounts bridge.
 *
 * When a board member links a bank via Plaid, every linked account is inserted
 * into `bank_accounts`. This bridge ALSO mirrors each linked account into the
 * Chart of Accounts (`financial_accounts`, what `/app/financial/foundation`
 * renders) as a balance-synced asset/bank row — so the linked bank "shows up in
 * the Chart of Accounts immediately," not just on the Bank Connections screen.
 *
 * Design (forward-only, additive, idempotent):
 *   - A mirrored row is `source='plaid'` and carries `linked_bank_account_id`
 *     (FK to bank_accounts.id) + `current_balance_cents`. Existing hand-entered
 *     rows are `source='manual'` (the column default) and are never touched.
 *   - Idempotency is keyed on `linked_bank_account_id` via the unique index
 *     (migration 0047): re-linking or re-syncing UPSERTS the same row, never a
 *     duplicate. Postgres allows many NULLs, so manual rows never collide.
 *   - Tenant isolation: the mirrored row is scoped to the same `association_id`
 *     the bank was linked under.
 *   - A 'plaid' row is owned by its bank connection → read-only in the COA UI.
 *
 * This is purely additive. It does not touch the live dues/payment path, the GL
 * flag, the GL tables, or any existing manual financial_accounts row.
 */
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { bankAccounts, financialAccounts } from "@shared/schema";
import { log } from "../logger";

/** What a Chart-of-Accounts "asset / bank" row is typed as. The COA uses a free
 * text `account_type`; "asset" is the natural type for a cash/bank balance. */
export const PLAID_COA_ACCOUNT_TYPE = "asset";

/** A linked bank account, shaped for the bridge (the subset the COA mirror needs). */
export interface BridgeableBankAccount {
  id: string;
  associationId: string;
  name: string;
  mask: string | null;
  currentBalanceCents: number | null;
}

/** Display name for the mirrored COA row, e.g. "Chase Operating ••1234". */
export function bridgedAccountName(name: string, mask: string | null): string {
  return mask ? `${name} ••${mask}` : name;
}

/**
 * Upsert the Chart-of-Accounts mirror row for ONE linked bank account.
 * Idempotent: keyed on `linked_bank_account_id`. On re-run it refreshes the
 * name + balance rather than inserting a duplicate.
 */
export async function upsertBridgedFinancialAccount(
  acct: BridgeableBankAccount,
): Promise<void> {
  await db
    .insert(financialAccounts)
    .values({
      associationId: acct.associationId,
      name: bridgedAccountName(acct.name, acct.mask),
      accountType: PLAID_COA_ACCOUNT_TYPE,
      isActive: 1,
      source: "plaid",
      linkedBankAccountId: acct.id,
      currentBalanceCents: acct.currentBalanceCents ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: financialAccounts.linkedBankAccountId,
      set: {
        name: bridgedAccountName(acct.name, acct.mask),
        currentBalanceCents: acct.currentBalanceCents ?? null,
        isActive: 1,
        updatedAt: new Date(),
      },
    });
}

/**
 * Mirror all linked bank accounts for a connection into the Chart of Accounts.
 * Called from the exchange-token handler right after the bank_accounts insert.
 * Best-effort: a bridge failure must never fail the bank link, so the caller
 * wraps this in a try/catch — but each account is upserted independently here
 * so one bad row doesn't sink the rest.
 */
export async function bridgeLinkedBankAccounts(
  accts: BridgeableBankAccount[],
): Promise<number> {
  let mirrored = 0;
  for (const acct of accts) {
    try {
      await upsertBridgedFinancialAccount(acct);
      mirrored++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`[coa-bridge] failed to mirror bank account ${acct.id} into COA: ${msg}`);
    }
  }
  return mirrored;
}

/**
 * Refresh the mirrored COA row's balance for ONE linked bank account during a
 * balance sync. No-op if no mirror row exists (e.g. a connection linked before
 * this bridge shipped — the next link/Sync-Now will backfill it via the upsert
 * path; this only updates an existing mirror). Idempotent.
 */
export async function syncBridgedFinancialAccountBalance(
  bankAccountId: string,
  currentBalanceCents: number | null,
): Promise<void> {
  await db
    .update(financialAccounts)
    .set({ currentBalanceCents: currentBalanceCents ?? null, updatedAt: new Date() })
    .where(
      and(
        eq(financialAccounts.linkedBankAccountId, bankAccountId),
        eq(financialAccounts.source, "plaid"),
      ),
    );
}

/**
 * Deactivate the mirrored COA rows for a removed/unlinked bank connection's
 * accounts, so the Chart of Accounts doesn't keep orphaned linked rows. Marks
 * inactive (not deleted) to preserve any audit references; the COA UI hides /
 * de-emphasizes inactive rows. Scoped to source='plaid' so manual rows are
 * never affected.
 *
 * NOTE: this is exported for the unlink path to call. Whether an unlink code
 * path exists today is out of scope for this bridge build — see PR notes. When
 * an unlink handler is wired, it should call this with the connection's
 * bank-account ids.
 */
export async function deactivateBridgedFinancialAccounts(
  bankAccountIds: string[],
): Promise<void> {
  if (bankAccountIds.length === 0) return;
  for (const bankAccountId of bankAccountIds) {
    await db
      .update(financialAccounts)
      .set({ isActive: 0, updatedAt: new Date() })
      .where(
        and(
          eq(financialAccounts.linkedBankAccountId, bankAccountId),
          eq(financialAccounts.source, "plaid"),
        ),
      );
  }
}

/** Helper: load the bridgeable shape for every account of a connection. */
export async function loadBridgeableAccountsForConnection(
  bankConnectionId: string,
): Promise<BridgeableBankAccount[]> {
  return db
    .select({
      id: bankAccounts.id,
      associationId: bankAccounts.associationId,
      name: bankAccounts.name,
      mask: bankAccounts.mask,
      currentBalanceCents: bankAccounts.currentBalanceCents,
    })
    .from(bankAccounts)
    .where(eq(bankAccounts.bankConnectionId, bankConnectionId));
}
