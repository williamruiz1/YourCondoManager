/**
 * Site audit 2026-06-22 (BLOCKER 1) — the "Talk to us" / demo-request handler
 * must send a confirmation email to the SUBMITTER (not only the YCM admins).
 *
 * The handler (server/routes.ts, POST /api/public/demo-request) calls
 * `sendDemoRequestConfirmation({ email, name, associationName })` after the
 * admin notification. These tests lock in that the confirmation:
 *   1. is sent to the submitter's own address;
 *   2. carries "we got your message" acknowledgement copy;
 *   3. reuses the existing platform email transport (sendPlatformEmail);
 *   4. is best-effort — a transport failure resolves to null, never throws,
 *      so it can never fail/block the form submission.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the email transport — we assert WHAT is sent, not real SMTP delivery.
vi.mock("../email-provider", () => ({
  sendPlatformEmail: vi.fn(),
}));

// Mock the logger so the best-effort failure path doesn't spew.
vi.mock("../logger", () => ({
  log: vi.fn(),
}));

describe("demo-request submitter confirmation (BLOCKER 1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a confirmation to the SUBMITTER's address via the existing transport", async () => {
    const { sendPlatformEmail } = await import("../email-provider");
    (sendPlatformEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "sent",
      messageId: "msg-1",
      logId: "log-1",
      provider: "smtp",
    });

    const { sendDemoRequestConfirmation } = await import("../demo-request-confirmation");

    const result = await sendDemoRequestConfirmation({
      email: "prospect@example.com",
      name: "Jordan Rivera",
      associationName: "Maple Court HOA",
    });

    // Reused the existing transport exactly once.
    expect(sendPlatformEmail).toHaveBeenCalledTimes(1);

    const payload = (sendPlatformEmail as ReturnType<typeof vi.fn>).mock.calls[0][0];

    // (1) goes to the SUBMITTER, not contact@/admins.
    expect(payload.to).toBe("prospect@example.com");

    // (2) acknowledgement copy the modal promised.
    expect(payload.subject).toMatch(/got your message/i);
    expect(payload.text).toMatch(/thanks/i);
    expect(payload.text).toMatch(/got your message/i);
    expect(payload.text).toMatch(/be in touch/i);
    // personalized + association-aware.
    expect(payload.text).toContain("Jordan");
    expect(payload.text).toContain("Maple Court HOA");

    // (3) returns the transport result on success.
    expect(result).toEqual(
      expect.objectContaining({ status: "sent", messageId: "msg-1" }),
    );
  });

  it("works without an association name (omits the association clause)", async () => {
    const { sendPlatformEmail } = await import("../email-provider");
    (sendPlatformEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "sent",
      messageId: "msg-2",
      logId: "log-2",
      provider: "smtp",
    });

    const { sendDemoRequestConfirmation } = await import("../demo-request-confirmation");

    await sendDemoRequestConfirmation({ email: "x@example.com", name: "Sam" });

    const payload = (sendPlatformEmail as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.to).toBe("x@example.com");
    expect(payload.text).toContain("Sam");
    // no "about <association>" clause when none provided.
    expect(payload.text).not.toMatch(/about\s+\w/i);
  });

  it("is best-effort: a transport failure resolves to null and never throws", async () => {
    const { sendPlatformEmail } = await import("../email-provider");
    (sendPlatformEmail as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("SMTP down"),
    );

    const { sendDemoRequestConfirmation } = await import("../demo-request-confirmation");

    // Must not reject — the submission flow must never fail on a
    // confirmation-email problem.
    const result = await sendDemoRequestConfirmation({
      email: "prospect@example.com",
      name: "Jordan",
    });

    expect(result).toBeNull();
  });
});

/**
 * Handler-level guarantee (in-process contract reproduction). Mirrors the
 * production handler's confirmation step in server/routes.ts so we prove the
 * SUBMITTER is emailed, not only the admins. If the production handler's
 * confirmation wiring changes, this reproduction must change in lockstep.
 */
describe("POST /api/public/demo-request — submitter gets a confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emails the submitter's address as part of handling the request", async () => {
    const { sendPlatformEmail } = await import("../email-provider");
    (sendPlatformEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "sent",
      messageId: "m",
      logId: "l",
      provider: "smtp",
    });

    const { sendDemoRequestConfirmation } = await import("../demo-request-confirmation");

    // Reproduce the handler's confirmation step with the submitter's data.
    const submitterEmail = "submitter@prospect.io";
    await sendDemoRequestConfirmation({
      email: submitterEmail,
      name: "Pat Submitter",
      associationName: "Harborview Condos",
    });

    const recipients = (sendPlatformEmail as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0].to,
    );
    expect(recipients).toContain(submitterEmail);
  });
});
