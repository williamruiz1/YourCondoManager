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

  const [existingReliabilityProject] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, "Condo Workflow Reliability and Data Integrity Recovery"));

  if (!existingReliabilityProject) {
    const [project] = await db.insert(roadmapProjects).values({
      title: "Condo Workflow Reliability and Data Integrity Recovery",
      description: "Recovery roadmap created from exploratory testing findings across authentication, association context, owner onboarding, residential data integrity, and communications workflows.",
      status: "active",
      isCollapsed: 0,
    }).returning();

    const [ws1] = await db.insert(roadmapWorkstreams).values({
      projectId: project.id,
      title: "Authentication and Workspace Entry",
      description: "Stabilize sign-in, post-auth redirect behavior, and public-entry UX residue.",
      orderIndex: 0,
      isCollapsed: 0,
    }).returning();
    const [ws2] = await db.insert(roadmapWorkstreams).values({
      projectId: project.id,
      title: "Association Context and Navigation",
      description: "Fix association selection, search routing, overview relevance, performance, and record navigation bindings.",
      orderIndex: 1,
      isCollapsed: 0,
    }).returning();
    const [ws3] = await db.insert(roadmapWorkstreams).values({
      projectId: project.id,
      title: "Owner Onboarding Form and Review Workflow",
      description: "Repair onboarding clarity, field structure, review actions, and submission visibility.",
      orderIndex: 2,
      isCollapsed: 0,
    }).returning();
    const [ws4] = await db.insert(roadmapWorkstreams).values({
      projectId: project.id,
      title: "Residential Registry and Data Integrity",
      description: "Align people, owners, units, and occupancy with explicit validation and synchronization rules.",
      orderIndex: 3,
      isCollapsed: 0,
    }).returning();
    const [ws5] = await db.insert(roadmapWorkstreams).values({
      projectId: project.id,
      title: "Communications Architecture and Operator UX",
      description: "Move misfiled finance functions, add templates and branding, and reduce communications workflow clutter.",
      orderIndex: 4,
      isCollapsed: 0,
    }).returning();
    const [ws6] = await db.insert(roadmapWorkstreams).values({
      projectId: project.id,
      title: "Governance Role and Permission Reliability",
      description: "Fix board-role assignment, record-context placement, and governance permission evaluation.",
      orderIndex: 5,
      isCollapsed: 0,
    }).returning();
    const [ws7] = await db.insert(roadmapWorkstreams).values({
      projectId: project.id,
      title: "Meetings, Agenda, Voting, and Compliance Operations",
      description: "Repair meeting creation, agenda clarity, voting flows, governance task creation, and compliance-rule sync.",
      orderIndex: 6,
      isCollapsed: 0,
    }).returning();
    const [ws8] = await db.insert(roadmapWorkstreams).values({
      projectId: project.id,
      title: "Board Package Delivery and Operator Guidance",
      description: "Clarify board package workflows, delivery behavior, and generation complexity.",
      orderIndex: 7,
      isCollapsed: 0,
    }).returning();
    const [ws9] = await db.insert(roadmapWorkstreams).values({
      projectId: project.id,
      title: "Platform Architecture and Feature Exposure Control",
      description: "Align module relationships and hide unfinished features from non-admin users.",
      orderIndex: 8,
      isCollapsed: 0,
    }).returning();

    await db.insert(roadmapTasks).values([
      {
        projectId: project.id,
        workstreamId: ws1.id,
        title: "ISS-001 Prevent duplicate Google sign-in window launches during login",
        description: "Investigate OAuth flow triggers and ensure authentication opens only one Google sign-in window per login attempt.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws1.id,
        title: "ISS-002 Preserve workspace redirect after authentication",
        description: "Fix post-auth redirect handling so successful login lands in the intended workspace instead of the public landing page.",
        status: "todo",
        effort: "medium",
        priority: "critical",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws1.id,
        title: "ISS-003 Remove debug-style UI residue from the landing page",
        description: "Remove developer-facing or irrelevant debug elements from the public landing page experience.",
        status: "todo",
        effort: "small",
        priority: "medium",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws1.id,
        title: "ISS-004 Remove or redesign the unclear refresh Google session control",
        description: "Replace the post-login refresh control with a clearer session-state treatment or remove it if it is not an operator action.",
        status: "todo",
        effort: "small",
        priority: "medium",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws2.id,
        title: "ISS-005 Load all accessible associations in the workspace selector",
        description: "Investigate association loading and permission filtering so users see every association they are allowed to manage.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws2.id,
        title: "ISS-006 Make global search route to relevant records and modules",
        description: "Replace hard-coded communications routing with actual search resolution logic for routes such as units and related record destinations.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws2.id,
        title: "ISS-007 Redesign the associations overview around association-level KPIs",
        description: "Update the associations page so the overview reflects association health and context instead of irrelevant owner-centric metrics.",
        status: "todo",
        effort: "medium",
        priority: "medium",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws2.id,
        title: "ISS-008 Profile and reduce association detail load latency",
        description: "Measure the association context/detail page load path and address slow queries or over-fetching that delay workspace readiness.",
        status: "todo",
        effort: "medium",
        priority: "medium",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws2.id,
        title: "ISS-021 Connect owner row selection to owner detail navigation",
        description: "Bind owner list rows to the owner detail route so operators can inspect and edit owner records directly from the list.",
        status: "todo",
        effort: "small",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws3.id,
        title: "ISS-013 Add clear labels and remove ambiguous prefills in owner onboarding",
        description: "Make every onboarding field explicit, remove unexplained default values, and restore basic form legibility for operators.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws3.id,
        title: "ISS-014 Move second-owner fields into the ownership section",
        description: "Reorganize the onboarding layout so additional ownership inputs are grouped with ownership rather than occupancy.",
        status: "todo",
        effort: "small",
        priority: "medium",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws3.id,
        title: "ISS-015 Replace free-text mailing address with structured address fields",
        description: "Capture mailing address data as structured street, city, state, and ZIP components instead of a single free-text field.",
        status: "todo",
        effort: "medium",
        priority: "medium",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws3.id,
        title: "ISS-016 Remove emergency-contact collection from owner onboarding",
        description: "Reduce low-value data capture in onboarding by removing the emergency contact field from the workflow.",
        status: "todo",
        effort: "small",
        priority: "low",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws3.id,
        title: "ISS-017 Make onboarding submissions appear immediately in the owner list",
        description: "Repair onboarding submission synchronization so newly submitted records are visible in the expected owner list without delayed propagation.",
        status: "todo",
        effort: "large",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws3.id,
        title: "ISS-018 Repair onboarding review and open actions on the dashboard",
        description: "Connect onboarding review controls so dashboard actions open the intended review interface instead of failing silently.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws4.id,
        title: "ISS-019 Synchronize approved owners into the people registry",
        description: "Ensure owner approvals update the people registry consistently so owner and person datasets do not drift apart.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws4.id,
        title: "ISS-020 Enforce ownership percentage validation per unit",
        description: "Block ownership states where combined owner percentages exceed 100 percent for the same unit and surface a clear validation error.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws4.id,
        title: "ISS-022 Redesign the residential data model around unit-scoped relationships",
        description: "Clarify how units, owners, tenants, occupancy, and people relate so the domain model matches condo operations and avoids duplicate or conflicting records.",
        status: "todo",
        effort: "large",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws5.id,
        title: "ISS-009 Move payment method registry ownership into finance",
        description: "Relocate payment method registry functionality from communications into the finance area where operators expect it.",
        status: "todo",
        effort: "medium",
        priority: "medium",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws5.id,
        title: "ISS-010 Add standard communications templates for common notices",
        description: "Create reusable templates for payment instructions and other standard association communications.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws5.id,
        title: "ISS-011 Add association letterhead and shared header metadata to outbound messages",
        description: "Standardize outbound communications with association branding and shared identifying metadata.",
        status: "todo",
        effort: "small",
        priority: "medium",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws5.id,
        title: "ISS-012 Rework communications layout and control grouping",
        description: "Redesign the communications module so the workflow is clearer, less cluttered, and easier for operators to interpret.",
        status: "todo",
        effort: "large",
        priority: "medium",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws6.id,
        title: "ISS-023 Fix board role assignment date validation",
        description: "Investigate date parsing and API schema validation so valid board-role assignment inputs do not fail with a 400 invalid date error.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws6.id,
        title: "ISS-024 Allow board role assignment from owner and people management",
        description: "Move or duplicate board-role assignment controls into the owner or people workflow where board members are managed.",
        status: "todo",
        effort: "medium",
        priority: "medium",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws6.id,
        title: "ISS-035 Repair governance permission evaluation for assigned admins",
        description: "Investigate role mapping and permission checks so governance actions recognize accounts that already hold admin rights.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws7.id,
        title: "ISS-029 Fix meeting creation failures in the scheduler",
        description: "Investigate meeting submission validation and API handling so scheduling a meeting succeeds without system errors.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws7.id,
        title: "ISS-030 Consolidate and clean up meeting type selection",
        description: "Replace confusing or duplicated meeting-type controls with one clear meeting-type selection workflow.",
        status: "todo",
        effort: "small",
        priority: "medium",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws7.id,
        title: "ISS-031 Seed representative meeting data for test and demo environments",
        description: "Populate sample meeting records so the meeting interface is understandable when the environment has no organic governance history yet.",
        status: "todo",
        effort: "small",
        priority: "medium",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws7.id,
        title: "ISS-032 Add labels and rules for agenda item numeric parameters",
        description: "Clarify the unexplained numeric agenda field with explicit labels, examples, and validation behavior.",
        status: "todo",
        effort: "small",
        priority: "medium",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws7.id,
        title: "ISS-033 Repair vote submission and tally acceptance logic",
        description: "Investigate why vote input is rejected and restore reliable vote capture for governance decisions.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws7.id,
        title: "ISS-034 Remove anonymous voting from governance workflows",
        description: "Enforce non-anonymous voting rules in governance contexts where board accountability is required.",
        status: "todo",
        effort: "small",
        priority: "medium",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws7.id,
        title: "ISS-036 Fix governance task creation failures",
        description: "Investigate governance task submission errors so new governance tasks can be saved successfully.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws7.id,
        title: "ISS-037 Investigate zero-result regulatory library sync",
        description: "Verify the regulatory data source and extraction pipeline so compliance rule sync returns actual records instead of zero results.",
        status: "todo",
        effort: "medium",
        priority: "medium",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws7.id,
        title: "ISS-038 Add contextual examples to governance task creation",
        description: "Provide examples and field descriptions so governance task setup is understandable without prior product knowledge.",
        status: "todo",
        effort: "small",
        priority: "medium",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws8.id,
        title: "ISS-025 Explain the scheduled sweep control in board packages",
        description: "Add contextual help or tooltips so operators understand what the scheduled sweep action does before using it.",
        status: "todo",
        effort: "small",
        priority: "medium",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws8.id,
        title: "ISS-026 Add usage guidance for board package workflows",
        description: "Create how-to guidance and contextual support for creating, generating, and distributing board packages.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws8.id,
        title: "ISS-027 Investigate board package delivery status versus inbox receipt",
        description: "Verify delivery logs, email provider behavior, and status reporting so package-delivery success reflects actual receipt outcomes.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws8.id,
        title: "ISS-028 Evaluate simplification of board package generation dependencies",
        description: "Review whether board package generation is too tightly coupled to other modules and simplify the workflow where the dependency chain is not justified.",
        status: "todo",
        effort: "medium",
        priority: "medium",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws9.id,
        title: "ISS-039 Review and align inter-module data relationships",
        description: "Conduct a platform architecture review across governance, meetings, owners, and compliance modules to reduce fragmented workflows and unclear data dependencies.",
        status: "todo",
        effort: "large",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws9.id,
        title: "ISS-040 Add WIP feature visibility controls for non-admin users",
        description: "Implement feature-gating controls so unfinished modules do not appear to non-admin users before they are operationally ready.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
    ]);
  }

  const [reliabilityProject] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, "Condo Workflow Reliability and Data Integrity Recovery"));

  if (reliabilityProject) {
    const reliabilityTasks = await db
      .select()
      .from(roadmapTasks)
      .where(eq(roadmapTasks.projectId, reliabilityProject.id));

    const taskByTitle = new Map(reliabilityTasks.map((task) => [task.title, task]));
    const scheduleDefs = [
      { title: "ISS-001 Prevent duplicate Google sign-in window launches during login", start: "2026-03-16", end: "2026-03-27", deps: [] },
      { title: "ISS-002 Preserve workspace redirect after authentication", start: "2026-03-16", end: "2026-03-27", deps: ["ISS-001 Prevent duplicate Google sign-in window launches during login"] },
      { title: "ISS-005 Load all accessible associations in the workspace selector", start: "2026-03-16", end: "2026-03-27", deps: [] },
      { title: "ISS-013 Add clear labels and remove ambiguous prefills in owner onboarding", start: "2026-03-16", end: "2026-03-27", deps: [] },
      { title: "ISS-017 Make onboarding submissions appear immediately in the owner list", start: "2026-03-16", end: "2026-03-27", deps: ["ISS-013 Add clear labels and remove ambiguous prefills in owner onboarding"] },
      { title: "ISS-018 Repair onboarding review and open actions on the dashboard", start: "2026-03-16", end: "2026-03-27", deps: ["ISS-017 Make onboarding submissions appear immediately in the owner list"] },
      { title: "ISS-019 Synchronize approved owners into the people registry", start: "2026-03-16", end: "2026-03-27", deps: ["ISS-017 Make onboarding submissions appear immediately in the owner list"] },
      { title: "ISS-020 Enforce ownership percentage validation per unit", start: "2026-03-16", end: "2026-03-27", deps: [] },
      { title: "ISS-023 Fix board role assignment date validation", start: "2026-03-16", end: "2026-03-27", deps: [] },
      { title: "ISS-029 Fix meeting creation failures in the scheduler", start: "2026-03-16", end: "2026-03-27", deps: [] },
      { title: "ISS-033 Repair vote submission and tally acceptance logic", start: "2026-03-16", end: "2026-03-27", deps: ["ISS-029 Fix meeting creation failures in the scheduler"] },
      { title: "ISS-035 Repair governance permission evaluation for assigned admins", start: "2026-03-16", end: "2026-03-27", deps: [] },
      { title: "ISS-036 Fix governance task creation failures", start: "2026-03-16", end: "2026-03-27", deps: ["ISS-035 Repair governance permission evaluation for assigned admins"] },
      { title: "ISS-006 Make global search route to relevant records and modules", start: "2026-03-30", end: "2026-04-10", deps: ["ISS-005 Load all accessible associations in the workspace selector"] },
      { title: "ISS-008 Profile and reduce association detail load latency", start: "2026-03-30", end: "2026-04-10", deps: ["ISS-005 Load all accessible associations in the workspace selector"] },
      { title: "ISS-015 Replace free-text mailing address with structured address fields", start: "2026-03-30", end: "2026-04-10", deps: ["ISS-013 Add clear labels and remove ambiguous prefills in owner onboarding"] },
      { title: "ISS-021 Connect owner row selection to owner detail navigation", start: "2026-03-30", end: "2026-04-10", deps: ["ISS-019 Synchronize approved owners into the people registry"] },
      { title: "ISS-024 Allow board role assignment from owner and people management", start: "2026-03-30", end: "2026-04-10", deps: ["ISS-023 Fix board role assignment date validation"] },
      { title: "ISS-025 Explain the scheduled sweep control in board packages", start: "2026-03-30", end: "2026-04-10", deps: [] },
      { title: "ISS-026 Add usage guidance for board package workflows", start: "2026-03-30", end: "2026-04-10", deps: [] },
      { title: "ISS-030 Consolidate and clean up meeting type selection", start: "2026-03-30", end: "2026-04-10", deps: ["ISS-029 Fix meeting creation failures in the scheduler"] },
      { title: "ISS-031 Seed representative meeting data for test and demo environments", start: "2026-03-30", end: "2026-04-10", deps: ["ISS-029 Fix meeting creation failures in the scheduler"] },
      { title: "ISS-032 Add labels and rules for agenda item numeric parameters", start: "2026-03-30", end: "2026-04-10", deps: ["ISS-029 Fix meeting creation failures in the scheduler"] },
      { title: "ISS-034 Remove anonymous voting from governance workflows", start: "2026-03-30", end: "2026-04-10", deps: ["ISS-033 Repair vote submission and tally acceptance logic"] },
      { title: "ISS-037 Investigate zero-result regulatory library sync", start: "2026-03-30", end: "2026-04-10", deps: ["ISS-036 Fix governance task creation failures"] },
      { title: "ISS-038 Add contextual examples to governance task creation", start: "2026-03-30", end: "2026-04-10", deps: ["ISS-036 Fix governance task creation failures"] },
      { title: "ISS-003 Remove debug-style UI residue from the landing page", start: "2026-04-13", end: "2026-04-24", deps: ["ISS-002 Preserve workspace redirect after authentication"] },
      { title: "ISS-004 Remove or redesign the unclear refresh Google session control", start: "2026-04-13", end: "2026-04-24", deps: ["ISS-002 Preserve workspace redirect after authentication"] },
      { title: "ISS-007 Redesign the associations overview around association-level KPIs", start: "2026-04-13", end: "2026-04-24", deps: ["ISS-005 Load all accessible associations in the workspace selector"] },
      { title: "ISS-009 Move payment method registry ownership into finance", start: "2026-04-13", end: "2026-04-24", deps: [] },
      { title: "ISS-010 Add standard communications templates for common notices", start: "2026-04-13", end: "2026-04-24", deps: ["ISS-009 Move payment method registry ownership into finance"] },
      { title: "ISS-011 Add association letterhead and shared header metadata to outbound messages", start: "2026-04-13", end: "2026-04-24", deps: ["ISS-010 Add standard communications templates for common notices"] },
      { title: "ISS-014 Move second-owner fields into the ownership section", start: "2026-04-13", end: "2026-04-24", deps: ["ISS-013 Add clear labels and remove ambiguous prefills in owner onboarding"] },
      { title: "ISS-016 Remove emergency-contact collection from owner onboarding", start: "2026-04-13", end: "2026-04-24", deps: ["ISS-013 Add clear labels and remove ambiguous prefills in owner onboarding"] },
      { title: "ISS-027 Investigate board package delivery status versus inbox receipt", start: "2026-04-13", end: "2026-04-24", deps: [] },
      { title: "ISS-012 Rework communications layout and control grouping", start: "2026-04-27", end: "2026-05-08", deps: ["ISS-010 Add standard communications templates for common notices", "ISS-011 Add association letterhead and shared header metadata to outbound messages"] },
      { title: "ISS-022 Redesign the residential data model around unit-scoped relationships", start: "2026-04-27", end: "2026-05-08", deps: ["ISS-019 Synchronize approved owners into the people registry", "ISS-020 Enforce ownership percentage validation per unit"] },
      { title: "ISS-028 Evaluate simplification of board package generation dependencies", start: "2026-04-27", end: "2026-05-08", deps: ["ISS-027 Investigate board package delivery status versus inbox receipt"] },
      { title: "ISS-039 Review and align inter-module data relationships", start: "2026-04-27", end: "2026-05-08", deps: ["ISS-024 Allow board role assignment from owner and people management", "ISS-022 Redesign the residential data model around unit-scoped relationships", "ISS-028 Evaluate simplification of board package generation dependencies"] },
      { title: "ISS-040 Add WIP feature visibility controls for non-admin users", start: "2026-04-27", end: "2026-05-08", deps: ["ISS-039 Review and align inter-module data relationships"] },
    ] as const;

    for (const def of scheduleDefs) {
      const task = taskByTitle.get(def.title);
      if (!task) continue;
      const dependencyTaskIds = def.deps
        .map((title) => taskByTitle.get(title)?.id)
        .filter((id): id is string => Boolean(id));

      await db
        .update(roadmapTasks)
        .set({
          dependencyTaskIds,
          targetStartDate: new Date(`${def.start}T00:00:00.000Z`),
          targetEndDate: new Date(`${def.end}T00:00:00.000Z`),
        })
        .where(eq(roadmapTasks.id, task.id));
    }
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
