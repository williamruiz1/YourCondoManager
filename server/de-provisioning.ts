/**
 * WS11 — Automated de-provisioning (Plaid attestation; Issue #387 / founder-os).
 *
 * Three concerns:
 *
 *   1. Admin account auto-deactivation
 *      - 90 days no login → `admin_users.is_active = 0`
 *      - 75-day warning email
 *      - Logged to `audit_logs` via storage.recordAuditEvent
 *      - Driven by daily scheduler tick (see `startDeprovisioningScheduler`)
 *
 *   2. Portal access auto-revoke on ownership transfer
 *      - When an `ownerships` row's endDate is set → `portal_access.status =
 *        'revoked'` for the matching person+association tuple
 *      - Logged to `audit_logs`
 *      - Called from the ownership PATCH handler
 *
 *   3. Role change notifications
 *      - When `permission_change_logs` gets a new entry (admin role
 *        change), a "your access level changed from X to Y" email fires
 *      - Called from `storage.updateAdminUserRole` (single insert site)
 *
 * Inactivity check uses `auth_users.last_login_at` joined to
 * `admin_users` via `auth_users.admin_user_id` — the existing auth flow
 * already updates `auth_users.last_login_at` on each login.
 *
 * Per OP #18 (Decision #95 / founder-os) the deactivation + warning
 * sweeps emit `[deprov]` log lines so the operator can see what would
 * have fired in dry-run / verify mode.
 */

import { and, eq } from "drizzle-orm";
import { db } from "./db.js";
import { withSchedulerLock } from "./lib/scheduler-lock.js";
import {
  adminUsers,
  authUsers,
  auditLogs,
  portalAccess,
  type AdminRole,
} from "../shared/schema.js";
import { sendPlatformEmail } from "./email-provider.js";
import { log } from "./logger.js";

// Tunables — exported for tests; defaults match Plaid attestation requirements.
export const INACTIVITY_DEACTIVATE_DAYS = 90;
export const INACTIVITY_WARNING_DAYS = 75;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const SYSTEM_ACTOR_EMAIL = "system@ycm.deprov";
const SYSTEM_ACTOR_REASON = "auto-deactivation: 90 days no login (WS11 / Plaid)";

interface AdminInactivityRow {
  adminUserId: string;
  email: string;
  role: AdminRole;
  lastLoginAt: Date | null;
  inactiveDays: number;
}

function daysSince(d: Date | null, now: Date): number {
  if (!d) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - d.getTime()) / MS_PER_DAY);
}

/**
 * Returns active admin_users joined to their auth_users.last_login_at,
 * with derived inactiveDays. Admins who never logged in (no auth_users
 * row) get inactiveDays = days since admin_users.createdAt.
 */
export async function listAdminInactivityCandidates(now: Date = new Date()): Promise<AdminInactivityRow[]> {
  const rows = await db
    .select({
      adminUserId: adminUsers.id,
      email: adminUsers.email,
      role: adminUsers.role,
      isActive: adminUsers.isActive,
      adminCreatedAt: adminUsers.createdAt,
      lastLoginAt: authUsers.lastLoginAt,
    })
    .from(adminUsers)
    .leftJoin(authUsers, eq(authUsers.adminUserId, adminUsers.id))
    .where(eq(adminUsers.isActive, 1));

  return rows.map((r) => {
    const referenceDate = r.lastLoginAt ?? r.adminCreatedAt ?? now;
    return {
      adminUserId: r.adminUserId,
      email: r.email,
      role: r.role,
      lastLoginAt: r.lastLoginAt,
      inactiveDays: daysSince(referenceDate, now),
    };
  });
}

export interface InactivitySweepResult {
  warned: Array<{ adminUserId: string; email: string; daysRemaining: number }>;
  deactivated: Array<{ adminUserId: string; email: string; inactiveDays: number }>;
  errors: Array<{ adminUserId: string; email: string; phase: "warn" | "deactivate"; message: string }>;
}

export async function runAdminInactivityCheck(now: Date = new Date()): Promise<InactivitySweepResult> {
  const result: InactivitySweepResult = { warned: [], deactivated: [], errors: [] };
  const candidates = await listAdminInactivityCandidates(now);

  for (const candidate of candidates) {
    if (candidate.inactiveDays >= INACTIVITY_DEACTIVATE_DAYS) {
      try {
        await db
          .update(adminUsers)
          .set({ isActive: 0, updatedAt: now })
          .where(eq(adminUsers.id, candidate.adminUserId));
        await db.insert(auditLogs).values({
          actorEmail: SYSTEM_ACTOR_EMAIL,
          action: "auto-deactivate",
          entityType: "admin-user",
          entityId: candidate.adminUserId,
          associationId: null,
          beforeJson: { isActive: 1, role: candidate.role, inactiveDays: candidate.inactiveDays },
          afterJson: { isActive: 0, reason: SYSTEM_ACTOR_REASON },
        });
        await sendDeactivationNotice(candidate);
        result.deactivated.push({
          adminUserId: candidate.adminUserId,
          email: candidate.email,
          inactiveDays: candidate.inactiveDays,
        });
        log(`[deprov] admin-deactivated id=${candidate.adminUserId} email=${candidate.email} inactiveDays=${candidate.inactiveDays}`, "automation");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push({ adminUserId: candidate.adminUserId, email: candidate.email, phase: "deactivate", message });
        console.error(`[deprov] deactivate failed id=${candidate.adminUserId}`, err);
      }
    } else if (candidate.inactiveDays >= INACTIVITY_WARNING_DAYS && candidate.inactiveDays < INACTIVITY_DEACTIVATE_DAYS) {
      const daysRemaining = INACTIVITY_DEACTIVATE_DAYS - candidate.inactiveDays;
      try {
        await sendInactivityWarning(candidate, daysRemaining);
        result.warned.push({
          adminUserId: candidate.adminUserId,
          email: candidate.email,
          daysRemaining,
        });
        log(`[deprov] admin-warned id=${candidate.adminUserId} email=${candidate.email} daysRemaining=${daysRemaining}`, "automation");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push({ adminUserId: candidate.adminUserId, email: candidate.email, phase: "warn", message });
        console.error(`[deprov] warn failed id=${candidate.adminUserId}`, err);
      }
    }
  }

  return result;
}

async function sendInactivityWarning(candidate: AdminInactivityRow, daysRemaining: number): Promise<void> {
  const subject = `[YCM] Inactivity warning: your admin access will be deactivated in ${daysRemaining} days`;
  const text = [
    `Hi,`,
    ``,
    `Your YCM admin access has not been used for ${candidate.inactiveDays} days.`,
    `Per our access-control policy (90-day inactivity window), your access`,
    `will be automatically deactivated in ${daysRemaining} days unless you sign in.`,
    ``,
    `If you still need access, please sign in to YCM at any time before that`,
    `date and the inactivity counter will reset. If you no longer need`,
    `access, no action is required — deactivation is automatic.`,
    ``,
    `If your access is auto-deactivated, a YCM admin can reactivate your`,
    `account from the Admin Users page.`,
    ``,
    `— YCM Security`,
  ].join("\n");
  await sendPlatformEmail({
    associationId: null,
    to: candidate.email,
    subject,
    text,
    metadata: {
      ws: "WS11",
      kind: "admin-inactivity-warning",
      daysRemaining,
      inactiveDays: candidate.inactiveDays,
    },
    templateKey: "security.deprov-warning",
  });
}

async function sendDeactivationNotice(candidate: AdminInactivityRow): Promise<void> {
  const subject = `[YCM] Your admin access has been deactivated due to inactivity`;
  const text = [
    `Hi,`,
    ``,
    `Your YCM admin access has been automatically deactivated after`,
    `${candidate.inactiveDays} days without a sign-in. This is per our`,
    `90-day access-control policy.`,
    ``,
    `If you still need access, please contact a YCM admin to reactivate`,
    `your account from the Admin Users page.`,
    ``,
    `— YCM Security`,
  ].join("\n");
  await sendPlatformEmail({
    associationId: null,
    to: candidate.email,
    subject,
    text,
    metadata: {
      ws: "WS11",
      kind: "admin-auto-deactivated",
      inactiveDays: candidate.inactiveDays,
    },
    templateKey: "security.deprov-deactivated",
  });
}

/**
 * Revoke portal_access entries linked to a person+association tuple.
 * Called from the ownership PATCH handler when endDate is set on an
 * ownership row. Idempotent — already-revoked rows are left alone.
 */
export async function revokePortalAccess(
  personId: string,
  associationId: string,
  options: { actorEmail: string; reason?: string } = { actorEmail: SYSTEM_ACTOR_EMAIL },
): Promise<{ revokedIds: string[] }> {
  const now = new Date();
  const reason = options.reason ?? "ownership ended (auto-revoke)";

  const candidates = await db
    .select({ id: portalAccess.id, status: portalAccess.status, email: portalAccess.email })
    .from(portalAccess)
    .where(and(eq(portalAccess.personId, personId), eq(portalAccess.associationId, associationId)));

  const revokedIds: string[] = [];
  for (const row of candidates) {
    if (row.status === "revoked") continue;
    await db
      .update(portalAccess)
      .set({ status: "revoked", revokedAt: now, updatedAt: now })
      .where(eq(portalAccess.id, row.id));
    await db.insert(auditLogs).values({
      actorEmail: options.actorEmail,
      action: "revoke",
      entityType: "portal-access",
      entityId: row.id,
      associationId,
      beforeJson: { status: row.status, email: row.email },
      afterJson: { status: "revoked", reason },
    });
    revokedIds.push(row.id);
    log(`[deprov] portal-revoked id=${row.id} personId=${personId} associationId=${associationId}`, "automation");
  }
  return { revokedIds };
}

/**
 * Send the role-change email to an admin whose role changed.
 * Called from `storage.updateAdminUserRole` after the role-change row
 * is written to permission_change_logs + audit_logs.
 */
export async function notifyRoleChange(args: {
  email: string;
  fromRole: string;
  toRole: string;
  changedBy: string;
  reason?: string;
}): Promise<void> {
  const subject = `[YCM] Your access level has been changed from ${args.fromRole} to ${args.toRole}`;
  const text = [
    `Hi,`,
    ``,
    `Your YCM access level has been changed by ${args.changedBy}.`,
    ``,
    `Previous role: ${args.fromRole}`,
    `New role:      ${args.toRole}`,
    args.reason ? `` : ``,
    args.reason ? `Reason: ${args.reason}` : ``,
    ``,
    `If you did not expect this change, please contact a YCM admin.`,
    ``,
    `— YCM Security`,
  ].filter((line, idx, arr) => !(line === "" && arr[idx - 1] === "")).join("\n");
  try {
    await sendPlatformEmail({
      associationId: null,
      to: args.email,
      subject,
      text,
      metadata: {
        ws: "WS11",
        kind: "admin-role-change",
        fromRole: args.fromRole,
        toRole: args.toRole,
      },
      templateKey: "security.role-change",
    });
    log(`[deprov] role-change-notified email=${args.email} ${args.fromRole}→${args.toRole}`, "automation");
  } catch (err) {
    console.error(`[deprov] role-change email failed for ${args.email}`, err);
  }
}

/**
 * Daily scheduler. Runs `runAdminInactivityCheck` at startup and then
 * every 24 hours. Call once from `server/index.ts`.
 */
let deprovTimer: NodeJS.Timeout | null = null;
const DAY_MS = 24 * 60 * 60 * 1000;

export function startDeprovisioningScheduler(intervalMs: number = DAY_MS): void {
  if (deprovTimer) return;
  const tick = async (): Promise<void> => {
    try {
      const result = await runAdminInactivityCheck();
      if (result.warned.length > 0 || result.deactivated.length > 0 || result.errors.length > 0) {
        log(
          `[deprov] sweep complete warned=${result.warned.length} deactivated=${result.deactivated.length} errors=${result.errors.length}`,
          "automation",
        );
      }
    } catch (err) {
      console.error("[deprov] sweep failed", err);
    }
  };
  // founder-os#10741 (SCALE-B-003): cross-machine advisory lock so the deprov
  // sweep fires on only ONE machine. No-op on the current single-machine topology.
  deprovTimer = setInterval(() => {
    void withSchedulerLock("deprov-sweep", tick);
  }, intervalMs);
  void withSchedulerLock("deprov-sweep", tick);
  log(`[deprov] scheduler started (interval ${intervalMs}ms)`, "automation");
}

export function stopDeprovisioningScheduler(): void {
  if (deprovTimer) {
    clearInterval(deprovTimer);
    deprovTimer = null;
  }
}
