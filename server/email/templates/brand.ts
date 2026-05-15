/**
 * Shared YCM v1 brand layout for transactional emails.
 *
 * Per Issue founder-os#1042 + memory project_ycm_brand_v1. Keeps every
 * template visually consistent without per-template style duplication.
 *
 * Email-client safe: inline styles only, no external stylesheets, no JS,
 * no flexbox / grid (Outlook), no @media (some legacy clients). Table-
 * based layout is the email-client lowest-common-denominator.
 */

const PRIMARY = "#1f3a5f"; // YCM v1 deep navy
const ACCENT = "#c4b9a0"; // YCM v1 warm cream-gold (matches Duho palette)
const BG = "#fafaf7"; // off-white page background
const FG = "#1a1a1a"; // body text
const MUTED = "rgba(26,26,26,0.60)"; // secondary text

export type BrandFooterOptions = {
  /** Override the default reply-to address shown in footer copy. */
  replyToOverride?: string | null;
};

/**
 * HTML escape helper — every dynamic field gets passed through this before
 * insertion into the template HTML.
 */
export function esc(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function brandLayout(opts: {
  title: string;
  preheader: string;
  bodyHtml: string;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  footer?: BrandFooterOptions;
}): string {
  const cta =
    opts.ctaUrl && opts.ctaLabel
      ? `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0;">
          <tr>
            <td bgcolor="${PRIMARY}" style="padding: 12px 28px; border-radius: 4px;">
              <a href="${esc(opts.ctaUrl)}" style="color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">${esc(opts.ctaLabel)}</a>
            </td>
          </tr>
        </table>
      `
      : "";

  const replyTo = opts.footer?.replyToOverride ?? "contact@yourcondomanager.org";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${esc(opts.title)}</title>
</head>
<body style="margin: 0; padding: 0; background: ${BG}; color: ${FG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
  <!-- Preheader (hidden inbox preview text) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${esc(opts.preheader)}</div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: ${BG};">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background: #ffffff; border: 1px solid ${ACCENT}33; border-radius: 6px; overflow: hidden;">
          <!-- Header / wordmark -->
          <tr>
            <td style="padding: 28px 32px 16px; border-bottom: 1px solid ${ACCENT}33;">
              <span style="color: ${PRIMARY}; font-size: 22px; font-weight: 700; letter-spacing: 0.01em;">YourCondoManager</span>
              <div style="color: ${MUTED}; font-size: 12px; margin-top: 2px;">Co-pilot for self-managed HOAs</div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 28px 32px; font-size: 15px; line-height: 1.55; color: ${FG};">
              ${opts.bodyHtml}
              ${cta}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid ${ACCENT}33; background: ${BG}; font-size: 12px; color: ${MUTED}; line-height: 1.5;">
              Replies to this email reach <a href="mailto:${esc(replyTo)}" style="color: ${PRIMARY}; text-decoration: none;">${esc(replyTo)}</a>.<br>
              YourCondoManager · <a href="https://yourcondomanager.org" style="color: ${PRIMARY}; text-decoration: none;">yourcondomanager.org</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
