/**
 * Onboarding wizard reminder cadence sweep (Issue founder-os#1617).
 *
 * Runs from the automation sweep tick in `server/index.ts`. Picks the
 * wizards eligible for Day 7/10/12/13/14 reminders, fires a Resend email
 * per (admin, day) pair, and marks the row to keep sends idempotent.
 *
 * Idempotency is durable across restarts: the dayN_reminder_sent_at
 * columns on `onboarding_progress` are the source of truth.
 */

import { storage } from "../storage.js";
import { sendEmail } from "../email/send.js";
import { log } from "../logger.js";

const STEP_LABELS: Record<number, string> = {
  1: "Confirm community details",
  2: "Connect your bank",
  3: "Upload your owner roster",
  4: "Set up recurring assessments",
  5: "Tell owners you're using YCM",
  6: "Invite board members",
  7: "Review your trial-conversion preview",
};

function resolveWizardUrl(): string {
  const fromEnv = process.env.PUBLIC_APP_URL?.trim();
  if (fromEnv) return `${fromEnv.replace(/\/$/, "")}/app/onboarding`;
  return "https://yourcondomanager.fly.dev/app/onboarding";
}

export type OnboardingReminderSweepResult = {
  scanned: number;
  sent: number;
  failed: number;
  skipped: number;
};

export async function runOnboardingReminderSweep(
  now: Date = new Date(),
): Promise<OnboardingReminderSweepResult> {
  const due = await storage.listOnboardingRemindersDue(now);
  if (due.length === 0) return { scanned: 0, sent: 0, failed: 0, skipped: 0 };

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const wizardUrl = resolveWizardUrl();

  for (const target of due) {
    if (target.openSteps.length === 0) {
      // The wizard is technically still "active" but every step is
      // resolved (the user just hasn't clicked Finish). The reminder
      // would be misleading, so mark sent + skip.
      try {
        await storage.markOnboardingReminderSent(target.adminUserId, target.dayNumber, now);
      } catch (err) {
        log(`[onboarding-reminder] mark-sent failed for ${target.adminUserId}/day${target.dayNumber}: ${(err as Error).message}`, "automation");
      }
      skipped += 1;
      continue;
    }

    try {
      const result = await sendEmail({
        to: target.recipientEmail,
        template: "onboarding-reminder",
        data: {
          recipientName: target.recipientName,
          dayNumber: target.dayNumber,
          openSteps: target.openSteps.map((n) => STEP_LABELS[n] ?? `Step ${n}`),
          wizardUrl,
        },
        tags: [
          { name: "campaign", value: "onboarding-reminder" },
          { name: "day", value: String(target.dayNumber) },
        ],
      });
      if (result.status === "sent") {
        await storage.markOnboardingReminderSent(target.adminUserId, target.dayNumber, now);
        sent += 1;
      } else {
        failed += 1;
        log(`[onboarding-reminder] send ${result.status} for ${target.recipientEmail} day${target.dayNumber}: ${result.errorMessage ?? "(no message)"}`, "automation");
      }
    } catch (err) {
      failed += 1;
      log(`[onboarding-reminder] send threw for ${target.recipientEmail} day${target.dayNumber}: ${(err as Error).message}`, "automation");
    }
  }

  return { scanned: due.length, sent, failed, skipped };
}
