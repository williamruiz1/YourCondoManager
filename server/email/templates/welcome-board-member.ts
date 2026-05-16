/**
 * Welcome — Board Member onboarding (Issue founder-os#1042).
 * Fires when a new board user is invited to YCM.
 */

import { brandLayout, esc } from "./brand.js";
import type { TemplateModule, WelcomeBoardMemberData } from "./types.js";

export const welcomeBoardMemberTemplate: TemplateModule<WelcomeBoardMemberData> = {
  key: "welcome-board-member",

  subject(data) {
    return `Welcome to YourCondoManager — ${data.associationName}`;
  },

  renderHtml(data) {
    const bodyHtml = `
      <p style="margin: 0 0 16px;">Hi ${esc(data.recipientName)},</p>
      <p style="margin: 0 0 16px;">
        <strong>${esc(data.invitedBy)}</strong> invited you to join YourCondoManager
        as a board member of <strong>${esc(data.associationName)}</strong>.
      </p>
      <p style="margin: 0 0 16px;">
        From here you'll be able to review owner ledgers, approve assessments,
        send notices, and track everything the AI co-pilot does on your
        association's behalf.
      </p>
      <p style="margin: 0 0 8px;">Click below to set your password and finish signing in.</p>
    `;
    return brandLayout({
      title: this.subject(data),
      preheader: `${data.invitedBy} invited you to ${data.associationName} on YourCondoManager.`,
      bodyHtml,
      ctaUrl: data.loginUrl,
      ctaLabel: "Finish setting up your account",
    });
  },

  renderText(data) {
    return [
      `Hi ${data.recipientName},`,
      ``,
      `${data.invitedBy} invited you to join YourCondoManager as a board member of ${data.associationName}.`,
      ``,
      `From here you'll be able to review owner ledgers, approve assessments, send notices, and track everything the AI co-pilot does on your association's behalf.`,
      ``,
      `Set your password and finish signing in:`,
      data.loginUrl,
      ``,
      `Replies to this email reach contact@yourcondomanager.org.`,
      `YourCondoManager · https://yourcondomanager.org`,
    ].join("\n");
  },
};
