export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

/** Structured debug logging — suppressed in production. */
export function debug(label: string, data?: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  console.debug(label, data !== undefined ? data : "");
}

// ---------------------------------------------------------------------------
// Request-log redaction (A-SEC-001, founder-os#10738)
//
// The global /api request logger previously appended the ENTIRE JSON response
// body to stdout in production — leaking owner PII, financial/ledger records,
// Plaid data, and replayable auth/OTP/session tokens into Fly's plaintext logs.
// The rules now:
//   - PRODUCTION: never serialize any response body into the log line.
//   - non-production: an OPTIONAL redacted + truncated body preview for local
//     debugging, with known-sensitive keys hard-redacted regardless of env.
// ---------------------------------------------------------------------------

/** Keys whose values must never appear in a log line (case-insensitive substring match). */
const SENSITIVE_KEY_PATTERN =
  /(token|password|passwd|secret|authorization|auth|otp|ssn|api[-_]?key|apikey|card|cvv|cvc|iban|routing|account|email|access[-_]?id|cookie|session)/i;

const REDACTED = "[REDACTED]";
const MAX_LOG_BODY_CHARS = 500;

/**
 * Deep-redact known-sensitive keys from a value and return a truncated JSON
 * string safe to write to a log. Circular-ref and depth safe. Exported for
 * unit testing.
 */
export function redactForLog(value: unknown, maxChars = MAX_LOG_BODY_CHARS): string {
  const seen = new WeakSet<object>();
  const walk = (v: unknown, depth: number): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (depth > 6) return "[…]";
    if (seen.has(v as object)) return "[Circular]";
    seen.add(v as object);
    if (Array.isArray(v)) return v.map((item) => walk(item, depth + 1));
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY_PATTERN.test(k) ? REDACTED : walk(val, depth + 1);
    }
    return out;
  };
  let str: string;
  try {
    str = JSON.stringify(walk(value, 0));
  } catch {
    return "[unserializable]";
  }
  if (str === undefined) return "";
  return str.length > maxChars ? `${str.slice(0, maxChars)}…(truncated)` : str;
}

/**
 * Build the `/api` request log line. Only method/path/status/duration in
 * production; a redacted+truncated body preview is appended ONLY in
 * non-production. Exported for unit testing. `body` present or not, the
 * returned line never contains a sensitive value.
 */
export function formatApiLogLine(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  body?: unknown,
): string {
  const line = `${method} ${path} ${statusCode} in ${durationMs}ms`;
  if (process.env.NODE_ENV !== "production" && body !== undefined) {
    return `${line} :: ${redactForLog(body)}`;
  }
  return line;
}
