/**
 * founder-os#11194 — invoice-on-assessment email service.
 *
 * Verifies the acceptance criteria at the service boundary (storage +
 * sendEmail stubbed, db table-routed):
 *   - a posted assessment triggers an invoice email with the required fields
 *     + a working pay link (observed send)
 *   - owners without an email on file are skipped without error
 *   - re-running the same assessment does NOT double-send (idempotency)
 *   - non-invoiceable entry types (payment/credit) are skipped
 *   - the kill switch (INVOICE_EMAIL_ON_ASSESSMENT=off) disables the send
 *   - a failed send voids the pay-link marker so a retry can re-send
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ownerPaymentLinks, persons, units, associations } from "@shared/schema";

// ── Table-routed db mock ──────────────────────────────────────────────────────
let dbResults = new Map<unknown, any[]>();
let updateCalls: Array<{ set: any }> = [];

function selectChain() {
  let tbl: unknown;
  const c: any = {
    from: (t: unknown) => {
      tbl = t;
      return c;
    },
    where: () => c,
    limit: () => c,
    then: (res: any, rej: any) =>
      Promise.resolve(dbResults.get(tbl) ?? []).then(res, rej),
  };
  return c;
}

vi.mock("../../db.js", () => ({
  db: {
    select: () => selectChain(),
    update: () => ({
      set: (v: any) => {
        updateCalls.push({ set: v });
        return { where: () => Promise.resolve() };
      },
    }),
  },
}));

// ── storage.createOwnerPaymentLink mock ───────────────────────────────────────
let payLinkMode: "ok" | "throw" = "ok";
let payLinkCalls: any[] = [];
vi.mock("../../storage.js", () => ({
  storage: {
    createOwnerPaymentLink: async (payload: any) => {
      payLinkCalls.push(payload);
      if (payLinkMode === "throw") {
        throw new Error("Owner ledger balance is not payable");
      }
      return {
        link: { id: "link-1", token: "tok_abc" },
        paymentUrl: "https://ycm.test/api/portal/payments/link/tok_abc",
        outstandingBalance: 450,
      };
    },
  },
}));

// ── sendEmail mock ────────────────────────────────────────────────────────────
let sendMode: "sent" | "failed" | "skipped" = "sent";
let sendCalls: Array<{ to: string | string[]; template: string; data: any }> = [];
vi.mock("../../email/send.js", () => ({
  sendEmail: async (params: any) => {
    sendCalls.push({ to: params.to, template: params.template, data: params.data });
    if (sendMode === "failed") {
      return { status: "failed", provider: "resend", messageId: null, errorMessage: "Resend 500" };
    }
    if (sendMode === "skipped") {
      return { status: "skipped", provider: "smtp", messageId: null };
    }
    return { status: "sent", provider: "resend", messageId: "msg_1" };
  },
}));

import { sendInvoiceAssessmentEmail } from "../invoice-assessment-email";

const BASE = {
  ledgerEntryId: "ledger-1",
  associationId: "assoc-1",
  unitId: "unit-1",
  personId: "person-1",
  amount: 350,
  entryType: "assessment",
  description: "May 2026 dues",
  dueDate: new Date("2026-05-31T00:00:00Z"),
};

function seedHappyContext() {
  dbResults = new Map<unknown, any[]>([
    [ownerPaymentLinks, []], // not already invoiced
    [persons, [{ firstName: "Alex", lastName: "Owner", email: "alex@example.com" }]],
    [units, [{ unitNumber: "4B", building: "Building A" }]],
    [associations, [{ name: "Cherry Hill Court" }]],
  ]);
}

describe("#11194 invoice-on-assessment email", () => {
  beforeEach(() => {
    seedHappyContext();
    updateCalls = [];
    payLinkCalls = [];
    payLinkMode = "ok";
    sendCalls = [];
    sendMode = "sent";
    delete process.env.INVOICE_EMAIL_ON_ASSESSMENT;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends an invoice email with the required fields + a pay link", async () => {
    const r = await sendInvoiceAssessmentEmail(BASE);
    expect(r).toEqual({ sent: true, skipped: false });
    expect(sendCalls).toHaveLength(1);
    const call = sendCalls[0];
    expect(call.template).toBe("invoice-assessment");
    expect(call.to).toBe("alex@example.com");
    expect(call.data.recipientName).toBe("Alex Owner");
    expect(call.data.associationName).toBe("Cherry Hill Court");
    expect(call.data.unitLabel).toBe("Building A / Unit 4B");
    expect(call.data.amountFormatted).toBe("$350.00");
    expect(call.data.description).toBe("May 2026 dues");
    expect(call.data.dueDate).toBe("2026-05-31");
    expect(call.data.currentBalanceFormatted).toBe("$450.00");
    expect(call.data.paymentLinkUrl).toContain("/api/portal/payments/link/");
    // The pay link is tagged with the ledger entry id for idempotency.
    expect(payLinkCalls[0].metadataJson.invoiceAssessmentLedgerEntryId).toBe("ledger-1");
  });

  it("skips owners with no email on file without error (assessment still posted)", async () => {
    dbResults.set(persons, [{ firstName: "No", lastName: "Email", email: null }]);
    const r = await sendInvoiceAssessmentEmail(BASE);
    expect(r).toEqual({ sent: false, skipped: true, skipReason: "no_email_on_file" });
    expect(sendCalls).toHaveLength(0);
    expect(payLinkCalls).toHaveLength(0); // no pay link created either
  });

  it("does not double-send when the assessment already has an invoice link (idempotency)", async () => {
    dbResults.set(ownerPaymentLinks, [{ id: "existing-link" }]);
    const r = await sendInvoiceAssessmentEmail(BASE);
    expect(r).toEqual({ sent: false, skipped: true, skipReason: "already_invoiced" });
    expect(sendCalls).toHaveLength(0);
    expect(payLinkCalls).toHaveLength(0);
  });

  it("skips non-invoiceable entry types (payment/credit)", async () => {
    const r = await sendInvoiceAssessmentEmail({ ...BASE, entryType: "payment" });
    expect(r.skipped).toBe(true);
    expect(r.skipReason).toBe("non_invoiceable_entry_type");
    expect(sendCalls).toHaveLength(0);
  });

  it("respects the kill switch INVOICE_EMAIL_ON_ASSESSMENT=off", async () => {
    process.env.INVOICE_EMAIL_ON_ASSESSMENT = "off";
    const r = await sendInvoiceAssessmentEmail(BASE);
    expect(r).toEqual({ sent: false, skipped: true, skipReason: "disabled_by_env" });
    expect(sendCalls).toHaveLength(0);
  });

  it("skips when the balance is not payable (pay link throws)", async () => {
    payLinkMode = "throw";
    const r = await sendInvoiceAssessmentEmail(BASE);
    expect(r.skipped).toBe(true);
    expect(r.skipReason).toBe("pay_link_unavailable");
    expect(sendCalls).toHaveLength(0);
  });

  it("voids the pay-link marker on send failure so a retry can re-send", async () => {
    sendMode = "failed";
    const r = await sendInvoiceAssessmentEmail(BASE);
    expect(r.sent).toBe(false);
    expect(r.errorMessage).toContain("Resend 500");
    // The just-created link was voided (rollback) so idempotency does not block a retry.
    expect(updateCalls.some((c) => c.set.status === "void")).toBe(true);
  });

  it("never throws (returns error result) on unexpected failure", async () => {
    dbResults = new Map(); // context missing -> resolves to skip, not throw
    const r = await sendInvoiceAssessmentEmail(BASE);
    expect(r.skipped).toBe(true);
    expect(r.skipReason).toBe("context_missing");
  });
});
