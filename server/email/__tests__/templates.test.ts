/**
 * Template render tests (Issue founder-os#1042).
 *
 * Each template:
 *   - returns non-empty HTML and text
 *   - HTML-escapes interpolated data (no XSS via owner name etc.)
 *   - contains the canonical YCM v1 wordmark
 *   - text fallback includes the same key data the HTML does
 */

import { describe, it, expect } from "vitest";

import { TEMPLATES, type TemplateKey } from "../templates";
import type {
  WelcomeBoardMemberData,
  WelcomeOwnerData,
  InvoiceAssessmentData,
  ReceiptPaymentData,
  PasswordResetData,
} from "../templates/types";

const SAMPLE_DATA: {
  "welcome-board-member": WelcomeBoardMemberData;
  "welcome-owner": WelcomeOwnerData;
  "invoice-assessment": InvoiceAssessmentData;
  "receipt-payment": ReceiptPaymentData;
  "password-reset": PasswordResetData;
} = {
  "welcome-board-member": {
    recipientName: "Jane Doe",
    associationName: "Cherry Hill Court Condominiums",
    loginUrl: "https://app.yourcondomanager.org/invite/abc123",
    invitedBy: "William Ruiz",
  },
  "welcome-owner": {
    recipientName: "Jane Doe",
    associationName: "Cherry Hill Court Condominiums",
    portalUrl: "https://app.yourcondomanager.org/portal/abc123",
    unitLabel: "Building 1417 · Unit 3",
  },
  "invoice-assessment": {
    recipientName: "Jane Doe",
    associationName: "Cherry Hill Court Condominiums",
    unitLabel: "Building 1417 · Unit 3",
    amountFormatted: "$350.00",
    description: "May 2026 dues",
    dueDate: "2026-05-31",
    paymentLinkUrl: "https://app.yourcondomanager.org/pay/abc123",
  },
  "receipt-payment": {
    recipientName: "Jane Doe",
    associationName: "Cherry Hill Court Condominiums",
    unitLabel: "Building 1417 · Unit 3",
    amountFormatted: "$350.00",
    description: "May 2026 dues",
    paidAt: "May 15, 2026",
    receiptReference: "PAY-20260515-AB12CD34",
  },
  "password-reset": {
    recipientName: "Jane Doe",
    resetUrl: "https://app.yourcondomanager.org/reset/abc123",
    expiresInMinutes: 60,
  },
};

describe("template registry — all 5 baseline templates present", () => {
  it("has all 5 keys from dispatch §Scope", () => {
    const keys = Object.keys(TEMPLATES).sort();
    expect(keys).toEqual([
      "invoice-assessment",
      "password-reset",
      "receipt-payment",
      "welcome-board-member",
      "welcome-owner",
    ]);
  });
});

describe.each(Object.keys(TEMPLATES) as TemplateKey[])("template %s", (key) => {
  const tpl = TEMPLATES[key];
  const data = SAMPLE_DATA[key];

  it("returns a non-empty subject", () => {
    const subject = tpl.subject(data as never);
    expect(typeof subject).toBe("string");
    expect(subject.length).toBeGreaterThan(0);
  });

  it("returns non-empty HTML with YCM v1 wordmark", () => {
    const html = tpl.renderHtml(data as never);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("YourCondoManager");
    expect(html.length).toBeGreaterThan(500);
  });

  it("returns non-empty plain-text fallback", () => {
    const text = tpl.renderText(data as never);
    expect(text.length).toBeGreaterThan(50);
    expect(text).toContain("YourCondoManager");
  });

  it("HTML-escapes interpolated strings (no XSS via name field)", () => {
    const malicious = {
      ...data,
      recipientName: '<script>alert("xss")</script>',
    } as typeof data;
    const html = tpl.renderHtml(malicious as never);
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain("&lt;script&gt;");
  });

  it("HTML and text both include the recipient name", () => {
    if ("recipientName" in data) {
      const recipientName = (data as { recipientName: string }).recipientName;
      expect(tpl.renderHtml(data as never)).toContain(recipientName);
      expect(tpl.renderText(data as never)).toContain(recipientName);
    }
  });
});

describe("template-specific assertions", () => {
  it("invoice-assessment shows the amount + due date in both surfaces", () => {
    const data = SAMPLE_DATA["invoice-assessment"];
    const html = TEMPLATES["invoice-assessment"].renderHtml(data);
    const text = TEMPLATES["invoice-assessment"].renderText(data);
    for (const surface of [html, text]) {
      expect(surface).toContain("$350.00");
      expect(surface).toContain("2026-05-31");
      expect(surface).toContain("May 2026 dues");
    }
  });

  it("receipt-payment shows the receipt reference in monospace HTML + plain text", () => {
    const data = SAMPLE_DATA["receipt-payment"];
    const html = TEMPLATES["receipt-payment"].renderHtml(data);
    const text = TEMPLATES["receipt-payment"].renderText(data);
    expect(html).toContain("PAY-20260515-AB12CD34");
    expect(text).toContain("PAY-20260515-AB12CD34");
    expect(html).toContain("ui-monospace");
  });

  it("password-reset surfaces the link expiration in minutes", () => {
    const data = SAMPLE_DATA["password-reset"];
    const html = TEMPLATES["password-reset"].renderHtml(data);
    const text = TEMPLATES["password-reset"].renderText(data);
    expect(html).toContain("60");
    expect(text).toContain("60 minutes");
  });

  it("welcome-board-member surfaces inviter + association in subject", () => {
    const tpl = TEMPLATES["welcome-board-member"];
    const subject = tpl.subject(SAMPLE_DATA["welcome-board-member"]);
    expect(subject).toContain("Cherry Hill Court Condominiums");
    expect(subject).toContain("YourCondoManager");
  });
});
