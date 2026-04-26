/**
 * 4.1 Tier 3 (Wave 32) — alert push + email notifications.
 *
 * Spec: docs/projects/platform-overhaul/decisions/4.1-tier-3-notifications.md
 *
 * One entry point — `fanOutCriticalAlerts()` — runs every 5 min from the
 * automation sweep (server/index.ts:runAutomationSweep). It:
 *
 *   1. Loads opted-in admins (anyone with `notify_alerts_email = 1` OR
 *      `notify_alerts_push = 1`, plus admins with no prefs row at all —
 *      defaults are email ON / push OFF, so every admin is at least
 *      email-eligible until they opt out).
 *   2. For each admin, runs the cross-association alert orchestrator
 *      across THAT admin's permitted association set, gated by
 *      `canAccessAlert` (already done inside the orchestrator). Filters
 *      to `severity === 'critical'`.
 *   3. For each (alertId, adminUserId) pair:
 *      - If a row in `alert_notifications` already exists for that pair
 *        on EITHER channel (email or push), skip — already delivered.
 *      - If a 'failed' row exists < 1h old, skip (avoid hot retry loop).
 *      - If user has hit the 5/hour rate limit, skip this cycle.
 *      - Pick channel: push first if user opted in AND has an active
 *        push subscription; otherwise email if user opted in; otherwise
 *        skip.
 *      - Insert `alert_notifications` row, send via channel, update row
 *        with `'sent'` / `'failed'` + errorMessage.
 *   4. On the FIRST EVER cycle (table empty), every currently-emitted
 *      critical alert is seeded as `delivery_status =
 *      'suppressed-pre-existing'` instead of being sent. This prevents
 *      retroactive notifications for alerts that existed before this
 *      wave shipped.
 *
 * Idempotency: re-running fan-out without time advancing yields zero
 * additional sends (every (alertId, adminUserId) tuple resolves to a row
 * already in `alert_notifications` once delivered).
 */

import { and, count, eq, gte, inArray, or } from "drizzle-orm";
import { db } from "../db";
import {
  adminPushSubscriptions,
  adminUserPreferences,
  adminUsers,
  adminAssociationScopes,
  alertNotifications,
  associations as associationsTable,
} from "@shared/schema";
import type { AdminRole, AdminUser } from "@shared/schema";
import { sendPlatformEmail } from "../email-provider";
import { sendPushNotification as sendPushToEndpoint } from "../push-provider";
import { canAccessAlert, getCriticalAlertsForFanOut } from "./index";
import type { AlertItem, AlertSeverity } from "./types";

// ---------------------------------------------------------------------------
// Constants — exported for tests so a flag flip stays a one-line edit.
// ---------------------------------------------------------------------------

/**
 * Severities eligible for out-of-band fan-out. Wave 32 ships with
 * `critical` only. The Wave 2 type union has no `serious` value; if Tier 4
 * adds one, append it here and the gate widens.
 */
export const CRITICAL_SEVERITIES: ReadonlyArray<AlertSeverity> = ["critical"];

/** 5 sends per user per rolling 60 minutes (counted across BOTH channels). */
export const RATE_LIMIT_PER_HOUR = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/** Failed rows younger than this are NOT retried (avoid hot loops). */
const FAILED_RETRY_BACKOFF_MS = 60 * 60 * 1000;

/** Channel literals stored on `alert_notifications.channel`. */
export const CHANNEL_EMAIL = "email";
export const CHANNEL_PUSH = "push";
export const CHANNEL_SUPPRESSED = "suppressed-pre-existing";

// ---------------------------------------------------------------------------
// Public entry point — wired into the automation sweep.
// ---------------------------------------------------------------------------

export interface FanOutResult {
  scanned: number;
  sentEmail: number;
  sentPush: number;
  failed: number;
  rateLimited: number;
  alreadyDelivered: number;
  suppressedPreExisting: number;
}

export async function fanOutCriticalAlerts(opts: { now?: Date } = {}): Promise<FanOutResult> {
  const now = opts.now ?? new Date();
  const result: FanOutResult = {
    scanned: 0,
    sentEmail: 0,
    sentPush: 0,
    failed: 0,
    rateLimited: 0,
    alreadyDelivered: 0,
    suppressedPreExisting: 0,
  };

  // 1. Detect first-ever-cycle (alert_notifications totally empty). On
  //    that cycle we seed instead of send.
  const isFirstCycle = await isAlertNotificationsTableEmpty();

  // 2. Load opted-in admins. Defaults are email ON / push OFF, so we want
  //    admins where (notify_alerts_email=1 OR notify_alerts_push=1) — OR
  //    admins with no prefs row at all (defaults apply: email ON).
  const optedInAdmins = await loadOptedInAdmins();

  // 3. Wave 35a — single-pass fan-out. Compute the universe of critical
  //    alerts ONCE per tick (one orchestrator run, ~9 storage calls total)
  //    instead of per-admin. Per-admin filtering is done in-memory below.
  //    Pre-Wave-35a: 50 admins × 50 associations × 9 resolvers = 22,500
  //    resolver invocations every 5 minutes; this collapses to ~9 per tick
  //    regardless of admin count.
  const criticalUniverse = optedInAdmins.length > 0
    ? (await getCriticalAlertsForFanOut({ now, severities: CRITICAL_SEVERITIES })).alerts
    : [];

  for (const admin of optedInAdmins) {
    // Resolve this admin's permitted associations. Platform-admins see all;
    // others see their adminAssociationScopes.
    const permittedAssociations = await loadPermittedAssociations(admin);
    if (permittedAssociations.length === 0) continue;

    // Filter the cached universe down to (a) the admin's permitted
    // associations and (b) the role's permitted feature-domains. The
    // canAccessAlert predicate is the same gate the user-facing GET
    // endpoint applies — using it here keeps notification visibility in
    // lock-step with on-screen visibility.
    const permittedIds = new Set(permittedAssociations.map((a) => a.id));
    const criticalAlerts = criticalUniverse.filter(
      (a) => permittedIds.has(a.associationId) && canAccessAlert(admin.role, a.featureDomain, {}),
    );
    if (criticalAlerts.length === 0) continue;

    if (isFirstCycle) {
      // First-ever cycle: seed rows with channel=suppressed-pre-existing.
      for (const alert of criticalAlerts) {
        result.scanned += 1;
        await insertNotificationRow({
          alertId: alert.alertId,
          adminUserId: admin.id,
          channel: CHANNEL_SUPPRESSED,
          deliveryStatus: CHANNEL_SUPPRESSED,
          sentAt: now,
        });
        result.suppressedPreExisting += 1;
      }
      continue;
    }

    // Normal cycle: fan out.
    const prefs = admin.preferences;
    const wantsEmail = prefs.notifyAlertsEmail !== 0;
    const wantsPush = prefs.notifyAlertsPush !== 0;
    if (!wantsEmail && !wantsPush) continue;

    // Rate-limit count for this admin in the rolling 60-minute window.
    let usedInWindow = await countNotificationsInWindow(admin.id, now);

    for (const alert of criticalAlerts) {
      result.scanned += 1;

      // Already-delivered check: any row for (alertId, adminUserId) on
      // either email or push channel that is NOT a recently-failed row.
      const existing = await loadExistingNotification(alert.alertId, admin.id);
      if (existing) {
        const deliveredAlready = existing.some(
          (row) =>
            row.channel !== CHANNEL_SUPPRESSED &&
            (row.deliveryStatus === "sent" || row.deliveryStatus === "pending"),
        );
        if (deliveredAlready) {
          result.alreadyDelivered += 1;
          continue;
        }
        // Suppressed-pre-existing seeded — this alert pre-dates this wave.
        const suppressed = existing.some(
          (row) => row.deliveryStatus === CHANNEL_SUPPRESSED,
        );
        if (suppressed) {
          result.alreadyDelivered += 1;
          continue;
        }
        // Recent failed row blocks re-send (cool-off period).
        const recentlyFailed = existing.some(
          (row) =>
            row.deliveryStatus === "failed" &&
            row.sentAt.getTime() > now.getTime() - FAILED_RETRY_BACKOFF_MS,
        );
        if (recentlyFailed) {
          result.failed += 1;
          continue;
        }
      }

      // Rate limit.
      if (usedInWindow >= RATE_LIMIT_PER_HOUR) {
        result.rateLimited += 1;
        continue;
      }

      // Pick channel. Push first if user has it AND has an active sub.
      let channel: typeof CHANNEL_EMAIL | typeof CHANNEL_PUSH | null = null;
      let pushSubs: Array<{ endpoint: string; p256dhKey: string; authKey: string }> = [];
      if (wantsPush) {
        pushSubs = await loadActivePushSubscriptions(admin.id);
        if (pushSubs.length > 0) channel = CHANNEL_PUSH;
      }
      if (!channel && wantsEmail) channel = CHANNEL_EMAIL;
      if (!channel) {
        // wants push only but has no sub → skip.
        continue;
      }

      // Insert pending row, then send, then update.
      await insertNotificationRow({
        alertId: alert.alertId,
        adminUserId: admin.id,
        channel,
        deliveryStatus: "pending",
        sentAt: now,
      });

      let sendOk = false;
      let errorMessage: string | null = null;
      try {
        if (channel === CHANNEL_PUSH) {
          const r = await sendPushNotification(admin, alert, pushSubs);
          sendOk = r.ok;
          errorMessage = r.errorMessage ?? null;
        } else {
          const r = await sendEmailNotification(admin, alert);
          sendOk = r.ok;
          errorMessage = r.errorMessage ?? null;
        }
      } catch (err: unknown) {
        sendOk = false;
        errorMessage = err instanceof Error ? err.message : String(err);
      }

      await db
        .update(alertNotifications)
        .set({
          deliveryStatus: sendOk ? "sent" : "failed",
          errorMessage: errorMessage ?? null,
        })
        .where(
          and(
            eq(alertNotifications.alertId, alert.alertId),
            eq(alertNotifications.adminUserId, admin.id),
            eq(alertNotifications.channel, channel),
          ),
        );

      if (sendOk) {
        usedInWindow += 1;
        if (channel === CHANNEL_PUSH) result.sentPush += 1;
        else result.sentEmail += 1;
      } else {
        result.failed += 1;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Channel sends — exported for unit tests.
// ---------------------------------------------------------------------------

export interface ChannelSendResult {
  ok: boolean;
  errorMessage?: string;
}

/**
 * Send an email for a single critical alert. Subject:
 *   `[YCM] {severity}: {title}`
 * Body: plain text with the resolutionHref appended.
 */
export async function sendEmailNotification(
  admin: { id: string; email: string },
  alert: AlertItem,
): Promise<ChannelSendResult> {
  const subject = `[YCM] ${alert.severity}: ${alert.title}`;
  const link = buildAbsoluteUrl(alert.resolutionHref);
  const lines = [
    alert.title,
    "",
    alert.description,
    "",
    `Association: ${alert.associationName}`,
    `Severity: ${alert.severity}`,
    "",
    `Open in YCM: ${link}`,
  ];
  const text = lines.join("\n");

  try {
    const result = await sendPlatformEmail({
      associationId: alert.associationId,
      to: admin.email,
      subject,
      text,
      metadata: {
        alertId: alert.alertId,
        ruleType: alert.ruleType,
        recordType: alert.recordType,
        recordId: alert.recordId,
        wave: "32-alert-notifications",
      },
      templateKey: "alerts.critical",
    });
    if (result.status === "sent" || result.status === "simulated") {
      return { ok: true };
    }
    return { ok: false, errorMessage: result.errorMessage ?? `email send returned ${result.status}` };
  } catch (err: unknown) {
    return { ok: false, errorMessage: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Send a Web Push notification to ALL active operator-side subscriptions
 * for the admin. If any send returns `expired` (HTTP 410), the
 * subscription is soft-deleted (`is_active=0`).
 */
export async function sendPushNotification(
  admin: { id: string },
  alert: AlertItem,
  subscriptions: ReadonlyArray<{ endpoint: string; p256dhKey: string; authKey: string }>,
): Promise<ChannelSendResult> {
  if (subscriptions.length === 0) {
    return { ok: false, errorMessage: "no active push subscriptions" };
  }
  const payload = {
    title: alert.title,
    body: alert.description,
    url: alert.resolutionHref,
    tag: `alert:${alert.alertId}`,
  };
  let anyOk = false;
  let lastError: string | null = null;
  for (const sub of subscriptions) {
    try {
      const r = await sendPushToEndpoint(sub, payload);
      if (r.status === "sent" || r.status === "simulated") {
        anyOk = true;
      } else if (r.status === "expired") {
        await db
          .update(adminPushSubscriptions)
          .set({ isActive: 0, updatedAt: new Date() })
          .where(eq(adminPushSubscriptions.endpoint, sub.endpoint));
        lastError = "subscription expired (410)";
      } else {
        lastError = r.errorMessage ?? "push failed";
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return anyOk
    ? { ok: true }
    : { ok: false, errorMessage: lastError ?? "all push sends failed" };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface OptedInAdmin extends Pick<AdminUser, "id" | "email" | "role"> {
  preferences: {
    notifyAlertsEmail: number;
    notifyAlertsPush: number;
  };
}

async function loadOptedInAdmins(): Promise<OptedInAdmin[]> {
  // Left join: admins with no prefs row use defaults (email ON, push OFF).
  const rows = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      role: adminUsers.role,
      isActive: adminUsers.isActive,
      notifyAlertsEmail: adminUserPreferences.notifyAlertsEmail,
      notifyAlertsPush: adminUserPreferences.notifyAlertsPush,
    })
    .from(adminUsers)
    .leftJoin(
      adminUserPreferences,
      eq(adminUsers.id, adminUserPreferences.adminUserId),
    );

  const out: OptedInAdmin[] = [];
  for (const row of rows) {
    if (row.isActive === 0) continue;
    const email = row.notifyAlertsEmail ?? 1;
    const push = row.notifyAlertsPush ?? 0;
    if (email === 0 && push === 0) continue;
    out.push({
      id: row.id,
      email: row.email,
      role: row.role as AdminRole,
      preferences: { notifyAlertsEmail: email, notifyAlertsPush: push },
    });
  }
  return out;
}

async function loadPermittedAssociations(admin: { id: string; role: AdminRole }): Promise<Array<{ id: string; name: string }>> {
  if (admin.role === "platform-admin") {
    return db
      .select({ id: associationsTable.id, name: associationsTable.name })
      .from(associationsTable)
      .where(eq(associationsTable.isArchived, 0));
  }
  const scopes = await db
    .select({ associationId: adminAssociationScopes.associationId })
    .from(adminAssociationScopes)
    .where(eq(adminAssociationScopes.adminUserId, admin.id));
  if (scopes.length === 0) return [];
  return db
    .select({ id: associationsTable.id, name: associationsTable.name })
    .from(associationsTable)
    .where(inArray(associationsTable.id, scopes.map((s) => s.associationId)));
}

async function loadActivePushSubscriptions(adminUserId: string): Promise<Array<{ endpoint: string; p256dhKey: string; authKey: string }>> {
  return db
    .select({
      endpoint: adminPushSubscriptions.endpoint,
      p256dhKey: adminPushSubscriptions.p256dhKey,
      authKey: adminPushSubscriptions.authKey,
    })
    .from(adminPushSubscriptions)
    .where(
      and(
        eq(adminPushSubscriptions.adminUserId, adminUserId),
        eq(adminPushSubscriptions.isActive, 1),
      ),
    );
}

async function isAlertNotificationsTableEmpty(): Promise<boolean> {
  const [row] = await db
    .select({ c: count() })
    .from(alertNotifications)
    .limit(1);
  return (row?.c ?? 0) === 0;
}

async function countNotificationsInWindow(adminUserId: string, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
  // Only count actual sends — pending and sent. Failed and suppressed
  // don't burn rate-limit budget.
  const [row] = await db
    .select({ c: count() })
    .from(alertNotifications)
    .where(
      and(
        eq(alertNotifications.adminUserId, adminUserId),
        gte(alertNotifications.sentAt, cutoff),
        or(
          eq(alertNotifications.deliveryStatus, "sent"),
          eq(alertNotifications.deliveryStatus, "pending"),
        ),
      ),
    );
  return row?.c ?? 0;
}

async function loadExistingNotification(alertId: string, adminUserId: string) {
  return db
    .select({
      channel: alertNotifications.channel,
      deliveryStatus: alertNotifications.deliveryStatus,
      sentAt: alertNotifications.sentAt,
    })
    .from(alertNotifications)
    .where(
      and(
        eq(alertNotifications.alertId, alertId),
        eq(alertNotifications.adminUserId, adminUserId),
      ),
    );
}

async function insertNotificationRow(input: {
  alertId: string;
  adminUserId: string;
  channel: string;
  deliveryStatus: string;
  sentAt: Date;
}): Promise<void> {
  // ON CONFLICT (alert_id, admin_user_id, channel) DO NOTHING — idempotent
  // re-runs will see the existing row in the dedup check and skip before
  // reaching here, but as a belt-and-suspenders we no-op on conflict.
  await db
    .insert(alertNotifications)
    .values({
      alertId: input.alertId,
      adminUserId: input.adminUserId,
      channel: input.channel,
      deliveryStatus: input.deliveryStatus,
      sentAt: input.sentAt,
    })
    .onConflictDoNothing({
      target: [
        alertNotifications.alertId,
        alertNotifications.adminUserId,
        alertNotifications.channel,
      ],
    });
}

function buildAbsoluteUrl(href: string): string {
  const base = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
  if (!base) return href;
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  return `${base}${href.startsWith("/") ? "" : "/"}${href}`;
}

// ---------------------------------------------------------------------------
// Test-only escape hatches.
// ---------------------------------------------------------------------------

/** Test-only: clear `alert_notifications`. Used to simulate first-cycle. */
export async function __resetAlertNotificationsForTests(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("__resetAlertNotificationsForTests must not run in production");
  }
  await db.delete(alertNotifications);
}

/** Test-only: simulate a 'failed' row older than the retry-backoff window. */
export async function __backdateFailedNotificationForTests(
  alertId: string,
  adminUserId: string,
  channel: string,
  ageMs: number,
): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("__backdateFailedNotificationForTests must not run in production");
  }
  const newSentAt = new Date(Date.now() - ageMs);
  await db
    .update(alertNotifications)
    .set({ sentAt: newSentAt })
    .where(
      and(
        eq(alertNotifications.alertId, alertId),
        eq(alertNotifications.adminUserId, adminUserId),
        eq(alertNotifications.channel, channel),
      ),
    );
}

