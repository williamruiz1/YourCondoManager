import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// CQ-001 (founder-os#10740): the server/shared trees were never linted (the
// primary eslint.config.js is client-only + ignores server/**/shared/**). This
// test proves the new `eslint.server.config.js` actually runs on server code AND
// catches the audit's headline concern — an unawaited promise in a money path
// (`@typescript-eslint/no-floating-promises`). If this fails, the server lint
// gate is not actually analysing server code.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function runServerLint(target: string): { code: number; output: string } {
  try {
    const out = execFileSync(
      "npx",
      ["eslint", "--config", "eslint.server.config.js", target],
      { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return { code: 0, output: out };
  } catch (err: any) {
    return { code: err.status ?? 1, output: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

describe("CQ-001 — server ESLint gate", () => {
  it("flags a floating promise in server code (no-floating-promises is active)", () => {
    const { code, output } = runServerLint("server/__tests__/fixtures/floating-promise.fixture.ts");
    expect(code).not.toBe(0); // eslint exits non-zero when it reports an error
    expect(output).toContain("@typescript-eslint/no-floating-promises");
  }, 60_000);
});
