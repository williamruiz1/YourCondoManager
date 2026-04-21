/**
 * Feature flag helper tests — Phase 5b of Platform Overhaul.
 *
 * Covers:
 *   - Default values match the documented lifecycle (PORTAL_ROLE_COLLAPSE off,
 *     BOARD_SHUNT_ACTIVE on).
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
  __FEATURE_FLAG_DEFAULTS__,
  type FeatureFlagKey,
} from "../shared/feature-flags";

const FLAG_KEYS: FeatureFlagKey[] = ["PORTAL_ROLE_COLLAPSE", "BOARD_SHUNT_ACTIVE"];

function envKey(key: FeatureFlagKey): string {
  return `FEATURE_FLAG_${key}`;
}

describe("feature flags — defaults", () => {
  beforeEach(() => {
    for (const k of FLAG_KEYS) delete process.env[envKey(k)];
  });

  it("PORTAL_ROLE_COLLAPSE default is false (Phase 8a ships off)", () => {
    expect(__FEATURE_FLAG_DEFAULTS__.PORTAL_ROLE_COLLAPSE).toBe(false);
    expect(getFeatureFlag("PORTAL_ROLE_COLLAPSE")).toBe(false);
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
    expect(getFeatureFlag("PORTAL_ROLE_COLLAPSE")).toBe(false);

    process.env.FEATURE_FLAG_BOARD_SHUNT_ACTIVE = "1";
    expect(getFeatureFlag("BOARD_SHUNT_ACTIVE")).toBe(true);
  });

  it("empty string env value falls through to default", () => {
    process.env.FEATURE_FLAG_PORTAL_ROLE_COLLAPSE = "";
    expect(getFeatureFlag("PORTAL_ROLE_COLLAPSE")).toBe(false);
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

describe("feature flags — import surface (server context)", () => {
  it("exports getFeatureFlag as a function", () => {
    expect(typeof getFeatureFlag).toBe("function");
  });

  it("exports __FEATURE_FLAG_DEFAULTS__ as a non-null object", () => {
    expect(__FEATURE_FLAG_DEFAULTS__).toBeTypeOf("object");
    expect(__FEATURE_FLAG_DEFAULTS__).not.toBeNull();
  });
});
