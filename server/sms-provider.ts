/**
 * SMS Provider — Twilio integration with simulation fallback.
 *
 * Credential resolution order:
 *   1. Environment variable (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)
 *   2. platform_secrets database table (set via Platform Controls UI)
 *   3. Simulation mode (logs only, no real API calls)
 */

import { getSecret } from "./platform-secrets-store";

export type SendSmsPayload = {
  to: string;            // E.164 recipient number
  body: string;          // Message text (max 1600 chars)
  from?: string | null;  // Override sending number (association-specific)
  associationId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type SendSmsResult = {
  status: "sent" | "failed" | "simulated";
  messageSid: string | null;
  provider: string;
  errorMessage?: string | null;
};

async function getSmsConfig() {
  return {
    accountSid: await getSecret("TWILIO_ACCOUNT_SID", "twilio.accountSid"),
    authToken: await getSecret("TWILIO_AUTH_TOKEN", "twilio.authToken"),
    fromNumber: await getSecret("TWILIO_FROM_NUMBER", "twilio.fromNumber"),
    statusCallbackUrl: await getSecret("TWILIO_STATUS_CALLBACK_URL", "twilio.statusCallbackUrl"),
  };
}

/**
 * Validate that SMS provider credentials are present AND have valid format.
 * - accountSid must start with "AC" and be 34 characters (Twilio standard)
 * - authToken must be a 32-character hex string
 * - fromNumber must be a valid E.164 phone number (starts with "+")
 */
export async function isSmsProviderConfigured(): Promise<boolean> {
  const cfg = await getSmsConfig();
  if (!cfg.accountSid || !cfg.authToken || !cfg.fromNumber) return false;

  // Twilio Account SIDs always start with "AC" and are 34 characters
  if (!/^AC[0-9a-f]{32}$/i.test(cfg.accountSid)) return false;

  // Auth tokens are 32-character hex strings
  if (!/^[0-9a-f]{32}$/i.test(cfg.authToken)) return false;

  // From number must be E.164 format
  if (!/^\+\d{7,15}$/.test(cfg.fromNumber)) return false;

  return true;
}

export async function getSmsProviderStatus() {
  const cfg = await getSmsConfig();
  return {
    configured: Boolean(cfg.accountSid && cfg.authToken && cfg.fromNumber),
    provider: "twilio",
    fromNumber: cfg.fromNumber,
    accountSidSet: Boolean(cfg.accountSid),
    authTokenSet: Boolean(cfg.authToken),
    statusCallbackConfigured: Boolean(cfg.statusCallbackUrl),
  };
}

/**
 * Normalize a phone number string to E.164 format best-effort.
 * Strips all non-digit characters and prepends +1 for 10-digit US numbers.
 * Returns null if the result is implausible.
 */
export function normalizePhoneNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 7) return `+${digits}`;
  return null;
}

/**
 * Send an SMS via Twilio REST API (no SDK dependency — raw fetch).
 * Falls back to simulation when credentials are not configured.
 */
export async function sendSms(payload: SendSmsPayload): Promise<SendSmsResult> {
  // Normalize the recipient phone number to E.164 before any processing
  const normalizedTo = normalizePhoneNumber(payload.to);
  if (!normalizedTo) {
    return { status: "failed", messageSid: null, provider: "twilio", errorMessage: `Invalid phone number: ${payload.to}` };
  }
  payload = { ...payload, to: normalizedTo };

  const cfg = await getSmsConfig();
  const fromNumber = payload.from ? (normalizePhoneNumber(payload.from) || payload.from) : cfg.fromNumber;

  if (!(await isSmsProviderConfigured()) || !fromNumber) {
    console.warn("[sms-provider][simulation]", {
      to: payload.to,
      body: payload.body.slice(0, 80),
      associationId: payload.associationId,
    });
    return {
      status: "simulated",
      messageSid: null,
      provider: "simulation",
    };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`;
  const body = new URLSearchParams({
    To: payload.to,
    From: fromNumber,
    Body: payload.body.slice(0, 1600),
  });
  if (cfg.statusCallbackUrl) {
    body.set("StatusCallback", cfg.statusCallbackUrl);
  }

  const credentials = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const data = (await res.json()) as { sid?: string; message?: string; code?: number };

    if (!res.ok) {
      const errorMessage = data.message || `Twilio HTTP ${res.status}`;
      console.error("[sms-provider][send-failed]", { to: payload.to, errorMessage, code: data.code });
      return { status: "failed", messageSid: null, provider: "twilio", errorMessage };
    }

    return { status: "sent", messageSid: data.sid ?? null, provider: "twilio" };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[sms-provider][send-error]", { to: payload.to, errorMessage });
    return { status: "failed", messageSid: null, provider: "twilio", errorMessage };
  }
}
