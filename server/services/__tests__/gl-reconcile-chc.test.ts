/**
 * Reconcile-to-the-cent ACCEPTANCE GATE — Cherry Hill Court (CHC).
 *
 * Audit anchor:  audits/AUDIT-financial-reporting-orchestration.md Gap F1 / F5+.
 * Hardening:     audits/BLINDSPOT-pass-2026-06-20.md F4 — "the GL must reproduce
 *                CHC's existing reconciled balances to the cent before it's
 *                allowed to become the source of truth."
 *
 * This is the CRITICAL gate. CHC is a LIVE 18-unit HOA whose dues run in
 * production right now. The owner-ledger opening balances seeded for CHC
 * (server/seed.ts CHC_BALANCE_ENTRIES — 13 driveway assessments + 6 HOA-dues
 * charges) sum to a reconciled balance of $21,607.78.
 *
 * To keep this test honest to LIVE data (never a hand-copied number that can
 * drift from the seed), it parses the actual CHC_BALANCE_ENTRIES amounts out of
 * server/seed.ts at test time, feeds them through the SAME parallel-GL posting
 * core the runtime uses, and asserts the GL's Accounts-Receivable balance equals
 * the owner-ledger Σ amount to the cent.
 *
 * If this test ever fails, the GL is NOT permitted to become source-of-truth.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { reconcileFromOwnerLedger, ownerLedgerBalanceCents } from "../gl/reconcile";
import { toCents, type OwnerLedgerEntryLike } from "../gl/posting";

/**
 * Parse the CHC_BALANCE_ENTRIES block out of server/seed.ts into the minimal
 * owner-ledger shape. Reads LIVE seed values so this test tracks the real
 * reconciled balance, not a frozen copy.
 */
function loadChcSeedEntries(): OwnerLedgerEntryLike[] {
  const seedPath = resolve(__dirname, "../../seed.ts");
  const text = readFileSync(seedPath, "utf8");

  const startMarker = "const CHC_BALANCE_ENTRIES";
  const endMarker = "await db.insert(ownerLedgerEntries).values(CHC_BALANCE_ENTRIES)";
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Could not locate CHC_BALANCE_ENTRIES block in server/seed.ts");
  }
  const block = text.slice(start, end);

  // Each entry is an object literal with entryType + amountCents fields (integer cents
  // since migration 0068 / founder-os#10779).
  const entries: OwnerLedgerEntryLike[] = [];
  const objectRegex = /\{[^{}]*?entryType:\s*"([^"]+)"[^{}]*?amountCents:\s*(-?\d+)[^{}]*?\}/gs;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = objectRegex.exec(block)) !== null) {
    entries.push({
      id: `chc-seed-${i++}`,
      entryType: m[1] as OwnerLedgerEntryLike["entryType"],
      amountCents: Number(m[2]),
      postedAt: new Date("2026-05-08T00:00:00Z"),
    });
  }
  return entries;
}

describe("CHC reconcile-to-the-cent — the acceptance gate (BLINDSPOT F4)", () => {
  const entries = loadChcSeedEntries();

  it("parsed the live CHC seed entries (13 assessments + 6 charges = 19)", () => {
    expect(entries.length).toBe(19);
    expect(entries.filter((e) => e.entryType === "assessment").length).toBe(13);
    expect(entries.filter((e) => e.entryType === "charge").length).toBe(6);
  });

  it("the owner-ledger reconciled balance is $21,607.78 (matches the live seed)", () => {
    // Independent reference number computed from the seed total. If the seed
    // changes, update this AND confirm the GL still reconciles (the next test).
    expect(ownerLedgerBalanceCents(entries)).toBe(2160778);
  });

  it("the parallel GL reproduces CHC's reconciled balance EXACTLY (difference = 0¢)", () => {
    const report = reconcileFromOwnerLedger(entries);

    // The gate.
    expect(report.invariantViolations).toEqual([]);
    expect(report.glAccountsReceivableCents).toBe(report.ownerLedgerBalanceCents);
    expect(report.differenceCents).toBe(0);
    expect(report.ok).toBe(true);

    // And the GL's AR is exactly the known $21,607.78.
    expect(report.glAccountsReceivableCents).toBe(2160778);
  });

  it("survives the live payment/credit money path: a payment reduces AR to the cent", () => {
    // Simulate a CHC owner paying $1,326.19 against their assessment — the exact
    // live money flow (admin-payments.ts stores payments as negative amounts).
    const withPayment: OwnerLedgerEntryLike[] = [
      ...entries,
      { id: "chc-pay-1", entryType: "payment", amountCents: -132619, postedAt: new Date("2026-06-01T00:00:00Z") },
    ];
    const report = reconcileFromOwnerLedger(withPayment);
    expect(report.ok).toBe(true);
    expect(report.differenceCents).toBe(0);
    // AR drops by exactly the payment.
    expect(report.glAccountsReceivableCents).toBe(2160778 - 132619);
  });
});
