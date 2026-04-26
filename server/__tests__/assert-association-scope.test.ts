/**
 * Regression contract tests for `assertAssociationScope` and
 * `assertAssociationInputScope` in `server/routes.ts`.
 *
 * Locks in the fail-closed hardening from PPM workitem
 * `a8dd8fbd-c008-4262-9077-a64fb4e03bb9` (self-review 2026-04-25 M6).
 *
 * Background — why a contract copy instead of importing the real helper:
 *   `server/routes.ts` imports the entire route-registration surface
 *   (storage, db, auth, every drizzle schema, every domain service) at
 *   module load. Pulling it into a unit test would require mocking the
 *   whole world. The convention in this repo (see
 *   `tests/alerts-mutation-security.test.ts`) is to reproduce the
 *   helper logic in-process and lock it as a contract.
 *
 * Maintenance contract: the `assertAssociationScope` /
 * `assertAssociationInputScope` reproductions in this file MUST stay
 * byte-equivalent to the production helpers in `server/routes.ts`. If
 * the production helper changes, this file's reproduction must change
 * in lockstep, or these tests will pass while the production helper
 * diverges. CI should not be the only guardrail — code review of the
 * `server/routes.ts` lines 1039–1085 region must include a check that
 * this test file mirrors the change.
 *
 * Cases covered:
 *   1. platform-admin with empty scope → allowed
 *   2. platform-admin with scope including the association → allowed
 *   3. platform-admin with empty associationId → allowed (cross-assoc)
 *   4. manager with empty scope → DENIED (the regression we are
 *      protecting; previously was allowed)
 *   5. manager with scope NOT including the association → DENIED
 *   6. manager with scope including the association → allowed
 *   7. board-officer / assisted-board / pm-assistant / viewer with
 *      empty scope → DENIED (parameterised across all non-platform
 *      roles to ensure the fail-closed branch fires for every role)
 *   8. assertAssociationInputScope null/undefined associationId →
 *      throws "associationId is required" for non-platform-admin
 *   9. assertAssociationInputScope null associationId for
 *      platform-admin → allowed (matches helper short-circuit)
 *  10. missing adminRole entirely → DENIED (defense-in-depth)
 */

import { describe, it, expect } from "vitest";
import type { AdminRole } from "@shared/schema";

// ---- Reproduced helpers (mirror of server/routes.ts:1039-1085) ----

type AdminRequest = {
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

function assertAssociationScope(req: AdminRequest, associationId: string) {
  if (req.adminRole === "platform-admin") return;
  if (!associationId) {
    throw new Error("associationId is required");
  }
  if (!req.adminRole) {
    throw new Error("Association is outside admin scope");
  }
  const scopedAssociationIds = req.adminScopedAssociationIds ?? [];
  if (scopedAssociationIds.length === 0 || !scopedAssociationIds.includes(associationId)) {
    throw new Error("Association is outside admin scope");
  }
}

function assertAssociationInputScope(req: AdminRequest, associationId: string | null | undefined) {
  if (req.adminRole === "platform-admin") return;
  if (!associationId) {
    throw new Error("associationId is required");
  }
  assertAssociationScope(req, associationId);
}

// ---- Test fixtures --------------------------------------------------------

const ASSOC_A = "assoc-A";
const ASSOC_B = "assoc-B";
const ASSOC_C = "assoc-C";

const NON_PLATFORM_ROLES: AdminRole[] = [
  "manager",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "viewer",
];

// ---- Tests ----------------------------------------------------------------

describe("assertAssociationScope — platform-admin (cross-association by design)", () => {
  it("allows platform-admin with empty scope", () => {
    const req: AdminRequest = { adminRole: "platform-admin", adminScopedAssociationIds: [] };
    expect(() => assertAssociationScope(req, ASSOC_A)).not.toThrow();
  });

  it("allows platform-admin with scope including the association", () => {
    const req: AdminRequest = {
      adminRole: "platform-admin",
      adminScopedAssociationIds: [ASSOC_A, ASSOC_B],
    };
    expect(() => assertAssociationScope(req, ASSOC_A)).not.toThrow();
  });

  it("allows platform-admin with scope NOT including the association (still cross-assoc)", () => {
    // platform-admin is a global-allow short-circuit; scope contents are irrelevant.
    const req: AdminRequest = {
      adminRole: "platform-admin",
      adminScopedAssociationIds: [ASSOC_B],
    };
    expect(() => assertAssociationScope(req, ASSOC_A)).not.toThrow();
  });

  it("allows platform-admin with empty associationId (no scope check needed)", () => {
    const req: AdminRequest = { adminRole: "platform-admin", adminScopedAssociationIds: [] };
    expect(() => assertAssociationScope(req, "")).not.toThrow();
  });
});

describe("assertAssociationScope — manager (the regression-protect cases)", () => {
  it("DENIES manager with empty scope (was previously allowed — the bug)", () => {
    // This is the M6 finding from self-review-2026-04-25.md. Before the
    // fix, the helper short-circuited to "allowed" when the scope array
    // was empty. After: must throw.
    const req: AdminRequest = { adminRole: "manager", adminScopedAssociationIds: [] };
    expect(() => assertAssociationScope(req, ASSOC_A)).toThrow(
      "Association is outside admin scope",
    );
  });

  it("DENIES manager with undefined scope", () => {
    const req: AdminRequest = { adminRole: "manager" };
    expect(() => assertAssociationScope(req, ASSOC_A)).toThrow(
      "Association is outside admin scope",
    );
  });

  it("DENIES manager with scope NOT including the association", () => {
    const req: AdminRequest = {
      adminRole: "manager",
      adminScopedAssociationIds: [ASSOC_B, ASSOC_C],
    };
    expect(() => assertAssociationScope(req, ASSOC_A)).toThrow(
      "Association is outside admin scope",
    );
  });

  it("ALLOWS manager with scope including the association", () => {
    const req: AdminRequest = {
      adminRole: "manager",
      adminScopedAssociationIds: [ASSOC_A, ASSOC_B],
    };
    expect(() => assertAssociationScope(req, ASSOC_A)).not.toThrow();
  });

  it("throws 'associationId is required' for manager with empty associationId", () => {
    const req: AdminRequest = {
      adminRole: "manager",
      adminScopedAssociationIds: [ASSOC_A],
    };
    expect(() => assertAssociationScope(req, "")).toThrow("associationId is required");
  });
});

describe("assertAssociationScope — every non-platform role fails closed on empty scope", () => {
  it.each(NON_PLATFORM_ROLES)(
    "DENIES role=%s with empty scope (fail-closed regression guard)",
    (role) => {
      const req: AdminRequest = { adminRole: role, adminScopedAssociationIds: [] };
      expect(() => assertAssociationScope(req, ASSOC_A)).toThrow(
        "Association is outside admin scope",
      );
    },
  );

  it.each(NON_PLATFORM_ROLES)(
    "ALLOWS role=%s when scope includes the association",
    (role) => {
      const req: AdminRequest = {
        adminRole: role,
        adminScopedAssociationIds: [ASSOC_A],
      };
      expect(() => assertAssociationScope(req, ASSOC_A)).not.toThrow();
    },
  );
});

describe("assertAssociationScope — defense-in-depth on missing adminRole", () => {
  it("DENIES when adminRole is undefined and associationId is present", () => {
    const req: AdminRequest = { adminScopedAssociationIds: [ASSOC_A] };
    expect(() => assertAssociationScope(req, ASSOC_A)).toThrow(
      "Association is outside admin scope",
    );
  });

  it("throws 'associationId is required' when adminRole is undefined and associationId is empty", () => {
    // The associationId-required check fires before the role check, by design,
    // so callers always learn about the missing input first.
    const req: AdminRequest = { adminScopedAssociationIds: [ASSOC_A] };
    expect(() => assertAssociationScope(req, "")).toThrow("associationId is required");
  });
});

describe("assertAssociationInputScope — wraps assertAssociationScope for nullable input", () => {
  it("allows platform-admin with null associationId (early-return)", () => {
    const req: AdminRequest = { adminRole: "platform-admin", adminScopedAssociationIds: [] };
    expect(() => assertAssociationInputScope(req, null)).not.toThrow();
    expect(() => assertAssociationInputScope(req, undefined)).not.toThrow();
  });

  it("DENIES manager with null associationId (associationId is required)", () => {
    const req: AdminRequest = {
      adminRole: "manager",
      adminScopedAssociationIds: [ASSOC_A],
    };
    expect(() => assertAssociationInputScope(req, null)).toThrow(
      "associationId is required",
    );
    expect(() => assertAssociationInputScope(req, undefined)).toThrow(
      "associationId is required",
    );
  });

  it("DENIES manager with empty scope and a present associationId (fail-closed)", () => {
    const req: AdminRequest = { adminRole: "manager", adminScopedAssociationIds: [] };
    expect(() => assertAssociationInputScope(req, ASSOC_A)).toThrow(
      "Association is outside admin scope",
    );
  });

  it("ALLOWS manager with scope including the association", () => {
    const req: AdminRequest = {
      adminRole: "manager",
      adminScopedAssociationIds: [ASSOC_A],
    };
    expect(() => assertAssociationInputScope(req, ASSOC_A)).not.toThrow();
  });

  it("DENIES manager with scope NOT including the association", () => {
    const req: AdminRequest = {
      adminRole: "manager",
      adminScopedAssociationIds: [ASSOC_B],
    };
    expect(() => assertAssociationInputScope(req, ASSOC_A)).toThrow(
      "Association is outside admin scope",
    );
  });
});
