// founder-os#11345 — Server-authoritative view-mode entitlement.
//
// The manager-app "view mode" (board vs manager) MUST be derived from the
// account's role/entitlement server-side — it is NOT a user-facing first-run
// picker or a client-chosen localStorage preference. This module is the single
// source of truth for that derivation and is imported by BOTH the server
// (`/api/auth/me`, which stamps the result into the auth payload) and the
// client view-mode store (which applies it and enforces the lock).
//
// "Locked" accounts have NO client path to the other view (the picker is
// removed and the store's mode setters refuse to escape the locked mode).

import type { AdminRole } from "./schema";

export type ViewMode = "board" | "manager";

export type ViewModeEntitlement = {
  /** The view mode this account is entitled to / rendered in. */
  viewMode: ViewMode;
  /** When true, the account cannot switch away from `viewMode` (no picker, no client-state path). */
  locked: boolean;
};

/**
 * Roles that only ever get the simplified, plain-English Board surface. A
 * volunteer board member / assisted-board / read-only viewer is never a trained
 * property manager, so they are locked to Board view.
 */
const BOARD_LOCKED_ROLES: ReadonlySet<AdminRole> = new Set<AdminRole>([
  "board-officer",
  "assisted-board",
  "viewer",
]);

/**
 * Specific accounts locked to Board view REGARDLESS of their (higher) role.
 *
 * `chcmgmt18@gmail.com` is a high-privilege `platform-admin` for access/security
 * reasons (it is the Cherry Hill Court platform account), but per William's
 * standing instruction it is a Cherry Hill BOARD-MEMBER account and MUST render
 * Board view only — with no path to the manager workspace. We lock the VIEW
 * here rather than demoting the underlying admin role (demotion would strip the
 * only super-admin and risk an access lockout). (founder-os#11345)
 */
const BOARD_LOCKED_EMAILS: ReadonlySet<string> = new Set<string>([
  "chcmgmt18@gmail.com",
]);

/**
 * The single source of truth for view mode. Derives the entitlement from the
 * account's email (explicit locks) then role (role-based locks); everything
 * else is an unlocked manager account.
 */
export function resolveViewModeEntitlement(input: {
  role: AdminRole | null | undefined;
  email: string | null | undefined;
}): ViewModeEntitlement {
  const email = (input.email ?? "").trim().toLowerCase();
  if (email && BOARD_LOCKED_EMAILS.has(email)) {
    return { viewMode: "board", locked: true };
  }
  const role = input.role ?? null;
  if (role && BOARD_LOCKED_ROLES.has(role)) {
    return { viewMode: "board", locked: true };
  }
  return { viewMode: "manager", locked: false };
}

/** True when this account is locked to Board view (convenience for callers). */
export function isBoardLockedAccount(input: {
  role: AdminRole | null | undefined;
  email: string | null | undefined;
}): boolean {
  const ent = resolveViewModeEntitlement(input);
  return ent.locked && ent.viewMode === "board";
}
