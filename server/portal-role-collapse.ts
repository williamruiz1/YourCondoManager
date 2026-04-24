// @zone: (cross-cutting — portal / server middleware)
// Phase 8b of the Platform Overhaul — Portal Role Collapse (code-level).
//
// This module encapsulates the flag-gated server-side behaviour that pretends
// the `portal_access_role` enum has already been collapsed to
// `["owner", "board-member"]` (see Phase 8a). While the PORTAL_ROLE_COLLAPSE
// feature flag is OFF (the default), nothing here alters runtime behaviour:
// the raw DB role string flows through unchanged and `requireBoardAccess`
// gates purely on `req.portalHasBoardAccess`.
//
// When the flag is ON, `getEffectivePortalRole()` collapses the legacy
// 4-value role string (`"tenant" | "owner" | "readonly" | "board-member"`) to
// the canonical literal `"owner"`. Board access remains a boolean augmentation
// on the request (`portalHasBoardAccess`), NOT a role-string branch.
//
// References:
//   - docs/projects/platform-overhaul/decisions/2.1-role-model-audit.md Q3/Q7/Q9
//   - docs/projects/platform-overhaul/decisions/2.2-owner-portal-access-boundaries.md Q1
//   - docs/projects/platform-overhaul/implementation-artifacts/phase-8-call-site-audit.md
//   - shared/feature-flags.ts (PORTAL_ROLE_COLLAPSE)
//
// IMPORTANT: This file does NOT modify the DB schema. `shared/schema.ts`
// `portalAccessRoleEnum` still carries all 4 legacy values — the actual enum
// collapse is Phase 8a, which is gated on a prod-data audit.

import type { NextFunction, Request, Response } from "express";
import { getFeatureFlag } from "@shared/feature-flags";

/**
 * The legacy portal role union as it currently lives in the DB. Retained here
 * purely so call sites can type raw inputs before `getEffectivePortalRole`
 * collapses them.
 */
export type LegacyPortalRole = "tenant" | "owner" | "readonly" | "board-member";

/**
 * Canonical post-collapse portal role. After Phase 8a migrates the DB, this
 * is the only value `portalAccess.role` will carry. Board access is modelled
 * separately via the boolean `portalHasBoardAccess` on the request.
 */
export type CanonicalPortalRole = "owner";

/**
 * Shape of a portal request with the fields Phase 8b cares about. Kept local
 * to this module to avoid the 4-way duplication of `PortalRequest` (see audit
 * §"PortalRequest type" — the dedup itself is Phase 8c).
 */
export interface PortalRoleContext {
  portalRole?: string;
  portalHasBoardAccess?: boolean;
  portalAssociationId?: string;
}

/**
 * Collapse a raw portal role string to the canonical `"owner"` literal when
 * the PORTAL_ROLE_COLLAPSE flag is ON; otherwise return the raw role as-is.
 *
 * The function is pure (no I/O), so it is safe to call per-request.
 *
 * @param rawRole         The raw role string read from `portalAccess.role`.
 * @param hasBoardAccess  Whether the accessor has board-access via a
 *                        `board_role` row. Carried through unchanged — board
 *                        access is tracked on the boolean flag, not the role.
 * @param flagOn          Resolved value of PORTAL_ROLE_COLLAPSE for this
 *                        caller. Injecting the flag keeps the helper pure and
 *                        testable.
 */
export function getEffectivePortalRole(
  rawRole: string,
  hasBoardAccess: boolean,
  flagOn: boolean,
): string {
  if (flagOn) return "owner";
  // Legacy shadow-compat: return the raw role verbatim. `hasBoardAccess` is a
  // no-op in this branch — callers continue to consume `portalHasBoardAccess`
  // directly. The parameter is present for symmetry and future-proofing.
  void hasBoardAccess;
  return rawRole;
}

/**
 * Resolve the PORTAL_ROLE_COLLAPSE flag for the current caller.
 *
 * Split out so tests and narrow call sites can inject a specific boolean
 * without stubbing the env helper.
 */
export function isPortalRoleCollapseOn(): boolean {
  return getFeatureFlag("PORTAL_ROLE_COLLAPSE");
}

/**
 * Express middleware — asserts the caller has board-access (via the
 * `portalHasBoardAccess` boolean set by `requirePortal`). Replaces the
 * Phase 8b-retired `requirePortalBoard` middleware. Response shape is
 * preserved byte-for-byte so that existing contract tests continue to pass.
 *
 * Behaviour is identical regardless of PORTAL_ROLE_COLLAPSE — the gate reads
 * the boolean, not the role string.
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
