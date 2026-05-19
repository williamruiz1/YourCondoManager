/**
 * Wizard Step 5 — "we're using YCM now" announcement to community owners.
 * (Issue founder-os#1617).
 *
 * Sent in bulk to all owners of a community when the treasurer hits "Send
 * announcement" in the onboarding wizard's Step 5. Subject + body are
 * fully customizable by the board so each community sounds like itself,
 * but ship with sensible defaults that work for 90% of boards.
 */

import { brandLayout, esc } from "./brand.js";
import type { TemplateModule, CommunityAnnouncementData } from "./types.js";

export const communityAnnouncementTemplate: TemplateModule<CommunityAnnouncementData> = {
  key: "community-announcement",

  subject(data) {
    return data.subjectOverride?.trim()
      || `${data.communityName} is now using YourCondoManager`;
  },

  renderHtml(data) {
    // The board-authored message is intentionally rendered as plain
    // paragraphs (no HTML pass-through) so a typo'd <script> can't fan out
    // to every owner inbox. We split on blank lines so paragraph breaks
    // survive but markup doesn't.
    const safeParagraphs = data.bodyText
      .split(/\n\s*\n/)
      .map((p) => `<p style="margin: 0 0 16px;">${esc(p.trim())}</p>`)
      .join("");

    const bodyHtml = `
      <p style="margin: 0 0 16px;">Hi ${esc(data.recipientName ?? "neighbor")},</p>
      ${safeParagraphs}
      <p style="margin: 0 0 8px;">Set up your owner portal access below — takes about 2 minutes.</p>
    `;
    return brandLayout({
      title: this.subject(data),
      preheader: `A message from your board about your new community portal.`,
      bodyHtml,
      ctaUrl: data.portalUrl,
      ctaLabel: "Access the owner portal",
    });
  },

  renderText(data) {
    return [
      `Hi ${data.recipientName ?? "neighbor"},`,
      ``,
      data.bodyText.trim(),
      ``,
      `Set up your owner portal access: ${data.portalUrl}`,
      ``,
      `Sent via YourCondoManager — replies reach ${data.replyToLabel}.`,
    ].join("\n");
  },
};
