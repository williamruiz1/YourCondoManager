/**
 * Contract tests for WS11 de-provisioning thresholds (Issue #387 / Plaid).
 *
 * These tests lock the policy decision matrix without touching the database
 * or storage layer — the actual `runAdminInactivityCheck()` is integration-
 * tested separately. Per the repo's `assert-association-scope.test.ts`
 * convention: the pure decision logic is reproduced in-process and locked
 * as a contract; the production helper in `server/de-provisioning.ts`
 * must stay byte-equivalent for the policy.
 *
 * Maintenance contract: if INACTIVITY_DEACTIVATE_DAYS or
 * INACTIVITY_WARNING_DAYS changes in `server/de-provisioning.ts`, this
 * file's reproduction must change in lockstep.
 */

import { describe, expect, test } from "vitest";

// Byte-equivalent reproduction of the constants from
// `server/de-provisioning.ts`. We do NOT import the module because it
// pulls in `server/db.ts` (which requires DATABASE_URL), `storage`,
// `email-provider`, etc., and unit-testing the policy decision matrix
// shouldn't require the world. Per the repo convention documented in
// `assert-association-scope.test.ts`. If the production constants
// change, update both sides in lockstep.
const INACTIVITY_DEACTIVATE_DAYS = 90;
const INACTIVITY_WARNING_DAYS = 75;

type Action = "deactivate" | "warn" | "noop";

function decideInactivityAction(inactiveDays: number): Action {
  if (inactiveDays >= INACTIVITY_DEACTIVATE_DAYS) return "deactivate";
  if (inactiveDays >= INACTIVITY_WARNING_DAYS && inactiveDays < INACTIVITY_DEACTIVATE_DAYS) return "warn";
  return "noop";
}

describe("WS11 inactivity-policy thresholds", () => {
  test("constants match Plaid attestation spec (90 / 75)", () => {
    expect(INACTIVITY_DEACTIVATE_DAYS).toBe(90);
    expect(INACTIVITY_WARNING_DAYS).toBe(75);
  });

  test("warning threshold is strictly less than deactivate threshold", () => {
    expect(INACTIVITY_WARNING_DAYS).toBeLessThan(INACTIVITY_DEACTIVATE_DAYS);
  });

  test("0 days inactive → noop", () => {
    expect(decideInactivityAction(0)).toBe("noop");
  });

  test("74 days inactive → noop (below warn threshold)", () => {
    expect(decideInactivityAction(74)).toBe("noop");
  });

  test("75 days inactive → warn (at warn threshold)", () => {
    expect(decideInactivityAction(75)).toBe("warn");
  });

  test("89 days inactive → warn (one below deactivate threshold)", () => {
    expect(decideInactivityAction(89)).toBe("warn");
  });

  test("90 days inactive → deactivate (at deactivate threshold)", () => {
    expect(decideInactivityAction(90)).toBe("deactivate");
  });

  test("365 days inactive → deactivate (well past threshold)", () => {
    expect(decideInactivityAction(365)).toBe("deactivate");
  });

  test("Infinity (never logged in) → deactivate", () => {
    expect(decideInactivityAction(Number.POSITIVE_INFINITY)).toBe("deactivate");
  });

  test("daysRemaining-until-deactivation is monotonic in the warn window", () => {
    const days75Remaining = INACTIVITY_DEACTIVATE_DAYS - 75;
    const days80Remaining = INACTIVITY_DEACTIVATE_DAYS - 80;
    const days89Remaining = INACTIVITY_DEACTIVATE_DAYS - 89;
    expect(days75Remaining).toBe(15);
    expect(days80Remaining).toBe(10);
    expect(days89Remaining).toBe(1);
    expect(days75Remaining).toBeGreaterThan(days80Remaining);
    expect(days80Remaining).toBeGreaterThan(days89Remaining);
  });
});
