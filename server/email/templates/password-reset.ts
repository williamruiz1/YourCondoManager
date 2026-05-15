/**
 * Password reset (Issue founder-os#1042).
 * Fires on user-initiated password reset request.
 */

import { brandLayout, esc } from "./brand.js";
import type { TemplateModule, PasswordResetData } from "./types.js";

export const passwordResetTemplate: TemplateModule<PasswordResetData> = {
  key: "password-reset",

  subject() {
    return `Reset your YourCondoManager password`;
  },

  renderHtml(data) {
    const bodyHtml = `
      <p style="margin: 0 0 16px;">Hi ${esc(data.recipientName)},</p>
      <p style="margin: 0 0 16px;">
        We received a request to reset your YourCondoManager password.
        Click below to set a new one. The link expires in
        <strong>${esc(data.expiresInMinutes)} minutes</strong>.
      </p>
      <p style="margin: 0 0 16px; font-size: 13px; color: rgba(26,26,26,0.60);">
        If you didn't ask to reset your password, ignore this email — your
        current password stays in place and nothing happens.
      </p>
    `;
    return brandLayout({
      title: this.subject(data),
      preheader: `Reset your YourCondoManager password — link expires in ${data.expiresInMinutes} minutes.`,
      bodyHtml,
      ctaUrl: data.resetUrl,
      ctaLabel: "Reset password",
    });
  },

  renderText(data) {
    return [
      `Hi ${data.recipientName},`,
      ``,
      `We received a request to reset your YourCondoManager password.`,
      `The link below expires in ${data.expiresInMinutes} minutes.`,
      ``,
      data.resetUrl,
      ``,
      `If you didn't ask to reset your password, ignore this email — your current password stays in place and nothing happens.`,
      ``,
      `Replies to this email reach contact@yourcondomanager.org.`,
      `YourCondoManager · https://yourcondomanager.org`,
    ].join("\n");
  },
};
