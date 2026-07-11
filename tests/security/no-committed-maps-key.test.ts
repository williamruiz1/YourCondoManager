/**
 * A-SEC-002 / COST-B-004 / CQ-012 (founder-os#10743) regression guard.
 *
 * The Google Maps API key must NOT be committed in plaintext anywhere in the
 * tracked config/docs — it is injected at build time by CI from the repo secret
 * VITE_GOOGLE_MAPS_API_KEY. This test fails if any real-looking Google API key
 * (`AIza` + 35 chars) reappears in fly.toml or the observability runbook, so a
 * future edit can't silently re-commit it.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
// A committed Google API key: literal "AIza" + 35 key chars.
const GOOGLE_API_KEY_RE = /AIza[0-9A-Za-z_-]{35}/;

const GUARDED_FILES = ["fly.toml", "INSTALL-OBSERVABILITY.md"];

describe("no committed Google Maps API key (A-SEC-002/#10743)", () => {
  for (const rel of GUARDED_FILES) {
    it(`${rel} contains no plaintext AIza… key`, () => {
      const contents = readFileSync(path.join(ROOT, rel), "utf8");
      const match = contents.match(GOOGLE_API_KEY_RE);
      expect(
        match,
        `Found a committed Google API key in ${rel}: ${match?.[0]}. ` +
          `Inject it via the CI build secret VITE_GOOGLE_MAPS_API_KEY instead.`,
      ).toBeNull();
    });
  }

  it("fly.toml's VITE_GOOGLE_MAPS_API_KEY build arg is empty (secret-injected)", () => {
    const fly = readFileSync(path.join(ROOT, "fly.toml"), "utf8");
    // the build arg exists but carries no value in committed config
    expect(fly).toMatch(/VITE_GOOGLE_MAPS_API_KEY\s*=\s*""/);
  });
});
