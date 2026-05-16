/**
 * Receipt — Payment confirmation (Issue founder-os#1042).
 * Fires when a homeowner's payment succeeds (Stripe webhook).
 */

import { brandLayout, esc } from "./brand.js";
import type { TemplateModule, ReceiptPaymentData } from "./types.js";

export const receiptPaymentTemplate: TemplateModule<ReceiptPaymentData> = {
  key: "receipt-payment",

  subject(data) {
    return `Receipt — ${data.amountFormatted} to ${data.associationName}`;
  },

  renderHtml(data) {
    const bodyHtml = `
      <p style="margin: 0 0 16px;">Hi ${esc(data.recipientName)},</p>
      <p style="margin: 0 0 16px;">
        Your payment to <strong>${esc(data.associationName)}</strong>
        (${esc(data.unitLabel)}) has been received. Thank you.
      </p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 16px 0; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: rgba(26,26,26,0.60);">Amount</td>
          <td style="padding: 8px 0 8px 24px; font-size: 18px; font-weight: 700; color: #1a1a1a;">${esc(data.amountFormatted)}</td>
        </tr>
        <tr>
          <td style="padding: 0 0 8px; font-size: 14px; color: rgba(26,26,26,0.60);">For</td>
          <td style="padding: 0 0 8px 24px; font-size: 14px; color: #1a1a1a;">${esc(data.description)}</td>
        </tr>
        <tr>
          <td style="padding: 0 0 8px; font-size: 14px; color: rgba(26,26,26,0.60);">Paid</td>
          <td style="padding: 0 0 8px 24px; font-size: 14px; color: #1a1a1a;">${esc(data.paidAt)}</td>
        </tr>
        <tr>
          <td style="padding: 0; font-size: 14px; color: rgba(26,26,26,0.60);">Receipt #</td>
          <td style="padding: 0 0 0 24px; font-size: 13px; color: #1a1a1a; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">${esc(data.receiptReference)}</td>
        </tr>
      </table>
      <p style="margin: 16px 0 0; font-size: 13px; color: rgba(26,26,26,0.60);">
        Keep this receipt for your records. ACH payments may take 3–5 business
        days to fully settle on your bank statement.
      </p>
    `;
    return brandLayout({
      title: this.subject(data),
      preheader: `${data.amountFormatted} received by ${data.associationName} for ${data.description}.`,
      bodyHtml,
    });
  },

  renderText(data) {
    return [
      `Hi ${data.recipientName},`,
      ``,
      `Your payment to ${data.associationName} (${data.unitLabel}) has been received. Thank you.`,
      ``,
      `Amount:    ${data.amountFormatted}`,
      `For:       ${data.description}`,
      `Paid:      ${data.paidAt}`,
      `Receipt #: ${data.receiptReference}`,
      ``,
      `Keep this receipt for your records. ACH payments may take 3–5 business days to fully settle on your bank statement.`,
      ``,
      `Replies to this email reach contact@yourcondomanager.org.`,
      `YourCondoManager · https://yourcondomanager.org`,
    ].join("\n");
  },
};
