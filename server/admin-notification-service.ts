import { and, eq, or } from "drizzle-orm";
import { db } from "./db";
import { sendPlatformEmail, type SendEmailPayload, type SendEmailResult } from "./email-provider";
import { adminAssociationScopes, adminUserPreferences, adminUsers } from "@shared/schema";
import {
  normalizeAdminNotificationPreferences,
  type AdminNotificationCategoryKey,
  type AdminNotificationPreferences,
} from "@shared/admin-notification-preferences";

type AdminNotificationChannel = "email" | "push" | "desktop";
type AdminNotificationPriority = "realtime" | "digest";

type AdminNotificationRecipient = {
  adminUserId: string;
  email: string;
  role: string;
  preferences: AdminNotificationPreferences;
};

type AdminNotificationRow = {
  adminUserId: string;
  email: string;
  role: string;
  isActive: number;
  emailNotifications: number | null;
  pushNotifications: number | null;
  desktopNotifications: number | null;
  alertDigest: string | null;
  quietHoursEnabled: number | null;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  notificationCategoryPreferencesJson: unknown;
};

function parseTimeMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours * 60) + minutes;
}

function isWithinQuietHours(preferences: AdminNotificationPreferences, now = new Date()): boolean {
  if (!preferences.quietHoursEnabled) return false;
  const startMinutes = parseTimeMinutes(preferences.quietHoursStart);
  const endMinutes = parseTimeMinutes(preferences.quietHoursEnd);
  const currentMinutes = (now.getHours() * 60) + now.getMinutes();

  if (startMinutes === endMinutes) return true;
  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

function isChannelEnabled(
  preferences: AdminNotificationPreferences,
  channel: AdminNotificationChannel,
  priority: AdminNotificationPriority,
  occurredAt = new Date(),
): boolean {
  if (priority === "digest" && preferences.alertDigest === "off") return false;
  if (priority === "digest" && preferences.alertDigest !== "realtime") return false;

  if (channel === "email") return preferences.emailNotifications;
  if (channel === "push") return preferences.pushNotifications && !isWithinQuietHours(preferences, occurredAt);
  return preferences.desktopNotifications && !isWithinQuietHours(preferences, occurredAt);
}

function hydrateRecipientFromRow(
  row: AdminNotificationRow,
  params: {
    category: AdminNotificationCategoryKey;
    channel: AdminNotificationChannel;
    priority?: AdminNotificationPriority;
    occurredAt?: Date;
  },
): AdminNotificationRecipient | null {
  const email = row.email.trim().toLowerCase();
  if (!email || row.isActive !== 1) return null;
  // Skip emails that fail basic RFC validation (e.g. seed data like admin@local with no TLD)
  if (!/.+@.+\..+/.test(email)) return null;

  const preferences = normalizeAdminNotificationPreferences({
    emailNotifications: row.emailNotifications,
    pushNotifications: row.pushNotifications,
    desktopNotifications: row.desktopNotifications,
    alertDigest: row.alertDigest ?? undefined,
    quietHoursEnabled: row.quietHoursEnabled,
    quietHoursStart: row.quietHoursStart ?? undefined,
    quietHoursEnd: row.quietHoursEnd ?? undefined,
    notificationCategoryPreferences: (row.notificationCategoryPreferencesJson ?? {}) as Record<string, unknown>,
  });

  if (!preferences.notificationCategoryPreferences[params.category]) return null;
  if (!isChannelEnabled(preferences, params.channel, params.priority ?? "realtime", params.occurredAt)) return null;

  return {
    adminUserId: row.adminUserId,
    email,
    role: row.role,
    preferences,
  };
}

export async function getAssociationAdminNotificationRecipients(params: {
  associationId: string;
  category: AdminNotificationCategoryKey;
  channel: AdminNotificationChannel;
  priority?: AdminNotificationPriority;
  allowedRoles?: string[];
  occurredAt?: Date;
  excludeEmails?: string[];
}): Promise<AdminNotificationRecipient[]> {
  const rows = await db
    .select({
      adminUserId: adminUsers.id,
      email: adminUsers.email,
      role: adminUsers.role,
      isActive: adminUsers.isActive,
      emailNotifications: adminUserPreferences.emailNotifications,
      pushNotifications: adminUserPreferences.pushNotifications,
      desktopNotifications: adminUserPreferences.desktopNotifications,
      alertDigest: adminUserPreferences.alertDigest,
      quietHoursEnabled: adminUserPreferences.quietHoursEnabled,
      quietHoursStart: adminUserPreferences.quietHoursStart,
      quietHoursEnd: adminUserPreferences.quietHoursEnd,
      notificationCategoryPreferencesJson: adminUserPreferences.notificationCategoryPreferencesJson,
    })
    .from(adminUsers)
    .leftJoin(adminUserPreferences, eq(adminUserPreferences.adminUserId, adminUsers.id))
    .leftJoin(
      adminAssociationScopes,
      and(
        eq(adminAssociationScopes.adminUserId, adminUsers.id),
        eq(adminAssociationScopes.associationId, params.associationId),
      ),
    )
    .where(
      and(
        eq(adminUsers.isActive, 1),
        or(
          eq(adminUsers.role, "platform-admin"),
          eq(adminAssociationScopes.associationId, params.associationId),
        ),
      ),
    );

  const deduped = new Map<string, AdminNotificationRecipient>();
  const excluded = new Set((params.excludeEmails ?? []).map((email) => email.trim().toLowerCase()).filter(Boolean));
  for (const row of rows) {
    if (params.allowedRoles?.length && !params.allowedRoles.includes(row.role)) continue;
    const recipient = hydrateRecipientFromRow(row, params);
    if (!recipient) continue;
    if (excluded.has(recipient.email)) continue;
    deduped.set(row.adminUserId, recipient);
  }

  return Array.from(deduped.values());
}

export async function getPlatformAdminNotificationRecipients(params: {
  category: AdminNotificationCategoryKey;
  channel: AdminNotificationChannel;
  priority?: AdminNotificationPriority;
  occurredAt?: Date;
  allowedRoles?: string[];
}): Promise<AdminNotificationRecipient[]> {
  const rows = await db
    .select({
      adminUserId: adminUsers.id,
      email: adminUsers.email,
      role: adminUsers.role,
      isActive: adminUsers.isActive,
      emailNotifications: adminUserPreferences.emailNotifications,
      pushNotifications: adminUserPreferences.pushNotifications,
      desktopNotifications: adminUserPreferences.desktopNotifications,
      alertDigest: adminUserPreferences.alertDigest,
      quietHoursEnabled: adminUserPreferences.quietHoursEnabled,
      quietHoursStart: adminUserPreferences.quietHoursStart,
      quietHoursEnd: adminUserPreferences.quietHoursEnd,
      notificationCategoryPreferencesJson: adminUserPreferences.notificationCategoryPreferencesJson,
    })
    .from(adminUsers)
    .leftJoin(adminUserPreferences, eq(adminUserPreferences.adminUserId, adminUsers.id))
    .where(eq(adminUsers.isActive, 1));

  return rows
    .filter((row) => (params.allowedRoles?.length ? params.allowedRoles.includes(row.role) : true))
    .map((row) => hydrateRecipientFromRow(row, params))
    .filter((recipient): recipient is AdminNotificationRecipient => Boolean(recipient));
}

export async function sendPlatformAdminEmailNotification(params: {
  category: AdminNotificationCategoryKey;
  priority?: AdminNotificationPriority;
  allowedRoles?: string[];
  email: Omit<SendEmailPayload, "to">;
}): Promise<{ recipients: string[]; results: SendEmailResult[] }> {
  const recipients = await getPlatformAdminNotificationRecipients({
    category: params.category,
    channel: "email",
    priority: params.priority,
    allowedRoles: params.allowedRoles ?? ["platform-admin"],
  });

  const results: SendEmailResult[] = [];
  for (const recipient of recipients) {
    results.push(await sendPlatformEmail({
      ...params.email,
      to: recipient.email,
    }));
  }

  return {
    recipients: recipients.map((recipient) => recipient.email),
    results,
  };
}

export async function sendDirectAdminEmailNotification(params: {
  adminUserId: string;
  category: AdminNotificationCategoryKey;
  priority?: AdminNotificationPriority;
  email: Omit<SendEmailPayload, "to">;
}): Promise<SendEmailResult | null> {
  const rows = await db
    .select({
      adminUserId: adminUsers.id,
      email: adminUsers.email,
      role: adminUsers.role,
      isActive: adminUsers.isActive,
      emailNotifications: adminUserPreferences.emailNotifications,
      pushNotifications: adminUserPreferences.pushNotifications,
      desktopNotifications: adminUserPreferences.desktopNotifications,
      alertDigest: adminUserPreferences.alertDigest,
      quietHoursEnabled: adminUserPreferences.quietHoursEnabled,
      quietHoursStart: adminUserPreferences.quietHoursStart,
      quietHoursEnd: adminUserPreferences.quietHoursEnd,
      notificationCategoryPreferencesJson: adminUserPreferences.notificationCategoryPreferencesJson,
    })
    .from(adminUsers)
    .leftJoin(adminUserPreferences, eq(adminUserPreferences.adminUserId, adminUsers.id))
    .where(eq(adminUsers.id, params.adminUserId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  const recipient = hydrateRecipientFromRow(row, {
    category: params.category,
    channel: "email",
    priority: params.priority,
  });
  if (!recipient) return null;

  return sendPlatformEmail({
    ...params.email,
    to: recipient.email,
  });
}

export async function sendAssociationAdminEmailNotification(params: {
  associationId: string;
  category: AdminNotificationCategoryKey;
  priority?: AdminNotificationPriority;
  allowedRoles?: string[];
  excludeEmails?: string[];
  email: Omit<SendEmailPayload, "associationId" | "to">;
}): Promise<{ recipients: string[]; results: SendEmailResult[] }> {
  const recipients = await getAssociationAdminNotificationRecipients({
    associationId: params.associationId,
    category: params.category,
    channel: "email",
    priority: params.priority,
    allowedRoles: params.allowedRoles,
    excludeEmails: params.excludeEmails,
  });

  const results: SendEmailResult[] = [];
  for (const recipient of recipients) {
    results.push(await sendPlatformEmail({
      ...params.email,
      associationId: params.associationId,
      to: recipient.email,
    }));
  }

  return {
    recipients: recipients.map((recipient) => recipient.email),
    results,
  };
}
