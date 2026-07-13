/**
 * Project Statecraft — compliance rules-engine scaffold unit tests.
 *
 * Covers the PURE, read-only loader in `server/compliance/rules-engine.ts`:
 *   - loading a known state (the cluster-B baseline placeholder, CT) returns
 *     the expected shape
 *   - loading an unknown state returns null
 *   - the placeholder's `verifiedWithCounsel: false` is present and readable
 *     (nothing here should ever be mistaken for settled legal fact)
 *   - cluster lookup returns only rule sets tagged with that cluster
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetComplianceRulesCacheForTests,
  getRequirementsForCluster,
  loadComplianceRules,
} from "../compliance/rules-engine";

describe("compliance rules-engine (Project Statecraft scaffold)", () => {
  beforeEach(() => {
    __resetComplianceRulesCacheForTests();
  });

  it("loads a known state (CT, cluster-B baseline placeholder) with the expected shape", () => {
    const rules = loadComplianceRules("CT");
    expect(rules).not.toBeNull();
    expect(rules?.stateCode).toBe("CT");
    expect(rules?.stateName).toBe("Connecticut");
    expect(rules?.cluster).toBe("B");
    expect(rules?.reserve).toMatchObject({
      reserveStudyRequired: false,
      fundingFloorPercent: null,
    });
    expect(rules?.disclosure).toMatchObject({
      budgetMustDiscloseReserve: true,
      resaleCertMustDiscloseReserve: true,
    });
  });

  it("is case-insensitive on the state code", () => {
    expect(loadComplianceRules("ct")?.stateCode).toBe("CT");
    expect(loadComplianceRules("Ct")?.stateCode).toBe("CT");
  });

  it("returns null for an unknown/unmodeled state", () => {
    expect(loadComplianceRules("ZZ")).toBeNull();
  });

  it("returns null for an empty state code", () => {
    expect(loadComplianceRules("")).toBeNull();
  });

  it("exposes verifiedWithCounsel: false on the placeholder — never settled legal fact", () => {
    const rules = loadComplianceRules("CT");
    expect(rules?.verifiedWithCounsel).toBe(false);
    expect(typeof rules?.note).toBe("string");
    expect(rules?.note).toMatch(/PLACEHOLDER/i);
  });

  it("returns the CT baseline when querying cluster B, and nothing for clusters with no data yet", () => {
    const clusterB = getRequirementsForCluster("B");
    expect(clusterB.length).toBeGreaterThanOrEqual(1);
    expect(clusterB.some((r) => r.stateCode === "CT")).toBe(true);

    const clusterA = getRequirementsForCluster("A");
    expect(clusterA).toEqual([]);
  });
});
