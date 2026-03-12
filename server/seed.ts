import { db } from "./db";
import { eq } from "drizzle-orm";
import {
  adminUsers, analysisRuns, analysisVersions, associations, boardRoles, documents, occupancies, ownerships, persons, roadmapProjects, roadmapTasks, roadmapWorkstreams, units,
} from "@shared/schema";

export async function seedDatabase() {
  const existingAssociations = await db.select().from(associations);
  if (existingAssociations.length === 0) {
    const [a1, a2, a3] = await db.insert(associations).values([
      { name: "Sunset Towers", address: "1200 Ocean Drive", city: "Miami Beach", state: "FL", country: "USA" },
      { name: "Lakewood Residences", address: "450 Lakeview Blvd", city: "Chicago", state: "IL", country: "USA" },
      { name: "Pacific Heights Condos", address: "789 Bay Street", city: "San Francisco", state: "CA", country: "USA" },
    ]).returning();

    const unitRows = await db.insert(units).values([
      { associationId: a1.id, unitNumber: "101", building: "A", squareFootage: 1250 },
      { associationId: a1.id, unitNumber: "102", building: "A", squareFootage: 980 },
      { associationId: a1.id, unitNumber: "201", building: "B", squareFootage: 1400 },
      { associationId: a1.id, unitNumber: "301", building: "B", squareFootage: 1600 },
      { associationId: a2.id, unitNumber: "1A", building: "Main", squareFootage: 1100 },
      { associationId: a2.id, unitNumber: "2A", building: "Main", squareFootage: 1100 },
      { associationId: a2.id, unitNumber: "3B", building: "East", squareFootage: 1350 },
      { associationId: a3.id, unitNumber: "PH1", building: null, squareFootage: 2200 },
      { associationId: a3.id, unitNumber: "501", building: null, squareFootage: 1050 },
    ]).returning();

    const personRows = await db.insert(persons).values([
      { firstName: "Maria", lastName: "Gonzalez", email: "maria.gonzalez@email.com", phone: "(305) 555-0101", mailingAddress: "1200 Ocean Drive Unit 101, Miami Beach, FL 33139" },
      { firstName: "James", lastName: "Chen", email: "j.chen@email.com", phone: "(305) 555-0102", mailingAddress: "1200 Ocean Drive Unit 102, Miami Beach, FL 33139" },
      { firstName: "Sarah", lastName: "Williams", email: "sarah.w@email.com", phone: "(312) 555-0201", mailingAddress: "450 Lakeview Blvd Unit 1A, Chicago, IL 60601" },
      { firstName: "Robert", lastName: "Thompson", email: "r.thompson@email.com", phone: "(415) 555-0301", mailingAddress: "789 Bay Street PH1, San Francisco, CA 94133" },
      { firstName: "Lisa", lastName: "Patel", email: "lisa.patel@email.com", phone: "(312) 555-0202", mailingAddress: "450 Lakeview Blvd Unit 3B, Chicago, IL 60601" },
      { firstName: "David", lastName: "Kim", email: "d.kim@email.com", phone: "(305) 555-0103", mailingAddress: null },
      { firstName: "Jennifer", lastName: "Martinez", email: "j.martinez@email.com", phone: "(415) 555-0302", mailingAddress: "789 Bay Street Unit 501, San Francisco, CA 94133" },
    ]).returning();

    await db.insert(ownerships).values([
      { unitId: unitRows[0].id, personId: personRows[0].id, ownershipPercentage: 100, startDate: new Date("2020-03-15") },
      { unitId: unitRows[1].id, personId: personRows[1].id, ownershipPercentage: 100, startDate: new Date("2021-06-01") },
      { unitId: unitRows[2].id, personId: personRows[0].id, ownershipPercentage: 50, startDate: new Date("2022-01-10") },
      { unitId: unitRows[2].id, personId: personRows[1].id, ownershipPercentage: 50, startDate: new Date("2022-01-10") },
      { unitId: unitRows[4].id, personId: personRows[2].id, ownershipPercentage: 100, startDate: new Date("2019-08-20") },
      { unitId: unitRows[6].id, personId: personRows[4].id, ownershipPercentage: 100, startDate: new Date("2023-02-01") },
      { unitId: unitRows[7].id, personId: personRows[3].id, ownershipPercentage: 100, startDate: new Date("2018-11-05") },
      { unitId: unitRows[8].id, personId: personRows[6].id, ownershipPercentage: 100, startDate: new Date("2024-01-15") },
    ]);

    await db.insert(occupancies).values([
      { unitId: unitRows[0].id, personId: personRows[0].id, occupancyType: "OWNER_OCCUPIED", startDate: new Date("2020-03-15") },
      { unitId: unitRows[1].id, personId: personRows[5].id, occupancyType: "TENANT", startDate: new Date("2023-01-01") },
      { unitId: unitRows[4].id, personId: personRows[2].id, occupancyType: "OWNER_OCCUPIED", startDate: new Date("2019-08-20") },
      { unitId: unitRows[7].id, personId: personRows[3].id, occupancyType: "OWNER_OCCUPIED", startDate: new Date("2018-11-05") },
    ]);

    await db.insert(boardRoles).values([
      { personId: personRows[0].id, associationId: a1.id, role: "President", startDate: new Date("2023-01-01") },
      { personId: personRows[1].id, associationId: a1.id, role: "Treasurer", startDate: new Date("2023-01-01") },
      { personId: personRows[2].id, associationId: a2.id, role: "President", startDate: new Date("2022-06-01") },
      { personId: personRows[4].id, associationId: a2.id, role: "Secretary", startDate: new Date("2022-06-01") },
      { personId: personRows[3].id, associationId: a3.id, role: "President", startDate: new Date("2021-01-01") },
      { personId: personRows[6].id, associationId: a3.id, role: "Board Member", startDate: new Date("2024-01-15") },
    ]);
  }

  const existingRoadmapProjects = await db.select().from(roadmapProjects);
  if (existingRoadmapProjects.length === 0) {
    const [phase1, phase2, phase3, phase4, phase5] = await db.insert(roadmapProjects).values([
      {
        title: "Phase 1 - Foundation, Registry, and Core Admin",
        description: "Platform foundation and system of record for associations, units, people, occupancy, board roles, and documents.",
        status: "active",
        isCollapsed: 0,
      },
      {
        title: "Phase 2 - Financial Operations and Budget Control",
        description: "Accounting operations for dues, assessments, payments, expenses, utilities, and budgets.",
        status: "active",
        isCollapsed: 1,
      },
      {
        title: "Phase 3 - Governance, Meetings, and Compliance Operations",
        description: "Operational governance records for meetings, decisions, annual obligations, and recurring tasks.",
        status: "active",
        isCollapsed: 1,
      },
      {
        title: "Phase 4 - Document Intelligence, Intake, and Operational Scale",
        description: "AI-assisted document ingestion, metadata extraction, review workflow, and linkage foundation.",
        status: "active",
        isCollapsed: 1,
      },
      {
        title: "Phase 5 - Portals, Communications, and SaaS Expansion",
        description: "External-facing access, communications, and multi-association expansion architecture.",
        status: "active",
        isCollapsed: 1,
      },
    ]).returning();

    await db.insert(roadmapWorkstreams).values([
      { projectId: phase1.id, title: "Association Setup", orderIndex: 0, isCollapsed: 0 },
      { projectId: phase1.id, title: "Unit Registry", orderIndex: 1, isCollapsed: 0 },
      { projectId: phase1.id, title: "Person Registry", orderIndex: 2, isCollapsed: 0 },
      { projectId: phase1.id, title: "Ownership History", orderIndex: 3, isCollapsed: 0 },
      { projectId: phase1.id, title: "Occupancy Contact Tracking", orderIndex: 4, isCollapsed: 0 },
      { projectId: phase1.id, title: "Board Role Tracking", orderIndex: 5, isCollapsed: 0 },
      { projectId: phase1.id, title: "Document Repository", orderIndex: 6, isCollapsed: 0 },
      { projectId: phase1.id, title: "Basic Dashboard", orderIndex: 7, isCollapsed: 0 },
      { projectId: phase1.id, title: "Auth, Roles, and Audit Logging", orderIndex: 8, isCollapsed: 0 },

      { projectId: phase2.id, title: "HOA/Common Fee Engine", orderIndex: 0, isCollapsed: 0 },
      { projectId: phase2.id, title: "Assessment Engine", orderIndex: 1, isCollapsed: 0 },
      { projectId: phase2.id, title: "Late Fee Rules", orderIndex: 2, isCollapsed: 0 },
      { projectId: phase2.id, title: "Owner Ledger", orderIndex: 3, isCollapsed: 0 },
      { projectId: phase2.id, title: "Expense and Invoice Tracking", orderIndex: 4, isCollapsed: 0 },
      { projectId: phase2.id, title: "Utility Payment Tracking", orderIndex: 5, isCollapsed: 0 },
      { projectId: phase2.id, title: "Budget Planning and Ratification", orderIndex: 6, isCollapsed: 0 },

      { projectId: phase3.id, title: "Meeting Tracker", orderIndex: 0, isCollapsed: 0 },
      { projectId: phase3.id, title: "Notes and Minutes Repository", orderIndex: 1, isCollapsed: 0 },
      { projectId: phase3.id, title: "Board Decision Log", orderIndex: 2, isCollapsed: 0 },
      { projectId: phase3.id, title: "Annual Checklist and Compliance Engine", orderIndex: 3, isCollapsed: 0 },
      { projectId: phase3.id, title: "Calendar and Task Workflows", orderIndex: 4, isCollapsed: 0 },
      { projectId: phase3.id, title: "Governance Dashboard", orderIndex: 5, isCollapsed: 0 },

      { projectId: phase4.id, title: "AI Document Ingestion", orderIndex: 0, isCollapsed: 0 },
      { projectId: phase4.id, title: "Metadata Extraction", orderIndex: 1, isCollapsed: 0 },
      { projectId: phase4.id, title: "Record Suggestion Engine", orderIndex: 2, isCollapsed: 0 },
      { projectId: phase4.id, title: "Bylaw Ingestion Foundation", orderIndex: 3, isCollapsed: 0 },
      { projectId: phase4.id, title: "Smart Intake Workflows", orderIndex: 4, isCollapsed: 0 },

      { projectId: phase5.id, title: "Owner Portal", orderIndex: 0, isCollapsed: 0 },
      { projectId: phase5.id, title: "Tenant Portal Access", orderIndex: 1, isCollapsed: 0 },
      { projectId: phase5.id, title: "Communications Layer", orderIndex: 2, isCollapsed: 0 },
      { projectId: phase5.id, title: "Gmail/Email Integration", orderIndex: 3, isCollapsed: 0 },
      { projectId: phase5.id, title: "Notice Templates", orderIndex: 4, isCollapsed: 0 },
      { projectId: phase5.id, title: "Multi-Association Architecture", orderIndex: 5, isCollapsed: 0 },
      { projectId: phase5.id, title: "Subscription and SaaS Admin Controls", orderIndex: 6, isCollapsed: 0 },
    ]);

    const [version1] = await db.insert(analysisVersions).values({
      resourceId: "platform-core",
      module: "roadmap-analyzer",
      version: 1,
      payloadJson: [{ phase: "phase-1", result: "initialized" }],
      itemCount: 1,
      trigger: "seed",
    }).returning();

    await db.insert(analysisVersions).values({
      resourceId: "platform-core",
      module: "roadmap-analyzer",
      version: 2,
      payloadJson: [{ phase: "phase-1", result: "initialized" }, { phase: "phase-2", result: "planned" }],
      itemCount: 2,
      trigger: `followup:${version1.id}`,
    });

    await db.insert(analysisRuns).values([
      {
        resourceId: "platform-core",
        module: "roadmap-analyzer",
        action: "run",
        success: 1,
        durationMs: 420,
        itemCount: 1,
        metadataJson: { source: "seed" },
      },
      {
        resourceId: "platform-core",
        module: "roadmap-analyzer",
        action: "run",
        success: 1,
        durationMs: 515,
        itemCount: 2,
        metadataJson: { source: "seed" },
      },
    ]);
  }

  const [existingPhase6] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, "Phase 6 - Ingestion Engine Fortification and Trust"));

  if (!existingPhase6) {
    const [phase6] = await db.insert(roadmapProjects).values({
      title: "Phase 6 - Ingestion Engine Fortification and Trust",
      description: "Follow-on phase to reopen the ingestion initiative with deterministic normalization, platform-context routing, strong quality gates, and measurable trust before import.",
      status: "active",
      isCollapsed: 0,
    }).returning();

    const [ws1] = await db.insert(roadmapWorkstreams).values({
      projectId: phase6.id,
      title: "Source Format Detection and Segmentation",
      description: "Identify source structure before extraction and split mixed inputs into coherent blocks.",
      orderIndex: 0,
      isCollapsed: 0,
    }).returning();
    const [ws2] = await db.insert(roadmapWorkstreams).values({
      projectId: phase6.id,
      title: "Intermediate Canonical Normalization",
      description: "Normalize source material into platform-oriented entities before module-specific import payloads are built.",
      orderIndex: 1,
      isCollapsed: 0,
    }).returning();
    const [ws3] = await db.insert(roadmapWorkstreams).values({
      projectId: phase6.id,
      title: "Platform Context and Destination Routing",
      description: "Ground extraction in the selected association and explicitly map records into the correct platform destination.",
      orderIndex: 2,
      isCollapsed: 0,
    }).returning();
    const [ws4] = await db.insert(roadmapWorkstreams).values({
      projectId: phase6.id,
      title: "Quality Gates, Review, and Approval Controls",
      description: "Block low-quality ingestion outputs from being approved and surface why the engine made each routing decision.",
      orderIndex: 3,
      isCollapsed: 0,
    }).returning();
    const [ws5] = await db.insert(roadmapWorkstreams).values({
      projectId: phase6.id,
      title: "Benchmarking, Observability, and Regression Harness",
      description: "Measure extraction quality continuously and prevent regressions on real operating formats.",
      orderIndex: 4,
      isCollapsed: 0,
    }).returning();
    const [ws6] = await db.insert(roadmapWorkstreams).values({
      projectId: phase6.id,
      title: "Import Safety, Remediation, and Operator Learning Loop",
      description: "Ensure imports are reversible, remediable, and continuously improved from operator feedback.",
      orderIndex: 5,
      isCollapsed: 0,
    }).returning();

    await db.insert(roadmapTasks).values([
      {
        projectId: phase6.id,
        workstreamId: ws1.id,
        title: "Add source-format detector for tables, address-block rosters, freeform notes, and mixed exports",
        description: "Classify ingestion source structure before extraction so the engine routes text to the right parser strategy instead of relying on generic row parsing.",
        status: "todo",
        effort: "large",
        priority: "critical",
        dependencyTaskIds: [],
      },
      {
        projectId: phase6.id,
        workstreamId: ws1.id,
        title: "Implement hierarchical segmentation for repeating building and unit roster blocks",
        description: "Split pasted rosters into building-level sections and unit-level rows so address headers and owner rows are not conflated.",
        status: "todo",
        effort: "large",
        priority: "critical",
        dependencyTaskIds: [],
      },
      {
        projectId: phase6.id,
        workstreamId: ws1.id,
        title: "Add parser strategy registry with deterministic fallbacks per source format",
        description: "Replace one-size-fits-all fallback parsing with a registry of format-specific deterministic parsers.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: phase6.id,
        workstreamId: ws2.id,
        title: "Create canonical ingestion entities for building, unit, person, contact point, ownership candidate, and notes",
        description: "Introduce an intermediate normalized graph so raw source facts are preserved before module routing decides what becomes units, persons, and ownerships.",
        status: "todo",
        effort: "large",
        priority: "critical",
        dependencyTaskIds: [],
      },
      {
        projectId: phase6.id,
        workstreamId: ws2.id,
        title: "Support multi-owner, multi-email, multi-phone, and relationship-note preservation",
        description: "Keep compound owner rows intact as structured facts instead of flattening them into lossy single-value fields.",
        status: "todo",
        effort: "large",
        priority: "critical",
        dependencyTaskIds: [],
      },
      {
        projectId: phase6.id,
        workstreamId: ws2.id,
        title: "Add canonicalization rules for owner names, unit identifiers, addresses, and contact variants",
        description: "Normalize ambiguous source tokens into stable forms while retaining source traceability.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: phase6.id,
        workstreamId: ws3.id,
        title: "Inject tenant-specific context such as known units, buildings, and prior owners into extraction and matching",
        description: "Ground extraction in the selected association so the engine contextualizes source content to the platform instead of processing it in isolation.",
        status: "todo",
        effort: "large",
        priority: "critical",
        dependencyTaskIds: [],
      },
      {
        projectId: phase6.id,
        workstreamId: ws3.id,
        title: "Build explicit destination routing rules from canonical entities to units, persons, ownerships, contacts, and exceptions",
        description: "Make module population deterministic and reviewable instead of implicit in parser output.",
        status: "todo",
        effort: "large",
        priority: "critical",
        dependencyTaskIds: [],
      },
      {
        projectId: phase6.id,
        workstreamId: ws3.id,
        title: "Create unresolved-exception buckets for facts that do not cleanly map to the platform",
        description: "Route ambiguous facts into review queues instead of forcing bad imports.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: phase6.id,
        workstreamId: ws4.id,
        title: "Define hard quality gates that block approval for malformed owner rosters",
        description: "Reject extraction outputs with invalid units, placeholder names, low contact coverage, or structural corruption before import.",
        status: "todo",
        effort: "medium",
        priority: "critical",
        dependencyTaskIds: [],
      },
      {
        projectId: phase6.id,
        workstreamId: ws4.id,
        title: "Surface extraction strategy, destination routing, confidence, and warnings in the review workspace",
        description: "Show operators how the engine interpreted the source and why the data is headed to a specific module.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: phase6.id,
        workstreamId: ws4.id,
        title: "Add guided remediation flows for unmatched units, split-owner rows, and conflicting contact facts",
        description: "Let managers and boards repair the normalized data without editing raw JSON blindly.",
        status: "todo",
        effort: "large",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: phase6.id,
        workstreamId: ws5.id,
        title: "Assemble benchmark fixtures from real HOA and condo source formats",
        description: "Create a durable corpus of owner rosters, bank statements, invoices, and governance docs drawn from realistic property-management operating formats.",
        status: "todo",
        effort: "large",
        priority: "critical",
        dependencyTaskIds: [],
      },
      {
        projectId: phase6.id,
        workstreamId: ws5.id,
        title: "Add automated regression scoring for extraction quality, routing quality, and import safety",
        description: "Measure whether a change improves or degrades ingestion performance before release.",
        status: "todo",
        effort: "large",
        priority: "critical",
        dependencyTaskIds: [],
      },
      {
        projectId: phase6.id,
        workstreamId: ws5.id,
        title: "Expand ingestion telemetry with provider failures, parser fallbacks, quality warnings, and approval outcomes",
        description: "Give operators and engineers direct visibility into where ingestion fails and how often.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: phase6.id,
        workstreamId: ws6.id,
        title: "Strengthen preview mode to show entity-by-entity creates, updates, skips, and unresolved exceptions",
        description: "Expose the exact platform impact before commit for units, persons, ownerships, and related contacts.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: phase6.id,
        workstreamId: ws6.id,
        title: "Add targeted rollback and reprocess tooling for ingestion batches",
        description: "Allow operators to revert or rerun a bad batch without manual database cleanup.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: phase6.id,
        workstreamId: ws6.id,
        title: "Capture operator corrections as structured feedback for future parser and routing improvements",
        description: "Turn human fixes into learning signals so the ingestion engine improves from production usage.",
        status: "todo",
        effort: "large",
        priority: "medium",
        dependencyTaskIds: [],
      },
    ]);
  }

  const existingAdminUsers = await db.select().from(adminUsers);
  if (existingAdminUsers.length === 0) {
    await db.insert(adminUsers).values({
      email: "admin@local",
      role: "platform-admin",
      isActive: 1,
    });
  }

  console.log("Database seeded successfully");
}
