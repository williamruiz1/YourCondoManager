/**
 * A-AUTH-004 write-scope enforcement (founder-os#10783).
 *
 * Contract tests for `assertAssociationWriteScope` + the write-aware
 * `assertAssociationInputScope` + the `ENFORCE_ADMIN_WRITE_SCOPE` flag in
 * `server/lib/tenant-scope.ts`. Unlike the older `assert-association-scope`
 * test (which reproduces the helper because it lived in the 17k-line
 * `routes.ts`), this imports the REAL functions directly — `tenant-scope.ts`
 * is deliberately dependency-light exactly so this is possible.
 *
 * The requirement (dispatch acceptance): with enforcement ON, a `read-only`-
 * scoped admin can READ but NOT WRITE its association; a `read-write`-scoped
 * admin can do both; platform-admin is unaffected. With the flag OFF (the
 * shipped default) behavior is identical to today (presence-based) — no
 * regression, so shipping this cannot strip write access from any admin.
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  assertAssociationScope,
  assertAssociationWriteScope,
  assertAssociationInputScope,
  isAdminWriteScopeEnforced,
  type ScopeAdminRequest,
} from "../server/lib/tenant-scope";

const ASSOC_A = "assoc-a";
const ASSOC_B = "assoc-b";

/** Run `fn` with `ENFORCE_ADMIN_WRITE_SCOPE` set to `value`, restoring after. */
function withEnforcement(value: boolean, fn: () => void) {
  const prev = process.env.ENFORCE_ADMIN_WRITE_SCOPE;
  process.env.ENFORCE_ADMIN_WRITE_SCOPE = value ? "true" : "false";
  try {
    fn();
  } finally {
    if (prev === undefined) delete process.env.ENFORCE_ADMIN_WRITE_SCOPE;
    else process.env.ENFORCE_ADMIN_WRITE_SCOPE = prev;
  }
}

afterEach(() => {
  delete process.env.ENFORCE_ADMIN_WRITE_SCOPE;
});

describe("isAdminWriteScopeEnforced — flag reader", () => {
  it("defaults OFF (absent env)", () => {
    delete process.env.ENFORCE_ADMIN_WRITE_SCOPE;
    expect(isAdminWriteScopeEnforced()).toBe(false);
  });
  it("is OFF for any value other than exactly 'true'", () => {
    for (const v of ["false", "1", "TRUE", "yes", "", "on"]) {
      process.env.ENFORCE_ADMIN_WRITE_SCOPE = v;
      expect(isAdminWriteScopeEnforced()).toBe(false);
    }
  });
  it("is ON only for the exact string 'true'", () => {
    process.env.ENFORCE_ADMIN_WRITE_SCOPE = "true";
    expect(isAdminWriteScopeEnforced()).toBe(true);
  });
});

describe("assertAssociationWriteScope — ENFORCEMENT ON", () => {
  it("a read-only-scoped admin can READ its association but NOT WRITE it", () => {
    withEnforcement(true, () => {
      const req: ScopeAdminRequest = {
        adminRole: "manager",
        adminScopedAssociationIds: [ASSOC_A], // in scope (can read)
        adminWriteAssociationIds: [], // but read-only (not in write set)
      };
      // READ is allowed — presence check passes.
      expect(() => assertAssociationScope(req, ASSOC_A)).not.toThrow();
      // WRITE is denied — read-only.
      expect(() => assertAssociationWriteScope(req, ASSOC_A)).toThrow(
        "Association is read-only for this admin",
      );
    });
  });

  it("a read-write-scoped admin can READ and WRITE its association", () => {
    withEnforcement(true, () => {
      const req: ScopeAdminRequest = {
        adminRole: "manager",
        adminScopedAssociationIds: [ASSOC_A],
        adminWriteAssociationIds: [ASSOC_A], // read-write
      };
      expect(() => assertAssociationScope(req, ASSOC_A)).not.toThrow();
      expect(() => assertAssociationWriteScope(req, ASSOC_A)).not.toThrow();
    });
  });

  it("write is denied for an association entirely outside scope (fail-closed)", () => {
    withEnforcement(true, () => {
      const req: ScopeAdminRequest = {
        adminRole: "manager",
        adminScopedAssociationIds: [ASSOC_A],
        adminWriteAssociationIds: [ASSOC_A],
      };
      // ASSOC_B is not even in the read set → the presence check fires first.
      expect(() => assertAssociationWriteScope(req, ASSOC_B)).toThrow(
        "Association is outside admin scope",
      );
    });
  });

  it("mixed grants — write allowed only for the read-write association", () => {
    withEnforcement(true, () => {
      const req: ScopeAdminRequest = {
        adminRole: "manager",
        adminScopedAssociationIds: [ASSOC_A, ASSOC_B],
        adminWriteAssociationIds: [ASSOC_B], // A is read-only, B is read-write
      };
      expect(() => assertAssociationScope(req, ASSOC_A)).not.toThrow(); // read A ok
      expect(() => assertAssociationScope(req, ASSOC_B)).not.toThrow(); // read B ok
      expect(() => assertAssociationWriteScope(req, ASSOC_A)).toThrow(
        "Association is read-only for this admin",
      ); // write A denied
      expect(() => assertAssociationWriteScope(req, ASSOC_B)).not.toThrow(); // write B ok
    });
  });

  it("platform-admin is unaffected — writes any association even with empty write set", () => {
    withEnforcement(true, () => {
      const req: ScopeAdminRequest = {
        adminRole: "platform-admin",
        adminScopedAssociationIds: [],
        adminWriteAssociationIds: [],
      };
      expect(() => assertAssociationWriteScope(req, ASSOC_A)).not.toThrow();
      expect(() => assertAssociationWriteScope(req, ASSOC_B)).not.toThrow();
    });
  });

  it("a missing write set (undefined) fails closed for a non-platform admin", () => {
    withEnforcement(true, () => {
      const req: ScopeAdminRequest = {
        adminRole: "manager",
        adminScopedAssociationIds: [ASSOC_A],
        // adminWriteAssociationIds omitted → treated as empty → read-only
      };
      expect(() => assertAssociationWriteScope(req, ASSOC_A)).toThrow(
        "Association is read-only for this admin",
      );
    });
  });
});

describe("assertAssociationWriteScope — ENFORCEMENT OFF (shipped default: NO REGRESSION)", () => {
  it("a read-only-scoped admin CAN write with the flag off (identical to today's presence-based behavior)", () => {
    withEnforcement(false, () => {
      const req: ScopeAdminRequest = {
        adminRole: "manager",
        adminScopedAssociationIds: [ASSOC_A],
        adminWriteAssociationIds: [], // read-only — but the flag is off
      };
      // Behaves exactly like assertAssociationScope: presence in scope = allowed.
      expect(() => assertAssociationWriteScope(req, ASSOC_A)).not.toThrow();
    });
  });

  it("still fails closed for an out-of-scope association with the flag off", () => {
    withEnforcement(false, () => {
      const req: ScopeAdminRequest = {
        adminRole: "manager",
        adminScopedAssociationIds: [ASSOC_A],
        adminWriteAssociationIds: [ASSOC_A],
      };
      expect(() => assertAssociationWriteScope(req, ASSOC_B)).toThrow(
        "Association is outside admin scope",
      );
    });
  });

  it("default (no env set at all) behaves as OFF — no regression by default", () => {
    delete process.env.ENFORCE_ADMIN_WRITE_SCOPE;
    const req: ScopeAdminRequest = {
      adminRole: "manager",
      adminScopedAssociationIds: [ASSOC_A],
      adminWriteAssociationIds: [], // read-only
    };
    expect(() => assertAssociationWriteScope(req, ASSOC_A)).not.toThrow();
  });
});

describe("assertAssociationInputScope — write by default, read on request", () => {
  it("defaults to WRITE intent → read-only input is denied when enforced", () => {
    withEnforcement(true, () => {
      const req: ScopeAdminRequest = {
        adminRole: "manager",
        adminScopedAssociationIds: [ASSOC_A],
        adminWriteAssociationIds: [], // read-only
      };
      expect(() => assertAssociationInputScope(req, ASSOC_A)).toThrow(
        "Association is read-only for this admin",
      );
    });
  });

  it("intent:'read' input is allowed for a read-only admin even when enforced", () => {
    withEnforcement(true, () => {
      const req: ScopeAdminRequest = {
        adminRole: "manager",
        adminScopedAssociationIds: [ASSOC_A],
        adminWriteAssociationIds: [], // read-only
      };
      expect(() => assertAssociationInputScope(req, ASSOC_A, "read")).not.toThrow();
    });
  });

  it("still throws 'associationId is required' on a null/undefined input (both intents)", () => {
    const req: ScopeAdminRequest = { adminRole: "manager", adminScopedAssociationIds: [ASSOC_A] };
    expect(() => assertAssociationInputScope(req, null)).toThrow("associationId is required");
    expect(() => assertAssociationInputScope(req, undefined, "read")).toThrow(
      "associationId is required",
    );
  });

  it("platform-admin short-circuits regardless of intent", () => {
    withEnforcement(true, () => {
      const req: ScopeAdminRequest = { adminRole: "platform-admin", adminScopedAssociationIds: [] };
      expect(() => assertAssociationInputScope(req, null)).not.toThrow();
      expect(() => assertAssociationInputScope(req, ASSOC_A, "write")).not.toThrow();
    });
  });
});
