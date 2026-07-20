import { describe, expect, it } from "vitest";
import {
  isBoardScopedAdminRole,
  shouldUseStaticBoardAssociationLabel,
} from "@shared/board-role-boundaries";
import { resolveViewModeEntitlement } from "@shared/view-mode-entitlement";
import {
  assertAssociationScope,
  resolveScopedAssociationId,
} from "../server/lib/tenant-scope";
import type { Request } from "express";

describe("Board role boundaries across multiple associations", () => {
  it.each(["board-officer", "assisted-board"] as const)(
    "keeps %s Board-scoped regardless of association count",
    (role) => {
      expect(isBoardScopedAdminRole(role)).toBe(true);
      expect(resolveViewModeEntitlement({ role, email: "volunteer@example.com" })).toEqual({
        viewMode: "board",
        locked: true,
      });
      expect(shouldUseStaticBoardAssociationLabel(role, 1)).toBe(true);
      expect(shouldUseStaticBoardAssociationLabel(role, 2)).toBe(false);
    },
  );

  it("never treats a paid Manager as Board-scoped", () => {
    expect(isBoardScopedAdminRole("manager")).toBe(false);
    expect(shouldUseStaticBoardAssociationLabel("manager", 1)).toBe(false);
  });

  it("allows an explicit authorized association context and denies leakage", () => {
    const request = {
      adminRole: "board-officer",
      adminScopedAssociationIds: ["assoc-a", "assoc-b"],
      query: { associationId: "assoc-b" },
    } as unknown as Request & {
      adminRole: "board-officer";
      adminScopedAssociationIds: string[];
    };

    expect(resolveScopedAssociationId(request)).toBe("assoc-b");
    expect(() => assertAssociationScope(request, "assoc-a")).not.toThrow();
    expect(() => assertAssociationScope(request, "assoc-c")).toThrow(
      /outside admin scope/,
    );
  });
});
