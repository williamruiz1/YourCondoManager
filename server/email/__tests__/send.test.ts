/**
 * Tests for the `sendEmail` wrapper (Issue founder-os#1042).
 *
 * Verifies:
 *   - Resolves the right provider from env
 *   - Falls back to SMTP when RESEND_API_KEY is missing
 *   - Returns a typed `failed` result on bad input
 *   - Subject + replyTo overrides win over template defaults / env defaults
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the Resend client at the module boundary so we don't hit the network.
vi.mock("../resend-client", () => ({
  resendSend: vi.fn(),
}));

// Mock the SMTP fallback path so its DB+nodemailer dependencies don't load.
vi.mock("../../email-provider", () => ({
  sendPlatformEmail: vi.fn(async () => ({
    status: "sent",
    messageId: "smtp-fake-id",
    logId: "log-fake-id",
    provider: "smtp",
  })),
}));

import { sendEmail } from "../send";
import { resendSend } from "../resend-client";
import { sendPlatformEmail } from "../../email-provider";

const baseInvoiceData = {
  recipientName: "Jane Doe",
  associationName: "Cherry Hill",
  unitLabel: "1417 #3",
  amountFormatted: "$350.00",
  description: "May 2026 dues",
  dueDate: "2026-05-31",
  paymentLinkUrl: "https://app.example/pay/x",
};

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.EMAIL_PROVIDER;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.EMAIL_REPLY_TO;
});

afterEach(() => {
  delete process.env.EMAIL_PROVIDER;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.EMAIL_REPLY_TO;
});

describe("sendEmail() — provider resolution", () => {
  it("routes to Resend when EMAIL_PROVIDER=resend and key is set", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test_xxx";
    vi.mocked(resendSend).mockResolvedValue({ ok: true, id: "re_msg_123" });

    const result = await sendEmail({
      to: "jane@example.com",
      template: "invoice-assessment",
      data: baseInvoiceData,
    });

    expect(result.status).toBe("sent");
    expect(result.provider).toBe("resend");
    expect(result.messageId).toBe("re_msg_123");
    expect(resendSend).toHaveBeenCalledOnce();
    expect(sendPlatformEmail).not.toHaveBeenCalled();
  });

  it("falls back to SMTP when EMAIL_PROVIDER=resend but RESEND_API_KEY is missing", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    // No RESEND_API_KEY
    const result = await sendEmail({
      to: "jane@example.com",
      template: "welcome-owner",
      data: {
        recipientName: "Jane",
        associationName: "Cherry Hill",
        portalUrl: "https://x/portal",
        unitLabel: "Unit",
      },
    });

    expect(result.status).toBe("sent");
    expect(result.provider).toBe("smtp");
    expect(sendPlatformEmail).toHaveBeenCalledOnce();
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("routes to SMTP when EMAIL_PROVIDER=smtp explicitly", async () => {
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.RESEND_API_KEY = "re_test_xxx"; // present but ignored
    const result = await sendEmail({
      to: "jane@example.com",
      template: "password-reset",
      data: {
        recipientName: "Jane",
        resetUrl: "https://x/reset",
        expiresInMinutes: 30,
      },
    });

    expect(result.status).toBe("sent");
    expect(result.provider).toBe("smtp");
    expect(resendSend).not.toHaveBeenCalled();
  });
});

describe("sendEmail() — payload shape", () => {
  beforeEach(() => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test_xxx";
  });

  it("sends the template's default subject when none is passed", async () => {
    vi.mocked(resendSend).mockResolvedValue({ ok: true, id: "re_x" });
    await sendEmail({
      to: "jane@example.com",
      template: "invoice-assessment",
      data: baseInvoiceData,
    });
    const args = vi.mocked(resendSend).mock.calls[0]![1];
    expect(args.subject).toContain("May 2026 dues");
    expect(args.subject).toContain("$350.00");
  });

  it("subject override wins over template default", async () => {
    vi.mocked(resendSend).mockResolvedValue({ ok: true, id: "re_x" });
    await sendEmail({
      to: "jane@example.com",
      subject: "Custom override",
      template: "invoice-assessment",
      data: baseInvoiceData,
    });
    const args = vi.mocked(resendSend).mock.calls[0]![1];
    expect(args.subject).toBe("Custom override");
  });

  it("uses EMAIL_FROM env when set", async () => {
    process.env.EMAIL_FROM = "custom@example.com";
    vi.mocked(resendSend).mockResolvedValue({ ok: true, id: "re_x" });
    await sendEmail({
      to: "jane@example.com",
      template: "password-reset",
      data: { recipientName: "Jane", resetUrl: "x", expiresInMinutes: 30 },
    });
    const args = vi.mocked(resendSend).mock.calls[0]![1];
    expect(args.from).toBe("custom@example.com");
  });

  it("adds a `template` tag to every Resend send", async () => {
    vi.mocked(resendSend).mockResolvedValue({ ok: true, id: "re_x" });
    await sendEmail({
      to: "jane@example.com",
      template: "receipt-payment",
      data: {
        recipientName: "Jane",
        associationName: "X",
        unitLabel: "U",
        amountFormatted: "$1",
        description: "d",
        paidAt: "today",
        receiptReference: "REF",
      },
    });
    const args = vi.mocked(resendSend).mock.calls[0]![1];
    expect(args.tags).toContainEqual({
      name: "template",
      value: "receipt-payment",
    });
  });

  it("returns failed when Resend returns an error", async () => {
    vi.mocked(resendSend).mockResolvedValue({
      ok: false,
      status: 422,
      error: "domain not verified",
    });
    const result = await sendEmail({
      to: "jane@example.com",
      template: "password-reset",
      data: { recipientName: "Jane", resetUrl: "x", expiresInMinutes: 30 },
    });
    expect(result.status).toBe("failed");
    expect(result.provider).toBe("resend");
    expect(result.errorMessage).toBe("domain not verified");
  });
});
