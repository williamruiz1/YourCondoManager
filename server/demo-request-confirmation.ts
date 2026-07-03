/**
 * "Talk to us" / demo-request submitter confirmation.
 *
 * Site audit 2026-06-22 (BLOCKER 1): the demo-request handler in routes.ts
 * notified the YCM platform admins but sent NO confirmation back to the
 * person who submitted the form — even though the modal tells them
 * "We've got your message and will be in touch shortly". A contact form
 * that silently swallows the submitter's address with no acknowledgement
 * reads as broken to a prospect.
 *
 * This module sends that confirmation. It reuses the EXISTING email
 * transport (`sendPlatformEmail`, the Gmail-SMTP path whose FROM defaults
 * to noreply@yourcondomanager.org via getEmailConfig().fromAddress) and the
 * same branded transactional template every other platform email rides — no
 * new transport is introduced.
 *
 * The send is best-effort: the handler does NOT block its HTTP response on
 * it, and a failure here MUST NOT fail the submission (the enquiry already
 * reached YCM via the admin notification). Failures are logged.
 */

import { sendPlatformEmail, type SendEmailResult } from "./email-provider";
import { log } from "./logger";

export type DemoRequestConfirmationInput = {
  /** The submitter's email address — where the confirmation is sent. */
  email: string;
  /** The submitter's name, used to personalize the greeting. */
  name: string;
  /** Association/community name, if provided. */
  associationName?: string;
};

/**
 * Build the plain-text body of the submitter confirmation. Exported so the
 * copy can be asserted directly in tests.
 */
export function buildDemoRequestConfirmationText(input: DemoRequestConfirmationInput): string {
  const firstName = input.name.trim().split(/\s+/)[0] || "there";
  return `
Hi ${firstName},

Thanks — we got your message. The Your Condo Manager team will be in touch
shortly${input.associationName ? ` about ${input.associationName}` : ""}.

If you didn't submit an enquiry on yourcondomanager.org, you can safely
ignore this email.

— The Your Condo Manager Team
`.trim();
}

/**
 * Send the "we got your message" confirmation to the submitter. Best-effort:
 * resolves to the send result on success, or to `null` on any failure (the
 * failure is logged and swallowed so the caller's submission flow is never
 * blocked or failed by a confirmation-email problem).
 */
export async function sendDemoRequestConfirmation(
  input: DemoRequestConfirmationInput,
): Promise<SendEmailResult | null> {
  try {
    const subject = "Thanks — we got your message · Your Condo Manager";
    const result = await sendPlatformEmail({
      to: input.email,
      subject,
      text: buildDemoRequestConfirmationText(input),
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`[demo-request] submitter confirmation failed (non-fatal): ${message}`, "email");
    return null;
  }
}
