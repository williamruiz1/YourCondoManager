import crypto from "crypto";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "./db";
import { emailEvents, emailLogs, type EmailEvent, type EmailLog } from "@shared/schema";

type EmailAddressLike = string | string[] | null | undefined;

export type EmailAttachment = {
  filename: string;
  contentType?: string | null;
  content: Buffer | string;
};

export type SendEmailPayload = {
  associationId?: string | null;
  to: EmailAddressLike;
  cc?: EmailAddressLike;
  bcc?: EmailAddressLike;
  subject: string;
  html?: string | null;
  text?: string | null;
  attachments?: EmailAttachment[];
  replyTo?: string | null;
  metadata?: Record<string, unknown> | null;
  templateKey?: string | null;
  enableTracking?: boolean | null;
};

export type SendEmailResult = {
  status: "sent" | "failed" | "simulated";
  messageId: string | null;
  logId: string;
  provider: string;
  errorMessage?: string | null;
};

type TrackingTokenPayload = {
  kind: "open" | "click";
  logId: string;
  url?: string;
  exp?: number;
};

type SmtpConfig = {
  host: string | null;
  port: number;
  secure: boolean;
  user: string | null;
  pass: string | null;
  fromAddress: string | null;
  fromName: string | null;
  replyTo: string | null;
  trackingEnabled: boolean;
  trackingBaseUrl: string | null;
  trackingRetentionDays: number;
  maxRetries: number;
  retryBackoffMs: number;
  poolMaxConnections: number;
  poolMaxMessages: number;
  tlsRequired: boolean;
  allowedRedirectDomains: string[];
  connectTimeoutMs: number;
};

const ONE_BY_ONE_GIF = Buffer.from(
  "R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==",
  "base64",
);

const TRANSIENT_SMTP_CODES = new Set([
  "ECONNECTION",
  "ETIMEDOUT",
  "EENVELOPE",
  "ESOCKET",
  "ECONNRESET",
  "EAI_AGAIN",
]);

let cachedTransporter: nodemailer.Transporter | null = null;
let cachedTransporterKey: string | null = null;

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null) return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getOptionalEnv(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return null;
}

function normalizeAddressList(value: EmailAddressLike): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : value.split(",");
  return Array.from(
    new Set(
      list
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function textToHtml(value: string): string {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br/>")}</p>`)
    .join("");
}

function getIpAddress(headers: Record<string, unknown>, fallback?: string | null): string | null {
  const forwarded = headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return fallback ?? null;
}

function getEmailConfig(): SmtpConfig {
  const provider = (process.env.EMAIL_PROVIDER || "").trim().toLowerCase();
  const legacyGmailUser = getOptionalEnv("GMAIL_SENDER_EMAIL", "GMAIL_EMAIL", "GMAIL_USER");
  const legacyGmailPass = getOptionalEnv("GMAIL_APP_PASSWORD", "GMAIL_PASSWORD");
  const host =
    getOptionalEnv("SMTP_HOST") ||
    ((provider === "gmail" || legacyGmailUser) ? "smtp.gmail.com" : null);
  const port = parseNumber(process.env.SMTP_PORT, host === "smtp.gmail.com" ? 465 : 587);
  const user = getOptionalEnv("SMTP_USER") || legacyGmailUser;
  const pass = getOptionalEnv("SMTP_PASS") || legacyGmailPass;
  return {
    host,
    port,
    secure: parseBoolean(process.env.EMAIL_TLS_IMPLICIT, port === 465),
    user,
    pass,
    fromAddress: getOptionalEnv("EMAIL_FROM_ADDRESS") || legacyGmailUser,
    fromName: getOptionalEnv("EMAIL_FROM_NAME"),
    replyTo: getOptionalEnv("EMAIL_REPLY_TO"),
    trackingEnabled: parseBoolean(process.env.EMAIL_TRACKING_ENABLED, false),
    trackingBaseUrl: process.env.EMAIL_TRACKING_BASE_URL?.trim() || null,
    trackingRetentionDays: parseNumber(process.env.EMAIL_TRACKING_RETENTION_DAYS, 90),
    maxRetries: parseNumber(process.env.EMAIL_MAX_RETRIES, 3),
    retryBackoffMs: parseNumber(process.env.EMAIL_RETRY_BACKOFF_MS, 500),
    poolMaxConnections: parseNumber(process.env.EMAIL_POOL_MAX_CONNECTIONS, 5),
    poolMaxMessages: parseNumber(process.env.EMAIL_POOL_MAX_MESSAGES, 100),
    tlsRequired: parseBoolean(process.env.EMAIL_TLS_REQUIRED, false),
    allowedRedirectDomains: (process.env.EMAIL_ALLOWED_REDIRECT_DOMAINS || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
    connectTimeoutMs: parseNumber(process.env.EMAIL_SMTP_TIMEOUT_MS, 15000),
  };
}

function isSmtpConfigured(config = getEmailConfig()): boolean {
  return Boolean(config.host && config.user && config.pass && config.fromAddress);
}

export function isEmailProviderConfigured(): boolean {
  return isSmtpConfigured();
}

function getTrackingSecret(): string {
  return process.env.EMAIL_TRACKING_SECRET?.trim() || process.env.SESSION_SECRET?.trim() || "dev-email-tracking-secret";
}

function signToken(payload: TrackingTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", getTrackingSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyToken(token: string): TrackingTokenPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac("sha256", getTrackingSecret()).update(encoded).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TrackingTokenPayload;
  if (payload.exp && Date.now() > payload.exp) return null;
  return payload;
}

function validateRedirectUrl(rawUrl: string, config = getEmailConfig()): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (config.allowedRedirectDomains.length === 0) return parsed.toString();
    const host = parsed.hostname.toLowerCase();
    const allowed = config.allowedRedirectDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
    return allowed ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function isTransientSmtpError(error: unknown): boolean {
  const err = error as { code?: string; responseCode?: number };
  if (err?.code && TRANSIENT_SMTP_CODES.has(err.code)) return true;
  return typeof err?.responseCode === "number" && err.responseCode >= 400 && err.responseCode < 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTransporter(config = getEmailConfig()): nodemailer.Transporter {
  const cacheKey = JSON.stringify({
    host: config.host,
    port: config.port,
    user: config.user,
    fromAddress: config.fromAddress,
    poolMaxConnections: config.poolMaxConnections,
    poolMaxMessages: config.poolMaxMessages,
    tlsRequired: config.tlsRequired,
  });
  if (cachedTransporter && cachedTransporterKey === cacheKey) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: config.host!,
    port: config.port,
    secure: config.secure,
    pool: true,
    maxConnections: config.poolMaxConnections,
    maxMessages: config.poolMaxMessages,
    auth: {
      user: config.user!,
      pass: config.pass!,
    },
    requireTLS: config.tlsRequired,
    connectionTimeout: config.connectTimeoutMs,
    greetingTimeout: config.connectTimeoutMs,
    socketTimeout: config.connectTimeoutMs,
  });
  cachedTransporterKey = cacheKey;
  return cachedTransporter;
}

async function createEmailLog(payload: SendEmailPayload, trackingToken: string | null): Promise<EmailLog> {
  const [emailLog] = await db
    .insert(emailLogs)
    .values({
      associationId: payload.associationId ?? null,
      toAddress: normalizeAddressList(payload.to).join(", "),
      ccAddresses: normalizeAddressList(payload.cc),
      bccAddresses: normalizeAddressList(payload.bcc),
      subject: payload.subject,
      templateKey: payload.templateKey ?? null,
      status: "queued",
      provider: isSmtpConfigured() ? "smtp" : "simulation",
      providerMessageId: null,
      errorMessage: null,
      metadataJson: payload.metadata ?? null,
      trackingToken,
      sentAt: null,
      updatedAt: new Date(),
    })
    .returning();

  return emailLog;
}

async function updateEmailLog(id: string, patch: Partial<typeof emailLogs.$inferInsert>): Promise<EmailLog> {
  const [emailLog] = await db
    .update(emailLogs)
    .set({
      ...patch,
      updatedAt: new Date(),
    })
    .where(eq(emailLogs.id, id))
    .returning();
  return emailLog;
}

function rewriteTrackedLinks(html: string, logId: string, config = getEmailConfig()): string {
  const baseUrl = config.trackingBaseUrl;
  if (!baseUrl) return html;
  return html.replace(/href=(["'])(https?:\/\/[^"']+)\1/gi, (_match, quote: string, url: string) => {
    const safeUrl = validateRedirectUrl(url, config);
    if (!safeUrl) return `href=${quote}${url}${quote}`;
    const token = signToken({
      kind: "click",
      logId,
      url: safeUrl,
      exp: Date.now() + (1000 * 60 * 60 * 24 * 30),
    });
    return `href=${quote}${baseUrl.replace(/\/$/, "")}/api/platform/email/tracking/click/${token}${quote}`;
  });
}

function appendTrackingPixel(html: string, logId: string, config = getEmailConfig()): string {
  const baseUrl = config.trackingBaseUrl;
  if (!baseUrl) return html;
  const token = signToken({
    kind: "open",
    logId,
    exp: Date.now() + (1000 * 60 * 60 * 24 * 30),
  });
  const pixelUrl = `${baseUrl.replace(/\/$/, "")}/api/platform/email/tracking/pixel/${token}`;
  return `${html}<img src="${pixelUrl}" alt="" width="1" height="1" style="display:none" />`;
}

export async function verifyEmailConnection(): Promise<{ ok: boolean; provider: string; message: string }> {
  const config = getEmailConfig();
  if (!isSmtpConfigured(config)) {
    return {
      ok: true,
      provider: "simulation",
      message: "SMTP not configured; emails will be simulated (not delivered).",
    };
  }

  await getTransporter(config).verify();
  return {
    ok: true,
    provider: "smtp",
    message: `SMTP connection verified for ${config.host}:${config.port}.`,
  };
}

export async function sendPlatformEmail(payload: SendEmailPayload): Promise<SendEmailResult> {
  const config = getEmailConfig();
  const to = normalizeAddressList(payload.to);
  const cc = normalizeAddressList(payload.cc);
  const bcc = normalizeAddressList(payload.bcc);
  const invalid = [...to, ...cc, ...bcc].find((address) => !isValidEmailAddress(address));
  if (to.length === 0) throw new Error("At least one recipient is required");
  if (invalid) throw new Error(`Invalid email address: ${invalid}`);

  const trackingEnabled = Boolean(payload.enableTracking ?? config.trackingEnabled);
  const trackingToken = trackingEnabled ? crypto.randomUUID() : null;
  const emailLog = await createEmailLog(payload, trackingToken);

  // Append owner portal link to all outbound emails, but only when a real URL is configured
  const appBaseUrl = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
  const isRealUrl = appBaseUrl && !appBaseUrl.includes("localhost") && !appBaseUrl.includes("127.0.0.1");
  const portalUrl = isRealUrl ? `${appBaseUrl}/portal` : null;
  if (!isRealUrl && process.env.APP_BASE_URL) {
    console.warn("[email] APP_BASE_URL looks like a local address — portal link omitted from email footer");
  }
  const portalFooterHtml = portalUrl
    ? `<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/><p style="font-size:12px;color:#6b7280;margin:0">Access your owner portal anytime at <a href="${portalUrl}" style="color:#4f46e5">${portalUrl}</a></p>`
    : "";
  const portalFooterText = portalUrl ? `\n\n---\nAccess your owner portal: ${portalUrl}` : "";

  let html = payload.html?.trim() || (payload.text?.trim() ? textToHtml(payload.text.trim()) : "");
  const text = (payload.text?.trim() || "") + (payload.text?.trim() ? portalFooterText : "");
  if (!html && !text) {
    await updateEmailLog(emailLog.id, { status: "failed", errorMessage: "Email body is required" });
    return {
      status: "failed",
      messageId: null,
      logId: emailLog.id,
      provider: emailLog.provider,
      errorMessage: "Email body is required",
    };
  }

  if (html) html = html + portalFooterHtml;

  if (trackingEnabled && html) {
    html = appendTrackingPixel(rewriteTrackedLinks(html, emailLog.id, config), emailLog.id, config);
  }

  if (!isSmtpConfigured(config)) {
    console.warn("[email][simulation-mode] Email not sent — no provider configured", { to, subject: payload.subject });
    const simMessageId = `sim-${Date.now()}`;
    await updateEmailLog(emailLog.id, {
      status: "simulated",
      provider: "simulation",
      providerMessageId: simMessageId,
      errorMessage: null,
      sentAt: new Date(),
    });
    return {
      status: "simulated",
      messageId: simMessageId,
      logId: emailLog.id,
      provider: "simulation",
    };
  }

  const transporter = getTransporter(config);
  const fromHeader = config.fromName ? `"${config.fromName}" <${config.fromAddress}>` : config.fromAddress!;
  const mailOptions: Mail.Options = {
    from: fromHeader,
    to,
    cc: cc.length > 0 ? cc : undefined,
    bcc: bcc.length > 0 ? bcc : undefined,
    subject: payload.subject,
    html: html || undefined,
    text: text || undefined,
    replyTo: payload.replyTo ?? config.replyTo ?? undefined,
    attachments: payload.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType ?? undefined,
    })),
  };

  let attempt = 0;
  for (;;) {
    try {
      const info = await transporter.sendMail(mailOptions);
      await updateEmailLog(emailLog.id, {
        status: "sent",
        provider: "smtp",
        providerMessageId: info.messageId || null,
        errorMessage: null,
        sentAt: new Date(),
      });
      return {
        status: "sent",
        messageId: info.messageId || null,
        logId: emailLog.id,
        provider: "smtp",
      };
    } catch (error) {
      attempt += 1;
      if (attempt > config.maxRetries || !isTransientSmtpError(error)) {
        const message = error instanceof Error ? error.message : "Email send failed";
        await updateEmailLog(emailLog.id, {
          status: "failed",
          provider: "smtp",
          errorMessage: message,
        });
        return {
          status: "failed",
          messageId: null,
          logId: emailLog.id,
          provider: "smtp",
          errorMessage: message,
        };
      }

      const jitter = Math.floor(Math.random() * Math.max(100, config.retryBackoffMs));
      const delay = (config.retryBackoffMs * (2 ** (attempt - 1))) + jitter;
      await sleep(delay);
    }
  }
}

export async function getEmailLog(id: string): Promise<EmailLog | undefined> {
  const [row] = await db.select().from(emailLogs).where(eq(emailLogs.id, id));
  return row;
}

export async function getEmailLogs(filters?: { associationId?: string; status?: string; limit?: number }): Promise<EmailLog[]> {
  const rows = await db.select().from(emailLogs).orderBy(desc(emailLogs.createdAt));
  return rows
    .filter((row) => (filters?.associationId ? row.associationId === filters.associationId : true))
    .filter((row) => (filters?.status ? row.status === filters.status : true))
    .slice(0, filters?.limit ?? 200);
}

export async function recordEmailEvent(payload: {
  emailLogId: string;
  eventType: "open" | "click";
  url?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<EmailEvent> {
  const [event] = await db
    .insert(emailEvents)
    .values({
      emailLogId: payload.emailLogId,
      eventType: payload.eventType,
      url: payload.url ?? null,
      ipAddress: payload.ipAddress ?? null,
      userAgent: payload.userAgent ?? null,
    })
    .returning();
  return event;
}

export async function handleEmailOpenTracking(input: {
  token: string;
  headers: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<boolean> {
  const payload = verifyToken(input.token);
  if (!payload || payload.kind !== "open") return false;
  await recordEmailEvent({
    emailLogId: payload.logId,
    eventType: "open",
    ipAddress: getIpAddress(input.headers, input.ipAddress),
    userAgent: typeof input.headers["user-agent"] === "string" ? input.headers["user-agent"] : null,
  });
  return true;
}

export async function handleEmailClickTracking(input: {
  token: string;
  headers: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<string | null> {
  const payload = verifyToken(input.token);
  if (!payload || payload.kind !== "click" || !payload.url) return null;
  const safeUrl = validateRedirectUrl(payload.url);
  if (!safeUrl) return null;
  await recordEmailEvent({
    emailLogId: payload.logId,
    eventType: "click",
    url: safeUrl,
    ipAddress: getIpAddress(input.headers, input.ipAddress),
    userAgent: typeof input.headers["user-agent"] === "string" ? input.headers["user-agent"] : null,
  });
  return safeUrl;
}

export async function purgeTrackingData(olderThan?: Date): Promise<{ deletedEvents: number; clearedTokens: number }> {
  const config = getEmailConfig();
  const cutoff = olderThan ?? new Date(Date.now() - (config.trackingRetentionDays * 24 * 60 * 60 * 1000));

  const deletedEvents = await db.delete(emailEvents).where(lt(emailEvents.occurredAt, cutoff)).returning({ id: emailEvents.id });
  const clearedTokens = await db
    .update(emailLogs)
    .set({ trackingToken: null, updatedAt: new Date() })
    .where(and(lt(emailLogs.createdAt, cutoff), eq(emailLogs.status, "sent")))
    .returning({ id: emailLogs.id });

  return {
    deletedEvents: deletedEvents.length,
    clearedTokens: clearedTokens.length,
  };
}

export function getEmailProviderStatus() {
  const config = getEmailConfig();
  const smtpConfigured = isSmtpConfigured(config);
  return {
    preferredProvider: "smtp",
    smtpConfigured,
    gmailConfigured: false,
    activeProvider: smtpConfigured ? "smtp" : "simulation",
    sender: config.fromAddress,
    fromName: config.fromName,
    trackingEnabled: config.trackingEnabled,
    poolMaxConnections: config.poolMaxConnections,
    maxRetries: config.maxRetries,
  };
}

export function getEmailPolicy() {
  const config = getEmailConfig();
  return {
    trackingEnabled: config.trackingEnabled,
    trackingRetentionDays: config.trackingRetentionDays,
    allowedRedirectDomains: config.allowedRedirectDomains,
    smtpConfigured: isSmtpConfigured(config),
  };
}

export function getTrackingPixelBuffer(): Buffer {
  return ONE_BY_ONE_GIF;
}
