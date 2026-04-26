/**
 * Feature flag helper tests — Phase 5b of Platform Overhaul.
 *
 * Covers:
 *   - Default values match the documented lifecycle (BOARD_SHUNT_ACTIVE on,
 *     ASSESSMENT_EXECUTION_UNIFIED on). PORTAL_ROLE_COLLAPSE was retired in
 *     Phase 8c — its assertions are intentionally absent.
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
  "BOARD_SHUNT_ACTIVE",
  "ASSESSMENT_EXECUTION_UNIFIED",
];

function envKey(key: FeatureFlagKey): string {
  return `FEATURE_FLAG_${key}`;
}

describe("feature flags — defaults", () => {
  beforeEach(() => {
    for (const k of FLAG_KEYS) delete process.env[envKey(k)];
  });

  it("PORTAL_ROLE_COLLAPSE is absent from FeatureFlagKey (Phase 8c retired)", () => {
    // Phase 8c removed the flag entirely. The DEFAULTS map must not carry
    // a PORTAL_ROLE_COLLAPSE entry, and the FeatureFlagKey union must not
    // include the literal — TypeScript would have already caught the latter
    // at compile time, so this asserts the runtime defaults map.
    expect(
      (__FEATURE_FLAG_DEFAULTS__ as Record<string, boolean>)
        .PORTAL_ROLE_COLLAPSE,
    ).toBeUndefined();
  });

  it("BOARD_SHUNT_ACTIVE default is true (Phase 13 dark-launch)", () => {
    expect(__FEATURE_FLAG_DEFAULTS__.BOARD_SHUNT_ACTIVE).toBe(true);
    expect(getFeatureFlag("BOARD_SHUNT_ACTIVE")).toBe(true);
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

  it('FEATURE_FLAG_BOARD_SHUNT_ACTIVE="true" flips the flag on', () => {
    process.env.FEATURE_FLAG_BOARD_SHUNT_ACTIVE = "true";
    expect(getFeatureFlag("BOARD_SHUNT_ACTIVE")).toBe(true);
  });

  it('FEATURE_FLAG_BOARD_SHUNT_ACTIVE="false" flips the flag off', () => {
    process.env.FEATURE_FLAG_BOARD_SHUNT_ACTIVE = "false";
    expect(getFeatureFlag("BOARD_SHUNT_ACTIVE")).toBe(false);
  });

  it("malformed env value falls through to default", () => {
    process.env.FEATURE_FLAG_BOARD_SHUNT_ACTIVE = "1";
    expect(getFeatureFlag("BOARD_SHUNT_ACTIVE")).toBe(true);
  });

  it("empty string env value falls through to default", () => {
    process.env.FEATURE_FLAG_BOARD_SHUNT_ACTIVE = "";
    expect(getFeatureFlag("BOARD_SHUNT_ACTIVE")).toBe(true);
  });

  it("overriding one flag does not leak to another", () => {
    process.env.FEATURE_FLAG_BOARD_SHUNT_ACTIVE = "false";
    expect(getFeatureFlag("BOARD_SHUNT_ACTIVE")).toBe(false);
    expect(getFeatureFlag("ASSESSMENT_EXECUTION_UNIFIED")).toBe(
      __FEATURE_FLAG_DEFAULTS__.ASSESSMENT_EXECUTION_UNIFIED,
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

describe("feature flags — ASSESSMENT_EXECUTION_UNIFIED (Wave 7 / 4.3 Q3 — flipped ON in Wave 12)", () => {
  afterEach(() => {
    delete process.env.FEATURE_FLAG_ASSESSMENT_EXECUTION_UNIFIED;
    for (const k of Object.keys(process.env)) {
      if (k.startsWith("FEATURE_FLAG_ASSESSMENT_EXECUTION_UNIFIED_")) {
        delete process.env[k];
      }
    }
  });

  it("defaults to true (Wave 12 flipped ON alongside legacy poster deletion)", () => {
    expect(__FEATURE_FLAG_DEFAULTS__.ASSESSMENT_EXECUTION_UNIFIED).toBe(true);
    expect(getFeatureFlag("ASSESSMENT_EXECUTION_UNIFIED")).toBe(true);
  });

  it("per-association override flips only the targeted association (to OFF — debug use)", () => {
    const associationId = "1e2da109-f6f6-431c-8dc0-f61b548a1b83";
    const envKey = `FEATURE_FLAG_ASSESSMENT_EXECUTION_UNIFIED_${associationId
      .replace(/-/g, "_")
      .toUpperCase()}`;
    process.env[envKey] = "false";

    expect(
      getFeatureFlagForAssociation("ASSESSMENT_EXECUTION_UNIFIED", associationId),
    ).toBe(false);
    expect(
      getFeatureFlagForAssociation("ASSESSMENT_EXECUTION_UNIFIED", "other-assoc"),
    ).toBe(true);
  });

  it("global flag override applies to every association when no per-association override exists", () => {
    process.env.FEATURE_FLAG_ASSESSMENT_EXECUTION_UNIFIED = "false";
    expect(
      getFeatureFlagForAssociation("ASSESSMENT_EXECUTION_UNIFIED", "any"),
    ).toBe(false);
  });

  it("per-association override takes precedence over the global flag", () => {
    process.env.FEATURE_FLAG_ASSESSMENT_EXECUTION_UNIFIED = "false";
    const associationId = "a-b-c";
    const envKey = `FEATURE_FLAG_ASSESSMENT_EXECUTION_UNIFIED_${associationId
      .replace(/-/g, "_")
      .toUpperCase()}`;
    process.env[envKey] = "true";

    expect(
      getFeatureFlagForAssociation("ASSESSMENT_EXECUTION_UNIFIED", associationId),
    ).toBe(true);
    expect(
      getFeatureFlagForAssociation("ASSESSMENT_EXECUTION_UNIFIED", "other"),
    ).toBe(false);
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
