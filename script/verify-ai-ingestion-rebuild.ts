import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { storage } from "../server/storage";
import { aiIngestionExceptions, associationIngestionCorrectionMemory, ownerships, personContactPoints, persons } from "../shared/schema";

async function createPreviewImport(recordType: "owner-roster" | "contact-roster" | "invoice-draft" | "bank-statement", associationId: string, payloadJson: Record<string, unknown>) {
  const job = await storage.createAiIngestionJob({
    associationId,
    sourceType: "pasted-text",
    sourceText: `verification seed for ${recordType}`,
    sourceFilename: `${recordType}-verification.txt`,
    sourceFileUrl: null,
    contextNotes: "verification",
    submittedBy: "verifier@local",
  });

  const record = await storage.createAiExtractedRecord({
    jobId: job.id,
    associationId,
    recordType,
    payloadJson,
    confidenceScore: 0.92,
  });

  const summary = await storage.importApprovedAiExtractedRecord(record.id, "verifier@local", { mode: "preview" });
  assert.equal(summary.dryRun, true, `${recordType}: expected preview summary`);
  assert.equal(summary.sourceRecordId, record.id, `${recordType}: missing sourceRecordId`);
  assert.equal(summary.sourceRecordType, recordType, `${recordType}: missing sourceRecordType`);
  assert.equal(summary.sourceJobId, job.id, `${recordType}: missing sourceJobId`);
  return summary;
}

async function verifyHierarchicalOwnerRosterSegmentation(associationId: string) {
  const sourceText = [
    "100 Test Way",
    "A101 Taylor Verifier verify-segment@example.com 555-100-0000",
    "A102 Jordan and Casey Owner owner-segment@example.com 555-111-2222",
  ].join("\n");

  const job = await storage.createAiIngestionJob({
    associationId,
    sourceType: "pasted-text",
    sourceText,
    sourceFilename: "owner-roster-segmentation-verification.txt",
    sourceFileUrl: null,
    contextNotes: "segmentation verification",
    submittedBy: "verifier@local",
  });

  const processed = await storage.processAiIngestionJob(job.id);
  assert.equal(processed.status, "completed", "segmentation job: expected completed status");

  const records = await storage.getAiExtractedRecords(job.id);
  const ownerRecord = records.find((record) => record.recordType === "owner-roster");
  assert.ok(ownerRecord, "segmentation job: expected owner-roster extracted record");

  const payload = ownerRecord.payloadJson as Record<string, any>;
  assert.equal(payload.destinationPlan?.primaryModule, "owners", "segmentation job: expected owners route plan");
  assert.equal(payload.destinationPlan?.entityCounts?.units, 2, "segmentation job: expected two routed units");
  assert.equal(payload.destinationPlan?.entityCounts?.ownerships, 3, "segmentation job: expected three routed ownership candidates");

  assert.ok(Array.isArray(payload.normalizedEntries), "segmentation job: normalized entries missing");
  assert.equal(payload.normalizedEntries.length, 2, "segmentation job: expected two normalized entries");
  assert.equal(payload.normalizedEntries[0]?.buildingAddress, "100 Test Way", "segmentation job: first entry missing building address");
  assert.equal(payload.normalizedEntries[1]?.buildingAddress, "100 Test Way", "segmentation job: second entry missing building address");
  assert.equal(payload.normalizedEntries[0]?.unitNumber, "A101", "segmentation job: first unit mismatch");
  assert.equal(payload.normalizedEntries[1]?.unitNumber, "A102", "segmentation job: second unit mismatch");
  assert.equal(payload.normalizedEntries[1]?.ownerCandidates?.length, 2, "segmentation job: expected multi-owner candidate preservation");
}

async function verifyCorrectionMemoryAndExceptionPersistence(associationId: string) {
  const ownerJob = await storage.createAiIngestionJob({
    associationId,
    sourceType: "pasted-text",
    sourceText: "owner correction verification",
    sourceFilename: "owner-correction-verification.txt",
    sourceFileUrl: null,
    contextNotes: "correction verification",
    submittedBy: "verifier@local",
  });

  const ownerRecord = await storage.createAiExtractedRecord({
    jobId: ownerJob.id,
    associationId,
    recordType: "owner-roster",
    confidenceScore: 0.9,
    payloadJson: {
      normalizedEntries: [{
        buildingAddress: "100 Test Way",
        unitNumber: "A101",
        ownerText: "Taylor Verifier",
        ownerCandidates: [{
          displayName: "Taylor Verifier",
          firstName: "Taylor",
          lastName: "Verifier",
          email: null,
          phone: null,
        }],
        emails: ["verify-memory@example.com"],
        phones: ["555-100-9999"],
        notes: [],
      }],
      operatorCorrections: [{
        timestamp: new Date().toISOString(),
        kind: "unit-remap",
        entryIndex: 0,
        field: "unitNumber",
        before: "A101",
        after: "A-101",
      }],
    },
  });

  await storage.reviewAiExtractedRecord(ownerRecord.id, {
    reviewStatus: "approved",
    reviewedBy: "verifier@local",
    payloadJson: ownerRecord.payloadJson,
  });

  const ownerMemoryRows = await db
    .select()
    .from(associationIngestionCorrectionMemory)
    .where(and(eq(associationIngestionCorrectionMemory.associationId, associationId), eq(associationIngestionCorrectionMemory.recordType, "owner-roster")));
  assert.ok(ownerMemoryRows.some((row) => row.correctionKind === "unit-remap"), "owner correction memory should persist unit remaps");

  const bankJob = await storage.createAiIngestionJob({
    associationId,
    sourceType: "pasted-text",
    sourceText: "bank correction verification",
    sourceFilename: "bank-correction-verification.txt",
    sourceFileUrl: null,
    contextNotes: "bank correction verification",
    submittedBy: "verifier@local",
  });

  const bankRecord = await storage.createAiExtractedRecord({
    jobId: bankJob.id,
    associationId,
    recordType: "bank-statement",
    confidenceScore: 0.9,
    payloadJson: {
      statementPeriod: "2025-01",
      transactions: [{
        unitNumber: "ZZ99",
        ownerEmail: "missing-owner@example.com",
        ownerName: "Missing Owner",
        amount: -125,
        postedAt: "2025-01-10",
        description: "Unknown payment mapping",
        entryType: "payment",
      }],
      operatorCorrections: [{
        timestamp: new Date().toISOString(),
        kind: "bank-transaction-edit",
        txIndex: 0,
        field: "unitNumber",
        before: "ZZ99",
        after: "A-101",
      }],
    },
  });

  await storage.reviewAiExtractedRecord(bankRecord.id, {
    reviewStatus: "approved",
    reviewedBy: "verifier@local",
    payloadJson: bankRecord.payloadJson,
  });

  const bankMemoryRows = await db
    .select()
    .from(associationIngestionCorrectionMemory)
    .where(and(eq(associationIngestionCorrectionMemory.associationId, associationId), eq(associationIngestionCorrectionMemory.recordType, "bank-statement")));
  assert.ok(bankMemoryRows.some((row) => row.correctionKind === "transaction-mapping"), "bank correction memory should persist transaction mappings");

  const bankExceptions = await db
    .select()
    .from(aiIngestionExceptions)
    .where(eq(aiIngestionExceptions.extractedRecordId, bankRecord.id));
  assert.ok(bankExceptions.length > 0, "bank statement review should persist ingestion exceptions");
}

async function verifyContactPointAndOwnershipNotePersistence(associationId: string) {
  const job = await storage.createAiIngestionJob({
    associationId,
    sourceType: "pasted-text",
    sourceText: "owner import persistence verification",
    sourceFilename: "owner-import-persistence-verification.txt",
    sourceFileUrl: null,
    contextNotes: "owner import persistence verification",
    submittedBy: "verifier@local",
  });

  const record = await storage.createAiExtractedRecord({
    jobId: job.id,
    associationId,
    recordType: "owner-roster",
    confidenceScore: 0.93,
    payloadJson: {
      normalizedEntries: [{
        buildingAddress: "100 Test Way",
        unitNumber: "A-101",
        ownerText: "Jordan Owner",
        ownerCandidates: [{
          displayName: "Jordan Owner",
          firstName: "Jordan",
          lastName: "Owner",
          email: "jordan.primary@example.com",
          phone: "555-111-2222",
        }],
        emails: ["jordan.primary@example.com", "jordan.alt@example.com"],
        phones: ["555-111-2222", "555-333-4444"],
        notes: ["Trust transfer pending", "Use alternate contact for statements"],
      }],
    },
  });

  await storage.reviewAiExtractedRecord(record.id, {
    reviewStatus: "approved",
    reviewedBy: "verifier@local",
    payloadJson: record.payloadJson,
  });

  const importSummary = await storage.importApprovedAiExtractedRecord(record.id, "verifier@local", { mode: "commit" });
  assert.equal(importSummary.targetModule, "owners", "owner persistence import should route to owners");
  assert.ok(importSummary.createdOwnerships >= 1, "owner persistence import should create an ownership");

  const [importedPerson] = await db
    .select()
    .from(persons)
    .where(and(eq(persons.associationId, associationId), eq(persons.firstName, "Jordan"), eq(persons.lastName, "Owner")));
  assert.ok(importedPerson, "owner persistence import should create the person");

  const contactPoints = await db
    .select()
    .from(personContactPoints)
    .where(eq(personContactPoints.personId, importedPerson.id));
  assert.ok(contactPoints.filter((row) => row.channel === "email").length >= 2, "contact point persistence should keep multiple emails");
  assert.ok(contactPoints.filter((row) => row.channel === "phone").length >= 2, "contact point persistence should keep multiple phones");

  const ownershipRows = await db
    .select()
    .from(ownerships)
    .where(eq(ownerships.personId, importedPerson.id));
  assert.ok(
    ownershipRows.some((row) => Array.isArray(row.relationshipNotesJson) && row.relationshipNotesJson.length === 2),
    "ownership persistence should keep relationship notes",
  );
}

async function verifyCanonicalEntityRoutingAndTenantContext(associationId: string) {
  const sourceText = [
    "100 Test Way",
    "A-101 Taylor Verifier canonical-context@example.com 555-222-0000",
  ].join("\n");

  const job = await storage.createAiIngestionJob({
    associationId,
    sourceType: "pasted-text",
    sourceText,
    sourceFilename: "canonical-context-verification.txt",
    sourceFileUrl: null,
    contextNotes: "canonical context verification",
    submittedBy: "verifier@local",
  });

  await storage.processAiIngestionJob(job.id);
  const records = await storage.getAiExtractedRecords(job.id);
  const ownerRecord = records.find((record) => record.recordType === "owner-roster");
  assert.ok(ownerRecord, "canonical context verification: expected owner-roster record");

  const ownerPayload = ownerRecord.payloadJson as Record<string, any>;
  assert.ok(ownerPayload.canonicalEntities, "canonical context verification: canonical entities should be attached");
  assert.equal(ownerPayload.canonicalEntities.recordType, "owner-roster", "canonical context verification: wrong canonical record type");
  assert.ok(
    Array.isArray(ownerPayload.canonicalEntities.contextSnapshot?.knownUnitNumbers)
      && ownerPayload.canonicalEntities.contextSnapshot.knownUnitNumbers.includes("A-101"),
    "canonical context verification: known units should be injected into canonical context",
  );
  assert.ok(
    Array.isArray(ownerPayload.canonicalEntities.contextSnapshot?.knownOwnerNames)
      && ownerPayload.canonicalEntities.contextSnapshot.knownOwnerNames.some((value: string) => value.startsWith("Taylor Verifier")),
    "canonical context verification: prior owner context should be injected",
  );
  assert.ok(
    ownerPayload.canonicalEntities.entities.some((entity: any) => entity.entityType === "ownership-candidate"),
    "canonical context verification: expected canonical ownership entity",
  );

  const manualJob = await storage.createAiIngestionJob({
    associationId,
    sourceType: "pasted-text",
    sourceText: "manual canonical entity verification",
    sourceFilename: "manual-canonical-entity-verification.txt",
    sourceFileUrl: null,
    contextNotes: "manual canonical verification",
    submittedBy: "verifier@local",
  });

  const canonicalOnlyRecord = await storage.createAiExtractedRecord({
    jobId: manualJob.id,
    associationId,
    recordType: "owner-roster",
    confidenceScore: 0.91,
    payloadJson: {
      canonicalEntities: {
        version: 1,
        recordType: "owner-roster",
        contextSnapshot: {
          associationName: "verification",
          knownUnitNumbers: ["A-101"],
          knownBuildings: ["100 Test Way"],
          knownOwnerNames: ["Taylor Verifier"],
        },
        entities: [
          {
            id: "unit-1",
            entityType: "unit",
            routeTarget: "units",
            routeStatus: "ready",
            entityKey: "A-102",
            relatedEntityIds: [],
            attributes: { unitNumber: "A-102", buildingAddress: "100 Test Way", knownUnit: false },
            sourceRefs: [{ kind: "manual", index: 0 }],
          },
          {
            id: "person-1",
            entityType: "person",
            routeTarget: "persons",
            routeStatus: "ready",
            entityKey: "casey|canonical|A-102",
            relatedEntityIds: ["unit-1"],
            attributes: { firstName: "Casey", lastName: "Canonical", displayName: "Casey Canonical", mailingAddress: "100 Test Way" },
            sourceRefs: [{ kind: "manual", index: 0 }],
          },
          {
            id: "contact-1",
            entityType: "contact-point",
            routeTarget: "contacts",
            routeStatus: "ready",
            entityKey: "email|casey.canonical@example.com",
            relatedEntityIds: ["person-1", "unit-1"],
            attributes: { channel: "email", value: "casey.canonical@example.com", isPrimary: true },
            sourceRefs: [{ kind: "manual", index: 0 }],
          },
          {
            id: "contact-2",
            entityType: "contact-point",
            routeTarget: "contacts",
            routeStatus: "ready",
            entityKey: "phone|555-777-1212",
            relatedEntityIds: ["person-1", "unit-1"],
            attributes: { channel: "phone", value: "555-777-1212", isPrimary: true },
            sourceRefs: [{ kind: "manual", index: 0 }],
          },
          {
            id: "note-1",
            entityType: "note",
            routeTarget: "ownerships",
            routeStatus: "ready",
            entityKey: "A-102|Imported only from canonical graph",
            relatedEntityIds: ["unit-1"],
            attributes: { unitNumber: "A-102", note: "Imported only from canonical graph" },
            sourceRefs: [{ kind: "manual", index: 0 }],
          },
          {
            id: "ownership-1",
            entityType: "ownership-candidate",
            routeTarget: "ownerships",
            routeStatus: "ready",
            entityKey: "A-102|casey|canonical",
            relatedEntityIds: ["unit-1", "person-1", "note-1"],
            attributes: { unitNumber: "A-102", ownershipPercentage: 100, relationshipNotes: ["Imported only from canonical graph"] },
            sourceRefs: [{ kind: "manual", index: 0 }],
          },
        ],
      },
    },
  });

  await storage.reviewAiExtractedRecord(canonicalOnlyRecord.id, {
    reviewStatus: "approved",
    reviewedBy: "verifier@local",
    payloadJson: canonicalOnlyRecord.payloadJson,
  });

  const importSummary = await storage.importApprovedAiExtractedRecord(canonicalOnlyRecord.id, "verifier@local", { mode: "commit" });
  assert.equal(importSummary.targetModule, "owners", "canonical-only import should route to owners");
  assert.ok(importSummary.createdUnits >= 1, "canonical-only import should create the unit");
  assert.ok(importSummary.createdPersons >= 1, "canonical-only import should create the person");
  assert.ok(importSummary.createdOwnerships >= 1, "canonical-only import should create the ownership");
}

async function run() {
  const suffix = Date.now().toString().slice(-6);
  const association = await storage.createAssociation({
    name: `AI Ingestion Verify ${suffix}`,
    address: "100 Test Way",
    city: "Austin",
    state: "TX",
    country: "USA",
  }, "verifier@local");

  const unit = await storage.createUnit({
    associationId: association.id,
    unitNumber: "A-101",
    building: null,
    squareFootage: null,
  }, "verifier@local");

  const person = await storage.createPerson({
    associationId: association.id,
    firstName: "Taylor",
    lastName: `Verifier${suffix}`,
    email: `verify-${suffix}@example.com`,
    phone: "555-100-0000",
    mailingAddress: "100 Test Way",
  }, "verifier@local");

  await storage.createOwnership({
    unitId: unit.id,
    personId: person.id,
    ownershipPercentage: 100,
    startDate: new Date("2024-01-01"),
    endDate: null,
  }, "verifier@local");

  const ownerSummary = await createPreviewImport("owner-roster", association.id, {
    title: "Owner Roster",
    itemCount: 1,
    items: [{
      unitNumber: "A-102",
      firstName: "Jordan",
      lastName: "Owner",
      email: `owner-${suffix}@example.com`,
      phone: "555-111-2222",
      mailingAddress: "102 Test Way",
      ownershipPercentage: 100,
      startDate: "2024-01-01",
    }],
  });
  assert.equal(ownerSummary.targetModule, "owners");

  const contactSummary = await createPreviewImport("contact-roster", association.id, {
    title: "Contact Roster",
    itemCount: 1,
    items: [{
      firstName: "Casey",
      lastName: "Contact",
      email: `contact-${suffix}@example.com`,
      phone: "555-333-4444",
      mailingAddress: "200 Contact Ln",
    }],
  });
  assert.equal(contactSummary.targetModule, "persons");

  const invoiceSummary = await createPreviewImport("invoice-draft", association.id, {
    vendorName: "Test Plumbing LLC",
    invoiceNumber: `INV-${suffix}`,
    amount: 275.4,
    invoiceDate: "2025-01-01",
    dueDate: "2025-01-15",
    notes: "verification invoice",
    status: "received",
  });
  assert.equal(invoiceSummary.targetModule, "financial-invoices");

  const bankSummary = await createPreviewImport("bank-statement", association.id, {
    statementPeriod: "2025-01",
    transactions: [{
      unitNumber: "A-101",
      ownerEmail: person.email,
      ownerName: `${person.firstName} ${person.lastName}`,
      amount: -450,
      postedAt: "2025-01-10",
      description: "HOA payment",
      entryType: "payment",
    }],
  });
  assert.equal(bankSummary.targetModule, "owner-ledger");

  await verifyHierarchicalOwnerRosterSegmentation(association.id);
  await verifyCorrectionMemoryAndExceptionPersistence(association.id);
  await verifyContactPointAndOwnershipNotePersistence(association.id);
  await verifyCanonicalEntityRoutingAndTenantContext(association.id);

  console.log("AI ingestion rebuild verification passed:");
  console.log(`- owners: ${ownerSummary.message}`);
  console.log(`- contacts: ${contactSummary.message}`);
  console.log(`- invoices: ${invoiceSummary.message}`);
  console.log(`- bank statements: ${bankSummary.message}`);
  console.log("- owner-roster segmentation: verified via processAiIngestionJob with normalized entries and route plan");
  console.log("- correction memory, durable exceptions, contact points, and ownership notes: verified");
  console.log("- canonical entities, tenant context injection, and canonical-only owner routing: verified");
}

run().catch((error: any) => {
  console.error(`AI ingestion rebuild verification failed: ${error.message}`);
  process.exit(1);
});
