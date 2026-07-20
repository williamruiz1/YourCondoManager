import { describe, expect, it } from "vitest";
import { canAccess } from "@shared/persona-access";

describe("Assisted Board and multi-association Board route boundaries", () => {
  it.each(["board-officer", "assisted-board"] as const)(
    "keeps %s out of Manager portfolio surfaces",
    (role) => {
      expect(canAccess(role, "/app/associations")).toBe(false);
      expect(canAccess(role, "/app/portfolio")).toBe(false);
      expect(canAccess(role, "/app/association-context")).toBe(false);
    },
  );

  it("keeps Assisted Board out of association settings", () => {
    expect(canAccess("assisted-board", "/app/settings")).toBe(false);
    expect(canAccess("board-officer", "/app/settings")).toBe(true);
  });

  it.each([
    "/app/admin/roadmap",
    "/app/admin/users",
    "/app/admin/access-review",
    "/app/admin/consent-audit",
    "/app/admin/go-live-readiness",
    "/app/admin/executive",
  ])("keeps every Board persona out of platform route %s", (route) => {
    expect(canAccess("board-officer", route)).toBe(false);
    expect(canAccess("assisted-board", route)).toBe(false);
    expect(canAccess("platform-admin", route)).toBe(true);
  });

  it("allows a Board Officer—but not Assisted Board—to start another self-managed HOA", () => {
    expect(canAccess("board-officer", "/app/new-association")).toBe(true);
    expect(canAccess("assisted-board", "/app/new-association")).toBe(false);
  });
});
