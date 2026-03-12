import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { storage } from "../server/storage";

type Fixture = {
  label: string;
  associationScoped: boolean;
  sourceFilename: string;
  contextNotes: string;
  sourceText: string;
  expected: {
    recordType: string;
    routeModule: string;
    minimumItems?: number;
    minimumTransactions?: number;
    requiresAmount?: boolean;
    requiresSummary?: boolean;
    requiresNormalizedEntries?: boolean;
  };
};

type FixtureResult = {
  label: string;
  extractionScore: number;
  routingScore: number;
  importSafetyScore: number;
  pass: boolean;
  notes: string[];
};

function loadFixtures(): Fixture[] {
  const fixturesDir = path.resolve("script/fixtures/ingestion");
  return fs.readdirSync(fixturesDir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => JSON.parse(fs.readFileSync(path.join(fixturesDir, name), "utf8")) as Fixture);
}

function scoreFixture(record: any, fixture: Fixture): FixtureResult {
  const notes: string[] = [];
  const extractionRecordTypeMatch = record?.recordType === fixture.expected.recordType;
  const routeModuleMatch = record?.payloadJson?.destinationModule === fixture.expected.routeModule;

  const payload = record?.payloadJson ?? {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  const transactions = Array.isArray(payload.transactions) ? payload.transactions : [];
  const normalizedEntries = Array.isArray(payload.normalizedEntries) ? payload.normalizedEntries : [];
  const unresolvedExceptions = Array.isArray(payload.unresolvedExceptions) ? payload.unresolvedExceptions : [];

  let extractionScore = extractionRecordTypeMatch ? 0.5 : 0;
  if (fixture.expected.minimumItems != null && items.length >= fixture.expected.minimumItems) extractionScore += 0.25;
  if (fixture.expected.minimumTransactions != null && transactions.length >= fixture.expected.minimumTransactions) extractionScore += 0.25;
  if (fixture.expected.requiresAmount && Number.isFinite(Number(payload.amount ?? NaN))) extractionScore += 0.25;
  if (fixture.expected.requiresSummary && (typeof payload.summary === "string" || typeof payload.title === "string")) extractionScore += 0.25;
  if (fixture.expected.requiresNormalizedEntries && normalizedEntries.length > 0) extractionScore += 0.25;
  extractionScore = Math.min(1, extractionScore);

  let routingScore = routeModuleMatch ? 0.5 : 0;
  if (payload.destinationPlan?.primaryModule === fixture.expected.routeModule) routingScore += 0.25;
  if (typeof payload.destinationPlan?.routeReason === "string" && payload.destinationPlan.routeReason.length > 0) routingScore += 0.25;
  routingScore = Math.min(1, routingScore);

  let importSafetyScore = 0.5;
  if (fixture.expected.recordType === "owner-roster") {
    importSafetyScore += Array.isArray(unresolvedExceptions) ? 0.25 : 0;
    importSafetyScore += normalizedEntries.length > 0 ? 0.25 : 0;
  } else if (fixture.expected.recordType === "bank-statement") {
    importSafetyScore += payload.feedbackSignals?.priorBankTransactionMappings != null ? 0.25 : 0;
    importSafetyScore += transactions.length > 0 ? 0.25 : 0;
  } else {
    importSafetyScore += routeModuleMatch ? 0.25 : 0;
    importSafetyScore += payload.destinationPlan ? 0.25 : 0;
  }
  importSafetyScore = Math.min(1, importSafetyScore);

  if (!extractionRecordTypeMatch) notes.push(`expected record type ${fixture.expected.recordType}, got ${record?.recordType ?? "none"}`);
  if (!routeModuleMatch) notes.push(`expected route module ${fixture.expected.routeModule}, got ${payload.destinationModule ?? "none"}`);

  const pass = extractionScore >= 0.75 && routingScore >= 0.75 && importSafetyScore >= 0.75;
  return {
    label: fixture.label,
    extractionScore,
    routingScore,
    importSafetyScore,
    pass,
    notes,
  };
}

async function run() {
  delete process.env.OPENAI_API_KEY;
  delete process.env.AI_API_KEY;

  const fixtures = loadFixtures();
  const suffix = Date.now().toString().slice(-6);
  const association = await storage.createAssociation({
    name: `AI Ingestion Benchmark ${suffix}`,
    address: "1 Benchmark Plaza",
    city: "Austin",
    state: "TX",
    country: "USA",
  }, "benchmark@local");

  const results: FixtureResult[] = [];

  for (const fixture of fixtures) {
    const job = await storage.createAiIngestionJob({
      associationId: fixture.associationScoped ? association.id : null,
      sourceType: "pasted-text",
      sourceText: fixture.sourceText,
      sourceFilename: fixture.sourceFilename,
      sourceFileUrl: null,
      contextNotes: fixture.contextNotes,
      submittedBy: "benchmark@local",
    });

    await storage.processAiIngestionJob(job.id);
    const records = await storage.getAiExtractedRecords(job.id);
    const record = records.find((row) => row.recordType === fixture.expected.recordType) ?? records[0];
    results.push(scoreFixture(record, fixture));
  }

  const extractionAverage = results.reduce((sum, item) => sum + item.extractionScore, 0) / results.length;
  const routingAverage = results.reduce((sum, item) => sum + item.routingScore, 0) / results.length;
  const importSafetyAverage = results.reduce((sum, item) => sum + item.importSafetyScore, 0) / results.length;

  console.log("AI ingestion benchmark results:");
  for (const row of results) {
    console.log(`- ${row.label}: extraction ${(row.extractionScore * 100).toFixed(0)}% | routing ${(row.routingScore * 100).toFixed(0)}% | import safety ${(row.importSafetyScore * 100).toFixed(0)}% ${row.pass ? "PASS" : "FAIL"}`);
    if (row.notes.length > 0) {
      console.log(`  notes: ${row.notes.join("; ")}`);
    }
  }
  console.log(`- averages: extraction ${(extractionAverage * 100).toFixed(0)}% | routing ${(routingAverage * 100).toFixed(0)}% | import safety ${(importSafetyAverage * 100).toFixed(0)}%`);

  assert.ok(results.every((row) => row.pass), "One or more ingestion benchmark fixtures failed.");
}

run().catch((error: any) => {
  console.error(`AI ingestion benchmark failed: ${error.message}`);
  process.exit(1);
});
