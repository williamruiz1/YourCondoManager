/**
 * Unit tests for `server/portal-role-collapse.ts` helpers.
 *
 * Phase 8c — the `PORTAL_ROLE_COLLAPSE` feature flag has been retired and
 * the always-on collapse path is now hardcoded. `getEffectivePortalRole`
 * unconditionally returns `"owner"`; the `isPortalRoleCollapseOn` helper
 * has been deleted.
 *
 * Scope:
 *   - `getEffectivePortalRole()` collapses every input to `"owner"`.
 *   - Board-access middlewares (`requireBoardAccess`,
 *     `requireBoardAccessReadOnly`) enforce the boolean contract.
 *
 * The integration-level assertions (29 endpoints pass/fail correctly, role
 * normalization on the request object) live in
 * `tests/portal-board-gating.test.ts`.
 */

import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import {
  getEffectivePortalRole,
  requireBoardAccess,
  requireBoardAccessReadOnly,
  type PortalRoleContext,
} from "../server/portal-role-collapse";

function makeRes(): Response & { _status?: number; _body?: unknown } {
  const res = {} as Response & { _status?: number; _body?: unknown };
  res.status = vi.fn((code: number) => {
    res._status = code;
    return res;
  }) as unknown as Response["status"];
  res.json = vi.fn((body: unknown) => {
    res._body = body;
    return res;
  }) as unknown as Response["json"];
  return res;
}

describe("getEffectivePortalRole — Phase 8c (always 'owner')", () => {
  // Every legacy 4-value role and every post-Phase-8a 2-value role
  // collapses unconditionally to the canonical `"owner"` literal.
  const everyKnownInput = [
    "owner",
    "tenant",
    "readonly",
    "board-member",
    "anything-else",
  ];

  it.each(everyKnownInput)(
    "returns 'owner' for input %s",
    (role) => {
      expect(getEffectivePortalRole(role, false)).toBe("owner");
      expect(getEffectivePortalRole(role, true)).toBe("owner");
    },
  );

  it("does not vary with hasBoardAccess", () => {
    expect(getEffectivePortalRole("board-member", false)).toBe("owner");
    expect(getEffectivePortalRole("board-member", true)).toBe("owner");
  });
});

describe("requireBoardAccess middleware", () => {
  function makeReq(overrides: PortalRoleContext = {}): Request &
    PortalRoleContext {
    return overrides as Request & PortalRoleContext;
  }

  it("calls next() when portalHasBoardAccess is true AND associationId present", () => {
    const req = makeReq({
      portalHasBoardAccess: true,
      portalAssociationId: "assoc-1",
    });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    requireBoardAccess(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("responds 403 when portalHasBoardAccess is false", () => {
    const req = makeReq({
      portalHasBoardAccess: false,
      portalAssociationId: "assoc-1",
    });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    requireBoardAccess(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Board-member access required",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("responds 403 when portalAssociationId is missing", () => {
    const req = makeReq({ portalHasBoardAccess: true });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    requireBoardAccess(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("responds 403 when both flags are missing", () => {
    const req = makeReq({});
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    requireBoardAccess(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireBoardAccessReadOnly middleware", () => {
  it("always responds 403 regardless of request shape", () => {
    const req = {} as Request;
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    requireBoardAccessReadOnly(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Board workspace is read-only for board members",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
