// @zone: (cross-cutting — portal / server middleware)
// Phase 8c of the Platform Overhaul — Portal Role Collapse (flag retired).
//
// Phase 8a migrated the DB enum from
// `["owner", "tenant", "readonly", "board-member"]` to
// `["owner", "board-member"]`. Phase 8b shipped the runtime collapse
// behind the `PORTAL_ROLE_COLLAPSE` feature flag. Phase 8c (this file)
// removes the flag — the always-on collapse path is now hardcoded.
//
// `getEffectivePortalRole()` unconditionally returns `"owner"`. Board
// access remains a boolean augmentation on the request
// (`portalHasBoardAccess`), NOT a role-string branch — `requireBoardAccess`
// gates purely on that boolean.
//
// References:
//   - docs/projects/platform-overhaul/decisions/2.1-role-model-audit.md Q3/Q7/Q9
//   - docs/projects/platform-overhaul/decisions/2.2-owner-portal-access-boundaries.md Q1
//   - docs/projects/platform-overhaul/implementation-artifacts/phase-8-call-site-audit.md
//
// IMPORTANT: This file does NOT modify the DB schema. `shared/schema.ts`
// `portalAccessRoleEnum` carries `["owner", "board-member"]` — the actual
// enum collapse to two values is Phase 8a's migration. Phase 8c only
// removes the flag-gated UI/runtime branch; the DB still admits
// `"board-member"` rows where they exist (board-only portal accesses).

import type { NextFunction, Request, Response } from "express";

/**
 * Canonical post-collapse portal role. After Phase 8a + Phase 8c, this is
 * the only value the request-level `portalRole` field will carry. Board
 * access is modelled separately via the boolean `portalHasBoardAccess` on
 * the request.
 */
export type CanonicalPortalRole = "owner";

/**
 * Shape of a portal request with the fields Phase 8b/8c cares about. Kept
 * local to this module to avoid the 4-way duplication of `PortalRequest`.
 */
export interface PortalRoleContext {
  portalRole?: string;
  portalHasBoardAccess?: boolean;
  portalAssociationId?: string;
}

/**
 * Collapse a raw portal role string to the canonical `"owner"` literal.
 *
 * Phase 8c — the `PORTAL_ROLE_COLLAPSE` feature flag has been retired;
 * the collapse is unconditional. The function is pure (no I/O), so it is
 * safe to call per-request.
 *
 * @param _rawRole         The raw role string read from `portalAccess.role`.
 *                         Ignored — every portal request resolves to the
 *                         canonical `"owner"` role at the request level.
 * @param _hasBoardAccess  Whether the accessor has board-access via a
 *                         `board_role` row. Ignored at this layer — board
 *                         access is tracked on the boolean
 *                         `portalHasBoardAccess` field, not the role.
 */
export function getEffectivePortalRole(
  _rawRole: string,
  _hasBoardAccess: boolean,
): CanonicalPortalRole {
  return "owner";
}

/**
 * Express middleware — asserts the caller has board-access (via the
 * `portalHasBoardAccess` boolean set by `requirePortal`). Replaces the
 * Phase 8b-retired `requirePortalBoard` middleware. Response shape is
 * preserved byte-for-byte so that existing contract tests continue to pass.
 */
export function requireBoardAccess(
  req: Request & PortalRoleContext,
  res: Response,
  next: NextFunction,
): void | Response {
  if (!req.portalHasBoardAccess || !req.portalAssociationId) {
    return res.status(403).json({ message: "Board-member access required" });
  }
  return next();
}

/**
 * Read-only variant — the board workspace is currently mutation-locked for
 * portal-side board members. Retained as a standalone middleware so the 14
 * mutation endpoints continue to 403 unchanged.
 *
 * This middleware's shape is intentionally identical to the retiring
 * `requirePortalBoardReadOnly` so no endpoint behaviour drifts in Phase 8b.
 */
export function requireBoardAccessReadOnly(
  _req: Request,
  res: Response,
  _next: NextFunction,
): Response {
  return res.status(403).json({ message: "Board workspace is read-only for board members" });
}
