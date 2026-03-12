import fs from "fs";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

function assertContains(content: string, token: string, message: string) {
  if (!content.includes(token)) {
    throw new Error(message);
  }
}

function run() {
  const schema = read("shared/schema.ts");
  const routes = read("server/routes.ts");
  const storage = read("server/storage.ts");
  const page = read("client/src/pages/ai-ingestion.tsx");
  const app = read("client/src/App.tsx");

  assertContains(schema, "aiIngestionJobs", "missing aiIngestionJobs schema");
  assertContains(schema, "aiExtractedRecords", "missing aiExtractedRecords schema");

  assertContains(routes, '"/api/ai/ingestion/jobs"', "missing ingestion job routes");
  assertContains(routes, '"/api/ai/ingestion/jobs/:id/process"', "missing ingestion process route");
  assertContains(routes, '"/api/ai/ingestion/records/:id/review"', "missing review route");

  assertContains(storage, "processAiIngestionJob", "missing ingestion processor");
  assertContains(storage, "reviewAiExtractedRecord", "missing review storage method");

  assertContains(page, "Submit Ingestion Job", "missing intake submit action");
  assertContains(page, "Process", "missing process action");
  assertContains(page, "Approve", "missing review approve action");
  assertContains(page, "Reject", "missing review reject action");

  assertContains(app, 'path="/ai/ingestion"', "missing AI ingestion app route");

  console.log("Phase 4 AI ingestion verification checks passed.");
}

try {
  run();
} catch (error: any) {
  console.error(`Verification failed: ${error.message}`);
  process.exit(1);
}
