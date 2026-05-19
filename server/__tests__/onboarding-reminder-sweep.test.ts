/**
 * #1617 — Reminder cadence sweep idempotency + threshold behavior.
 *
 * Exercises the storage→sweep boundary with a stubbed storage layer.
 * We verify:
 *   - listOnboardingRemindersDue returns one target per (admin, day-N) hit
 *   - sweep skips wizards with no open steps (marks sent without emailing)
 *   - sweep marks dayN_reminder_sent_at after a successful send
 *   - failed sends do NOT mark the row (retry on next tick)
 *   - sweep tolerates a Resend outage without throwing out of the run
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ADMIN_ID = "admin-1";

// Stub storage state — overwritten per-test.
let dueTargets: any[] = [];
let markCalls: Array<{ adminUserId: string; dayNumber: number; sentAt: Date }> = [];
let sendEmailMode: "ok" | "fail" | "throw" = "ok";
let sendEmailCalls: Array<{ to: string; template: string; data: any }> = [];

vi.mock("../storage", () => ({
  storage: {
    listOnboardingRemindersDue: async () => dueTargets,
    markOnboardingReminderSent: async (adminUserId: string, dayNumber: number, sentAt: Date) => {
      markCalls.push({ adminUserId, dayNumber, sentAt });
    },
  },
}));

vi.mock("../email/send", () => ({
  sendEmail: async (params: any) => {
    sendEmailCalls.push({ to: params.to, template: params.template, data: params.data });
    if (sendEmailMode === "throw") throw new Error("resend down");
    if (sendEmailMode === "fail") {
      return { status: "failed", provider: "resend", messageId: null, errorMessage: "Resend 500" };
    }
    return { status: "sent", provider: "resend", messageId: "msg_test" };
  },
}));

vi.mock("../logger", () => ({ log: vi.fn() }));

import { runOnboardingReminderSweep } from "../services/onboarding-reminder-sweep";

describe("#1617 onboarding reminder sweep", () => {
  beforeEach(() => {
    dueTargets = [];
    markCalls = [];
    sendEmailCalls = [];
    sendEmailMode = "ok";
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns zeros when no targets are due", async () => {
    const result = await runOnboardingReminderSweep(new Date());
    expect(result).toEqual({ scanned: 0, sent: 0, failed: 0, skipped: 0 });
    expect(sendEmailCalls).toHaveLength(0);
    expect(markCalls).toHaveLength(0);
  });

  it("sends one email per (admin, day) and marks each row", async () => {
    dueTargets = [
      {
        adminUserId: ADMIN_ID, associationId: "assoc-1",
        recipientName: "alice", recipientEmail: "alice@example.com",
        dayNumber: 7, openSteps: [2, 3],
      },
      {
        adminUserId: ADMIN_ID, associationId: "assoc-1",
        recipientName: "alice", recipientEmail: "alice@example.com",
        dayNumber: 10, openSteps: [3],
      },
    ];
    const result = await runOnboardingReminderSweep(new Date());
    expect(result.scanned).toBe(2);
    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);
    expect(sendEmailCalls).toHaveLength(2);
    expect(markCalls.map((m) => m.dayNumber).sort((a, b) => a - b)).toEqual([7, 10]);
  });

  it("skips (marks-sent without emailing) when no open steps remain", async () => {
    dueTargets = [
      {
        adminUserId: ADMIN_ID, associationId: "assoc-1",
        recipientName: "alice", recipientEmail: "alice@example.com",
        dayNumber: 7, openSteps: [],
      },
    ];
    const result = await runOnboardingReminderSweep(new Date());
    expect(result.scanned).toBe(1);
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(sendEmailCalls).toHaveLength(0);
    expect(markCalls).toHaveLength(1);
  });

  it("does NOT mark the row when send fails (retry on next tick)", async () => {
    sendEmailMode = "fail";
    dueTargets = [
      {
        adminUserId: ADMIN_ID, associationId: "assoc-1",
        recipientName: "alice", recipientEmail: "alice@example.com",
        dayNumber: 7, openSteps: [2],
      },
    ];
    const result = await runOnboardingReminderSweep(new Date());
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
    expect(markCalls).toHaveLength(0);
  });

  it("tolerates a thrown send (logs + counts failed, no mark)", async () => {
    sendEmailMode = "throw";
    dueTargets = [
      {
        adminUserId: ADMIN_ID, associationId: "assoc-1",
        recipientName: "alice", recipientEmail: "alice@example.com",
        dayNumber: 14, openSteps: [4],
      },
    ];
    const result = await runOnboardingReminderSweep(new Date());
    expect(result.failed).toBe(1);
    expect(markCalls).toHaveLength(0);
  });

  it("translates step numbers to plain-English labels in the email payload", async () => {
    dueTargets = [
      {
        adminUserId: ADMIN_ID, associationId: "assoc-1",
        recipientName: "alice", recipientEmail: "alice@example.com",
        dayNumber: 7, openSteps: [2, 4, 5],
      },
    ];
    await runOnboardingReminderSweep(new Date());
    expect(sendEmailCalls).toHaveLength(1);
    expect(sendEmailCalls[0].data.openSteps).toEqual([
      "Connect your bank",
      "Set up recurring assessments",
      "Tell owners you're using YCM",
    ]);
    expect(sendEmailCalls[0].data.dayNumber).toBe(7);
  });
});
