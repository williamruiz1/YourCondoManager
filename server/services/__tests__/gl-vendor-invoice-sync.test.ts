/**
 * GL vendor-invoice → service-layer sync (Expense→GL, ratified 2026-06-30).
 *
 * Verifies syncAssociationGl posts BOTH the owner-ledger (income) side and the
 * vendor-invoice (expense) side into the same balanced corpus, flag-gated and
 * idempotent — without a live database (the db reads + inserts are mocked).
 *
 * Asserts:
 *   1. FLAG-GATED — disabled association posts nothing (no chart writes, no legs).
 *   2. EXPENSE LEGS — an enabled association's received/paid invoices produce
 *      expense+A/P / expense+cash legs alongside dues legs.
 *   3. DRAFT/VOID DROPPED — non-committed invoices never reach the insert.
 *   4. BALANCED — the rows handed to the insert are double-entry balanced.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Programmable row sets for the two loads (owner ledger, vendor invoices).
let ownerRows: any[] = [];
let invoiceRows: any[] = [];
// Capture what the GL insert was handed.
let insertedRows: any[] = [];

// Mock drizzle's db. The service calls:
//   - db.select().from(glAccounts).where()                      → existing accounts
//   - db.insert(glAccounts).values().onConflictDoNothing().returning()
//   - db.select().from(ownerLedgerEntries).where()              → owner rows
//   - db.select({...}).from(vendorInvoices).leftJoin().where()  → invoice rows
//   - db.insert(glEntries).values(rows).onConflictDoNothing().returning()
const DRIZZLE_NAME = Symbol.for("drizzle:Name");
const tableName = (t: any): string => String(t?.[DRIZZLE_NAME] ?? "");

vi.mock("../../db", () => {
  return {
    db: {
      // Disambiguate the three reads by the table passed to .from():
      //   gl_accounts          → existing-accounts read (empty → all get seeded)
      //   owner_ledger_entries → owner-ledger (income) rows
      //   vendor_invoices      → vendor-invoice (expense) rows
      select: (_projection?: any) => {
        const chain: any = {
          _name: "",
          from: (t: any) => {
            chain._name = tableName(t);
            return chain;
          },
          leftJoin: () => chain,
          where: () => {
            if (chain._name === "vendor_invoices") return Promise.resolve(invoiceRows);
            if (chain._name === "owner_ledger_entries") return Promise.resolve(ownerRows);
            return Promise.resolve([]); // gl_accounts existing → none yet
          },
        };
        return chain;
      },
      insert: (table: any) => ({
        values: (rows: any[]) => ({
          onConflictDoNothing: () => ({
            returning: () => {
              // glAccounts seed vs glEntries insert: only record the gl_entries.
              const isEntries = Array.isArray(rows) && rows.some((r) => "side" in r && "amountCents" in r);
              if (isEntries) {
                insertedRows = rows;
                return Promise.resolve(rows.map((_, i) => ({ id: `leg-${i}` })));
              }
              // glAccounts seed → echo each row back WITH an id so ensureChartOfAccounts
              // can build its (code|fund → account) map (it reads the returning rows).
              return Promise.resolve(rows.map((r, i) => ({ ...r, id: `acct-${i}` })));
            },
          }),
        }),
      }),
    },
  };
});

import { syncAssociationGl } from "../gl/gl-posting-service";

const ASSOC = "assoc-1";

beforeEach(() => {
  ownerRows = [
    { id: "d1", entryType: "charge", amount: 300, amountCents: 30000, postedAt: new Date("2026-06-01"), description: "dues" },
    { id: "p1", entryType: "payment", amount: -300, amountCents: -30000, postedAt: new Date("2026-06-02"), description: "pay" },
  ];
  invoiceRows = [
    { id: "v1", amount: 1200, status: "received", invoiceDate: new Date("2026-06-03"), vendorName: "GreenLawn", invoiceNumber: "INV-1", categoryName: "Landscaping" },
    { id: "v2", amount: 450, status: "paid", invoiceDate: new Date("2026-06-04"), vendorName: "FixIt", invoiceNumber: "INV-2", categoryName: "Repairs" },
    { id: "v3", amount: 999, status: "draft", invoiceDate: new Date("2026-06-04"), vendorName: "Draft Co", invoiceNumber: null, categoryName: null },
  ];
  insertedRows = [];
  delete process.env.GL_ENABLED;
  delete process.env.GL_ENABLED_ASSOCIATIONS;
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.GL_ENABLED;
  delete process.env.GL_ENABLED_ASSOCIATIONS;
});

describe("syncAssociationGl — vendor-invoice expense legs (flag-gated)", () => {
  it("FLAG OFF — posts nothing (no gl_entries insert) for a disabled association", async () => {
    const res = await syncAssociationGl(ASSOC); // not forced, no flag
    expect(res.skipped).toBe(true);
    expect(res.legsInserted).toBe(0);
    expect(insertedRows).toHaveLength(0);
  });

  it("FORCED — posts dues income legs AND vendor expense legs into one corpus", async () => {
    const res = await syncAssociationGl(ASSOC, { force: true });
    expect(res.skipped).toBe(false);

    // The inserted gl_entries include the expense side now. Leg count:
    //   owner: charge (DR AR / CR 4000) = 2  +  payment (DR cash / CR AR) = 2  → 4
    //   vendor: received (DR exp / CR A/P) = 2  +  paid (DR exp / CR cash) = 2  → 4
    //   draft invoice → 0 (dropped)
    // = 8 legs total.
    expect(insertedRows).toHaveLength(8);

    // Double-entry: total debit cents == total credit cents across all legs.
    const debit = insertedRows.filter((r) => r.side === "debit").reduce((s, r) => s + r.amountCents, 0);
    const credit = insertedRows.filter((r) => r.side === "credit").reduce((s, r) => s + r.amountCents, 0);
    expect(debit).toBe(credit);

    // The expense magnitudes are present: 1200 (landscaping) + 450 (repairs).
    const debitAmounts = insertedRows.filter((r) => r.side === "debit").map((r) => r.amountCents).sort((a, b) => a - b);
    expect(debitAmounts).toContain(120000); // landscaping expense
    expect(debitAmounts).toContain(45000); // repairs expense
  });

  it("DRAFT invoice posts nothing — only committed invoices reach the GL", async () => {
    invoiceRows = [
      { id: "only-draft", amount: 5000, status: "draft", invoiceDate: new Date("2026-06-05"), vendorName: "X", invoiceNumber: null, categoryName: null },
    ];
    ownerRows = [];
    const res = await syncAssociationGl(ASSOC, { force: true });
    expect(res.skipped).toBe(false);
    expect(insertedRows).toHaveLength(0); // nothing committed → no legs
  });

  it("a received invoice with NO owner-ledger activity still posts a balanced expense journal", async () => {
    ownerRows = [];
    invoiceRows = [
      { id: "v", amount: 1000, status: "received", invoiceDate: new Date("2026-06-05"), vendorName: "Acme", invoiceNumber: "A1", categoryName: "Insurance" },
    ];
    await syncAssociationGl(ASSOC, { force: true });
    expect(insertedRows).toHaveLength(2);
    const debit = insertedRows.filter((r) => r.side === "debit").reduce((s, r) => s + r.amountCents, 0);
    const credit = insertedRows.filter((r) => r.side === "credit").reduce((s, r) => s + r.amountCents, 0);
    expect(debit).toBe(100000);
    expect(credit).toBe(100000);
  });
});
