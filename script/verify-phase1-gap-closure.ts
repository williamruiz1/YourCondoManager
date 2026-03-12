import fs from "fs";
import { randomUUID } from "crypto";
import { storage } from "../server/storage";
import { db } from "../server/db";
import { auditLogs } from "../shared/schema";
import { eq } from "drizzle-orm";

function assertCheck(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function read(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

async function verifyCodeCoverage() {
  const routes = read("server/routes.ts");
  const schema = read("shared/schema.ts");
  const storageFile = read("server/storage.ts");

  assertCheck(schema.includes("export const auditLogs"), "missing canonical auditLogs schema");
  assertCheck(routes.includes('app.get("/api/audit-logs"'), "missing audit log read endpoint");

  const requiredDeletes = [
    '/api/associations/:id',
    '/api/units/:id',
    '/api/persons/:id',
    '/api/ownerships/:id',
    '/api/occupancies/:id',
    '/api/board-roles/:id',
    '/api/documents/:id',
  ];

  for (const path of requiredDeletes) {
    assertCheck(routes.includes(`app.delete("${path}"`), `missing delete route ${path}`);
  }

  assertCheck(storageFile.includes("recordAuditEvent"), "missing audit event writer in storage");
  assertCheck(storageFile.includes("Cannot delete unit with ownership history"), "missing unit integrity guard");
  assertCheck(storageFile.includes("Cannot delete person with ownership history"), "missing person integrity guard");
}

async function verifyRuntimeAuditBehavior() {
  const actor = `m1-verify-${Date.now()}@local`;
  const marker = randomUUID();

  const association = await storage.createAssociation(
    {
      name: `M1 Verify ${marker}`,
      address: "1 Audit Way",
      city: "New Haven",
      state: "CT",
      country: "USA",
    },
    actor,
  );

  const unit = await storage.createUnit(
    {
      associationId: association.id,
      unitNumber: `U-${marker.slice(0, 6)}`,
      building: "A",
      squareFootage: 900,
    },
    actor,
  );

  const person = await storage.createPerson(
    {
      firstName: "Audit",
      lastName: "Tester",
      email: `${marker.slice(0, 8)}@example.com`,
      phone: "555-1000",
      mailingAddress: "1 Audit Way",
    },
    actor,
  );

  const ownership = await storage.createOwnership(
    {
      unitId: unit.id,
      personId: person.id,
      ownershipPercentage: 100,
      startDate: new Date(),
      endDate: null,
    },
    actor,
  );

  let unitDeleteBlocked = false;
  try {
    await storage.deleteUnit(unit.id, actor);
  } catch {
    unitDeleteBlocked = true;
  }
  assertCheck(unitDeleteBlocked, "unit delete should be blocked when ownership history exists");

  const deletedOwnership = await storage.deleteOwnership(ownership.id, actor);
  assertCheck(deletedOwnership, "ownership delete should succeed");

  const deletedUnit = await storage.deleteUnit(unit.id, actor);
  assertCheck(deletedUnit, "unit delete should succeed after ownership deletion");

  const boardPerson = await storage.createPerson(
    {
      firstName: "Board",
      lastName: "Member",
      email: `${marker.slice(0, 8)}-board@example.com`,
      phone: null,
      mailingAddress: null,
    },
    actor,
  );

  const boardRole = await storage.createBoardRole(
    {
      associationId: association.id,
      personId: boardPerson.id,
      role: "Secretary",
      startDate: new Date(),
      endDate: null,
    },
    actor,
  );

  const document = await storage.createDocument(
    {
      associationId: association.id,
      title: `Doc ${marker}`,
      fileUrl: "/api/uploads/mock.pdf",
      documentType: "minutes",
      uploadedBy: actor,
    },
    actor,
  );

  await storage.createDocumentTag(
    {
      documentId: document.id,
      entityType: "association",
      entityId: association.id,
    },
    actor,
  );

  await storage.createDocumentVersion(
    {
      documentId: document.id,
      versionNumber: 2,
      title: `Doc ${marker} v2`,
      fileUrl: "/api/uploads/mock-v2.pdf",
      uploadedBy: actor,
    },
    actor,
  );

  const deletedDocument = await storage.deleteDocument(document.id, actor);
  assertCheck(deletedDocument, "document delete should succeed");

  const deletedBoardRole = await storage.deleteBoardRole(boardRole.id, actor);
  assertCheck(deletedBoardRole, "board role delete should succeed");

  const deletedBoardPerson = await storage.deletePerson(boardPerson.id, actor);
  assertCheck(deletedBoardPerson, "board person delete should succeed after board-role deletion");

  const deletedPerson = await storage.deletePerson(person.id, actor);
  assertCheck(deletedPerson, "person delete should succeed after ownership deletion");

  const deletedAssociation = await storage.deleteAssociation(association.id, actor);
  assertCheck(deletedAssociation, "association delete should succeed once linked records are removed");

  const logs = await db.select().from(auditLogs).where(eq(auditLogs.actorEmail, actor));
  assertCheck(logs.length >= 12, "expected a substantial set of audit entries from runtime verification");

  const actionsByEntity = new Set(logs.map((l) => `${l.action}:${l.entityType}`));
  const required = [
    "create:association",
    "delete:association",
    "create:unit",
    "delete:unit",
    "create:ownership",
    "delete:ownership",
    "create:person",
    "delete:person",
    "create:board-role",
    "delete:board-role",
    "create:document",
    "delete:document",
  ];

  for (const token of required) {
    assertCheck(actionsByEntity.has(token), `missing audit token ${token}`);
  }
}

async function run() {
  await verifyCodeCoverage();
  await verifyRuntimeAuditBehavior();
  console.log("Phase 1 gap-closure verification checks passed.");
}

run().catch((error) => {
  console.error("Verification failed:", error.message);
  process.exit(1);
});
