// Git-hygiene guard for the Google Maps API key (A-SEC-002 / COST-B-004 / CQ-012).
//
// The Maps JS key must NOT be committed to config: it is injected at deploy time
// from the CI secret VITE_GOOGLE_MAPS_API_KEY via `flyctl deploy --build-arg`.
// This test fails if any tracked config file re-introduces a hardcoded Google
// API key literal, and confirms the CI injection stays wired.
//
// (Maps JS keys are client-visible by design — this guards git hygiene +
// rotation, not server-secrecy.)
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Google API keys look like `AIza` + 35 url-safe chars.
const GOOGLE_API_KEY = /AIza[0-9A-Za-z_-]{35}/;
const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("Google Maps API key is not committed to config (A-SEC-002/COST-B-004/CQ-012)", () => {
  it("fly.toml contains no hardcoded Google API key", () => {
    const fly = read("fly.toml");
    expect(fly).not.toMatch(GOOGLE_API_KEY);
    // The build-arg key is present but empty (CI injects the real value).
    expect(fly).toContain('VITE_GOOGLE_MAPS_API_KEY = ""');
  });

  it("INSTALL-OBSERVABILITY.md contains no hardcoded Google API key", () => {
    expect(read("INSTALL-OBSERVABILITY.md")).not.toMatch(GOOGLE_API_KEY);
  });

  it("the Fly deploy workflow injects the key from a CI secret at build time", () => {
    const wf = read(".github/workflows/fly-deploy.yml");
    expect(wf).toContain("--build-arg VITE_GOOGLE_MAPS_API_KEY=");
    expect(wf).toContain("secrets.VITE_GOOGLE_MAPS_API_KEY");
    // and the injected value itself must not be a hardcoded key
    expect(wf).not.toMatch(GOOGLE_API_KEY);
  });
});
