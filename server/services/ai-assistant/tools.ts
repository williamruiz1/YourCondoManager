/**
 * AI Assistant — read-only tool stubs (founder-os#1318, Phase 0).
 *
 * Three tools that wrap the existing YCM service layer with isolation
 * enforcement. The LLM (mock in Phase 0; real in Phase 1) invokes these
 * by name; the isolation guards live HERE so any future adapter inherits
 * them automatically.
 *
 * Isolation contract: every tool takes a `CallerContext` parameter that
 * carries the authoritative scope (`associationId`, `personId`, `unitIds`).
 * Tools MUST use these values as the only source of truth — any LLM-supplied
 * `owner_id` / `community_id` argument is checked against them and rejected
 * on mismatch. This mirrors the existing `payment-portal.ts` pattern at
 * lines 134-136.
 */

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  ownerLedgerEntries,
  paymentTransactions,
  type PaymentTransaction,
} from "@shared/schema";
import { getOwnerBalanceSummary, getOwnerPaymentHistory } from "../payment-service";
import type { CallerContext } from "./types";

/**
 * Error class for isolation-guard failures. Distinct from generic errors
 * so callers can detect attempted cross-tenant access and log to Sentry
 * as a security signal (per founder-os#1030 observability).
 */
export class IsolationViolationError extends Error {
  constructor(
    public readonly attemptedOwnerId: string,
    public readonly callerPersonId: string,
  ) {
    super(
      `Isolation violation: tool called with owner_id=${attemptedOwnerId} ` +
        `but caller is person=${callerPersonId}`,
    );
    this.name = "IsolationViolationError";
  }
}

/**
 * Validate the LLM-supplied `owner_id` against the caller's authoritative
 * `personId`. Throws on mismatch so the tool layer never returns data for
 * a different owner.
 *
 * If the LLM omits `owner_id` entirely, we default to the caller's id —
 * this is the canonical "first-person resident chat" interpretation.
 */
function resolveScopedOwnerId(suppliedOwnerId: string | undefined, caller: CallerContext): string {
  const ownerId = suppliedOwnerId?.trim() || caller.personId;
  if (ownerId !== caller.personId) {
    throw new IsolationViolationError(ownerId, caller.personId);
  }
  return ownerId;
}

// ── Tool 1: get_owner_balance ────────────────────────────────────────────────

export interface GetOwnerBalanceInput {
  /** LLM-supplied; checked against `caller.personId` and rejected on mismatch. */
  owner_id?: string;
}

export interface GetOwnerBalanceOutput {
  ownerId: string;
  totalBalance: number;
  totalCharges: number;
  totalPayments: number;
  pendingPaymentCents: number;
  openCharges: number;
  /** Plain-English one-liner the LLM can quote verbatim. */
  summary: string;
}

/**
 * Returns the owner's current balance summary. Wraps
 * `getOwnerBalanceSummary` from `payment-service.ts` (the same function
 * the existing `/api/portal/balance-summary` route uses) so this is
 * REAL data, not mocked. Only the LLM layer is mocked in Phase 0.
 */
export async function getOwnerBalance(
  input: GetOwnerBalanceInput,
  caller: CallerContext,
): Promise<GetOwnerBalanceOutput> {
  const ownerId = resolveScopedOwnerId(input.owner_id, caller);
  const summary = await getOwnerBalanceSummary({
    associationId: caller.associationId,
    personId: ownerId,
    unitIds: caller.unitIds,
  });

  const summaryLine =
    summary.totalBalance > 0
      ? `Your current balance is $${summary.totalBalance.toFixed(2)} across ${summary.openCharges.length} open charge${summary.openCharges.length === 1 ? "" : "s"}.`
      : summary.totalBalance < 0
        ? `You have a credit of $${Math.abs(summary.totalBalance).toFixed(2)} on your account.`
        : `Your account is fully paid — $0.00 balance.`;

  return {
    ownerId,
    totalBalance: summary.totalBalance,
    totalCharges: summary.totalCharges,
    totalPayments: summary.totalPayments,
    pendingPaymentCents: summary.pendingPaymentCents,
    openCharges: summary.openCharges.length,
    summary: summaryLine,
  };
}

// ── Tool 2: get_payment_history ──────────────────────────────────────────────

export interface GetPaymentHistoryInput {
  owner_id?: string;
  limit?: number;
}

export interface GetPaymentHistoryOutput {
  ownerId: string;
  transactions: Array<{
    id: string;
    amountCents: number;
    status: string;
    description: string | null;
    createdAt: string;
  }>;
  summary: string;
}

/**
 * Returns the owner's recent payment history. Wraps
 * `getOwnerPaymentHistory` from `payment-service.ts`.
 */
export async function getPaymentHistory(
  input: GetPaymentHistoryInput,
  caller: CallerContext,
): Promise<GetPaymentHistoryOutput> {
  const ownerId = resolveScopedOwnerId(input.owner_id, caller);
  const limit = Math.min(Math.max(1, input.limit ?? 10), 50);

  const txns: PaymentTransaction[] = await getOwnerPaymentHistory({
    associationId: caller.associationId,
    personId: ownerId,
    limit,
  });

  const recent = txns.map((t) => ({
    id: t.id,
    amountCents: t.amountCents,
    status: t.status,
    description: t.description,
    createdAt: t.createdAt.toISOString(),
  }));

  const summaryLine =
    recent.length === 0
      ? "No payment history on record yet."
      : `${recent.length} recent payment${recent.length === 1 ? "" : "s"} — most recent ${recent[0].status} on ${recent[0].createdAt.slice(0, 10)}.`;

  return { ownerId, transactions: recent, summary: summaryLine };
}

// ── Tool 3: get_next_payment_due ─────────────────────────────────────────────

export interface GetNextPaymentDueInput {
  owner_id?: string;
}

export interface GetNextPaymentDueOutput {
  ownerId: string;
  nextDueId: string | null;
  nextDueAmount: number | null;
  nextDueDate: string | null;
  description: string | null;
  summary: string;
}

/**
 * Returns the next charge the owner needs to pay. Computed from
 * `ownerLedgerEntries` — picks the earliest-posted charge with a
 * positive amount.
 */
export async function getNextPaymentDue(
  input: GetNextPaymentDueInput,
  caller: CallerContext,
): Promise<GetNextPaymentDueOutput> {
  const ownerId = resolveScopedOwnerId(input.owner_id, caller);

  if (caller.unitIds.length === 0) {
    return {
      ownerId,
      nextDueId: null,
      nextDueAmount: null,
      nextDueDate: null,
      description: null,
      summary: "No active units on this account — no charges to surface.",
    };
  }

  const chargeTypes: Array<"charge" | "assessment" | "late-fee"> = ["charge", "assessment", "late-fee"];
  const entries = await db
    .select()
    .from(ownerLedgerEntries)
    .where(
      and(
        eq(ownerLedgerEntries.associationId, caller.associationId),
        eq(ownerLedgerEntries.personId, ownerId),
        inArray(ownerLedgerEntries.unitId, caller.unitIds),
        inArray(ownerLedgerEntries.entryType, chargeTypes),
      ),
    )
    .orderBy(asc(ownerLedgerEntries.postedAt))
    .limit(50);

  // The "next due" is the earliest-posted charge with a positive amount
  // that hasn't been fully paid. Phase 0 picks first-positive; Phase 1
  // adapter may compute against an offset / due-date schedule.
  const open = entries.find((e) => e.amountCents > 0);

  if (!open) {
    return {
      ownerId,
      nextDueId: null,
      nextDueAmount: null,
      nextDueDate: null,
      description: null,
      summary: "No open charges — nothing currently due.",
    };
  }

  // amount_cents is exact integer cents (migration 0068); this summary surface is
  // dollars-facing, so convert once here.
  const amount = open.amountCents / 100;
  const dueDate = open.postedAt.toISOString().slice(0, 10);
  return {
    ownerId,
    nextDueId: open.id,
    nextDueAmount: amount,
    nextDueDate: dueDate,
    description: open.description,
    summary: `Your next charge is $${amount.toFixed(2)} (${open.description ?? open.entryType}) posted ${dueDate}.`,
  };
}

// ── Registry: tools available to the adapter ────────────────────────────────

/**
 * The Phase 0 tool registry. The mock adapter uses these names; the
 * Phase 1 LLM adapter passes the same names through to the LLM tool-use
 * API so the LLM "calls" the same tool layer — no remapping.
 */
export const TOOL_NAMES = ["get_owner_balance", "get_payment_history", "get_next_payment_due"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export interface ToolDispatch {
  get_owner_balance: (input: GetOwnerBalanceInput, caller: CallerContext) => Promise<GetOwnerBalanceOutput>;
  get_payment_history: (input: GetPaymentHistoryInput, caller: CallerContext) => Promise<GetPaymentHistoryOutput>;
  get_next_payment_due: (input: GetNextPaymentDueInput, caller: CallerContext) => Promise<GetNextPaymentDueOutput>;
}

export const tools: ToolDispatch = {
  get_owner_balance: getOwnerBalance,
  get_payment_history: getPaymentHistory,
  get_next_payment_due: getNextPaymentDue,
};
