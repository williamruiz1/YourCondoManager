export const ADMIN_NOTIFICATION_CATEGORY_KEYS = [
  "announcements",
  "documents",
  "meetings",
  "boardPackages",
  "compliance",
  "elections",
  "assessments",
  "invoices",
  "payments",
  "lateFees",
  "reconciliation",
  "maintenance",
  "inspections",
  "insurance",
  "occupancy",
  "associationContext",
  "adminAccess",
  "platformOps",
] as const;

export type AdminNotificationCategoryKey = (typeof ADMIN_NOTIFICATION_CATEGORY_KEYS)[number];

export type AdminNotificationCategoryPreferences = Record<AdminNotificationCategoryKey, boolean>;

export type AdminNotificationPreferences = {
  emailNotifications: boolean;
  pushNotifications: boolean;
  desktopNotifications: boolean;
  alertDigest: "realtime" | "daily" | "weekly" | "off";
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  notificationCategoryPreferences: AdminNotificationCategoryPreferences;
};

export const DEFAULT_ADMIN_NOTIFICATION_CATEGORY_PREFERENCES: AdminNotificationCategoryPreferences = {
  announcements: true,
  documents: true,
  meetings: true,
  boardPackages: true,
  compliance: true,
  elections: true,
  assessments: true,
  invoices: true,
  payments: true,
  lateFees: true,
  reconciliation: true,
  maintenance: true,
  inspections: true,
  insurance: true,
  occupancy: true,
  associationContext: true,
  adminAccess: true,
  platformOps: true,
};

export const DEFAULT_ADMIN_NOTIFICATION_PREFERENCES: AdminNotificationPreferences = {
  emailNotifications: true,
  pushNotifications: true,
  desktopNotifications: true,
  alertDigest: "daily",
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  notificationCategoryPreferences: DEFAULT_ADMIN_NOTIFICATION_CATEGORY_PREFERENCES,
};

const VALID_ALERT_DIGESTS = new Set(["realtime", "daily", "weekly", "off"]);

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeTime(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value) ? value : fallback;
}

export function normalizeAdminNotificationPreferences(
  value: Record<string, unknown> | Partial<AdminNotificationPreferences> | null | undefined,
): AdminNotificationPreferences {
  const source = (value ?? {}) as Record<string, unknown>;
  const categorySource = source.notificationCategoryPreferences && typeof source.notificationCategoryPreferences === "object"
    ? source.notificationCategoryPreferences as Record<string, unknown>
    : {};
  const notificationCategoryPreferences = Object.fromEntries(
    ADMIN_NOTIFICATION_CATEGORY_KEYS.map((key) => [
      key,
      normalizeBoolean(categorySource[key], DEFAULT_ADMIN_NOTIFICATION_CATEGORY_PREFERENCES[key]),
    ]),
  ) as AdminNotificationCategoryPreferences;

  const alertDigest = typeof source.alertDigest === "string" && VALID_ALERT_DIGESTS.has(source.alertDigest)
    ? source.alertDigest as AdminNotificationPreferences["alertDigest"]
    : DEFAULT_ADMIN_NOTIFICATION_PREFERENCES.alertDigest;

  return {
    emailNotifications: normalizeBoolean(source.emailNotifications, DEFAULT_ADMIN_NOTIFICATION_PREFERENCES.emailNotifications),
    pushNotifications: normalizeBoolean(source.pushNotifications, DEFAULT_ADMIN_NOTIFICATION_PREFERENCES.pushNotifications),
    desktopNotifications: normalizeBoolean(source.desktopNotifications, DEFAULT_ADMIN_NOTIFICATION_PREFERENCES.desktopNotifications),
    alertDigest,
    quietHoursEnabled: normalizeBoolean(source.quietHoursEnabled, DEFAULT_ADMIN_NOTIFICATION_PREFERENCES.quietHoursEnabled),
    quietHoursStart: normalizeTime(source.quietHoursStart, DEFAULT_ADMIN_NOTIFICATION_PREFERENCES.quietHoursStart),
    quietHoursEnd: normalizeTime(source.quietHoursEnd, DEFAULT_ADMIN_NOTIFICATION_PREFERENCES.quietHoursEnd),
    notificationCategoryPreferences,
  };
}

export function isAdminNotificationCategoryKey(value: string): value is AdminNotificationCategoryKey {
  return ADMIN_NOTIFICATION_CATEGORY_KEYS.includes(value as AdminNotificationCategoryKey);
}
