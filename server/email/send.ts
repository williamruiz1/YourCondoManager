/**
 * Top-level `sendEmail({ to, subject, template, data })` wrapper.
 *
 * Per Issue founder-os#1042 dispatch §Scope:
 *   "Wire YCM codebase to send via Resend: thin wrapper at server/email/send.ts
 *    with signature sendEmail({ to, subject, template, data })"
 *
 * Resolves the provider (Resend by default, SMTP fallback) from env, renders
 * the template, and dispatches. Templates own subject + body; the explicit
 * `subject` arg overrides the template default when provided.
 *
 * Env contract (deploy-time):
 *   - EMAIL_PROVIDER       = "resend" | "smtp"     (default: "resend")
 *   - RESEND_API_KEY       = re_live_xxx
 *   - EMAIL_FROM           = noreply@yourcondomanager.org
 *   - EMAIL_REPLY_TO       = contact@yourcondomanager.org
 *
 * When `EMAIL_PROVIDER` is `smtp` (or no Resend key is configured), routes
 * through the existing `server/email-provider.ts` SMTP path so the wrapper
 * stays usable in dev / Mailpit / Mailtrap setups too.
 */

import { TEMPLATES, type TemplateKey, type TemplateDataMap } from "./templates/index.js";
import { resendSend, type ResendSendResult } from "./resend-client.js";
import { sendPlatformEmail as smtpSendEmail } from "../email-provider.js";
import { resolveTenantSender } from "./tenant-sender.js";

export type SendEmailParams<K extends TemplateKey> = {
  to: string | string[];
  /** Optional override; template provides a default subject if omitted. */
  subject?: string;
  template: K;
  data: TemplateDataMap[K];
  /** Optional reply-to override; default comes from EMAIL_REPLY_TO env. */
  replyTo?: string | null;
  /**
   * Tags forwarded to Resend (visible in their dashboard for filtering /
   * support triage). Templates that have natural identifiers (HOA, owner)
   * pass them here so analytics + debugging stay structured.
   */
  tags?: Array<{ name: string; value: string }>;
  /**
   * Association ID for the SMTP fallback path's logging (per-HOA email
   * tracking in `email_logs`). Ignored by the Resend path.
   */
  associationId?: string | null;
};

export type SendEmailResult = {
  status: "sent" | "failed" | "skipped";
  provider: "resend" | "smtp";
  messageId: string | null;
  errorMessage?: string | null;
};

function resolveProvider(): "resend" | "smtp" {
  const raw = (process.env.EMAIL_PROVIDER ?? "resend").toLowerCase().trim();
  if (raw === "smtp") return "smtp";
  // Default to Resend; fall back to SMTP if API key is missing — keeps
  // local-dev (Mailpit / Mailtrap via SMTP env) working without explicit
  // EMAIL_PROVIDER=smtp.
  if (raw === "resend" && !process.env.RESEND_API_KEY) return "smtp";
  return "resend";
}

function resolveFromAddress(): string {
  // Spec §Scope: EMAIL_FROM (e.g., noreply@yourcondomanager.org).
  return (
    process.env.EMAIL_FROM?.trim() ||
    "YourCondoManager <noreply@yourcondomanager.org>"
  );
}

function resolveReplyTo(override?: string | null): string {
  return (
    override?.trim() ||
    process.env.EMAIL_REPLY_TO?.trim() ||
    "contact@yourcondomanager.org"
  );
}

/**
 * Render + send. Type-safe over the template registry: the `data` shape is
 * inferred from the `template` key.
 */
export async function sendEmail<K extends TemplateKey>(
  params: SendEmailParams<K>,
): Promise<SendEmailResult> {
  const tpl = TEMPLATES[params.template];
  if (!tpl) {
    return {
      status: "failed",
      provider: resolveProvider(),
      messageId: null,
      errorMessage: `Unknown template: ${String(params.template)}`,
    };
  }

  const subject = params.subject ?? tpl.subject(params.data as never);
  const html = tpl.renderHtml(params.data as never);
  const text = tpl.renderText(params.data as never);

  const provider = resolveProvider();

  // Per-tenant sending alias: when this association has a configured alias AND
  // the feature flag is on, send FROM `<slug>@yourcondomanager.org` with the
  // tenant display name + Reply-To. Otherwise this returns the global default,
  // so behavior is unchanged. The From is SERVER-DERIVED from associationId —
  // never client-supplied — so one tenant can never send as another's alias.
  const tenantSender = await resolveTenantSender(params.associationId ?? null);

  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      return {
        status: "failed",
        provider: "resend",
        messageId: null,
        errorMessage: "RESEND_API_KEY env not set",
      };
    }
    // When an alias resolved, its Reply-To wins unless the caller passed an
    // explicit replyTo override.
    const replyTo =
      params.replyTo?.trim() || tenantSender.replyTo || resolveReplyTo(params.replyTo);
    const result: ResendSendResult = await resendSend(apiKey, {
      from: tenantSender.fromHeader || resolveFromAddress(),
      to: params.to,
      subject,
      html,
      text,
      replyTo,
      tags: [
        { name: "template", value: params.template },
        ...(params.tags ?? []),
      ],
    });
    if (result.ok) {
      return { status: "sent", provider: "resend", messageId: result.id };
    }
    return {
      status: "failed",
      provider: "resend",
      messageId: null,
      errorMessage: result.error,
    };
  }

  // SMTP fallback (legacy path; uses existing nodemailer infra).
  const smtpResult = await smtpSendEmail({
    to: params.to,
    subject,
    html,
    text,
    replyTo: resolveReplyTo(params.replyTo),
    associationId: params.associationId ?? null,
    templateKey: params.template,
  });
  if (smtpResult.status === "sent") {
    return { status: "sent", provider: "smtp", messageId: smtpResult.messageId };
  }
  if (smtpResult.status === "simulated") {
    return { status: "skipped", provider: "smtp", messageId: null };
  }
  return {
    status: "failed",
    provider: "smtp",
    messageId: null,
    errorMessage: smtpResult.errorMessage ?? "SMTP send failed",
  };
}

// Re-exports for callers that want the type-level mapping (e.g., to pass
// the template + data pair as a single object through a queue).
export type { TemplateKey, TemplateDataMap } from "./templates/index.js";
