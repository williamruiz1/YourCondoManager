/**
 * Unit tests for `server/portal-role-collapse.ts` helpers — Phase 8b.
 *
 * Scope:
 *   - `getEffectivePortalRole()` pure collapse behaviour (flag on/off).
 *   - `isPortalRoleCollapseOn()` reads the PORTAL_ROLE_COLLAPSE flag.
 *   - Board-access middlewares (`requireBoardAccess`,
 *     `requireBoardAccessReadOnly`) enforce the boolean contract regardless
 *     of flag state.
 *
 * The integration-level assertions (29 endpoints pass/fail correctly, role
 * normalization on the request object) live in
 * `tests/portal-board-gating.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import {
  getEffectivePortalRole,
  isPortalRoleCollapseOn,
  requireBoardAccess,
  requireBoardAccessReadOnly,
  type LegacyPortalRole,
  type PortalRoleContext,
} from "../server/portal-role-collapse";

const FLAG_ENV_KEY = "FEATURE_FLAG_PORTAL_ROLE_COLLAPSE";

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

describe("getEffectivePortalRole — flag OFF (legacy shadow-compat)", () => {
  const legacyRoles: LegacyPortalRole[] = [
    "tenant",
    "owner",
    "readonly",
    "board-member",
  ];

  it.each(legacyRoles)(
    "returns the raw role %s unchanged when flag is off",
    (role) => {
      expect(getEffectivePortalRole(role, false, false)).toBe(role);
      expect(getEffectivePortalRole(role, true, false)).toBe(role);
    },
  );

  it("does not collapse an unknown string when flag is off (shadow-compat)", () => {
    expect(getEffectivePortalRole("anything-else", false, false)).toBe(
      "anything-else",
    );
  });

  it("ignores hasBoardAccess when flag is off", () => {
    expect(getEffectivePortalRole("tenant", true, false)).toBe("tenant");
    expect(getEffectivePortalRole("tenant", false, false)).toBe("tenant");
  });
});

describe("getEffectivePortalRole — flag ON (canonical collapse)", () => {
  const legacyRoles: LegacyPortalRole[] = [
    "tenant",
    "owner",
    "readonly",
    "board-member",
  ];

  it.each(legacyRoles)(
    "collapses legacy role %s to 'owner' when flag is on",
    (role) => {
      expect(getEffectivePortalRole(role, false, true)).toBe("owner");
      expect(getEffectivePortalRole(role, true, true)).toBe("owner");
    },
  );

  it("collapses unknown strings to 'owner' when flag is on", () => {
    expect(getEffectivePortalRole("legacy-garbage", false, true)).toBe("owner");
  });

  it("does not vary with hasBoardAccess when flag is on", () => {
    expect(getEffectivePortalRole("board-member", false, true)).toBe("owner");
    expect(getEffectivePortalRole("board-member", true, true)).toBe("owner");
  });
});

describe("isPortalRoleCollapseOn — env-driven", () => {
  beforeEach(() => {
    delete process.env[FLAG_ENV_KEY];
  });
  afterEach(() => {
    delete process.env[FLAG_ENV_KEY];
  });

  it("defaults to true after Phase 8a flip (matches DEFAULTS)", () => {
    // Phase 8a flipped PORTAL_ROLE_COLLAPSE from OFF to ON in shared/feature-flags.ts
    // alongside migration 0014_portal_role_collapse.sql. With no env override,
    // the collapse branch is live everywhere.
    expect(isPortalRoleCollapseOn()).toBe(true);
  });

  it('honours FEATURE_FLAG_PORTAL_ROLE_COLLAPSE="true"', () => {
    process.env[FLAG_ENV_KEY] = "true";
    expect(isPortalRoleCollapseOn()).toBe(true);
  });

  it('honours FEATURE_FLAG_PORTAL_ROLE_COLLAPSE="false" (escape hatch)', () => {
    // Retained as an escape hatch until Phase 8c hardcodes the collapse
    // branch and removes the flag entirely.
    process.env[FLAG_ENV_KEY] = "false";
    expect(isPortalRoleCollapseOn()).toBe(false);
  });

  it("malformed env value falls through to default (true post-8a)", () => {
    process.env[FLAG_ENV_KEY] = "yes";
    expect(isPortalRoleCollapseOn()).toBe(true);
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

  it("behaviour does not depend on PORTAL_ROLE_COLLAPSE flag state", () => {
    const req = makeReq({
      portalHasBoardAccess: true,
      portalAssociationId: "assoc-1",
    });
    const resOn = makeRes();
    const resOff = makeRes();
    const nextOn = vi.fn() as unknown as NextFunction;
    const nextOff = vi.fn() as unknown as NextFunction;

    process.env[FLAG_ENV_KEY] = "true";
    requireBoardAccess(req, resOn, nextOn);
    expect(nextOn).toHaveBeenCalledOnce();

    process.env[FLAG_ENV_KEY] = "false";
    requireBoardAccess(req, resOff, nextOff);
    expect(nextOff).toHaveBeenCalledOnce();

    delete process.env[FLAG_ENV_KEY];
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
