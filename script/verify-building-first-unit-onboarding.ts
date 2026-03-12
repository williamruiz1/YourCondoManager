import assert from "node:assert/strict";
import { storage } from "../server/storage";

async function run() {
  const suffix = String(Date.now()).slice(-6);
  const actor = `verify-building-first-${suffix}@local`;

  const associationA = await storage.createAssociation({
    name: `Building First Verify A ${suffix}`,
    address: "100 Verify Way",
    city: "Austin",
    state: "TX",
    country: "USA",
  }, actor);

  const associationB = await storage.createAssociation({
    name: `Building First Verify B ${suffix}`,
    address: "200 Verify Way",
    city: "Austin",
    state: "TX",
    country: "USA",
  }, actor);

  const buildingA = await storage.createBuilding({
    associationId: associationA.id,
    name: `Building-A-${suffix}`,
    address: "100 Verify Way",
    totalUnits: 12,
    notes: "verification",
  }, actor);

  await storage.createBuilding({
    associationId: associationB.id,
    name: `Building-B-${suffix}`,
    address: "200 Verify Way",
    totalUnits: 6,
    notes: "verification",
  }, actor);

  const unitLinked = await storage.createUnit({
    associationId: associationA.id,
    buildingId: buildingA.id,
    unitNumber: `A-${suffix}`,
    building: null,
    squareFootage: 950,
  }, actor);

  assert.equal(unitLinked.buildingId, buildingA.id, "buildingId should persist on new unit");
  assert.equal(unitLinked.building, buildingA.name, "legacy building label should auto-fill from selected building");

  const legacyUnit = await storage.createUnit({
    associationId: associationA.id,
    unitNumber: `LEG-${suffix}`,
    building: "Legacy Tower",
    squareFootage: 880,
    buildingId: null,
  }, actor);
  assert.equal(legacyUnit.buildingId, null, "legacy unit should allow null buildingId");

  const updatedLegacy = await storage.updateUnit(legacyUnit.id, {
    buildingId: buildingA.id,
  }, actor);
  assert.ok(updatedLegacy, "legacy unit should be updatable");
  assert.equal(updatedLegacy?.buildingId, buildingA.id, "legacy unit should support linking to building later");
  assert.equal(updatedLegacy?.building, buildingA.name, "legacy building label should normalize after linking");

  const buildingsA = await storage.getBuildings(associationA.id);
  assert.ok(buildingsA.some((building) => building.id === buildingA.id), "building query should include association building");
  assert.ok(buildingsA.every((building) => building.associationId === associationA.id), "building query should stay scoped");

  const otherAssociationBuildings = await storage.getBuildings(associationB.id);
  const foreignBuildingId = otherAssociationBuildings[0]?.id;
  assert.ok(foreignBuildingId, "second association building should exist for guardrail check");

  let blockedCrossAssociationLink = false;
  try {
    await storage.createUnit({
      associationId: associationA.id,
      buildingId: foreignBuildingId!,
      unitNumber: `BAD-${suffix}`,
      building: null,
      squareFootage: 700,
    }, actor);
  } catch (error: any) {
    blockedCrossAssociationLink = String(error?.message || "").includes("same association");
  }
  assert.equal(blockedCrossAssociationLink, true, "cross-association building linkage should be blocked");

  console.log("Building-first unit onboarding verification passed.");
  console.log(JSON.stringify({
    associationA: associationA.id,
    associationB: associationB.id,
    buildingA: buildingA.id,
    unitLinked: unitLinked.id,
    legacyUnit: legacyUnit.id,
  }, null, 2));
}

run().catch((error: any) => {
  console.error(`Building-first verification failed: ${error.message}`);
  process.exit(1);
});
