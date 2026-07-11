import { useSyncExternalStore } from "react";
import {
  ADMIN_NOTIFICATION_CATEGORY_KEYS,
  DEFAULT_ADMIN_NOTIFICATION_CATEGORY_PREFERENCES,
  DEFAULT_ADMIN_NOTIFICATION_PREFERENCES,
  type AdminNotificationCategoryKey,
} from "@shared/admin-notification-preferences";

export type UserSettings = {
  displayName: string;
  timezone: string;
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
  emailNotifications: boolean;
  pushNotifications: boolean;
  alertDigest: "realtime" | "daily" | "weekly" | "off";
  desktopNotifications: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  notificationCategoryPreferences: Record<NotificationCategoryKey, boolean>;
  theme: "system" | "light" | "dark";
};

export const NOTIFICATION_PREFERENCE_KEYS = ADMIN_NOTIFICATION_CATEGORY_KEYS;
export type NotificationCategoryKey = AdminNotificationCategoryKey;

const DEFAULT_SETTINGS: UserSettings = {
  displayName: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateFormat: "MM/DD/YYYY",
  emailNotifications: DEFAULT_ADMIN_NOTIFICATION_PREFERENCES.emailNotifications,
  pushNotifications: DEFAULT_ADMIN_NOTIFICATION_PREFERENCES.pushNotifications,
  alertDigest: DEFAULT_ADMIN_NOTIFICATION_PREFERENCES.alertDigest,
  desktopNotifications: DEFAULT_ADMIN_NOTIFICATION_PREFERENCES.desktopNotifications,
  quietHoursEnabled: DEFAULT_ADMIN_NOTIFICATION_PREFERENCES.quietHoursEnabled,
  quietHoursStart: DEFAULT_ADMIN_NOTIFICATION_PREFERENCES.quietHoursStart,
  quietHoursEnd: DEFAULT_ADMIN_NOTIFICATION_PREFERENCES.quietHoursEnd,
  notificationCategoryPreferences: DEFAULT_ADMIN_NOTIFICATION_CATEGORY_PREFERENCES,
  // Follows the OS preference. The brand-v2 dark-mode breakage (a duplicate hardcoded
  // `background: #f8f9fa` in tailwind.config.ts shadowing the token-driven `--background`)
  // is fixed (YCM#352 / founder-os#8539), so we no longer force light. Existing users keep
  // their saved preference unchanged.
  theme: "system",
};

const STORAGE_KEY_PREFIX = "user-settings-";
let listeners: Array<() => void> = [];
let cachedSnapshot: UserSettings = load();

function getStorageKey(): string {
  // Read admin id from the auth session cached in react-query if available
  // Falls back to "default" — the settings page re-saves under the real key once auth resolves
  try {
    const raw = localStorage.getItem("user-settings-admin-id");
    if (raw) return STORAGE_KEY_PREFIX + raw;
  } catch {}
  return STORAGE_KEY_PREFIX + "default";
}

function load(): UserSettings {
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UserSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        notificationCategoryPreferences: {
          ...DEFAULT_ADMIN_NOTIFICATION_CATEGORY_PREFERENCES,
          ...(parsed.notificationCategoryPreferences ?? {}),
        },
      };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function notify() {
  cachedSnapshot = load();
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): UserSettings {
  return cachedSnapshot;
}

export function setAdminIdForSettings(adminId: string) {
  try {
    localStorage.setItem("user-settings-admin-id", adminId);
  } catch {}
  notify();
}

export function saveUserSettings(settings: UserSettings) {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(settings));
  } catch {}
  notify();
}

export function useUserSettings(): UserSettings {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export { DEFAULT_SETTINGS };

// ── Theme application ──────────────────────────────────────────────────────────

/**
 * Apply the theme.
 *
 * SHELVED 2026-07-07 (per William): dark mode is disabled app-wide — the app
 * always renders LIGHT, regardless of the user's saved theme setting or the OS
 * `prefers-color-scheme`. The dark `dark:` CSS variants + tokens are intentionally
 * left in place so dark mode can be re-enabled later by restoring the original
 * body of this function. To un-shelve: delete the force-light short-circuit and
 * reinstate the theme/system branching preserved in the comment below.
 */
export function applyTheme(_theme: UserSettings["theme"]) {
  const root = document.documentElement;
  // Force light everywhere — never add the `dark` class on any route.
  root.classList.remove("dark");
  return;

  /* ── SHELVED dark-mode logic (reversible) ──────────────────────────────────
  const isWorkspace = window.location.pathname.startsWith("/app");
  if (!isWorkspace) {
    root.classList.remove("dark");
    return;
  }
  if (_theme === "dark") {
    root.classList.add("dark");
  } else if (_theme === "light") {
    root.classList.remove("dark");
  } else {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
  ───────────────────────────────────────────────────────────────────────────── */
}

// ── Date formatting ────────────────────────────────────────────────────────────

export function formatSettingsDate(
  date: string | Date | null | undefined,
  settings: UserSettings,
  options?: { includeTime?: boolean },
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";

  const includeTime = options?.includeTime ?? false;

  try {
    const intlOpts: Intl.DateTimeFormatOptions = {
      timeZone: settings.timezone,
    };

    if (settings.dateFormat === "YYYY-MM-DD") {
      intlOpts.year = "numeric";
      intlOpts.month = "2-digit";
      intlOpts.day = "2-digit";
      // Intl with en-CA gives YYYY-MM-DD
      if (includeTime) {
        intlOpts.hour = "numeric";
        intlOpts.minute = "2-digit";
      }
      return d.toLocaleString("en-CA", intlOpts);
    }

    if (settings.dateFormat === "DD/MM/YYYY") {
      intlOpts.year = "numeric";
      intlOpts.month = "2-digit";
      intlOpts.day = "2-digit";
      if (includeTime) {
        intlOpts.hour = "numeric";
        intlOpts.minute = "2-digit";
      }
      return d.toLocaleString("en-GB", intlOpts);
    }

    // MM/DD/YYYY (default)
    intlOpts.year = "numeric";
    intlOpts.month = "2-digit";
    intlOpts.day = "2-digit";
    if (includeTime) {
      intlOpts.hour = "numeric";
      intlOpts.minute = "2-digit";
    }
    return d.toLocaleString("en-US", intlOpts);
  } catch {
    return d.toLocaleDateString();
  }
}
