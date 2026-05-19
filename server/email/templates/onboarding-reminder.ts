/**
 * Onboarding wizard Day 7/10/12/13/14 reminder (Issue founder-os#1617).
 *
 * Sent by the automation sweep when a treasurer's self-managed onboarding
 * wizard has incomplete steps and the day-N threshold is crossed. The
 * cadence escalates: Day 7 is a friendly nudge ("here's what's left"),
 * Day 13/14 is the trial-clock-running closer.
 */

import { brandLayout, esc } from "./brand.js";
import type { TemplateModule, OnboardingReminderData } from "./types.js";

const DAY_TONE: Record<number, { headline: string; preheader: string; tone: string }> = {
  7: {
    headline: "You're a week into YCM — here's what's left",
    preheader: "Day 7 of your 14-day setup. A few steps still open.",
    tone: "Halfway there! Here are the wizard steps still open for your community.",
  },
  10: {
    headline: "Four days left in setup — quick check-in",
    preheader: "Day 10 of 14. We can usually finish the rest in 15 minutes.",
    tone: "You're past the midpoint. The steps below are the ones still open — most boards finish them in 15 minutes.",
  },
  12: {
    headline: "Two days left to wrap up setup",
    preheader: "Day 12 of 14. Two steps stand between you and first payment.",
    tone: "Two days left. Once these are done you can start collecting assessments.",
  },
  13: {
    headline: "Setup expires tomorrow",
    preheader: "Day 13. Tomorrow your free setup window closes — but your data stays put.",
    tone: "Tomorrow is the last day of your setup window. Your data stays — but the reminder cadence stops, and we'd rather see you across the finish line.",
  },
  14: {
    headline: "Today's the day — finish setup",
    preheader: "Day 14 — the final reminder. Wrap up in 15 minutes.",
    tone: "Last day of setup. Wrap up the steps below to start collecting your first payments this week.",
  },
};

export const onboardingReminderTemplate: TemplateModule<OnboardingReminderData> = {
  key: "onboarding-reminder",

  subject(data) {
    return DAY_TONE[data.dayNumber]?.headline ?? `Day ${data.dayNumber} of YCM setup`;
  },

  renderHtml(data) {
    const tone = DAY_TONE[data.dayNumber] ?? {
      headline: this.subject(data),
      preheader: `Day ${data.dayNumber} reminder.`,
      tone: "Here are the wizard steps still open.",
    };
    const stepList = data.openSteps
      .map((s) => `<li style="margin: 4px 0;">${esc(s)}</li>`)
      .join("");
    const bodyHtml = `
      <p style="margin: 0 0 16px;">Hi ${esc(data.recipientName)},</p>
      <p style="margin: 0 0 16px;">${esc(tone.tone)}</p>
      ${data.openSteps.length > 0
        ? `<ul style="margin: 0 0 16px 20px; padding: 0;">${stepList}</ul>`
        : `<p style="margin: 0 0 16px;">Looks like everything's resolved — click below to wrap up onboarding.</p>`}
      <p style="margin: 0 0 8px;">Pick up where you left off:</p>
    `;
    return brandLayout({
      title: tone.headline,
      preheader: tone.preheader,
      bodyHtml,
      ctaUrl: data.wizardUrl,
      ctaLabel: "Open onboarding wizard",
    });
  },

  renderText(data) {
    const tone = DAY_TONE[data.dayNumber];
    return [
      `Hi ${data.recipientName},`,
      ``,
      tone?.tone ?? `Day ${data.dayNumber} reminder.`,
      ``,
      ...(data.openSteps.length > 0
        ? ["Steps still open:", ...data.openSteps.map((s) => `  - ${s}`), ``]
        : ["Everything looks resolved — click below to wrap up onboarding.", ``]),
      `Open the wizard: ${data.wizardUrl}`,
      ``,
      `— The YourCondoManager team`,
      `Replies to this email reach contact@yourcondomanager.org.`,
    ].join("\n");
  },
};
