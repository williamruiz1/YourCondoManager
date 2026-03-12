import assert from "node:assert/strict";
import { storage } from "../server/storage";

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

  console.log("AI ingestion rebuild verification passed:");
  console.log(`- owners: ${ownerSummary.message}`);
  console.log(`- contacts: ${contactSummary.message}`);
  console.log(`- invoices: ${invoiceSummary.message}`);
  console.log(`- bank statements: ${bankSummary.message}`);
}

run().catch((error: any) => {
  console.error(`AI ingestion rebuild verification failed: ${error.message}`);
  process.exit(1);
});
