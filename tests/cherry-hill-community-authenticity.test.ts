import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..");
const seedSource = readFileSync(resolve(repoRoot, "server/seed.ts"), "utf8");
const cleanupSql = readFileSync(
  resolve(repoRoot, "migrations/0070_cherry_hill_authentic_notice_cleanup.sql"),
  "utf8",
);

describe("Cherry Hill public content authenticity", () => {
  it("does not recreate fictional association announcements in the production seed", () => {
    expect(seedSource).not.toContain("Annual Meeting Reminder");
    expect(seedSource).not.toContain("Pool Opening — Memorial Day Weekend");
    expect(seedSource).not.toContain("Emergency Water Shutoff Notice");
  });

  it("removes every remaining fixed-ID fictional Cherry Hill announcement", () => {
    expect(cleanupSql).toContain("ann00001-0000-4000-8000-000000000001");
    expect(cleanupSql).toContain("ann00001-0000-4000-8000-000000000004");
    expect(cleanupSql).toContain("ann00001-0000-4000-8000-000000000005");
    expect(cleanupSql).toContain("f301d073-ed84-4d73-84ce-3ef28af66f7a");
  });
});
