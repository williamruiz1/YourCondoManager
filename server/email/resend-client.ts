/**
 * Resend API client (raw fetch, no SDK).
 *
 * Per Issue founder-os#1042. Matches the existing Stripe-without-SDK pattern
 * in this codebase (raw HTTP via `fetch` against the documented REST surface).
 *
 * Resend's API: https://resend.com/docs/api-reference/emails/send-email
 *
 * The wrapper is intentionally thin — it owns the HTTP shape only. Template
 * rendering, env-var resolution, and provider-selection live in `send.ts` so
 * tests can stub one without the other.
 */

export type ResendSendInput = {
  /** "Friendly Name <addr@host>" or just "addr@host". Must match a verified domain. */
  from: string;
  to: string | string[];
  subject: string;
  html?: string | null;
  text?: string | null;
  replyTo?: string | string[] | null;
  cc?: string | string[] | null;
  bcc?: string | string[] | null;
  /** Custom headers (rare; e.g., List-Unsubscribe). */
  headers?: Record<string, string> | null;
  /** Tag-style metadata; Resend supports up to 10 tags per send. */
  tags?: Array<{ name: string; value: string }> | null;
};

export type ResendSendResult =
  | { ok: true; id: string }
  | { ok: false; error: string; status: number };

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Send an email via the Resend REST API. Returns a discriminated union so
 * callers can switch on `.ok` without try/catch noise.
 *
 * On 4xx/5xx, returns `{ ok: false, error, status }` with the Resend message
 * parsed where possible. On network errors, returns the underlying error
 * stringified.
 */
export async function resendSend(
  apiKey: string,
  input: ResendSendInput,
): Promise<ResendSendResult> {
  const body: Record<string, unknown> = {
    from: input.from,
    to: input.to,
    subject: input.subject,
  };
  if (input.html) body.html = input.html;
  if (input.text) body.text = input.text;
  if (input.replyTo) body.reply_to = input.replyTo;
  if (input.cc) body.cc = input.cc;
  if (input.bcc) body.bcc = input.bcc;
  if (input.headers) body.headers = input.headers;
  if (input.tags) body.tags = input.tags;

  let res: Response;
  try {
    res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const parsed = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const message =
      parsed && typeof parsed.message === "string"
        ? parsed.message
        : `Resend send failed (HTTP ${res.status})`;
    return { ok: false, status: res.status, error: message };
  }

  const id = parsed && typeof parsed.id === "string" ? parsed.id : null;
  if (!id) {
    return {
      ok: false,
      status: res.status,
      error: "Resend response missing `id` field",
    };
  }

  return { ok: true, id };
}
