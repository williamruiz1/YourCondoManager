/**
 * GL runtime sync — the LIVE dues-to-GL trigger orchestrator.
 *
 * Verifies the four hard guarantees of server/services/gl/runtime-sync.ts:
 *   1. NON-FATAL  — a GL-sync error never propagates to the caller (money path).
 *   2. PER-ASSOC  — skips unless the GL is enabled for THIS association.
 *   3. RECONCILE  — even when enabled, refuses to post unless the owner ledger
 *                   reconciles to the cent (a corrupt ledger gets NO GL).
 *   4. IDEMPOTENT — delegates to syncAssociationGl, which is onConflictDoNothing
 *                   keyed on the source-leg unique index (asserted separately in
 *                   gl-dues-to-statements + the existing reconcile/invariant
 *                   tests). Here we assert the orchestration decisions.
 *
 * The DB owner-ledger load + the two collaborators (reconcile, syncAssociationGl)
 * are mocked so the GATE LOGIC is tested in isolation, without a live database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock the owner-ledger DB load. runtime-sync calls db.select().from().where()
//    and maps rows; we return a programmable row set. ──────────────────────────
let ledgerRows: any[] = [];
vi.mock("../../db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(ledgerRows),
      }),
    }),
  },
}));

// ── Mock the reconcile core so we drive the gate's pass/fail branch directly. ──
let reconcileOk = true;
const reconcileSpy = vi.fn();
vi.mock("../gl/reconcile", () => ({
  reconcileFromOwnerLedger: (entries: any[]) => {
    reconcileSpy(entries);
    return reconcileOk
      ? {
          ok: true,
          ownerLedgerBalanceCents: 1000,
          glAccountsReceivableCents: 1000,
          differenceCents: 0,
          fundBalancesCents: {},
          invariantViolations: [],
          entryCount: entries.length,
        }
      : {
          ok: false,
          ownerLedgerBalanceCents: 1000,
          glAccountsReceivableCents: 900,
          differenceCents: 100,
          fundBalancesCents: {},
          invariantViolations: ["[balanced] corpus does not balance"],
          entryCount: entries.length,
        };
  },
}));

// ── Mock the DB writer so we can assert it's (not) called + force errors. ──────
let syncBehavior: "ok" | "throw" = "ok";
const syncSpy = vi.fn();
vi.mock("../gl/gl-posting-service", () => ({
  syncAssociationGl: async (associationId: string, opts: any) => {
    syncSpy(associationId, opts);
    if (syncBehavior === "throw") throw new Error("db exploded");
    return { skipped: false, accountsSeeded: 13, journalsConsidered: 2, legsInserted: 4 };
  },
}));

import { maybeSyncAssociationGl, syncAssociationGlGated } from "../gl/runtime-sync";

const ASSOC = "assoc-1";

beforeEach(() => {
  ledgerRows = [
    { id: "e1", entryType: "charge", amount: 100, amountCents: 10000, postedAt: new Date(), description: "dues" },
    { id: "e2", entryType: "payment", amount: -100, amountCents: -10000, postedAt: new Date(), description: "pay" },
  ];
  reconcileOk = true;
  syncBehavior = "ok";
  delete process.env.GL_ENABLED;
  delete process.env.GL_ENABLED_ASSOCIATIONS;
  reconcileSpy.mockClear();
  syncSpy.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.GL_ENABLED;
  delete process.env.GL_ENABLED_ASSOCIATIONS;
});

describe("syncAssociationGlGated — per-association enablement gate", () => {
  it("skips when the GL is not enabled (no flag, not allowlisted) — never posts", async () => {
    const out = await syncAssociationGlGated(ASSOC);
    expect(out).toEqual({ posted: false, reason: "not-enabled" });
    expect(reconcileSpy).not.toHaveBeenCalled();
    expect(syncSpy).not.toHaveBeenCalled();
  });

  it("runs when the association is on the GL_ENABLED_ASSOCIATIONS allowlist", async () => {
    process.env.GL_ENABLED_ASSOCIATIONS = `other,${ASSOC}`;
    const out = await syncAssociationGlGated(ASSOC);
    expect(out.posted).toBe(true);
    expect(syncSpy).toHaveBeenCalledWith(ASSOC, { force: true });
  });

  it("runs when the global GL_ENABLED flag is on", async () => {
    process.env.GL_ENABLED = "1";
    const out = await syncAssociationGlGated(ASSOC);
    expect(out.posted).toBe(true);
    expect(syncSpy).toHaveBeenCalledTimes(1);
  });

  it("does NOT enable a non-allowlisted association when others are listed", async () => {
    process.env.GL_ENABLED_ASSOCIATIONS = "someone-else";
    const out = await syncAssociationGlGated(ASSOC);
    expect(out).toEqual({ posted: false, reason: "not-enabled" });
    expect(syncSpy).not.toHaveBeenCalled();
  });
});

describe("syncAssociationGlGated — reconcile-to-cent gate", () => {
  beforeEach(() => {
    process.env.GL_ENABLED_ASSOCIATIONS = ASSOC;
  });

  it("posts when the owner ledger reconciles to the cent", async () => {
    reconcileOk = true;
    const out = await syncAssociationGlGated(ASSOC);
    expect(out.posted).toBe(true);
    if (out.posted) expect(out.result.legsInserted).toBe(4);
    expect(reconcileSpy).toHaveBeenCalledTimes(1);
    expect(syncSpy).toHaveBeenCalledTimes(1);
  });

  it("BLOCKS posting when the ledger does NOT reconcile (corrupt data → no GL)", async () => {
    reconcileOk = false;
    const out = await syncAssociationGlGated(ASSOC);
    expect(out.posted).toBe(false);
    if (!out.posted) {
      expect(out.reason).toBe("reconcile-failed");
      expect(out.detail).toContain("diff=100c");
    }
    // Reconcile ran (the gate), but the DB writer was NEVER called.
    expect(reconcileSpy).toHaveBeenCalledTimes(1);
    expect(syncSpy).not.toHaveBeenCalled();
  });
});

describe("maybeSyncAssociationGl — NON-FATAL best-effort wrapper", () => {
  it("swallows a DB error and reports it (never throws into the money path)", async () => {
    process.env.GL_ENABLED_ASSOCIATIONS = ASSOC;
    syncBehavior = "throw";
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // The whole point: this must resolve, not reject.
    const out = await maybeSyncAssociationGl(ASSOC, "payment-webhook");
    expect(out.posted).toBe(false);
    if (!out.posted) expect(out.reason).toBe("error");
    errSpy.mockRestore();
  });

  it("returns the not-enabled outcome cleanly when disabled (the common default)", async () => {
    const out = await maybeSyncAssociationGl(ASSOC, "autopay");
    expect(out).toEqual({ posted: false, reason: "not-enabled" });
  });

  it("reports posted with the legs inserted on the happy path", async () => {
    process.env.GL_ENABLED = "1";
    const out = await maybeSyncAssociationGl(ASSOC, "payment-webhook");
    expect(out.posted).toBe(true);
    if (out.posted) expect(out.result.legsInserted).toBe(4);
  });
});
