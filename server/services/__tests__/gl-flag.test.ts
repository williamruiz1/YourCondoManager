/**
 * GL enablement flags — global + per-association allowlist.
 *
 * Verifies the SAFE rollout gate: an association is GL-enabled when the global
 * GL_ENABLED is on OR its id is on the GL_ENABLED_ASSOCIATIONS allowlist —
 * without flipping the GL on for everyone (the "do NOT blindly flip global-on"
 * requirement).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isGlEnabled, isGlEnabledForAssociation } from "../gl/flag";

const CHC = "f301d073-ed84-4d73-84ce-3ef28af66f7a";
const OTHER = "00000000-0000-4000-8000-000000000000";

beforeEach(() => {
  delete process.env.GL_ENABLED;
  delete process.env.GL_ENABLED_ASSOCIATIONS;
});
afterEach(() => {
  delete process.env.GL_ENABLED;
  delete process.env.GL_ENABLED_ASSOCIATIONS;
});

describe("isGlEnabled — global flag", () => {
  it("defaults OFF", () => {
    expect(isGlEnabled()).toBe(false);
  });
  it.each(["1", "true", "yes", "on"])("is ON for %j", (v) => {
    process.env.GL_ENABLED = v;
    expect(isGlEnabled()).toBe(true);
  });
});

describe("isGlEnabledForAssociation — per-association allowlist", () => {
  it("defaults OFF for any association when nothing is set", () => {
    expect(isGlEnabledForAssociation(CHC)).toBe(false);
    expect(isGlEnabledForAssociation(OTHER)).toBe(false);
  });

  it("global GL_ENABLED turns it on for EVERY association", () => {
    process.env.GL_ENABLED = "1";
    expect(isGlEnabledForAssociation(CHC)).toBe(true);
    expect(isGlEnabledForAssociation(OTHER)).toBe(true);
  });

  it("allowlist enables ONLY the listed association(s) — not everyone", () => {
    process.env.GL_ENABLED_ASSOCIATIONS = CHC;
    expect(isGlEnabledForAssociation(CHC)).toBe(true);
    expect(isGlEnabledForAssociation(OTHER)).toBe(false);
  });

  it("parses comma- and space-separated allowlists", () => {
    process.env.GL_ENABLED_ASSOCIATIONS = `${OTHER}, ${CHC}`;
    expect(isGlEnabledForAssociation(CHC)).toBe(true);
    expect(isGlEnabledForAssociation(OTHER)).toBe(true);
  });
});
