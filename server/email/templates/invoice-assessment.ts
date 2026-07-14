/**
 * Invoice — Assessment due (Issue founder-os#1042).
 * Fires when a monthly / quarterly assessment is issued to a homeowner.
 */

import { brandLayout, esc } from "./brand.js";
import type { TemplateModule, InvoiceAssessmentData } from "./types.js";

export const invoiceAssessmentTemplate: TemplateModule<InvoiceAssessmentData> = {
  key: "invoice-assessment",

  subject(data) {
    return `${data.associationName} — ${data.description} (${data.amountFormatted} due ${data.dueDate})`;
  },

  renderHtml(data) {
    const bodyHtml = `
      <p style="margin: 0 0 16px;">Hi ${esc(data.recipientName)},</p>
      <p style="margin: 0 0 16px;">
        Your ${esc(data.description)} for <strong>${esc(data.associationName)}</strong>
        (${esc(data.unitLabel)}) is ready:
      </p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 16px 0; border-collapse: collapse;">
        <tr>
          <td style="padding: 12px 0; font-size: 14px; color: rgba(26,26,26,0.60);">Amount</td>
          <td style="padding: 12px 0 12px 24px; font-size: 18px; font-weight: 700; color: #1a1a1a;">${esc(data.amountFormatted)}</td>
        </tr>
        <tr>
          <td style="padding: 0 0 12px; font-size: 14px; color: rgba(26,26,26,0.60);">Due date</td>
          <td style="padding: 0 0 12px 24px; font-size: 14px; color: #1a1a1a;">${esc(data.dueDate)}</td>
        </tr>${data.currentBalanceFormatted ? `
        <tr>
          <td style="padding: 0 0 12px; font-size: 14px; color: rgba(26,26,26,0.60);">Current balance</td>
          <td style="padding: 0 0 12px 24px; font-size: 14px; color: #1a1a1a;">${esc(data.currentBalanceFormatted)}</td>
        </tr>` : ``}
      </table>
      <p style="margin: 0 0 8px;">Pay online via ACH or card — settlement and your receipt arrive automatically.</p>
    `;
    return brandLayout({
      title: this.subject(data),
      preheader: `${data.amountFormatted} due ${data.dueDate} for ${data.description}.`,
      bodyHtml,
      ctaUrl: data.paymentLinkUrl,
      ctaLabel: "Pay now",
    });
  },

  renderText(data) {
    return [
      `Hi ${data.recipientName},`,
      ``,
      `Your ${data.description} for ${data.associationName} (${data.unitLabel}) is ready:`,
      ``,
      `Amount:    ${data.amountFormatted}`,
      `Due date:  ${data.dueDate}`,
      ...(data.currentBalanceFormatted ? [`Balance:   ${data.currentBalanceFormatted}`] : []),
      ``,
      `Pay online via ACH or card — settlement and your receipt arrive automatically.`,
      ``,
      `Pay now: ${data.paymentLinkUrl}`,
      ``,
      `Replies to this email reach contact@yourcondomanager.org.`,
      `YourCondoManager · https://yourcondomanager.org`,
    ].join("\n");
  },
};
