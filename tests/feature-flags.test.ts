/**
 * Feature flag helper tests — Phase 5b of Platform Overhaul.
 *
 * Covers:
 *   - Default values match the documented lifecycle (PORTAL_ROLE_COLLAPSE on
 *     post-Phase-8a, BOARD_SHUNT_ACTIVE on).
 *   - process.env override for "true" / "false".
 *   - Malformed env values fall through to defaults.
 *   - Cross-flag independence (overriding one does not leak to the other).
 *   - Importability from server (Node) context — this file IS the server-context
 *     import test. A client-context import test lives in
 *     client/src/**__tests__ under the jsdom env.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getFeatureFlag,
  getFeatureFlagForAssociation,
  __FEATURE_FLAG_DEFAULTS__,
  type FeatureFlagKey,
} from "../shared/feature-flags";

const FLAG_KEYS: FeatureFlagKey[] = [
  "PORTAL_ROLE_COLLAPSE",
  "BOARD_SHUNT_ACTIVE",
  "ASSESSMENT_EXECUTION_UNIFIED",
  "HUB_VISIBILITY_RENAME",
];

function envKey(key: FeatureFlagKey): string {
  return `FEATURE_FLAG_${key}`;
}

describe("feature flags — defaults", () => {
  beforeEach(() => {
    for (const k of FLAG_KEYS) delete process.env[envKey(k)];
  });

  it("PORTAL_ROLE_COLLAPSE default is true (Phase 8a flip)", () => {
    // Phase 8b shipped the flag at default OFF; Phase 8a flipped it to ON
    // alongside migration 0014_portal_role_collapse.sql. Phase 8c removes
    // the flag entirely.
    expect(__FEATURE_FLAG_DEFAULTS__.PORTAL_ROLE_COLLAPSE).toBe(true);
    expect(getFeatureFlag("PORTAL_ROLE_COLLAPSE")).toBe(true);
  });

  it("BOARD_SHUNT_ACTIVE default is true (Phase 13 dark-launch)", () => {
    expect(__FEATURE_FLAG_DEFAULTS__.BOARD_SHUNT_ACTIVE).toBe(true);
    expect(getFeatureFlag("BOARD_SHUNT_ACTIVE")).toBe(true);
  });

  it("HUB_VISIBILITY_RENAME default is false (1.5 HV-1 ships additive only)", () => {
    expect(__FEATURE_FLAG_DEFAULTS__.HUB_VISIBILITY_RENAME).toBe(false);
    expect(getFeatureFlag("HUB_VISIBILITY_RENAME")).toBe(false);
  });

  it("every FeatureFlagKey has an explicit default", () => {
    for (const k of FLAG_KEYS) {
      expect(__FEATURE_FLAG_DEFAULTS__[k]).toBeTypeOf("boolean");
    }
  });
});

describe("feature flags — process.env override", () => {
  afterEach(() => {
    for (const k of FLAG_KEYS) delete process.env[envKey(k)];
  });

  it('FEATURE_FLAG_PORTAL_ROLE_COLLAPSE="true" flips the flag on', () => {
    process.env.FEATURE_FLAG_PORTAL_ROLE_COLLAPSE = "true";
    expect(getFeatureFlag("PORTAL_ROLE_COLLAPSE")).toBe(true);
  });

  it('FEATURE_FLAG_BOARD_SHUNT_ACTIVE="false" flips the flag off', () => {
    process.env.FEATURE_FLAG_BOARD_SHUNT_ACTIVE = "false";
    expect(getFeatureFlag("BOARD_SHUNT_ACTIVE")).toBe(false);
  });

  it("malformed env value falls through to default", () => {
    process.env.FEATURE_FLAG_PORTAL_ROLE_COLLAPSE = "yes";
    // Phase 8a flipped the default to true — malformed values fall through to it.
    expect(getFeatureFlag("PORTAL_ROLE_COLLAPSE")).toBe(true);

    process.env.FEATURE_FLAG_BOARD_SHUNT_ACTIVE = "1";
    expect(getFeatureFlag("BOARD_SHUNT_ACTIVE")).toBe(true);
  });

  it("empty string env value falls through to default", () => {
    process.env.FEATURE_FLAG_PORTAL_ROLE_COLLAPSE = "";
    expect(getFeatureFlag("PORTAL_ROLE_COLLAPSE")).toBe(true);
  });

  it("overriding one flag does not leak to another", () => {
    process.env.FEATURE_FLAG_PORTAL_ROLE_COLLAPSE = "true";
    expect(getFeatureFlag("PORTAL_ROLE_COLLAPSE")).toBe(true);
    expect(getFeatureFlag("BOARD_SHUNT_ACTIVE")).toBe(
      __FEATURE_FLAG_DEFAULTS__.BOARD_SHUNT_ACTIVE,
    );
  });

  it("is callable repeatedly without side effects (pure read)", () => {
    process.env.FEATURE_FLAG_BOARD_SHUNT_ACTIVE = "false";
    const a = getFeatureFlag("BOARD_SHUNT_ACTIVE");
    const b = getFeatureFlag("BOARD_SHUNT_ACTIVE");
    const c = getFeatureFlag("BOARD_SHUNT_ACTIVE");
    expect([a, b, c]).toEqual([false, false, false]);
  });
});

describe("feature flags — ASSESSMENT_EXECUTION_UNIFIED (Wave 7 / 4.3 Q3)", () => {
  afterEach(() => {
    delete process.env.FEATURE_FLAG_ASSESSMENT_EXECUTION_UNIFIED;
    for (const k of Object.keys(process.env)) {
      if (k.startsWith("FEATURE_FLAG_ASSESSMENT_EXECUTION_UNIFIED_")) {
        delete process.env[k];
      }
    }
  });

  it("defaults to false (Wave 7 ships with shadow-write only)", () => {
    expect(__FEATURE_FLAG_DEFAULTS__.ASSESSMENT_EXECUTION_UNIFIED).toBe(false);
    expect(getFeatureFlag("ASSESSMENT_EXECUTION_UNIFIED")).toBe(false);
  });

  it("per-association override flips only the targeted association", () => {
    const associationId = "1e2da109-f6f6-431c-8dc0-f61b548a1b83";
    const envKey = `FEATURE_FLAG_ASSESSMENT_EXECUTION_UNIFIED_${associationId
      .replace(/-/g, "_")
      .toUpperCase()}`;
    process.env[envKey] = "true";

    expect(
      getFeatureFlagForAssociation("ASSESSMENT_EXECUTION_UNIFIED", associationId),
    ).toBe(true);
    expect(
      getFeatureFlagForAssociation("ASSESSMENT_EXECUTION_UNIFIED", "other-assoc"),
    ).toBe(false);
  });

  it("global flag override applies to every association when no per-association override exists", () => {
    process.env.FEATURE_FLAG_ASSESSMENT_EXECUTION_UNIFIED = "true";
    expect(
      getFeatureFlagForAssociation("ASSESSMENT_EXECUTION_UNIFIED", "any"),
    ).toBe(true);
  });

  it("per-association override takes precedence over the global flag", () => {
    process.env.FEATURE_FLAG_ASSESSMENT_EXECUTION_UNIFIED = "true";
    const associationId = "a-b-c";
    const envKey = `FEATURE_FLAG_ASSESSMENT_EXECUTION_UNIFIED_${associationId
      .replace(/-/g, "_")
      .toUpperCase()}`;
    process.env[envKey] = "false";

    expect(
      getFeatureFlagForAssociation("ASSESSMENT_EXECUTION_UNIFIED", associationId),
    ).toBe(false);
    expect(
      getFeatureFlagForAssociation("ASSESSMENT_EXECUTION_UNIFIED", "other"),
    ).toBe(true);
  });
});

describe("feature flags — import surface (server context)", () => {
  it("exports getFeatureFlag as a function", () => {
    expect(typeof getFeatureFlag).toBe("function");
  });

  it("exports __FEATURE_FLAG_DEFAULTS__ as a non-null object", () => {
    expect(__FEATURE_FLAG_DEFAULTS__).toBeTypeOf("object");
    expect(__FEATURE_FLAG_DEFAULTS__).not.toBeNull();
  });
});
