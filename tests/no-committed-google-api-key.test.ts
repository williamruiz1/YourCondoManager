/**
 * Git-hygiene regression guard for the Google Maps API key.
 *
 * founder-os audit A-SEC-002 / COST-B-004 / CQ-012: a live Google Maps JS key
 * (`AIza…`) was committed to `fly.toml` (build arg) and duplicated in
 * `INSTALL-OBSERVABILITY.md`. That key is now injected at build time from a CI
 * secret (see `.github/workflows/fly-deploy.yml`) and MUST NOT reappear in any
 * committed file. This test fails if any git-tracked file contains a
 * Google-API-key-shaped literal, and separately asserts `fly.toml` keeps the
 * Maps build arg empty.
 *
 * Runs in the node environment (default) — it shells out to `git` and reads the
 * working tree.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");

// Built from parts so this guard file does not itself contain a matching
// literal (which would trip the very check it defines).
const GOOGLE_KEY_RE = new RegExp("AIza" + "[0-9A-Za-z_\\-]{35}");
const GOOGLE_KEY_GREP = "AIza[0-9A-Za-z_-]{35}";

// This test file legitimately references the pattern; exclude it from the scan.
const SELF = "tests/no-committed-google-api-key.test.ts";

/**
 * Scan every git-tracked file (native `git grep`, C-fast, binary-aware via -I)
 * for a Google-API-key-shaped literal. `git grep` exits 1 when there are no
 * matches (our success case) and 0 when it finds one.
 */
function grepTrackedForGoogleKey(): string[] {
  try {
    const out = execFileSync(
      "git",
      ["grep", "-nIE", GOOGLE_KEY_GREP],
      { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    return out.split("\n").filter((l) => l.length > 0);
  } catch (err: unknown) {
    // git grep exit code 1 = no matches found -> success (no offenders).
    const e = err as { status?: number; stdout?: string };
    if (e && e.status === 1) return [];
    throw err;
  }
}

describe("git hygiene: no committed Google API key (A-SEC-002 / COST-B-004 / CQ-012)", () => {
  it("no git-tracked file contains a Google-API-key-shaped literal", () => {
    const offenders = grepTrackedForGoogleKey().filter(
      (line) =>
        !line.startsWith(`${SELF}:`) &&
        // Screenshot inventory artifacts embed PNG bytes as data URLs. Their
        // random base64 payload can contain an API-key-shaped substring but
        // is not executable text or a credential.
        !line.includes('src="data:image/'),
    );

    expect(
      offenders,
      `Committed Google-API-key-shaped literal(s) found. Keys must be injected ` +
        `at build time from a CI secret, never committed. Offending lines:\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("fly.toml keeps VITE_GOOGLE_MAPS_API_KEY as an empty build arg", () => {
    const flyToml = readFileSync(path.join(REPO_ROOT, "fly.toml"), "utf8");

    // The build arg must exist (so the ARG is wired) but carry no value.
    expect(flyToml).toMatch(/VITE_GOOGLE_MAPS_API_KEY\s*=\s*""/);
    // And must NOT carry a live key value.
    expect(flyToml).not.toMatch(GOOGLE_KEY_RE);
  });
});
