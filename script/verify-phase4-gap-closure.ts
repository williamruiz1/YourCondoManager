import fs from "fs";
import { randomUUID } from "crypto";
import { storage } from "../server/storage";

function assertCheck(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

async function verifyCodeCoverage() {
  const schema = read("shared/schema.ts");
  const routes = read("server/routes.ts");
  const page = read("client/src/pages/ai-ingestion.tsx");

  assertCheck(schema.includes("export const clauseRecords"), "missing clauseRecords schema");
  assertCheck(schema.includes("export const clauseTags"), "missing clauseTags schema");
  assertCheck(schema.includes("export const suggestedLinks"), "missing suggestedLinks schema");

  assertCheck(routes.includes('"/api/ai/ingestion/clauses"'), "missing clause list route");
  assertCheck(routes.includes('"/api/ai/ingestion/clauses/:id/review"'), "missing clause review route");
  assertCheck(routes.includes('"/api/ai/ingestion/clauses/:id/tags"'), "missing clause tag routes");
  assertCheck(routes.includes('"/api/ai/ingestion/clauses/:id/suggested-links"'), "missing suggested link routes");
  assertCheck(routes.includes('"/api/ai/ingestion/governance/approved-links"'), "missing approved governance link route");

  assertCheck(page.includes("Bylaw Review Queue"), "missing clause review queue UX");
  assertCheck(page.includes("Before (Extracted)"), "missing before state comparison");
  assertCheck(page.includes("After (Editable)"), "missing editable after state");
  assertCheck(page.includes("Source Traceability"), "missing source traceability UI");
  assertCheck(page.includes("Suggest Link"), "missing suggested link creation UI");
}

async function verifyRuntime() {
  const marker = randomUUID();
  const actor = `m4-verify-${Date.now()}@local`;

  const association = await storage.createAssociation(
    {
      name: `M4 Verify ${marker.slice(0, 8)}`,
      address: "4 Intelligence Way",
      city: "Cambridge",
      state: "MA",
      country: "USA",
    },
    actor,
  );

  const job = await storage.createAiIngestionJob({
    associationId: association.id,
    sourceType: "pasted-text",
    sourceFilename: null,
    sourceText:
      "Bylaw Update\nArticle II Meetings\nSection 2.1 Budget meeting notice is required.\nSection 2.2 Board quorum rules apply.\nSection 2.3 Budget ratification vote timeline.",
    sourceFileUrl: null,
    submittedBy: actor,
  });

  const processed = await storage.processAiIngestionJob(job.id);
  assertCheck(processed.status === "completed", "ingestion job should complete");

  const clauses = await storage.getClauseRecords({ ingestionJobId: job.id });
  assertCheck(clauses.length > 0, "expected extracted clause records");

  const budgetClause = clauses.find((c) => /budget/i.test(c.clauseText)) || clauses[0];
  const reviewed = await storage.reviewClauseRecord(budgetClause.id, {
    reviewStatus: "approved",
    title: `${budgetClause.title} (approved)`,
    clauseText: budgetClause.clauseText,
    reviewedBy: actor,
  });
  assertCheck(reviewed?.reviewStatus === "approved", "clause should be approvable");

  const tags = await storage.getClauseTags(budgetClause.id);
  assertCheck(tags.length > 0, "expected at least one generated clause tag");

  let links = await storage.getSuggestedLinks(budgetClause.id);
  if (links.length === 0) {
    await storage.createSuggestedLink({
      clauseRecordId: budgetClause.id,
      entityType: "governance-template-item",
      entityId: "budget-review",
      confidenceScore: 0.7,
    });
    links = await storage.getSuggestedLinks(budgetClause.id);
  }
  assertCheck(links.length > 0, "expected at least one suggested link");

  await storage.updateSuggestedLink(links[0].id, { isApproved: 1 });

  const approvedRefs = await storage.getApprovedClauseLinksForGovernance(association.id);
  assertCheck(
    approvedRefs.some((ref) => ref.clauseRecordId === budgetClause.id),
    "approved clause links should be exposed to governance modules",
  );
}

async function run() {
  await verifyCodeCoverage();
  await verifyRuntime();
  console.log("Phase 4 gap-closure verification checks passed.");
}

run().catch((error) => {
  console.error(`Verification failed: ${error.message}`);
  process.exit(1);
});
