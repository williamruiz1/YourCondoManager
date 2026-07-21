import { describe, expect, it, vi } from "vitest";

vi.mock("../server/pm-toggles", () => ({
  canDelegatedFeatureAccess: vi.fn(async () => true),
}));

import {
  ASSISTED_BOARD_FEATURES,
  assistedBoardDefaultAccess,
  createDefaultAssistedBoardAccessMatrix,
  createDefaultDelegatedAccessMatrix,
  delegatedToggleDescriptor,
  delegatedToggleKey,
} from "../shared/delegated-feature-access";
import {
  evaluateAssistedBoardMutation,
  resolveAssistedBoardMutationFeature,
  resolveAssistedBoardRequestFeature,
  resolveDelegatedAssociationId,
} from "../server/assisted-board-delegation";
import { setResourceAssociationResolver } from "../server/lib/tenant-scope";
import { canDelegatedFeatureAccess } from "../server/pm-toggles";

function request(overrides: Record<string, unknown> = {}) {
  const headers = (overrides.headers ?? {}) as Record<string, string>;
  return {
    method: "POST",
    path: "/api/work-orders",
    query: {},
    body: {},
    adminRole: "assisted-board",
    adminScopedAssociationIds: ["assoc-a"],
    get: (name: string) => headers[name.toLowerCase()],
    ...overrides,
  } as any;
}

describe("Assisted Board delegation catalog", () => {
  it("keeps View and Write independent for every feature", () => {
    const matrix = createDefaultAssistedBoardAccessMatrix();
    for (const feature of ASSISTED_BOARD_FEATURES) {
      const viewKey = delegatedToggleKey(feature.id, "view");
      const writeKey = delegatedToggleKey(feature.id, "write");
      expect(viewKey).not.toBe(writeKey);
      expect(delegatedToggleDescriptor(viewKey)).toEqual({
        featureId: feature.id,
        permission: "view",
      });
      expect(delegatedToggleDescriptor(writeKey)).toEqual({
        featureId: feature.id,
        permission: "write",
      });
      expect(matrix[feature.id]).toEqual({
        view: assistedBoardDefaultAccess(feature.id, "view"),
        write: assistedBoardDefaultAccess(feature.id, "write"),
      });
    }
  });

  it("does not expose platform, admin, settings, or portfolio authority", () => {
    const ids = ASSISTED_BOARD_FEATURES.map((feature) => feature.id);
    expect(ids.some((id) => /platform|admin|settings|portfolio|billing/.test(id))).toBe(false);
  });

  it("starts every PM Assistant feature denied without changing Assisted Board defaults", () => {
    const assistant = createDefaultDelegatedAccessMatrix("pm-assistant");
    const board = createDefaultDelegatedAccessMatrix("assisted-board");
    for (const feature of ASSISTED_BOARD_FEATURES) {
      expect(assistant[feature.id]).toEqual({ view: false, write: false });
      expect(board[feature.id]).toEqual({
        view: feature.defaultView,
        write: feature.defaultWrite,
      });
    }
  });
});

describe("Assisted Board server mutation envelope", () => {
  it("maps known mutations and fail-closes unknown mutations", () => {
    expect(resolveAssistedBoardMutationFeature("POST", "/api/work-orders")).toBe(
      "operations.work-orders",
    );
    expect(resolveAssistedBoardRequestFeature("/api/maintenance/requests")).toBe(
      "operations.maintenance-requests",
    );
    expect(resolveAssistedBoardRequestFeature("/api/financial/reports/board-summary")).toBe(
      "financials.reports",
    );
    expect(resolveAssistedBoardMutationFeature("PATCH", "/api/announcements/a1")).toBe(
      "communications.announcements",
    );
    expect(resolveAssistedBoardMutationFeature("POST", "/api/admin/users")).toBeNull();
  });

  it("requires explicit association context for multi-association board users", () => {
    expect(() =>
      resolveDelegatedAssociationId(
        request({ adminScopedAssociationIds: ["assoc-a", "assoc-b"] }),
      ),
    ).toThrow(/associationId is required/);

    expect(
      resolveDelegatedAssociationId(
        request({
          adminScopedAssociationIds: ["assoc-a", "assoc-b"],
          headers: { "x-ycm-association-id": "assoc-b" },
        }),
      ),
    ).toBe("assoc-b");
  });

  it("uses explicit mutation data before the browser association header", () => {
    expect(
      resolveDelegatedAssociationId(
        request({
          adminScopedAssociationIds: ["assoc-a", "assoc-b"],
          body: { associationId: "assoc-b" },
          headers: { "x-ycm-association-id": "assoc-a" },
        }),
      ),
    ).toBe("assoc-b");
  });

  it("rejects association context outside the caller's scope", () => {
    expect(() =>
      resolveDelegatedAssociationId(
        request({ headers: { "x-ycm-association-id": "assoc-b" } }),
      ),
    ).toThrow(/outside admin scope/);
  });

  it("denies unmapped Assisted Board writes but permits personal alert state", async () => {
    await expect(
      evaluateAssistedBoardMutation(request({ path: "/api/admin/users" })),
    ).resolves.toMatchObject({
      allowed: false,
      code: "DELEGATED_REQUEST_UNMAPPED",
    });
    await expect(
      evaluateAssistedBoardMutation(
        request({ path: "/api/alerts/alert-id/read" }),
      ),
    ).resolves.toEqual({ allowed: true });
  });


  it("fail-closes PM Assistant reads and writes that are not in the feature map", async () => {
    await expect(
      evaluateAssistedBoardMutation(request({
        method: "GET",
        path: "/api/admin/users",
        adminRole: "pm-assistant",
      })),
    ).resolves.toMatchObject({
      allowed: false,
      code: "DELEGATED_REQUEST_UNMAPPED",
    });

    await expect(
      evaluateAssistedBoardMutation(request({
        method: "POST",
        path: "/api/admin/billing/portal-session",
        adminRole: "pm-assistant",
      })),
    ).resolves.toMatchObject({
      allowed: false,
      code: "DELEGATED_REQUEST_UNMAPPED",
    });
  });

  it("uses the same PM Assistant grant check for direct reads and writes", async () => {
    const permission = vi.mocked(canDelegatedFeatureAccess);
    permission.mockResolvedValueOnce(false);
    await expect(
      evaluateAssistedBoardMutation(request({
        method: "GET",
        path: "/api/work-orders",
        adminRole: "pm-assistant",
      })),
    ).resolves.toMatchObject({
      allowed: false,
      code: "DELEGATED_VIEW_NOT_GRANTED",
      featureId: "operations.work-orders",
    });

    permission.mockResolvedValueOnce(true);
    await expect(
      evaluateAssistedBoardMutation(request({
        method: "POST",
        path: "/api/work-orders",
        adminRole: "pm-assistant",
      })),
    ).resolves.toMatchObject({
      allowed: true,
      featureId: "operations.work-orders",
    });
  });

  it("evaluates record mutations against the record's canonical association", async () => {
    setResourceAssociationResolver(async (resourceType, id) => {
      expect(resourceType).toBe("work-order");
      expect(id).toBe("wo-b");
      return "assoc-b";
    });
    await expect(
      evaluateAssistedBoardMutation(
        request({
          method: "PATCH",
          path: "/api/work-orders/wo-b",
          adminScopedAssociationIds: ["assoc-a", "assoc-b"],
          headers: { "x-ycm-association-id": "assoc-a" },
        }),
      ),
    ).resolves.toMatchObject({
      allowed: true,
      associationId: "assoc-b",
      featureId: "operations.work-orders",
    });
  });
});
