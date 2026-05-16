/**
 * Welcome — Owner portal access (Issue founder-os#1042).
 * Fires when an HOA invites a homeowner to the owner portal.
 */

import { brandLayout, esc } from "./brand.js";
import type { TemplateModule, WelcomeOwnerData } from "./types.js";

export const welcomeOwnerTemplate: TemplateModule<WelcomeOwnerData> = {
  key: "welcome-owner",

  subject(data) {
    return `${data.associationName} — your owner portal is ready`;
  },

  renderHtml(data) {
    const bodyHtml = `
      <p style="margin: 0 0 16px;">Hi ${esc(data.recipientName)},</p>
      <p style="margin: 0 0 16px;">
        Welcome to the <strong>${esc(data.associationName)}</strong> owner portal
        for <strong>${esc(data.unitLabel)}</strong>.
      </p>
      <p style="margin: 0 0 16px;">
        From the portal you can view your account balance, see recent
        assessments and payments, pay online via ACH or card, and message
        the board when something needs attention.
      </p>
      <p style="margin: 0 0 8px;">Click below to open your portal and set your password.</p>
    `;
    return brandLayout({
      title: this.subject(data),
      preheader: `Your owner portal at ${data.associationName} (${data.unitLabel}) is ready.`,
      bodyHtml,
      ctaUrl: data.portalUrl,
      ctaLabel: "Open your owner portal",
    });
  },

  renderText(data) {
    return [
      `Hi ${data.recipientName},`,
      ``,
      `Welcome to the ${data.associationName} owner portal for ${data.unitLabel}.`,
      ``,
      `From the portal you can view your account balance, see recent assessments and payments, pay online via ACH or card, and message the board when something needs attention.`,
      ``,
      `Open your portal and set your password:`,
      data.portalUrl,
      ``,
      `Replies to this email reach contact@yourcondomanager.org.`,
      `YourCondoManager · https://yourcondomanager.org`,
    ].join("\n");
  },
};
