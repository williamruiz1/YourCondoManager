import { db } from "./db";
import { and, eq, ilike, sql } from "drizzle-orm";
import {
  adminUsers, analysisRuns, analysisVersions, associations, boardRoles, buildings, documents, occupancies, ownerships, persons, roadmapProjects, roadmapTasks, roadmapWorkstreams, units,
  elections, electionOptions, electionBallotTokens, electionBallotCasts, electionProxyDesignations, electionProxyDocuments,
  vendors, workOrders,
  associationInsurancePolicies, inspectionRecords,
  maintenanceScheduleTemplates, maintenanceScheduleInstances,
  governanceMeetings,
  communityAnnouncements,
  budgets, budgetVersions, budgetLines,
  ownerLedgerEntries,
} from "@shared/schema";
import { log } from "./logger";
import { randomBytes } from "crypto";

// All associations from the dev environment. These are inserted by exact ID on every
// server start using ON CONFLICT DO NOTHING — safe to run repeatedly, never overwrites.
const KNOWN_ASSOCIATIONS: (typeof associations.$inferInsert)[] = [
  { id: "e60c349e-b14e-48fa-a72e-8af3c2180c74", name: "Sunset Towers", address: "1200 Ocean Drive", city: "Miami", state: "FL", country: "USA" },
  { id: "f627dc9b-cde0-44c0-a23a-405487cb0add", name: "Pacific Heights Condos", address: "789 Bay Street", city: "San Francisco", state: "CA", country: "USA" },
  { id: "7a1f216a-8ac9-4fe9-a8d2-b62b01565a42", name: "Lakewood Residences", address: "450 Lakeview Blvd", city: "Chicago", state: "IL", country: "USA" },
  { id: "1c63e35c-2ac3-4b0a-b2ab-61f873d0d938", name: "Test Towers", address: "100 Test Ave", city: "Austin", state: "TX", country: "USA" },
  { id: "f301d073-ed84-4d73-84ce-3ef28af66f7a", name: "Cherry Hill Court Condominiums", associationType: "HOA", dateFormed: "1990-07-16", ein: "06-1513429", address: "1405 Quinnipiac Ave.", city: "New Haven", state: "CT", country: "USA" },
  { id: "628b7d4b-b052-44a5-9bcc-69784581450c", name: "Cherry Hill Court", associationType: "condo", address: "101 Cherry Hill Court", city: "Cherry Hill", state: "NJ", country: "USA" },
  { id: "7c164b67-9e3b-456a-bb49-dd698b0822c4", name: "Verification HOA 1773579706183", associationType: "condo", address: "1 Verification Way", city: "New Haven", state: "CT", country: "USA" },
  { id: "5d4488b7-c229-4412-8762-d822e4f150f3", name: "QA Communications Foundation 364067", address: "100 Verification Way", city: "New Haven", state: "CT", country: "USA" },
  { id: "f61e4b10-01a3-4670-87b3-c2a7749b2958", name: "Building First Verify A 092492", address: "100 Verify Way", city: "Austin", state: "TX", country: "USA" },
  { id: "8c579997-ec38-4389-9e78-dbf34ba80947", name: "Building First Verify B 092492", address: "200 Verify Way", city: "Austin", state: "TX", country: "USA" },
];

export async function seedDatabase() {
  log(`[seed] starting :: KNOWN_ASSOCIATIONS=${KNOWN_ASSOCIATIONS.length}`, "seed");

  // Ensure all known associations exist — inserts by exact ID, skips any that already exist.
  // This runs on every startup so production stays in sync with dev without manual intervention.
  let assocInserted = 0;
  let assocSkipped = 0;
  for (const assoc of KNOWN_ASSOCIATIONS) {
    const result = await db.insert(associations).values(assoc).onConflictDoNothing().returning({ id: associations.id });
    if (result.length > 0) {
      assocInserted++;
    } else {
      assocSkipped++;
    }
  }
  log(`[seed] associations :: inserted=${assocInserted} skipped(already-exist)=${assocSkipped}`, "seed");

  // Log total row counts for key tables to verify DB copy completeness
  const counts = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM associations) AS associations,
      (SELECT COUNT(*)::int FROM units) AS units,
      (SELECT COUNT(*)::int FROM buildings) AS buildings,
      (SELECT COUNT(*)::int FROM persons) AS persons,
      (SELECT COUNT(*)::int FROM auth_users) AS auth_users,
      (SELECT COUNT(*)::int FROM admin_users) AS admin_users
  `);
  const c = counts.rows[0] as any;
  log(`[seed] db counts :: associations=${c.associations} units=${c.units} buildings=${c.buildings} persons=${c.persons} auth_users=${c.auth_users} admin_users=${c.admin_users}`, "seed");

  // Seed demo units/people/ownerships only on a truly fresh database (no units yet).
  const existingUnits = await db.select().from(units);
  log(`[seed] units check :: existingUnits=${existingUnits.length} (will seed demo data only if 0)`, "seed");
  if (existingUnits.length === 0) {
    const sunsetTowers = KNOWN_ASSOCIATIONS.find(a => a.name === "Sunset Towers")!;
    const lakewood = KNOWN_ASSOCIATIONS.find(a => a.name === "Lakewood Residences")!;
    const pacific = KNOWN_ASSOCIATIONS.find(a => a.name === "Pacific Heights Condos")!;

    const unitRows = await db.insert(units).values([
      { associationId: sunsetTowers.id!, unitNumber: "101", building: "A", squareFootage: 1250 },
      { associationId: sunsetTowers.id!, unitNumber: "102", building: "A", squareFootage: 980 },
      { associationId: sunsetTowers.id!, unitNumber: "201", building: "B", squareFootage: 1400 },
      { associationId: sunsetTowers.id!, unitNumber: "301", building: "B", squareFootage: 1600 },
      { associationId: lakewood.id!, unitNumber: "1A", building: "Main", squareFootage: 1100 },
      { associationId: lakewood.id!, unitNumber: "2A", building: "Main", squareFootage: 1100 },
      { associationId: lakewood.id!, unitNumber: "3B", building: "East", squareFootage: 1350 },
      { associationId: pacific.id!, unitNumber: "PH1", building: null, squareFootage: 2200 },
      { associationId: pacific.id!, unitNumber: "501", building: null, squareFootage: 1050 },
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
      { personId: personRows[0].id, associationId: sunsetTowers.id!, role: "President", startDate: new Date("2023-01-01") },
      { personId: personRows[1].id, associationId: sunsetTowers.id!, role: "Treasurer", startDate: new Date("2023-01-01") },
      { personId: personRows[2].id, associationId: lakewood.id!, role: "President", startDate: new Date("2022-06-01") },
      { personId: personRows[4].id, associationId: lakewood.id!, role: "Secretary", startDate: new Date("2022-06-01") },
      { personId: personRows[3].id, associationId: pacific.id!, role: "President", startDate: new Date("2021-01-01") },
      { personId: personRows[6].id, associationId: pacific.id!, role: "Board Member", startDate: new Date("2024-01-15") },
    ]);
  }

  // Seed Cherry Hill Court Condominiums buildings — idempotent by fixed UUID
  const CHERRY_HILL_CONDO_ID = "f301d073-ed84-4d73-84ce-3ef28af66f7a";
  const CHERRY_HILL_BUILDINGS = [
    { id: "b11ea5a8-d907-4063-a0ed-640874159f61", associationId: CHERRY_HILL_CONDO_ID, name: "1415", address: "Quinnipiac Ave., New Haven, CT 06513", totalUnits: 1 },
    { id: "f249583c-5d75-4865-a6ca-d01f0b4dd3a6", associationId: CHERRY_HILL_CONDO_ID, name: "1417", address: "Quinnipiac Ave., New Haven, CT 06513", totalUnits: 7 },
    { id: "8a0fafb2-cc66-400f-a3dc-74617e39eefc", associationId: CHERRY_HILL_CONDO_ID, name: "1419", address: "Quinnipiac Ave., New Haven, CT 06513", totalUnits: 1 },
    { id: "e4f64f48-6136-457c-af87-20223cfc81ef", associationId: CHERRY_HILL_CONDO_ID, name: "1421", address: "1421 Quinnipiac Ave.", totalUnits: 4, notes: "Backfilled from legacy unit building labels." },
  ] as const;
  for (const b of CHERRY_HILL_BUILDINGS) {
    await db.insert(buildings).values(b).onConflictDoNothing();
  }

  // Seed Cherry Hill Court Condominiums units — idempotent by fixed UUID
  const CHERRY_HILL_UNITS = [
    { id: "7adb3521-845b-41de-8054-3281ddfc0f3c", associationId: CHERRY_HILL_CONDO_ID, unitNumber: "A", building: "1415", buildingId: "b11ea5a8-d907-4063-a0ed-640874159f61" },
    { id: "909ed4e8-fb53-49f8-aecf-5b56c10e1e30", associationId: CHERRY_HILL_CONDO_ID, unitNumber: "B", building: "1415", buildingId: "b11ea5a8-d907-4063-a0ed-640874159f61" },
    { id: "341b2050-28cf-4d3d-bc44-ef5a0f6584d9", associationId: CHERRY_HILL_CONDO_ID, unitNumber: "C", building: "1415", buildingId: "b11ea5a8-d907-4063-a0ed-640874159f61" },
    { id: "34575428-ea77-4013-bd0f-593e0c7dbbbb", associationId: CHERRY_HILL_CONDO_ID, unitNumber: "A", building: "1417", buildingId: "f249583c-5d75-4865-a6ca-d01f0b4dd3a6" },
    { id: "b1f60b15-3cec-4cca-8c1c-0a0ba7bf4d7f", associationId: CHERRY_HILL_CONDO_ID, unitNumber: "B", building: "1417", buildingId: "f249583c-5d75-4865-a6ca-d01f0b4dd3a6" },
    { id: "a5b46109-1514-4207-9ed3-2b587ead617f", associationId: CHERRY_HILL_CONDO_ID, unitNumber: "C", building: "1417", buildingId: "f249583c-5d75-4865-a6ca-d01f0b4dd3a6" },
    { id: "978bacef-824f-471e-80ea-891a8eaa01f8", associationId: CHERRY_HILL_CONDO_ID, unitNumber: "D", building: "1417", buildingId: "f249583c-5d75-4865-a6ca-d01f0b4dd3a6" },
    { id: "3b5e2a2f-81cc-4199-9333-858c8f0fca9c", associationId: CHERRY_HILL_CONDO_ID, unitNumber: "E", building: "1417", buildingId: "f249583c-5d75-4865-a6ca-d01f0b4dd3a6" },
    { id: "8b029a2d-c7e4-4cb1-ad82-9f9829877208", associationId: CHERRY_HILL_CONDO_ID, unitNumber: "F", building: "1417", buildingId: "f249583c-5d75-4865-a6ca-d01f0b4dd3a6" },
    { id: "91e77ac7-b0dc-4bab-a169-f167b20e5cce", associationId: CHERRY_HILL_CONDO_ID, unitNumber: "G", building: "1417", buildingId: "f249583c-5d75-4865-a6ca-d01f0b4dd3a6" },
    { id: "a882cbbb-1061-4764-8b2b-d9398e2ccedb", associationId: CHERRY_HILL_CONDO_ID, unitNumber: "1419", building: "1419", buildingId: "8a0fafb2-cc66-400f-a3dc-74617e39eefc" },
    { id: "bfa54c14-9fcd-4ed4-a810-61f193aa7d4b", associationId: CHERRY_HILL_CONDO_ID, unitNumber: "A", building: "1421", buildingId: "e4f64f48-6136-457c-af87-20223cfc81ef", squareFootage: 1500 },
    { id: "96696dfe-9feb-439a-ba29-88b79c5a74fd", associationId: CHERRY_HILL_CONDO_ID, unitNumber: "B", building: "1421", buildingId: "e4f64f48-6136-457c-af87-20223cfc81ef", squareFootage: 1200 },
    { id: "16795e0e-2a66-4a5a-9977-0d93e7790c6e", associationId: CHERRY_HILL_CONDO_ID, unitNumber: "C", building: "1421", buildingId: "e4f64f48-6136-457c-af87-20223cfc81ef", squareFootage: 1200 },
    { id: "f5d74705-ef3d-439d-bf89-a2c1c2a17f34", associationId: CHERRY_HILL_CONDO_ID, unitNumber: "D", building: "1421", buildingId: "e4f64f48-6136-457c-af87-20223cfc81ef" },
    { id: "3d308aff-6712-4628-b812-e247c38ab92b", associationId: CHERRY_HILL_CONDO_ID, unitNumber: "E", building: "1421", buildingId: "e4f64f48-6136-457c-af87-20223cfc81ef" },
    { id: "968ed680-252a-4be9-ae77-9312e8a5a150", associationId: CHERRY_HILL_CONDO_ID, unitNumber: "F", building: "1421", buildingId: "e4f64f48-6136-457c-af87-20223cfc81ef" },
    { id: "a1a7aef1-3b07-414c-ae6a-3093cf5105cd", associationId: CHERRY_HILL_CONDO_ID, unitNumber: "G", building: "1421", buildingId: "e4f64f48-6136-457c-af87-20223cfc81ef" },
  ] as const;
  for (const u of CHERRY_HILL_UNITS) {
    await db.insert(units).values(u).onConflictDoNothing();
  }
  log(`[seed] cherry hill court condominiums buildings=${CHERRY_HILL_BUILDINGS.length} units=${CHERRY_HILL_UNITS.length} (idempotent)`, "seed");

  // Seed known admin users with fixed UUIDs — idempotent, ensures production always has correct accounts
  // regardless of whether Replit's DB copy mechanism works.
  const KNOWN_ADMIN_USERS = [
    { id: "ae7a1d67-d01a-4041-ac39-68e1519ee77d", email: "chcmgmt18@gmail.com", role: "platform-admin" as const, isActive: 1 },
    { id: "b4d20095-aa16-42fa-97b3-99b688a6a323", email: "yourcondomanagement@gmail.com", role: "platform-admin" as const, isActive: 1 },
  ];
  for (const adminUser of KNOWN_ADMIN_USERS) {
    await db.insert(adminUsers).values(adminUser).onConflictDoNothing();
  }
  log(`[seed] admin users seeded :: count=${KNOWN_ADMIN_USERS.length} (idempotent)`, "seed");

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

  // Bootstrap platform admins from PLATFORM_ADMIN_EMAILS env var.
  //
  // HOW IT WORKS:
  //   Set PLATFORM_ADMIN_EMAILS=you@example.com (comma-separated for multiple)
  //   in your deployment environment. On every server start, each listed email
  //   is ensured to be an active platform-admin in the database.
  //
  // WHEN TO USE:
  //   - First deployment: no platform-admin exists yet in the production DB
  //   - Recovery: you've been locked out and need to restore platform-admin access
  //   - Accidental role downgrade: someone demoted the last platform-admin
  //
  // It is safe to leave this env var set permanently — it only promotes listed
  // emails, never downgrades or affects other users.
  const platformAdminEmailsRaw = (process.env.PLATFORM_ADMIN_EMAILS || "").trim();
  if (platformAdminEmailsRaw) {
    const platformAdminEmails = platformAdminEmailsRaw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    for (const email of platformAdminEmails) {
      const [existing] = await db.select().from(adminUsers).where(ilike(adminUsers.email, email));
      if (existing) {
        if (existing.role !== "platform-admin" || existing.isActive !== 1) {
          await db
            .update(adminUsers)
            .set({ role: "platform-admin", isActive: 1, updatedAt: new Date() })
            .where(eq(adminUsers.id, existing.id));
          console.log(`[bootstrap] Promoted ${email} to platform-admin`);
        } else {
          console.log(`[bootstrap] Confirmed platform-admin: ${email}`);
        }
      } else {
        await db.insert(adminUsers).values({ email, role: "platform-admin", isActive: 1 });
        console.log(`[bootstrap] Created platform-admin for ${email}`);
      }
    }
  }

  // Production Deployment Stability roadmap — tracks auth and data-sync issues
  const [existingDeployStabilityProject] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, "Production Deployment Stability"));

  if (!existingDeployStabilityProject) {
    const [project] = await db.insert(roadmapProjects).values({
      title: "Production Deployment Stability",
      description: "Two active production issues: (1) association data edits made in dev are not reflected in published production environment after DB copy; (2) Google OAuth login on published site redirects back to sign-in page instead of establishing a session. Both require root-cause diagnosis, targeted fixes, and verification.",
      status: "active",
      isCollapsed: 0,
    }).returning();

    const [ws1] = await db.insert(roadmapWorkstreams).values({
      projectId: project.id,
      title: "Issue A — Dev Data Not Appearing in Production After DB Copy",
      description: "Association edits made in dev (e.g. Cherry Hill Court Condominiums) are not visible in the published app after republishing with the 'Copy dev database to production' option checked. Root cause is unknown — could be silent pg_restore failures, FK constraint violations blocking partial tables, or the wrong DB being targeted.",
      orderIndex: 0,
      isCollapsed: 0,
    }).returning();

    const [ws2] = await db.insert(roadmapWorkstreams).values({
      projectId: project.id,
      title: "Issue B — Google OAuth Session Not Persisting on Published Site",
      description: "Signing in with Google on the published site returns ?auth=success in the URL but the app renders the sign-in page instead of the workspace. Session is not established. Observed when using the same browser as the Replit IDE. chcmgmt18@gmail.com logs in successfully; yourcondomanagement@gmail.com does not.",
      orderIndex: 1,
      isCollapsed: 0,
    }).returning();

    await db.insert(roadmapTasks).values([
      // Issue A tasks
      {
        projectId: project.id,
        workstreamId: ws1.id,
        title: "A-1 Add detailed seed and health logging to pinpoint where DB copy breaks down",
        description: "Add per-table row counts and association-level breakdowns to /api/health and to seedDatabase() startup logs. This gives a definitive before/after snapshot to confirm whether the copy transferred the right data or stopped partway.",
        status: "done",
        effort: "small",
        priority: "critical",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws1.id,
        title: "A-2 Verify FK constraint cleanliness in dev DB before each deploy",
        description: "Run a pre-deploy FK integrity check query across all tables to confirm no orphaned rows exist that would cause pg_restore to fail silently. Document the check and make it repeatable.",
        status: "todo",
        effort: "small",
        priority: "critical",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws1.id,
        title: "A-3 Diagnose whether /api/health post-deploy shows correct association data",
        description: "After next republish, immediately hit /api/health on the production URL. Compare association list, unit counts, and building counts against dev. If counts match dev, the data is there and the issue is display/auth. If counts are wrong, the copy failed.",
        status: "todo",
        effort: "small",
        priority: "critical",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws1.id,
        title: "A-4 Confirm association edit fields are stored in DB-backed columns not local state",
        description: "Identify which fields the user edits for Cherry Hill Court (EIN, dateFormed, address, etc.) and verify they are persisted to the associations table and not held only in client state or a separate config store.",
        status: "todo",
        effort: "small",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws1.id,
        title: "A-5 Fix any remaining FK violations blocking complete pg_restore",
        description: "Using the FK integrity check from A-2, clean all orphaned rows across budget_lines, financial_categories, and any other FK-constrained tables. Re-run the check after cleanup.",
        status: "todo",
        effort: "medium",
        priority: "critical",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws1.id,
        title: "A-6 Verify Cherry Hill Court data is visible in production post-fix",
        description: "After fixing FK issues and redeploying, confirm in the published UI that Cherry Hill Court Condominiums shows the correct EIN, formation date, address, units, buildings, and any other edited fields.",
        status: "todo",
        effort: "small",
        priority: "critical",
        dependencyTaskIds: [],
      },
      // Issue B tasks
      {
        projectId: project.id,
        workstreamId: ws2.id,
        title: "B-1 Add OAuth callback and session restore logging to server/auth.ts",
        description: "Log every key step in the Google OAuth flow: external account lookup result, email lookup result, admin bootstrap resolution, auth user created vs updated, isActive value, and session restore token verification outcome. This makes every login attempt fully traceable in server logs.",
        status: "done",
        effort: "small",
        priority: "critical",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws2.id,
        title: "B-2 Fix is_active=0 blocking session establishment after OAuth",
        description: "The auth_users record for yourcondomanagement@gmail.com has is_active=0. deserializeUser rejects inactive users, causing the session to be silently dropped after a successful OAuth callback. Fix: set isActive=1 on every OAuth login in updateAuthUser. Also update the dev DB record directly.",
        status: "done",
        effort: "small",
        priority: "critical",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws2.id,
        title: "B-3 Investigate session cookie behavior when Replit IDE and published app share a browser",
        description: "The user observes login failure specifically when using the same browser as the Replit IDE. Diagnose whether the 'sid' session cookie name conflicts across dev and production origins, whether SameSite=Lax blocks the cookie after the OAuth redirect, or whether a Replit iframe/proxy changes the origin seen by the server.",
        status: "todo",
        effort: "medium",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws2.id,
        title: "B-4 Verify authRestore token flow completes correctly in production",
        description: "After OAuth callback, the authRestore token in the redirect URL must be picked up by the frontend and POSTed to /api/auth/session/restore. Verify this call happens, returns 201, and that the resulting Set-Cookie header is accepted by the browser. Check network tab for the restore call and its response headers.",
        status: "todo",
        effort: "small",
        priority: "high",
        dependencyTaskIds: [],
      },
      {
        projectId: project.id,
        workstreamId: ws2.id,
        title: "B-5 Confirm yourcondomanagement@gmail.com signs in and sees correct admin workspace",
        description: "After deploying B-1 and B-2 fixes, verify end-to-end: login completes, session is established, /api/auth/me returns platform-admin role, and the workspace shows all accessible associations.",
        status: "todo",
        effort: "small",
        priority: "critical",
        dependencyTaskIds: [],
      },
    ]);

    log("[seed] created roadmap project: Production Deployment Stability", "seed");
  }

  const [existingMobileOptimizationProject] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, "Mobile Optimization"));

  if (!existingMobileOptimizationProject) {
    const [project] = await db.insert(roadmapProjects).values({
      title: "Mobile Optimization",
      description: "Platform-wide roadmap to make owner, board, manager, admin, and shared communication/document experiences work as a primary responsive web application on mobile without degrading desktop workflows.",
      status: "active",
      isCollapsed: 0,
    }).returning();

    const workstreamDefinitions: {
      title: string;
      description: string;
      priority: "low" | "medium" | "high" | "critical";
      tasks: [string, string, "small" | "medium" | "large"][];
    }[] = [
      {
        title: "Mobile Foundations And Shared UI Standards",
        description: "Create the shared mobile layout, form, table, and action-placement standards that every workspace follows.",
        priority: "critical" as const,
        tasks: [
          ["Audit shared spacing, typography, touch target, and breakpoint patterns across shared components and key pages", "Review shared UI patterns across components and major pages to identify inconsistent mobile behavior and define the baseline for standardization.", "large"],
          ["Define mobile layout standards for page headers, section spacing, cards, tab bars, drawers, button groups, and sticky actions", "Create a durable layout standard for common page structures so mobile pages behave consistently across roles.", "large"],
          ["Standardize responsive behavior for tables with list or card fallbacks on narrow screens", "Replace dense desktop tables with prioritized columns, list patterns, or cards when space is constrained.", "medium"],
          ["Standardize responsive behavior for forms with single-column defaults, persistent labels, inline validation, and keyboard-safe layouts", "Ensure form entry remains readable and finishable on small screens without clipped fields, ambiguous labels, or keyboard overlap.", "medium"],
          ["Standardize mobile-safe patterns for filters and low-frequency controls using drawers, sheets, or expandable sections", "Move secondary controls out of cramped inline toolbars so task-critical actions remain visible on phones.", "medium"],
          ["Create a reusable mobile section shell for pages with headers, status, actions, and long content", "Introduce a shared section primitive so product teams can compose mobile-safe screens without rebuilding the same layout logic repeatedly.", "large"],
          ["Document mobile UI rules in a durable shared guidance artifact", "Capture the resulting standards in project guidance so future work follows the same mobile contract.", "small"],
        ],
      },
      {
        title: "Global Navigation, Authentication, And Session Flows",
        description: "Make entry, switching, and navigation clean and predictable on phones.",
        priority: "critical" as const,
        tasks: [
          ["Review mobile behavior for login, OTP, association selection, and workspace switching", "Audit entry and context-switching flows on common phone widths to identify overflow, clipping, and step-order issues.", "medium"],
          ["Simplify stacked auth screens so each step fits within the viewport cleanly", "Refactor authentication layouts so each step is readable and actionable without accidental scroll traps or hidden controls.", "medium"],
          ["Standardize mobile navigation patterns for owner, board, manager, and admin contexts", "Define role-aware navigation behavior so mobile users can predict how top-level and subpage navigation works across the platform.", "large"],
          ["Review fixed headers, sticky submenus, and bottom navigation so they do not overlap content", "Resolve header, sticky region, and bottom-nav collisions that hide content or actions on small screens.", "medium"],
          ["Ensure tab changes and subpage changes reset or preserve scroll intentionally", "Make mobile navigation transitions predictable by choosing explicit scroll restoration behavior per flow.", "small"],
          ["Make portal context switching between units and associations mobile-friendly", "Improve unit and association switching controls for touch interaction, visibility, and small-screen legibility.", "medium"],
          ["Verify safe-area spacing and bottom-nav behavior on phone-sized screens", "Ensure phone-sized devices preserve safe-area spacing around anchored navigation and actions.", "small"],
        ],
      },
      {
        title: "Owner Portal Mobile Experience",
        description: "Make the owner portal easy to scan, navigate, edit, and act on from a phone.",
        priority: "critical" as const,
        tasks: [
          ["Audit owner portal overview, financials, maintenance, documents, and notices on common mobile widths", "Review the primary owner-facing surfaces on narrow screens and identify layout breakage, hidden actions, and readability issues.", "large"],
          ["Refine overview layout so summary, owner info, and occupancy work cleanly in narrow viewports", "Rework the overview information hierarchy so the owner landing page reads clearly on phones.", "medium"],
          ["Ensure owner info and occupancy forms are single-column, labeled, and easy to edit and save on mobile", "Convert profile and occupancy editing flows into mobile-safe form structures with clear labels and accessible save actions.", "medium"],
          ["Optimize unit selection for touch interaction and horizontal scrolling", "Improve multi-unit switching so owners can change context easily on phones without cramped controls.", "small"],
          ["Simplify financials into a statement-first mobile flow with balance, pay action, recent transactions, and payment setup", "Restructure owner financials so the most common payment and review actions appear first on mobile.", "large"],
          ["Convert dense financial history tables into mobile-friendly transaction cards or prioritized rows", "Replace narrow-screen ledger tables with a readable mobile transaction pattern.", "medium"],
          ["Review maintenance submission and request history for attachment handling, long text, and status readability", "Ensure maintenance flows remain usable on phones for both request creation and review.", "medium"],
          ["Review document and notice views for readable typography, download actions, and expansion behavior", "Make long-form owner content clean to read and act on from a phone.", "medium"],
          ["Verify mobile behavior for bottom tab navigation and long-scrolling content", "Confirm owner navigation remains reachable and does not interfere with long-form portal content.", "small"],
        ],
      },
      {
        title: "Board Workspace Mobile Experience",
        description: "Support board review and light action on mobile while clearly separating desktop-preferred authoring workflows.",
        priority: "medium" as const,
        tasks: [
          ["Audit board landing, agenda, tasks, meeting summaries, approvals, packages, and activity views on mobile", "Identify which governance surfaces are readable and actionable on phones versus those that currently fail on narrow screens.", "large"],
          ["Identify board workflows that should support mobile review versus desktop-only authoring", "Define the support boundary so mobile expectations are explicit instead of accidental.", "medium"],
          ["Collapse dense governance dashboards into prioritized cards with progressive disclosure", "Break multi-panel board dashboards into mobile-safe review stacks ordered by urgency.", "medium"],
          ["Convert board activity feeds and approval queues into mobile-first list patterns", "Replace dense queue layouts with mobile-first feed and approval surfaces.", "medium"],
          ["Review attachments, packets, and long-form content for readable mobile access", "Ensure board members can open and read governance materials on phones without broken layouts.", "medium"],
          ["Ensure board actions such as approve, review, comment, and open detail remain reachable on mobile", "Anchor critical board actions so they remain visible and usable on small screens.", "small"],
          ["Define which board workflows should explicitly show desktop-preferred messaging", "Mark workflows that should not pretend to be mobile-ready when desktop remains the better operating surface.", "small"],
        ],
      },
      {
        title: "Manager And Admin Workspace Mobile Experience",
        description: "Reduce friction for operational users doing triage, review, and follow-up from mobile.",
        priority: "high" as const,
        tasks: [
          ["Audit admin dashboard, work queues, maintenance triage, communications, financial review, and association switching on mobile", "Review core operator workflows on phones to identify layout and actionability gaps.", "large"],
          ["Break large multi-panel dashboards into mobile stacks ordered by urgency", "Recompose desktop dashboards into mobile-first information hierarchies.", "large"],
          ["Move filter-heavy or configuration-heavy controls into drawers or dedicated subviews", "Remove secondary controls from cramped inline layouts and preserve space for high-frequency operator actions.", "medium"],
          ["Convert operational tables into mobile queue cards with visible status, scope, and next action", "Replace dense back-office tables with mobile queue patterns optimized for triage.", "medium"],
          ["Review multi-step admin forms for mobile-safe progression and save states", "Ensure operational forms can be completed in mobile-sized steps without losing progress.", "medium"],
          ["Ensure core operational tasks can be completed on mobile: acknowledge, assign, update status, send notice, review account, open record", "Protect the highest-frequency operator actions so they remain finishable from a phone.", "large"],
          ["Mark workflows that are truly desktop-first and provide explicit handoff messaging instead of poor mobile fallbacks", "Clarify when operators should switch to desktop rather than forcing broken small-screen interactions.", "small"],
        ],
      },
      {
        title: "Resident, Shared Content, And Cross-Role Communication Surfaces",
        description: "Improve the mobile behavior of shared content surfaces used across roles.",
        priority: "high" as const,
        tasks: [
          ["Audit notices, announcements, documents, communication history, and resident-facing content on mobile", "Review the platform's shared reading and communication surfaces for readability and actionability on phones.", "medium"],
          ["Improve readability for message cards, timelines, attachments, and metadata", "Refine shared content presentation so message details remain legible without desktop width.", "medium"],
          ["Ensure document previews, download actions, and filenames behave cleanly on small screens", "Make document access predictable on mobile for both operators and residents.", "small"],
          ["Standardize mobile treatment for badges, statuses, timestamps, and association or unit labels", "Reduce visual clutter and inconsistency in shared metadata patterns on small screens.", "small"],
          ["Review empty states and success states so they stay concise on small screens", "Ensure low-content states do not dominate the viewport or bury next actions on phones.", "small"],
          ["Ensure shared content components do not rely on desktop-only table layouts", "Remove table-only assumptions from shared communication and content modules.", "medium"],
        ],
      },
      {
        title: "Data Density, Performance, And Interaction Quality",
        description: "Keep mobile pages fast, readable, and physically usable.",
        priority: "medium" as const,
        tasks: [
          ["Identify screens with excessive card stacking, redundant summaries, or repeated data blocks", "Reduce unnecessary repetition so mobile screens surface one primary decision area at a time.", "medium"],
          ["Reduce duplicate status surfaces and keep one primary decision area per screen", "Simplify dense pages so status and action placement remain clear on phones.", "medium"],
          ["Audit heavy tables, long feeds, and expensive panels for mobile performance impact", "Measure and reduce mobile performance bottlenecks in data-heavy surfaces.", "medium"],
          ["Improve perceived performance with progressive loading and lighter default states where needed", "Make mobile pages feel faster even when underlying data surfaces remain large.", "medium"],
          ["Review tap targets, scroll traps, nested scroll areas, and overlap with sticky UI", "Fix physical interaction issues that make phone usage frustrating or error-prone.", "small"],
          ["Ensure modals, drawers, selects, and date pickers behave correctly with the mobile keyboard", "Resolve keyboard overlap and viewport issues in common mobile interaction primitives.", "small"],
        ],
      },
      {
        title: "QA, Verification, And Rollout",
        description: "Make mobile quality measurable, repeatable, and visible during rollout.",
        priority: "high" as const,
        tasks: [
          ["Define a core mobile viewport matrix for 320px, 375px, 390px, 430px, and 768px widths", "Adopt a standard viewport coverage matrix for validating mobile behavior consistently.", "small"],
          ["Create a role-based mobile test checklist for owner, board, manager, admin, and shared public/auth flows", "Define a repeatable manual verification checklist across the major user roles.", "medium"],
          ["Add manual verification scripts for the highest-frequency mobile journeys", "Capture exact mobile verification paths for the flows most likely to regress.", "medium"],
          ["Capture before and after screenshots for major workstreams", "Create a visual record of mobile improvements to support rollout and regression review.", "small"],
          ["Identify candidate UI regression coverage for mobile-critical flows if automation is added", "Document where automation would provide the most leverage for mobile regression control.", "small"],
          ["Establish a release gate that requires mobile verification on touched role surfaces", "Require mobile validation when relevant platform surfaces are changed.", "medium"],
          ["Track unresolved desktop-only workflows explicitly so they are not misrepresented as mobile-ready", "Maintain a clear inventory of desktop-preferred workflows during the transition to better mobile coverage.", "small"],
        ],
      },
    ];

    for (let workstreamIndex = 0; workstreamIndex < workstreamDefinitions.length; workstreamIndex += 1) {
      const workstreamDefinition = workstreamDefinitions[workstreamIndex];
      const [workstream] = await db.insert(roadmapWorkstreams).values({
        projectId: project.id,
        title: workstreamDefinition.title,
        description: workstreamDefinition.description,
        orderIndex: workstreamIndex,
        isCollapsed: 0,
      }).returning();

      await db.insert(roadmapTasks).values(
        workstreamDefinition.tasks.map((taskDefinition) => ({
          projectId: project.id,
          workstreamId: workstream.id,
          title: taskDefinition[0],
          description: taskDefinition[1],
          status: "todo" as const,
          effort: taskDefinition[2],
          priority: workstreamDefinition.priority,
          dependencyTaskIds: [],
        })),
      );
    }

    log("[seed] created roadmap project: Mobile Optimization", "seed");
  }

  const [existingLeaseRedesignProject] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, "Lease And Occupancy Workspace Redesign"));

  if (!existingLeaseRedesignProject) {
    const [project] = await db.insert(roadmapProjects).values({
      title: "Lease And Occupancy Workspace Redesign",
      description: "Plan and deliver a desktop and mobile redesign for the lease and occupancy management experience, preserving current occupancy recording and onboarding intake functionality while moving the live workflow toward a clearer, more editorial workspace.",
      status: "active",
      isCollapsed: 0,
    }).returning();

    const workstreamDefinitions: {
      title: string;
      description: string;
      priority: "low" | "medium" | "high" | "critical";
      tasks: [string, string, "small" | "medium" | "large"][];
    }[] = [
      {
        title: "Service Intent, Journey Review, And Scope",
        description: "Clarify what the lease and occupancy workspace is meant to do before changing layout or visual direction.",
        priority: "critical" as const,
        tasks: [
          ["Define the target operator, success criteria, and scope boundary for the lease workspace", "Document who uses this workspace, what counts as a successful session, and which current flows must remain intact during the redesign.", "medium"],
          ["Audit the current live lease and occupancy journey across Units, occupancy CRUD, and onboarding intake", "Map how the current workflow actually operates today, including the route redirect from /app/occupancy to /app/units and any embedded lease or occupancy controls.", "large"],
          ["Capture user-facing friction and data-safety risks in the existing lease workflow", "Record the current usability, trust, and workflow breakdowns that the redesign must address without introducing data loss or ambiguity.", "medium"],
          ["Decide whether the redesign should live as a standalone page, a Units sub-workspace, or a hybrid entry model", "Resolve the route and navigation model before visual implementation so the redesign is attached to the correct operating surface.", "medium"],
        ],
      },
      {
        title: "Information Architecture And Theme Translation",
        description: "Translate the provided references into a workable lease-management structure instead of copying them literally.",
        priority: "high" as const,
        tasks: [
          ["Extract the reusable design language from the provided references", "Identify the typography, color, spacing, density, hero treatment, and card patterns worth carrying into the lease workspace theme.", "medium"],
          ["Define the lease workspace information hierarchy for desktop and mobile", "Decide which summary metrics, records, actions, and status states should appear first so the page serves operators instead of acting like a generic gallery layout.", "large"],
          ["Map current controls into the new structure and discard reference elements that do not fit the product", "Preserve the functional pieces that matter while explicitly ignoring off-theme or non-functional reference fragments.", "medium"],
          ["Create a durable implementation brief for desktop and mobile parity", "Capture the accepted structure, visual direction, and non-goals so implementation stays aligned once code changes begin.", "small"],
        ],
      },
      {
        title: "Workflow Preservation And Data Integrity",
        description: "Protect the live record creation and intake flows while the interface is being redesigned.",
        priority: "critical" as const,
        tasks: [
          ["Inventory every current action, mutation, and dataset dependency in the lease workspace", "List the existing queries, mutations, dialogs, form fields, and invalidation behavior that must survive the redesign.", "medium"],
          ["Preserve occupancy record creation, tenant-owner type handling, and onboarding intake behavior", "Keep the current operational behavior for recording occupancy and submitting onboarding intake, including required field rules and association context.", "large"],
          ["Define safe edit, empty, loading, and failure states for the redesigned lease workspace", "Ensure the redesign handles operational edge states clearly rather than focusing only on ideal data-rich views.", "medium"],
          ["Verify route continuity and command-path consistency after the redesign", "Ensure users can still reach the workspace from the existing navigation and redirects without breaking mental models or links.", "small"],
        ],
      },
      {
        title: "Desktop Lease Workspace Redesign",
        description: "Implement the larger-screen lease experience with the new editorial visual direction and clearer action hierarchy.",
        priority: "high" as const,
        tasks: [
          ["Design a desktop hero and summary layer that frames lease activity without burying core actions", "Create a purposeful top section that introduces the workspace theme and exposes high-value status and action entry points.", "medium"],
          ["Rework desktop record browsing into a more intentional card or structured-list layout", "Replace the plain table treatment with a clearer desktop pattern that still supports rapid scanning of resident, unit, type, and date state.", "large"],
          ["Integrate occupancy creation and onboarding entry points into the redesigned desktop surface", "Ensure the main create flows remain obvious and reachable within the new desktop structure.", "medium"],
          ["Align desktop spacing, typography, surfaces, and motion to the accepted theme", "Apply the new visual system consistently instead of mixing the redesign with leftover legacy page patterns.", "medium"],
        ],
      },
      {
        title: "Mobile Lease Workspace Redesign",
        description: "Build a phone-first version of the workspace that keeps lease actions finishable and readable.",
        priority: "high" as const,
        tasks: [
          ["Design a mobile-first page structure for lease status, records, and actions", "Reorder the workspace for small screens so the primary decision areas appear first and remain reachable without dense stacking.", "large"],
          ["Refactor mobile record presentation into prioritized cards and compact detail rows", "Present resident, unit, type, and date information in a mobile pattern that preserves context without requiring a desktop table.", "medium"],
          ["Make occupancy and onboarding dialogs mobile-safe with single-column progression", "Ensure the create flows fit within the viewport cleanly, remain keyboard-safe, and keep submission actions visible.", "medium"],
          ["Verify touch targets, safe-area spacing, and bottom-of-screen action behavior", "Confirm the redesigned mobile workspace works in realistic phone layouts instead of only shrinking the desktop design.", "small"],
        ],
      },
      {
        title: "Verification, Rollout, And Closure",
        description: "Validate functional parity and reflect execution honestly in the roadmap as chunks land.",
        priority: "high" as const,
        tasks: [
          ["Run desktop and mobile verification for occupancy creation, onboarding intake, and record review", "Exercise the highest-frequency lease workflows after implementation to confirm the redesign preserved functionality.", "medium"],
          ["Capture before and after screenshots for the redesigned lease workspace", "Create a visual record of the redesign for roadmap, executive, and regression review needs.", "small"],
          ["Document any remaining desktop-preferred or deferred lease workflows explicitly", "Leave unresolved gaps visible instead of implying the redesign completed more than it actually did.", "small"],
          ["Update roadmap task status in step with implemented and validated redesign slices", "Use the Admin roadmap as the source of truth while the redesign is executed, moving tasks to in-progress or done only when reality supports it.", "small"],
        ],
      },
    ];

    for (let workstreamIndex = 0; workstreamIndex < workstreamDefinitions.length; workstreamIndex += 1) {
      const workstreamDefinition = workstreamDefinitions[workstreamIndex];
      const [workstream] = await db.insert(roadmapWorkstreams).values({
        projectId: project.id,
        title: workstreamDefinition.title,
        description: workstreamDefinition.description,
        orderIndex: workstreamIndex,
        isCollapsed: 0,
      }).returning();

      await db.insert(roadmapTasks).values(
        workstreamDefinition.tasks.map((taskDefinition) => ({
          projectId: project.id,
          workstreamId: workstream.id,
          title: taskDefinition[0],
          description: taskDefinition[1],
          status: "todo" as const,
          effort: taskDefinition[2],
          priority: workstreamDefinition.priority,
          dependencyTaskIds: [],
        })),
      );
    }

    log("[seed] created roadmap project: Lease And Occupancy Workspace Redesign", "seed");
  }

  // ── Election Seed Data ──────────────────────────────────────────────────────
  // Seeds three elections for Sunset Towers: a certified board election, an open
  // community referendum, and a draft amendment. Plus proxy data on the board election.
  // Idempotent — checks by title before inserting.

  const SUNSET_TOWERS_ID = "e60c349e-b14e-48fa-a72e-8af3c2180c74";

  // Look up Sunset Towers persons and units for ballot token generation
  const stUnits = await db.select().from(units).where(eq(units.associationId, SUNSET_TOWERS_ID));
  const stOwnerships = await db.select().from(ownerships).where(
    sql`${ownerships.unitId} IN (SELECT id FROM units WHERE association_id = ${SUNSET_TOWERS_ID})`
  );
  // Deduplicate person IDs from ownerships
  const stOwnerPersonIds = Array.from(new Set(stOwnerships.map(o => o.personId)));
  const stPersons = stOwnerPersonIds.length > 0
    ? await db.select().from(persons).where(
        sql`${persons.id} IN (${sql.join(stOwnerPersonIds.map(id => sql`${id}`), sql`, `)})`
      )
    : [];

  // Build a unit-to-owner map for ballot tokens
  const unitOwnerMap: { unitId: string; personId: string }[] = stOwnerships.map(o => ({
    unitId: o.unitId, personId: o.personId,
  }));

  // ── 4.1: Certified Board Election ──
  const [existingBoardElection] = await db.select().from(elections)
    .where(and(eq(elections.associationId, SUNSET_TOWERS_ID), eq(elections.title, "2025 Annual Board Election")));

  if (!existingBoardElection && stPersons.length > 0 && stUnits.length > 0) {
    const boardElectionOpensAt = new Date("2025-11-01T09:00:00Z");
    const boardElectionClosesAt = new Date("2025-11-15T17:00:00Z");
    const boardElectionCertifiedAt = new Date("2025-11-16T10:00:00Z");

    const [boardElection] = await db.insert(elections).values({
      associationId: SUNSET_TOWERS_ID,
      title: "2025 Annual Board Election",
      description: "Annual election to fill three open seats on the Sunset Towers Board of Directors. Candidates were nominated at the October general meeting.",
      voteType: "board-election",
      votingRule: "unit-weighted",
      isSecretBallot: 0,
      resultVisibility: "public",
      status: "certified",
      opensAt: boardElectionOpensAt,
      closesAt: boardElectionClosesAt,
      quorumPercent: 50,
      maxChoices: 3,
      eligibleVoterCount: unitOwnerMap.length,
      certifiedBy: "Board Secretary",
      certifiedAt: boardElectionCertifiedAt,
      createdBy: "seed",
    }).returning();

    // 4 candidate options
    const boardCandidates = await db.insert(electionOptions).values([
      { electionId: boardElection.id, label: "Maria Gonzalez", description: "Current Board President, running for re-election. 5 years of service.", orderIndex: 0 },
      { electionId: boardElection.id, label: "James Chen", description: "Current Treasurer, seeking a second term. CPA with 15 years experience.", orderIndex: 1 },
      { electionId: boardElection.id, label: "David Kim", description: "Unit 102 tenant representative. Active in community events for 3 years.", orderIndex: 2 },
      { electionId: boardElection.id, label: "Angela Torres", description: "New candidate. Former property manager with 10 years industry experience.", orderIndex: 3 },
    ]).returning();

    // Ballot tokens for all unit owners — ~70% cast
    const boardTokens: (typeof electionBallotTokens.$inferInsert)[] = [];
    for (const ownership of unitOwnerMap) {
      const token = randomBytes(32).toString("hex");
      boardTokens.push({
        electionId: boardElection.id,
        token,
        personId: String(ownership.personId),
        unitId: String(ownership.unitId),
        status: "pending",
      });
    }
    const insertedBoardTokens = await db.insert(electionBallotTokens).values(boardTokens).returning();

    // Cast ~70% of ballots with realistic vote distribution
    const castCount = Math.max(1, Math.round(insertedBoardTokens.length * 0.7));
    const boardCasts: (typeof electionBallotCasts.$inferInsert)[] = [];
    for (let i = 0; i < castCount; i++) {
      const tok = insertedBoardTokens[i];
      // Vary choices: first voter picks candidates 0,1,3; second picks 0,2; third picks 1,2,3; etc.
      const choicePatterns = [
        [boardCandidates[0].id, boardCandidates[1].id, boardCandidates[3].id],
        [boardCandidates[0].id, boardCandidates[2].id],
        [boardCandidates[1].id, boardCandidates[2].id, boardCandidates[3].id],
        [boardCandidates[0].id, boardCandidates[1].id, boardCandidates[2].id],
      ];
      const choices = choicePatterns[i % choicePatterns.length];
      const stUnit = stUnits.find(u => String(u.id) === String(tok.unitId));
      const weight = stUnit?.squareFootage ? stUnit.squareFootage / 1000 : 1;

      boardCasts.push({
        electionId: boardElection.id,
        ballotTokenId: tok.id,
        personId: tok.personId,
        unitId: tok.unitId,
        choicesJson: choices,
        voteWeight: weight,
        isProxy: 0,
        confirmationRef: randomBytes(8).toString("hex").toUpperCase(),
      });

      // Update token status to cast
      await db.update(electionBallotTokens)
        .set({ status: "cast" as const, castAt: new Date(boardElectionOpensAt.getTime() + (i + 1) * 3600000) })
        .where(eq(electionBallotTokens.id, tok.id));
    }
    if (boardCasts.length > 0) {
      await db.insert(electionBallotCasts).values(boardCasts);
    }

    // ── 4.4: Proxy seed data on board election ──
    if (stPersons.length >= 2 && unitOwnerMap.length >= 2) {
      // Active proxy: second person designated first person as proxy (and proxy voted)
      const proxyOwner = stPersons[1]; // James Chen
      const proxyHolder = stPersons[0]; // Maria Gonzalez
      const proxyOwnerUnit = unitOwnerMap.find(o => String(o.personId) === String(proxyOwner.id));

      await db.insert(electionProxyDesignations).values({
        electionId: boardElection.id,
        ownerPersonId: String(proxyOwner.id),
        ownerUnitId: proxyOwnerUnit ? String(proxyOwnerUnit.unitId) : null,
        proxyPersonId: String(proxyHolder.id),
        designatedAt: new Date("2025-10-28T14:00:00Z"),
        notes: "Proxy designated via email authorization prior to voting period.",
      }).onConflictDoNothing();

      // Revoked proxy: if we have a third person, designate then revoke
      if (stPersons.length >= 3) {
        const revokedOwner = stPersons[2]; // e.g. Sarah Williams (cross-association but valid person)
        const revokedOwnerUnit = unitOwnerMap.find(o => String(o.personId) === String(revokedOwner.id));
        await db.insert(electionProxyDesignations).values({
          electionId: boardElection.id,
          ownerPersonId: String(revokedOwner.id),
          ownerUnitId: revokedOwnerUnit ? String(revokedOwnerUnit.unitId) : null,
          proxyPersonId: String(proxyHolder.id),
          designatedAt: new Date("2025-10-25T10:00:00Z"),
          revokedAt: new Date("2025-10-30T16:00:00Z"),
          notes: "Owner revoked proxy designation before voting opened.",
        }).onConflictDoNothing();
      }

      // Proxy document
      await db.insert(electionProxyDocuments).values({
        electionId: boardElection.id,
        ownerPersonId: String(proxyOwner.id),
        ownerUnitId: proxyOwnerUnit ? String(proxyOwnerUnit.unitId) : null,
        fileUrl: "/documents/proxy-forms/2025-board-election-chen-proxy.pdf",
        title: "Proxy Authorization — James Chen for 2025 Board Election",
        uploadedBy: "seed",
      });
    }

    log(`[seed] elections :: board election created with ${insertedBoardTokens.length} tokens, ${boardCasts.length} cast, proxy data seeded`, "seed");
  } else if (existingBoardElection) {
    log("[seed] elections :: board election already exists, skipping", "seed");
  }

  // ── 4.2: Open Community Referendum ──
  const [existingReferendum] = await db.select().from(elections)
    .where(and(eq(elections.associationId, SUNSET_TOWERS_ID), eq(elections.title, "Pool Renovation Budget Approval")));

  if (!existingReferendum && stPersons.length > 0 && stUnits.length > 0) {
    const refOpensAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const refClosesAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    const [referendum] = await db.insert(elections).values({
      associationId: SUNSET_TOWERS_ID,
      title: "Pool Renovation Budget Approval",
      description: "Community vote to approve the $85,000 pool renovation budget. Funding would come from the reserve fund with a special assessment of $500 per unit to cover the shortfall.",
      voteType: "community-referendum",
      votingRule: "unit-weighted",
      isSecretBallot: 1,
      resultVisibility: "public",
      status: "open",
      opensAt: refOpensAt,
      closesAt: refClosesAt,
      quorumPercent: 50,
      maxChoices: 1,
      eligibleVoterCount: unitOwnerMap.length,
      createdBy: "seed",
    }).returning();

    // 3 options
    const refOptions = await db.insert(electionOptions).values([
      { electionId: referendum.id, label: "Approve Full Budget ($85,000)", description: "Approve the complete renovation plan including new filtration system, resurfacing, and deck expansion.", orderIndex: 0 },
      { electionId: referendum.id, label: "Approve Reduced Scope ($52,000)", description: "Approve only essential repairs: filtration replacement and basic resurfacing. No deck expansion.", orderIndex: 1 },
      { electionId: referendum.id, label: "Reject — Defer to Next Year", description: "Reject the renovation proposal and revisit during the 2026 budget cycle.", orderIndex: 2 },
    ]).returning();

    // Ballot tokens for all unit owners
    const refTokens: (typeof electionBallotTokens.$inferInsert)[] = [];
    for (const ownership of unitOwnerMap) {
      refTokens.push({
        electionId: referendum.id,
        token: randomBytes(32).toString("hex"),
        personId: String(ownership.personId),
        unitId: String(ownership.unitId),
        status: "pending",
      });
    }
    const insertedRefTokens = await db.insert(electionBallotTokens).values(refTokens).returning();

    // ~40% cast
    const refCastCount = Math.max(1, Math.round(insertedRefTokens.length * 0.4));
    const refCasts: (typeof electionBallotCasts.$inferInsert)[] = [];
    for (let i = 0; i < refCastCount; i++) {
      const tok = insertedRefTokens[i];
      // Secret ballot: choicesJson is null for anonymization, but we store it for seed demo visibility
      const optionIdx = i % refOptions.length;
      const stUnit = stUnits.find(u => String(u.id) === String(tok.unitId));
      const weight = stUnit?.squareFootage ? stUnit.squareFootage / 1000 : 1;

      refCasts.push({
        electionId: referendum.id,
        ballotTokenId: tok.id,
        personId: null, // secret ballot — anonymized
        unitId: null,   // secret ballot — anonymized
        choicesJson: [refOptions[optionIdx].id],
        voteWeight: weight,
        isProxy: 0,
        confirmationRef: randomBytes(8).toString("hex").toUpperCase(),
      });

      await db.update(electionBallotTokens)
        .set({ status: "cast" as const, castAt: new Date(refOpensAt.getTime() + (i + 1) * 7200000) })
        .where(eq(electionBallotTokens.id, tok.id));
    }
    if (refCasts.length > 0) {
      await db.insert(electionBallotCasts).values(refCasts);
    }

    log(`[seed] elections :: referendum created with ${insertedRefTokens.length} tokens, ${refCasts.length} cast`, "seed");
  } else if (existingReferendum) {
    log("[seed] elections :: referendum already exists, skipping", "seed");
  }

  // ── 4.3: Draft Amendment ──
  const [existingAmendment] = await db.select().from(elections)
    .where(and(eq(elections.associationId, SUNSET_TOWERS_ID), eq(elections.title, "Amendment to Pet Policy — Section 4.2")));

  if (!existingAmendment) {
    const [amendment] = await db.insert(elections).values({
      associationId: SUNSET_TOWERS_ID,
      title: "Amendment to Pet Policy — Section 4.2",
      description: "Proposed amendment to allow up to two pets per unit (currently limited to one) and remove the breed-specific restrictions in Section 4.2 of the community bylaws.",
      voteType: "amendment-ratification",
      votingRule: "person-weighted",
      isSecretBallot: 0,
      resultVisibility: "public",
      status: "draft",
      quorumPercent: 67,
      maxChoices: 1,
      eligibleVoterCount: 0, // not yet determined
      createdBy: "seed",
    }).returning();

    // 2 options — no tokens generated for draft
    await db.insert(electionOptions).values([
      { electionId: amendment.id, label: "Approve", description: "Ratify the proposed amendment to Section 4.2, effective 30 days after certification.", orderIndex: 0 },
      { electionId: amendment.id, label: "Reject", description: "Reject the proposed amendment. Current pet policy remains unchanged.", orderIndex: 1 },
    ]);

    log("[seed] elections :: draft amendment created (no tokens for draft status)", "seed");
  } else {
    log("[seed] elections :: draft amendment already exists, skipping", "seed");
  }

  // ── 5: Vendors ──
  const CHERRY_HILL_ASSOC_ID = "f301d073-ed84-4d73-84ce-3ef28af66f7a";
  const [existingVendor] = await db.select().from(vendors)
    .where(eq(vendors.associationId, CHERRY_HILL_ASSOC_ID));

  if (!existingVendor) {
    await db.insert(vendors).values([
      {
        id: "a1b2c3d4-0001-4000-8000-000000000001",
        associationId: CHERRY_HILL_ASSOC_ID,
        name: "Northeast HVAC Services",
        trade: "hvac",
        primaryContactName: "Rick Morales",
        primaryEmail: "rick@northeasthvac.com",
        primaryPhone: "(203) 555-0181",
        licenseNumber: "HVAC-CT-20847",
        status: "active",
        notes: "Preferred vendor for all HVAC work. 24/7 emergency line available.",
      },
      {
        id: "a1b2c3d4-0001-4000-8000-000000000002",
        associationId: CHERRY_HILL_ASSOC_ID,
        name: "Harbor Plumbing Co.",
        trade: "plumbing",
        primaryContactName: "Sandra Leung",
        primaryEmail: "sandra@harborplumbing.com",
        primaryPhone: "(203) 555-0242",
        licenseNumber: "PLB-CT-11934",
        status: "active",
        notes: "Licensed and insured. Handles both emergency and scheduled work.",
      },
      {
        id: "a1b2c3d4-0001-4000-8000-000000000003",
        associationId: CHERRY_HILL_ASSOC_ID,
        name: "Greenscape Landscaping",
        trade: "landscaping",
        primaryContactName: "Tom Ferrara",
        primaryEmail: "tom@greenscapect.com",
        primaryPhone: "(203) 555-0317",
        licenseNumber: null,
        status: "active",
        notes: "Seasonal contract for lawn care and snow removal.",
      },
      {
        id: "a1b2c3d4-0001-4000-8000-000000000004",
        associationId: CHERRY_HILL_ASSOC_ID,
        name: "Brightline Electrical",
        trade: "electrical",
        primaryContactName: "Denise Park",
        primaryEmail: "denise@brightlineelectric.com",
        primaryPhone: "(203) 555-0409",
        licenseNumber: "ELC-CT-58821",
        status: "pending-renewal",
        notes: "Insurance renewal pending. Do not dispatch until confirmed active.",
      },
      {
        id: "a1b2c3d4-0001-4000-8000-000000000005",
        associationId: CHERRY_HILL_ASSOC_ID,
        name: "ProClean Janitorial",
        trade: "cleaning",
        primaryContactName: "Miguel Santos",
        primaryEmail: "miguel@procleanct.com",
        primaryPhone: "(203) 555-0563",
        licenseNumber: null,
        status: "active",
        notes: "Weekly common-area cleaning. Key fob access on file.",
      },
    ]).onConflictDoNothing();
    log("[seed] vendors :: 5 Cherry Hill vendors inserted", "seed");
  } else {
    log("[seed] vendors :: already exist, skipping", "seed");
  }

  // ── 6: Work Orders ──
  const [existingWorkOrder] = await db.select().from(workOrders)
    .where(eq(workOrders.associationId, CHERRY_HILL_ASSOC_ID));

  if (!existingWorkOrder) {
    const workOrderRows: (typeof workOrders.$inferInsert)[] = [
      {
        id: "w0000001-0000-4000-8000-000000000001",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: "7adb3521-845b-41de-8054-3281ddfc0f3c", // 1415-A
        vendorId: "a1b2c3d4-0001-4000-8000-000000000001", // Northeast HVAC
        title: "HVAC unit making loud noise",
        description: "Unit 1415-A resident reports the HVAC system produces a loud rattling sound during startup. Suspected loose fan housing.",
        locationText: "Unit 1415-A — HVAC closet",
        category: "hvac",
        priority: "high",
        status: "in-progress",
        assignedTo: "Northeast HVAC Services",
        estimatedCost: 320,
        scheduledFor: new Date("2026-04-14T09:00:00Z"),
        startedAt: new Date("2026-04-14T09:30:00Z"),
        vendorNotes: "Fan blade loose. Parts ordered — ETA 2 days.",
      },
      {
        id: "w0000001-0000-4000-8000-000000000002",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: null, // common area
        vendorId: "a1b2c3d4-0001-4000-8000-000000000002", // Harbor Plumbing
        title: "Lobby ceiling water stain",
        description: "Water stain visible on lobby ceiling near unit 1417-B. Possible slow leak from upstairs bathroom. Needs inspection and repair.",
        locationText: "1417 Building — Lobby ceiling",
        category: "plumbing",
        priority: "urgent",
        status: "assigned",
        assignedTo: "Harbor Plumbing Co.",
        estimatedCost: 750,
        scheduledFor: new Date("2026-04-11T08:00:00Z"),
        vendorNotes: "Will inspect and identify source on arrival.",
      },
      {
        id: "w0000001-0000-4000-8000-000000000003",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: null, // common area
        vendorId: "a1b2c3d4-0001-4000-8000-000000000004", // Brightline Electrical
        title: "Parking lot light out",
        description: "Exterior light pole #3 in the 1421 parking lot is not functioning. Bulb or ballast replacement required.",
        locationText: "1421 parking lot — light pole #3",
        category: "electrical",
        priority: "medium",
        status: "open",
        assignedTo: null,
        estimatedCost: null,
        resolutionNotes: null,
        vendorNotes: "Brightline insurance renewal pending. Assign once status confirmed.",
      },
      {
        id: "w0000001-0000-4000-8000-000000000004",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: "34575428-ea77-4013-bd0f-593e0c7dbbbb", // 1417-A
        vendorId: "a1b2c3d4-0001-4000-8000-000000000002", // Harbor Plumbing
        title: "Slow drain in bathroom sink",
        description: "Unit 1417-A reports bathroom sink draining very slowly. Likely blockage in P-trap.",
        locationText: "Unit 1417-A — bathroom sink",
        category: "plumbing",
        priority: "low",
        status: "closed",
        assignedTo: "Harbor Plumbing Co.",
        estimatedCost: 150,
        actualCost: 125,
        scheduledFor: new Date("2026-03-20T10:00:00Z"),
        startedAt: new Date("2026-03-20T10:15:00Z"),
        completedAt: new Date("2026-03-20T11:00:00Z"),
        resolutionNotes: "P-trap cleared. No structural damage found.",
      },
      {
        id: "w0000001-0000-4000-8000-000000000005",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: null, // common area
        vendorId: "a1b2c3d4-0001-4000-8000-000000000003", // Greenscape
        title: "Overgrown hedges blocking walkway",
        description: "Hedges along 1419 entrance walkway have grown over the path. Safety hazard for residents and visitors.",
        locationText: "1419 Building — front entrance walkway",
        category: "landscaping",
        priority: "medium",
        status: "closed",
        assignedTo: "Greenscape Landscaping",
        estimatedCost: 200,
        actualCost: 180,
        scheduledFor: new Date("2026-03-15T07:00:00Z"),
        startedAt: new Date("2026-03-15T07:30:00Z"),
        completedAt: new Date("2026-03-15T09:00:00Z"),
        resolutionNotes: "Hedges trimmed back 18 inches. Walkway fully clear.",
      },
      {
        id: "w0000001-0000-4000-8000-000000000006",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: null, // common area
        vendorId: "a1b2c3d4-0001-4000-8000-000000000005", // ProClean
        title: "Graffiti on stairwell wall",
        description: "Graffiti found on the 1421 B-stairwell wall between floors 1 and 2. Needs cleaning or repainting.",
        locationText: "1421 Building — B stairwell, floors 1–2",
        category: "cleaning",
        priority: "high",
        status: "assigned",
        assignedTo: "ProClean Janitorial",
        estimatedCost: 275,
        scheduledFor: new Date("2026-04-12T08:00:00Z"),
        vendorNotes: "Will assess whether chemical cleaning or paint touch-up is needed.",
      },
      {
        id: "w0000001-0000-4000-8000-000000000007",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: "bfa54c14-9fcd-4ed4-a810-61f193aa7d4b", // 1421-A
        vendorId: null,
        title: "Entry door lock sticking",
        description: "Unit 1421-A reports the front door deadbolt is difficult to turn. May need lubrication or lock cylinder replacement.",
        locationText: "Unit 1421-A — front door deadbolt",
        category: "general",
        priority: "medium",
        status: "open",
        assignedTo: null,
        estimatedCost: null,
      },
      {
        id: "w0000001-0000-4000-8000-000000000008",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: null, // common area
        vendorId: "a1b2c3d4-0001-4000-8000-000000000001", // Northeast HVAC
        title: "Boiler room annual inspection",
        description: "Annual inspection of the shared boiler system for buildings 1415 and 1417. Required per CT state code before May 1.",
        locationText: "1415/1417 shared boiler room — basement",
        category: "hvac",
        priority: "high",
        status: "closed",
        assignedTo: "Northeast HVAC Services",
        estimatedCost: 500,
        actualCost: 500,
        scheduledFor: new Date("2026-03-28T09:00:00Z"),
        startedAt: new Date("2026-03-28T09:10:00Z"),
        completedAt: new Date("2026-03-28T12:00:00Z"),
        resolutionNotes: "Boiler passed inspection. Certificate on file. Minor sediment flush performed at no extra charge.",
        vendorEstimatedCompletionDate: new Date("2026-03-28T12:00:00Z"),
      },
    ];
    await db.insert(workOrders).values(workOrderRows).onConflictDoNothing();
    log("[seed] work orders :: 8 Cherry Hill work orders inserted", "seed");
  } else {
    log("[seed] work orders :: already exist, skipping", "seed");
  }

  // ── Insurance Policies ──────────────────────────────────────────────────────
  const existingPolicies = await db
    .select()
    .from(associationInsurancePolicies)
    .where(eq(associationInsurancePolicies.associationId, CHERRY_HILL_ASSOC_ID));

  if (existingPolicies.length === 0) {
    const policyRows = [
      {
        id: "ins00001-0000-4000-8000-000000000001",
        associationId: CHERRY_HILL_ASSOC_ID,
        policyType: "master" as const,
        carrier: "Hartford Fire Insurance",
        policyNumber: "HFI-2026-CH-00142",
        effectiveDate: new Date("2026-01-01T00:00:00Z"),
        expirationDate: new Date("2027-01-01T00:00:00Z"),
        premiumAmount: 12500,
        coverageAmount: 5000000,
        notes: "Master property policy covering all buildings and common areas. Replacement cost coverage.",
      },
      {
        id: "ins00001-0000-4000-8000-000000000002",
        associationId: CHERRY_HILL_ASSOC_ID,
        policyType: "d-and-o" as const,
        carrier: "Chubb Group",
        policyNumber: "CHUBB-DO-2026-8831",
        effectiveDate: new Date("2026-01-01T00:00:00Z"),
        expirationDate: new Date("2027-01-01T00:00:00Z"),
        premiumAmount: 4200,
        coverageAmount: 2000000,
        notes: "Directors & Officers liability policy covering board members for management decisions.",
      },
      {
        id: "ins00001-0000-4000-8000-000000000003",
        associationId: CHERRY_HILL_ASSOC_ID,
        policyType: "umbrella" as const,
        carrier: "Zurich Insurance",
        policyNumber: "ZNA-UMB-2026-44019",
        effectiveDate: new Date("2026-01-01T00:00:00Z"),
        expirationDate: new Date("2027-01-01T00:00:00Z"),
        premiumAmount: 8000,
        coverageAmount: 10000000,
        notes: "Commercial umbrella policy providing excess coverage above primary liability limits.",
      },
      {
        id: "ins00001-0000-4000-8000-000000000004",
        associationId: CHERRY_HILL_ASSOC_ID,
        policyType: "flood" as const,
        carrier: "NFIP via Wright Flood",
        policyNumber: "NFIP-WF-2026-CH-7723",
        effectiveDate: new Date("2026-01-01T00:00:00Z"),
        expirationDate: new Date("2027-01-01T00:00:00Z"),
        premiumAmount: 3100,
        coverageAmount: 500000,
        notes: "National Flood Insurance Program policy administered through Wright Flood. Covers basement and ground-floor common areas.",
      },
    ];
    await db.insert(associationInsurancePolicies).values(policyRows).onConflictDoNothing();
    log("[seed] insurance policies :: 4 Cherry Hill policies inserted", "seed");
  } else {
    log("[seed] insurance policies :: already exist, skipping", "seed");
  }

  // ── Inspection Records ───────────────────────────────────────────────────────
  const existingInspections = await db
    .select()
    .from(inspectionRecords)
    .where(eq(inspectionRecords.associationId, CHERRY_HILL_ASSOC_ID));

  if (existingInspections.length === 0) {
    const inspectionRows = [
      {
        id: "insp0001-0000-4000-8000-000000000001",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: null,
        locationType: "common-area" as const,
        locationText: "All buildings — common corridors, stairwells, and mechanical rooms",
        inspectionType: "fire-safety",
        inspectorName: "Robert Fielding, CT Fire Marshal",
        overallCondition: "good" as const,
        summary: "Annual fire safety inspection completed. All extinguishers current, exit signs functional, sprinkler heads clear. No deficiencies noted.",
        inspectedAt: new Date("2026-02-14T10:00:00Z"),
        findingsJson: [],
      },
      {
        id: "insp0001-0000-4000-8000-000000000002",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: null,
        locationType: "building" as const,
        locationText: "1417 Cherry Hill Dr — elevator cab and machine room",
        inspectionType: "elevator",
        inspectorName: "Otis Elevator Services / CT DOLS Inspector",
        overallCondition: "good" as const,
        summary: "Annual elevator inspection passed. Certificate of operation issued. Minor note: door re-open sensitivity adjusted on-site during inspection.",
        inspectedAt: new Date("2026-01-22T09:30:00Z"),
        findingsJson: [
          {
            severity: "low",
            description: "Door re-open sensitivity slightly slow on ground floor",
            status: "resolved",
            resolvedNote: "Adjusted on-site by inspector. Retested and confirmed passing.",
          },
        ],
      },
      {
        id: "insp0001-0000-4000-8000-000000000003",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: null,
        locationType: "building" as const,
        locationText: "1415 and 1417 Cherry Hill Dr — roof decks and flashings",
        inspectionType: "roof-condition",
        inspectorName: "Summit Roofing Consultants",
        overallCondition: "fair" as const,
        summary: "Roof condition assessment found moderate granule loss on the 1415 building flat section and cracked flashing at two HVAC penetrations. Recommend repair within 6 months to prevent water intrusion.",
        inspectedAt: new Date("2026-03-05T13:00:00Z"),
        findingsJson: [
          {
            severity: "medium",
            description: "Moderate granule loss on 1415 flat roof membrane — approx 400 sq ft affected",
            status: "open",
          },
          {
            severity: "medium",
            description: "Cracked step flashing at two HVAC roof penetrations on 1417",
            status: "open",
          },
        ],
      },
      {
        id: "insp0001-0000-4000-8000-000000000004",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: null,
        locationType: "common-area" as const,
        locationText: "Underground parking garage — levels P1 and P2",
        inspectionType: "structural",
        inspectorName: "Greenfield Structural Engineers",
        overallCondition: "good" as const,
        summary: "Parking garage structural inspection scheduled for Q2 2026. Pre-inspection documentation review completed. No prior structural concerns on record.",
        inspectedAt: new Date("2026-04-20T09:00:00Z"),
        findingsJson: [],
      },
      {
        id: "insp0001-0000-4000-8000-000000000005",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: null,
        locationType: "common-area" as const,
        locationText: "Pool deck, fitness room, and lobby — main common areas",
        inspectionType: "health-and-safety",
        inspectorName: "Hartford County Health Department",
        overallCondition: "excellent" as const,
        summary: "Pool and common area health inspection passed with no violations. Water chemistry within range, deck surfaces clean and non-slip, fitness equipment sanitized. Certificate posted.",
        inspectedAt: new Date("2026-03-18T11:00:00Z"),
        findingsJson: [],
      },
    ];
    await db.insert(inspectionRecords).values(inspectionRows).onConflictDoNothing();
    log("[seed] inspection records :: 5 Cherry Hill inspections inserted", "seed");
  } else {
    log("[seed] inspection records :: already exist, skipping", "seed");
  }

  // ── Maintenance Schedule Templates ──────────────────────────────────────────
  const existingMaintTemplates = await db
    .select()
    .from(maintenanceScheduleTemplates)
    .where(eq(maintenanceScheduleTemplates.associationId, CHERRY_HILL_ASSOC_ID));

  if (existingMaintTemplates.length === 0) {
    const maintTemplateRows = [
      {
        id: "maint001-0000-4000-8000-000000000001",
        associationId: CHERRY_HILL_ASSOC_ID,
        title: "HVAC Filter Replacement",
        component: "HVAC",
        description: "Replace air handler filters in all mechanical rooms and rooftop units. Check and clean condensate drains.",
        locationText: "Mechanical rooms — 1415 basement and 1417 basement; rooftop units",
        frequencyUnit: "quarter" as const,
        frequencyInterval: 1,
        responsibleParty: "Facilities Manager",
        autoCreateWorkOrder: 0,
        nextDueAt: new Date("2026-07-01T08:00:00Z"),
        status: "active" as const,
      },
      {
        id: "maint001-0000-4000-8000-000000000002",
        associationId: CHERRY_HILL_ASSOC_ID,
        title: "Fire Extinguisher Inspection",
        component: "Fire Safety",
        description: "Annual inspection of all portable fire extinguishers per NFPA 10. Tag, document, and recharge or replace as needed.",
        locationText: "All common area corridors, mechanical rooms, garage, and lobby",
        frequencyUnit: "year" as const,
        frequencyInterval: 1,
        responsibleParty: "Licensed Fire Safety Vendor",
        autoCreateWorkOrder: 1,
        nextDueAt: new Date("2027-01-15T09:00:00Z"),
        status: "active" as const,
      },
      {
        id: "maint001-0000-4000-8000-000000000003",
        associationId: CHERRY_HILL_ASSOC_ID,
        title: "Common Area Deep Clean",
        component: "Cleaning",
        description: "Monthly deep cleaning of lobby, hallways, laundry rooms, and fitness center. Includes carpet extraction, floor scrubbing, and window cleaning.",
        locationText: "Lobby, 1415 and 1417 corridors, laundry rooms, fitness center",
        frequencyUnit: "month" as const,
        frequencyInterval: 1,
        responsibleParty: "Cleaning Contractor",
        autoCreateWorkOrder: 0,
        nextDueAt: new Date("2026-05-01T07:00:00Z"),
        status: "active" as const,
      },
    ];
    await db.insert(maintenanceScheduleTemplates).values(maintTemplateRows).onConflictDoNothing();
    log("[seed] maintenance schedule templates :: 3 Cherry Hill templates inserted", "seed");
  } else {
    log("[seed] maintenance schedule templates :: already exist, skipping", "seed");
  }

  // ── Maintenance Schedule Instances ──────────────────────────────────────────
  const existingMaintInstances = await db
    .select()
    .from(maintenanceScheduleInstances)
    .where(eq(maintenanceScheduleInstances.associationId, CHERRY_HILL_ASSOC_ID));

  if (existingMaintInstances.length === 0) {
    const maintInstanceRows = [
      // HVAC Filter Replacement instances
      {
        id: "minst001-0000-4000-8000-000000000001",
        templateId: "maint001-0000-4000-8000-000000000001",
        associationId: CHERRY_HILL_ASSOC_ID,
        title: "HVAC Filter Replacement — Q1 2026",
        component: "HVAC",
        locationText: "Mechanical rooms — 1415 basement and 1417 basement; rooftop units",
        dueAt: new Date("2026-01-15T08:00:00Z"),
        status: "completed" as const,
      },
      {
        id: "minst001-0000-4000-8000-000000000002",
        templateId: "maint001-0000-4000-8000-000000000001",
        associationId: CHERRY_HILL_ASSOC_ID,
        title: "HVAC Filter Replacement — Q2 2026",
        component: "HVAC",
        locationText: "Mechanical rooms — 1415 basement and 1417 basement; rooftop units",
        dueAt: new Date("2026-04-15T08:00:00Z"),
        status: "due" as const,
      },
      {
        id: "minst001-0000-4000-8000-000000000003",
        templateId: "maint001-0000-4000-8000-000000000001",
        associationId: CHERRY_HILL_ASSOC_ID,
        title: "HVAC Filter Replacement — Q3 2026",
        component: "HVAC",
        locationText: "Mechanical rooms — 1415 basement and 1417 basement; rooftop units",
        dueAt: new Date("2026-07-01T08:00:00Z"),
        status: "scheduled" as const,
      },
      // Fire Extinguisher Inspection instances
      {
        id: "minst001-0000-4000-8000-000000000004",
        templateId: "maint001-0000-4000-8000-000000000002",
        associationId: CHERRY_HILL_ASSOC_ID,
        title: "Fire Extinguisher Inspection — Annual 2026",
        component: "Fire Safety",
        locationText: "All common area corridors, mechanical rooms, garage, and lobby",
        dueAt: new Date("2026-01-15T09:00:00Z"),
        status: "completed" as const,
      },
      {
        id: "minst001-0000-4000-8000-000000000005",
        templateId: "maint001-0000-4000-8000-000000000002",
        associationId: CHERRY_HILL_ASSOC_ID,
        title: "Fire Extinguisher Inspection — Annual 2027",
        component: "Fire Safety",
        locationText: "All common area corridors, mechanical rooms, garage, and lobby",
        dueAt: new Date("2027-01-15T09:00:00Z"),
        status: "scheduled" as const,
      },
      // Common Area Deep Clean instances
      {
        id: "minst001-0000-4000-8000-000000000006",
        templateId: "maint001-0000-4000-8000-000000000003",
        associationId: CHERRY_HILL_ASSOC_ID,
        title: "Common Area Deep Clean — March 2026",
        component: "Cleaning",
        locationText: "Lobby, 1415 and 1417 corridors, laundry rooms, fitness center",
        dueAt: new Date("2026-03-01T07:00:00Z"),
        status: "completed" as const,
      },
      {
        id: "minst001-0000-4000-8000-000000000007",
        templateId: "maint001-0000-4000-8000-000000000003",
        associationId: CHERRY_HILL_ASSOC_ID,
        title: "Common Area Deep Clean — April 2026",
        component: "Cleaning",
        locationText: "Lobby, 1415 and 1417 corridors, laundry rooms, fitness center",
        dueAt: new Date("2026-04-01T07:00:00Z"),
        status: "due" as const,
      },
      {
        id: "minst001-0000-4000-8000-000000000008",
        templateId: "maint001-0000-4000-8000-000000000003",
        associationId: CHERRY_HILL_ASSOC_ID,
        title: "Common Area Deep Clean — May 2026",
        component: "Cleaning",
        locationText: "Lobby, 1415 and 1417 corridors, laundry rooms, fitness center",
        dueAt: new Date("2026-05-01T07:00:00Z"),
        status: "scheduled" as const,
      },
    ];
    await db.insert(maintenanceScheduleInstances).values(maintInstanceRows).onConflictDoNothing();
    log("[seed] maintenance schedule instances :: 8 Cherry Hill instances inserted", "seed");
  } else {
    log("[seed] maintenance schedule instances :: already exist, skipping", "seed");
  }

  // ── Governance Meetings ──────────────────────────────────────────────────────
  const existingMeetings = await db
    .select()
    .from(governanceMeetings)
    .where(eq(governanceMeetings.associationId, CHERRY_HILL_ASSOC_ID));

  if (existingMeetings.length === 0) {
    const meetingRows = [
      {
        id: "meet0001-0000-4000-8000-000000000001",
        associationId: CHERRY_HILL_ASSOC_ID,
        meetingType: "annual",
        title: "Annual Board Meeting",
        scheduledAt: new Date("2026-01-20T18:00:00Z"),
        location: "Cherry Hill Court Community Room, 1415 Quinnipiac Ave., New Haven, CT",
        status: "completed" as const,
        agenda: "1. Call to order\n2. Approval of prior meeting minutes\n3. President's report\n4. Treasurer's financial report — FY2025 actuals\n5. Election of board officers\n6. Approval of FY2026 operating budget\n7. Resident open forum\n8. Adjournment",
        notes: "Quorum achieved with 14 of 22 unit owners present or represented by proxy. Budget approved 12-2. All incumbent officers re-elected by acclamation.",
        summaryStatus: "published" as const,
      },
      {
        id: "meet0001-0000-4000-8000-000000000002",
        associationId: CHERRY_HILL_ASSOC_ID,
        meetingType: "special",
        title: "Budget Review Special Meeting",
        scheduledAt: new Date("2026-02-10T18:30:00Z"),
        location: "Cherry Hill Court Community Room, 1415 Quinnipiac Ave., New Haven, CT",
        status: "completed" as const,
        agenda: "1. Call to order\n2. Review of Q4 2025 reserve fund expenditures\n3. Discussion of proposed Q1 2026 capital reserve contribution increase\n4. Vote on reserve contribution amendment\n5. Adjournment",
        notes: "Special meeting called to address reserve fund shortfall identified after year-end audit. Reserve contribution increased by $15/unit/month effective March 2026. Vote: 10 in favor, 2 opposed, 1 abstention.",
        summaryStatus: "published" as const,
      },
      {
        id: "meet0001-0000-4000-8000-000000000003",
        associationId: CHERRY_HILL_ASSOC_ID,
        meetingType: "emergency",
        title: "Emergency Meeting — Roof Repair Authorization",
        scheduledAt: new Date("2026-03-03T19:00:00Z"),
        location: "Virtual — Zoom (link distributed via email)",
        status: "completed" as const,
        agenda: "1. Call to order\n2. Roof inspection findings summary (Building Inspector Frank Almeida)\n3. Review of three contractor bids\n4. Vote to authorize emergency roof repair contract\n5. Discussion of special assessment options\n6. Adjournment",
        notes: "Emergency meeting convened following February storm damage. Board authorized contract with Summit Roofing LLC ($28,400) for flashing repairs and membrane patching. Special assessment of $500/unit approved to fund repair, payable over two installments.",
        summaryStatus: "published" as const,
      },
      {
        id: "meet0001-0000-4000-8000-000000000004",
        associationId: CHERRY_HILL_ASSOC_ID,
        meetingType: "regular",
        title: "Q2 Board Meeting",
        scheduledAt: new Date("2026-05-19T18:00:00Z"),
        location: "Cherry Hill Court Community Room, 1415 Quinnipiac Ave., New Haven, CT",
        status: "scheduled" as const,
        agenda: "1. Call to order\n2. Approval of prior meeting minutes\n3. Treasurer's Q1 2026 financial report\n4. Landscaping contract renewal discussion\n5. Pool opening preparations and safety review\n6. Parking garage inspection debrief\n7. Resident open forum\n8. Adjournment",
        notes: null,
        summaryStatus: "draft" as const,
      },
    ];
    await db.insert(governanceMeetings).values(meetingRows).onConflictDoNothing();
    log("[seed] governance meetings :: 4 Cherry Hill meetings inserted", "seed");
  } else {
    log("[seed] governance meetings :: already exist, skipping", "seed");
  }

  // ── Community Announcements ─────────────────────────────────────────────────
  const existingAnnouncements = await db
    .select()
    .from(communityAnnouncements)
    .where(eq(communityAnnouncements.associationId, CHERRY_HILL_ASSOC_ID));
  if (existingAnnouncements.length === 0) {
    const announcementRows = [
      {
        id: "ann00001-0000-4000-8000-000000000001",
        associationId: CHERRY_HILL_ASSOC_ID,
        title: "Annual Meeting Reminder",
        body: "This is a reminder that the Annual Meeting of Cherry Hill Court Homeowners Association will be held on January 28, 2026 at 6:30 PM in the Community Room. All homeowners are encouraged to attend. The agenda includes election of board members, budget approval for 2026, and open resident forum.",
        priority: "normal" as const,
        noticeCategory: "general",
        isPublished: 1,
        isDraft: 0,
        publishedAt: new Date("2026-01-10T12:00:00Z"),
        authorName: "Board of Directors",
        targetAudience: "all",
      },
      {
        id: "ann00001-0000-4000-8000-000000000002",
        associationId: CHERRY_HILL_ASSOC_ID,
        title: "Parking Lot Repaving Schedule",
        body: "The parking lot repaving project is scheduled to begin February 17, 2026. Work will be completed in two phases over two weekends. Phase 1 (Feb 17–18): Sections A and B. Phase 2 (Feb 24–25): Sections C and D. Temporary overflow parking will be available on Oak Street. Please plan accordingly and move your vehicles before 7:00 AM on work days.",
        priority: "normal" as const,
        noticeCategory: "maintenance",
        isPublished: 1,
        isDraft: 0,
        publishedAt: new Date("2026-02-05T09:00:00Z"),
        authorName: "Property Management",
        targetAudience: "all",
      },
      {
        id: "ann00001-0000-4000-8000-000000000003",
        associationId: CHERRY_HILL_ASSOC_ID,
        title: "New Pet Policy Update",
        body: "Effective April 1, 2026, the updated Pet Policy will be in effect for all Cherry Hill Court residents. Key changes include: (1) A maximum of two pets per unit is permitted. (2) All dogs must be leashed in common areas at all times. (3) Pet waste stations have been added near the north entrance. (4) Residents must register pets with management. Please review the full policy document available in the resident portal.",
        priority: "important" as const,
        noticeCategory: "policy",
        isPublished: 1,
        isDraft: 0,
        publishedAt: new Date("2026-03-01T10:00:00Z"),
        authorName: "Board of Directors",
        targetAudience: "all",
      },
      {
        id: "ann00001-0000-4000-8000-000000000004",
        associationId: CHERRY_HILL_ASSOC_ID,
        title: "Pool Opening — Memorial Day Weekend",
        body: "We are excited to announce that the community pool will open for the season on Memorial Day Weekend, May 23, 2026. Pool hours will be 8:00 AM – 9:00 PM daily. Resident pool key fobs will be reactivated automatically. Guest passes (limit 2 per visit) are available from the management office. A pool safety orientation will be posted at the entrance.",
        priority: "normal" as const,
        noticeCategory: "community",
        isPublished: 0,
        isDraft: 1,
        publishedAt: null,
        scheduledPublishAt: new Date("2026-05-01T08:00:00Z"),
        authorName: "Amenities Committee",
        targetAudience: "all",
      },
      {
        id: "ann00001-0000-4000-8000-000000000005",
        associationId: CHERRY_HILL_ASSOC_ID,
        title: "Emergency Water Shutoff Notice",
        body: "URGENT: Due to an emergency repair to the main water supply line, water service to all units will be shut off on March 14, 2026 from 8:00 AM to approximately 2:00 PM. Please store sufficient water for drinking and essential needs before 8:00 AM. We apologize for the inconvenience and will provide updates via email if the timeline changes. Contact the management office at (203) 555-0100 with questions.",
        priority: "urgent" as const,
        noticeCategory: "urgent",
        isPublished: 1,
        isDraft: 0,
        publishedAt: new Date("2026-03-13T17:00:00Z"),
        authorName: "Property Management",
        targetAudience: "all",
      },
    ];
    await db.insert(communityAnnouncements).values(announcementRows).onConflictDoNothing();
    log("[seed] community announcements :: 5 Cherry Hill announcements inserted", "seed");
  } else {
    log("[seed] community announcements :: already exist, skipping", "seed");
  }

  // ── Budgets ──────────────────────────────────────────────────────────────────
  const existingBudgets = await db
    .select()
    .from(budgets)
    .where(eq(budgets.associationId, CHERRY_HILL_ASSOC_ID));
  if (existingBudgets.length === 0) {
    const budgetRows: (typeof budgets.$inferInsert)[] = [
      {
        id: "budg0001-0000-4000-8000-000000000001",
        associationId: CHERRY_HILL_ASSOC_ID,
        name: "FY 2026 Operating Budget",
        fiscalYear: 2026,
        periodStart: new Date("2026-01-01T00:00:00Z"),
        periodEnd: new Date("2026-12-31T23:59:59Z"),
      },
      {
        id: "budg0001-0000-4000-8000-000000000002",
        associationId: CHERRY_HILL_ASSOC_ID,
        name: "FY 2026 Reserve Budget",
        fiscalYear: 2026,
        periodStart: new Date("2026-01-01T00:00:00Z"),
        periodEnd: new Date("2026-12-31T23:59:59Z"),
      },
    ];
    await db.insert(budgets).values(budgetRows).onConflictDoNothing();
    log("[seed] budgets :: 2 Cherry Hill FY 2026 budgets inserted", "seed");
  } else {
    log("[seed] budgets :: already exist, skipping", "seed");
  }

  // ── Budget Versions ───────────────────────────────────────────────────────────
  const existingBudgetVersions = await db
    .select()
    .from(budgetVersions)
    .where(eq(budgetVersions.budgetId, "budg0001-0000-4000-8000-000000000001"));
  if (existingBudgetVersions.length === 0) {
    const budgetVersionRows: (typeof budgetVersions.$inferInsert)[] = [
      {
        id: "budgv001-0000-4000-8000-000000000001",
        budgetId: "budg0001-0000-4000-8000-000000000001",
        versionNumber: 1,
        status: "ratified",
        notes: "Approved by the board at the January 2026 annual meeting.",
        ratifiedAt: new Date("2026-01-20T18:00:00Z"),
      },
      {
        id: "budgv001-0000-4000-8000-000000000002",
        budgetId: "budg0001-0000-4000-8000-000000000002",
        versionNumber: 1,
        status: "ratified",
        notes: "Approved by the board at the January 2026 annual meeting.",
        ratifiedAt: new Date("2026-01-20T18:00:00Z"),
      },
    ];
    await db.insert(budgetVersions).values(budgetVersionRows).onConflictDoNothing();
    log("[seed] budget versions :: 2 Cherry Hill FY 2026 budget versions inserted", "seed");
  } else {
    log("[seed] budget versions :: already exist, skipping", "seed");
  }

  // ── Budget Lines ──────────────────────────────────────────────────────────────
  const existingBudgetLines = await db
    .select()
    .from(budgetLines)
    .where(eq(budgetLines.budgetVersionId, "budgv001-0000-4000-8000-000000000001"));
  if (existingBudgetLines.length === 0) {
    const budgetLineRows: (typeof budgetLines.$inferInsert)[] = [
      // Operating Budget lines
      {
        id: "bdln0001-0000-4000-8000-000000000001",
        budgetVersionId: "budgv001-0000-4000-8000-000000000001",
        lineItemName: "Landscaping",
        plannedAmount: 24000,
        sortOrder: 1,
      },
      {
        id: "bdln0001-0000-4000-8000-000000000002",
        budgetVersionId: "budgv001-0000-4000-8000-000000000001",
        lineItemName: "Utilities (Water/Sewer)",
        plannedAmount: 18000,
        sortOrder: 2,
      },
      {
        id: "bdln0001-0000-4000-8000-000000000003",
        budgetVersionId: "budgv001-0000-4000-8000-000000000001",
        lineItemName: "Insurance Premiums",
        plannedAmount: 28000,
        sortOrder: 3,
      },
      {
        id: "bdln0001-0000-4000-8000-000000000004",
        budgetVersionId: "budgv001-0000-4000-8000-000000000001",
        lineItemName: "Management Fees",
        plannedAmount: 36000,
        sortOrder: 4,
      },
      {
        id: "bdln0001-0000-4000-8000-000000000005",
        budgetVersionId: "budgv001-0000-4000-8000-000000000001",
        lineItemName: "Maintenance & Repairs",
        plannedAmount: 22000,
        sortOrder: 5,
      },
      {
        id: "bdln0001-0000-4000-8000-000000000006",
        budgetVersionId: "budgv001-0000-4000-8000-000000000001",
        lineItemName: "Snow Removal",
        plannedAmount: 8000,
        sortOrder: 6,
      },
      {
        id: "bdln0001-0000-4000-8000-000000000007",
        budgetVersionId: "budgv001-0000-4000-8000-000000000001",
        lineItemName: "Cleaning Services",
        plannedAmount: 14000,
        sortOrder: 7,
      },
      {
        id: "bdln0001-0000-4000-8000-000000000008",
        budgetVersionId: "budgv001-0000-4000-8000-000000000001",
        lineItemName: "Legal & Professional",
        plannedAmount: 5000,
        sortOrder: 8,
      },
      // Reserve Budget lines
      {
        id: "bdln0001-0000-4000-8000-000000000009",
        budgetVersionId: "budgv001-0000-4000-8000-000000000002",
        lineItemName: "Roof Replacement Reserve",
        plannedAmount: 45000,
        sortOrder: 1,
      },
      {
        id: "bdln0001-0000-4000-8000-000000000010",
        budgetVersionId: "budgv001-0000-4000-8000-000000000002",
        lineItemName: "Parking Lot Resurfacing",
        plannedAmount: 20000,
        sortOrder: 2,
      },
      {
        id: "bdln0001-0000-4000-8000-000000000011",
        budgetVersionId: "budgv001-0000-4000-8000-000000000002",
        lineItemName: "HVAC Major Repairs",
        plannedAmount: 15000,
        sortOrder: 3,
      },
    ];
    await db.insert(budgetLines).values(budgetLineRows).onConflictDoNothing();
    log("[seed] budget lines :: 8 operating + 3 reserve lines inserted for Cherry Hill", "seed");
  } else {
    log("[seed] budget lines :: already exist, skipping", "seed");
  }

  // ── Owner Ledger Entries — Cherry Hill Court Condominiums ───────────────────
  // 3-month ledger (Jan–Mar 2026) for 3 units. Unit 1415-A has a late fee and
  // no March payment yet; the other two units are fully paid through March.
  const existingLedgerEntries = await db
    .select()
    .from(ownerLedgerEntries)
    .where(eq(ownerLedgerEntries.associationId, CHERRY_HILL_ASSOC_ID));

  if (existingLedgerEntries.length === 0) {
    // Seed Cherry Hill persons referenced by ledger entries — idempotent fixed UUIDs
    const CHERRY_HILL_PERSONS = [
      {
        id: "chper001-0000-4000-8000-000000000001",
        firstName: "Patricia",
        lastName: "Marchetti",
        email: "p.marchetti@email.com",
        phone: "(203) 555-0411",
        mailingAddress: "1405 Quinnipiac Ave. Unit 1415-A, New Haven, CT 06513",
      },
      {
        id: "chper001-0000-4000-8000-000000000002",
        firstName: "Derek",
        lastName: "Sullivan",
        email: "d.sullivan@email.com",
        phone: "(203) 555-0412",
        mailingAddress: "1405 Quinnipiac Ave. Unit 1417-A, New Haven, CT 06513",
      },
      {
        id: "chper001-0000-4000-8000-000000000003",
        firstName: "Yuki",
        lastName: "Nakamura",
        email: "y.nakamura@email.com",
        phone: "(203) 555-0413",
        mailingAddress: "1405 Quinnipiac Ave. Unit 1421-A, New Haven, CT 06513",
      },
    ];
    for (const p of CHERRY_HILL_PERSONS) {
      await db.insert(persons).values(p).onConflictDoNothing();
    }

    const ledgerRows: (typeof ownerLedgerEntries.$inferInsert)[] = [
      // ── Unit 1415-A (Patricia Marchetti) — fully paid Jan–Mar ──────────────
      {
        id: "olgr0001-0000-4000-8000-000000000001",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: "7adb3521-845b-41de-8054-3281ddfc0f3c",
        personId: "chper001-0000-4000-8000-000000000001",
        entryType: "assessment",
        amount: 350,
        postedAt: new Date("2026-01-01T00:00:00Z"),
        description: "Monthly assessment — January 2026",
      },
      {
        id: "olgr0001-0000-4000-8000-000000000002",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: "7adb3521-845b-41de-8054-3281ddfc0f3c",
        personId: "chper001-0000-4000-8000-000000000001",
        entryType: "payment",
        amount: -350,
        postedAt: new Date("2026-01-05T00:00:00Z"),
        description: "Payment received — January 2026 assessment",
      },
      {
        id: "olgr0001-0000-4000-8000-000000000003",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: "7adb3521-845b-41de-8054-3281ddfc0f3c",
        personId: "chper001-0000-4000-8000-000000000001",
        entryType: "assessment",
        amount: 350,
        postedAt: new Date("2026-02-01T00:00:00Z"),
        description: "Monthly assessment — February 2026",
      },
      {
        id: "olgr0001-0000-4000-8000-000000000004",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: "7adb3521-845b-41de-8054-3281ddfc0f3c",
        personId: "chper001-0000-4000-8000-000000000001",
        entryType: "payment",
        amount: -350,
        postedAt: new Date("2026-02-07T00:00:00Z"),
        description: "Payment received — February 2026 assessment",
      },
      {
        id: "olgr0001-0000-4000-8000-000000000005",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: "7adb3521-845b-41de-8054-3281ddfc0f3c",
        personId: "chper001-0000-4000-8000-000000000001",
        entryType: "assessment",
        amount: 350,
        postedAt: new Date("2026-03-01T00:00:00Z"),
        description: "Monthly assessment — March 2026",
      },
      {
        id: "olgr0001-0000-4000-8000-000000000006",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: "7adb3521-845b-41de-8054-3281ddfc0f3c",
        personId: "chper001-0000-4000-8000-000000000001",
        entryType: "payment",
        amount: -350,
        postedAt: new Date("2026-03-08T00:00:00Z"),
        description: "Payment received — March 2026 assessment",
      },

      // ── Unit 1417-A (Derek Sullivan) — fully paid Jan–Mar ──────────────────
      {
        id: "olgr0001-0000-4000-8000-000000000007",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: "34575428-ea77-4013-bd0f-593e0c7dbbbb",
        personId: "chper001-0000-4000-8000-000000000002",
        entryType: "assessment",
        amount: 350,
        postedAt: new Date("2026-01-01T00:00:00Z"),
        description: "Monthly assessment — January 2026",
      },
      {
        id: "olgr0001-0000-4000-8000-000000000008",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: "34575428-ea77-4013-bd0f-593e0c7dbbbb",
        personId: "chper001-0000-4000-8000-000000000002",
        entryType: "payment",
        amount: -350,
        postedAt: new Date("2026-01-05T00:00:00Z"),
        description: "Payment received — January 2026 assessment",
      },
      {
        id: "olgr0001-0000-4000-8000-000000000009",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: "34575428-ea77-4013-bd0f-593e0c7dbbbb",
        personId: "chper001-0000-4000-8000-000000000002",
        entryType: "assessment",
        amount: 350,
        postedAt: new Date("2026-02-01T00:00:00Z"),
        description: "Monthly assessment — February 2026",
      },
      {
        id: "olgr0001-0000-4000-8000-000000000010",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: "34575428-ea77-4013-bd0f-593e0c7dbbbb",
        personId: "chper001-0000-4000-8000-000000000002",
        entryType: "payment",
        amount: -350,
        postedAt: new Date("2026-02-07T00:00:00Z"),
        description: "Payment received — February 2026 assessment",
      },
      {
        id: "olgr0001-0000-4000-8000-000000000011",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: "34575428-ea77-4013-bd0f-593e0c7dbbbb",
        personId: "chper001-0000-4000-8000-000000000002",
        entryType: "assessment",
        amount: 350,
        postedAt: new Date("2026-03-01T00:00:00Z"),
        description: "Monthly assessment — March 2026",
      },
      {
        id: "olgr0001-0000-4000-8000-000000000012",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: "34575428-ea77-4013-bd0f-593e0c7dbbbb",
        personId: "chper001-0000-4000-8000-000000000002",
        entryType: "payment",
        amount: -350,
        postedAt: new Date("2026-03-08T00:00:00Z"),
        description: "Payment received — March 2026 assessment",
      },

      // ── Unit 1421-A (Yuki Nakamura) — late on March; fee charged, no payment ─
      {
        id: "olgr0001-0000-4000-8000-000000000013",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: "bfa54c14-9fcd-4ed4-a810-61f193aa7d4b",
        personId: "chper001-0000-4000-8000-000000000003",
        entryType: "assessment",
        amount: 350,
        postedAt: new Date("2026-01-01T00:00:00Z"),
        description: "Monthly assessment — January 2026",
      },
      {
        id: "olgr0001-0000-4000-8000-000000000014",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: "bfa54c14-9fcd-4ed4-a810-61f193aa7d4b",
        personId: "chper001-0000-4000-8000-000000000003",
        entryType: "payment",
        amount: -350,
        postedAt: new Date("2026-01-05T00:00:00Z"),
        description: "Payment received — January 2026 assessment",
      },
      {
        id: "olgr0001-0000-4000-8000-000000000015",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: "bfa54c14-9fcd-4ed4-a810-61f193aa7d4b",
        personId: "chper001-0000-4000-8000-000000000003",
        entryType: "assessment",
        amount: 350,
        postedAt: new Date("2026-02-01T00:00:00Z"),
        description: "Monthly assessment — February 2026",
      },
      {
        id: "olgr0001-0000-4000-8000-000000000016",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: "bfa54c14-9fcd-4ed4-a810-61f193aa7d4b",
        personId: "chper001-0000-4000-8000-000000000003",
        entryType: "payment",
        amount: -350,
        postedAt: new Date("2026-02-07T00:00:00Z"),
        description: "Payment received — February 2026 assessment",
      },
      {
        id: "olgr0001-0000-4000-8000-000000000017",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: "bfa54c14-9fcd-4ed4-a810-61f193aa7d4b",
        personId: "chper001-0000-4000-8000-000000000003",
        entryType: "assessment",
        amount: 350,
        postedAt: new Date("2026-03-01T00:00:00Z"),
        description: "Monthly assessment — March 2026",
      },
      {
        id: "olgr0001-0000-4000-8000-000000000018",
        associationId: CHERRY_HILL_ASSOC_ID,
        unitId: "bfa54c14-9fcd-4ed4-a810-61f193aa7d4b",
        personId: "chper001-0000-4000-8000-000000000003",
        entryType: "late-fee",
        amount: 25,
        postedAt: new Date("2026-03-16T00:00:00Z"),
        description: "Late fee — March 2026 assessment overdue",
      },
    ];
    await db.insert(ownerLedgerEntries).values(ledgerRows).onConflictDoNothing();
    log("[seed] owner ledger entries :: 18 entries (Jan–Mar 2026) for 3 Cherry Hill units inserted", "seed");
  } else {
    log("[seed] owner ledger entries :: already exist, skipping", "seed");
  }

  // Warn if no active platform-admin exists after seeding — this means no one
  // can manage users or grant permissions. Fix by setting PLATFORM_ADMIN_EMAILS.
  const activePlatformAdmins = await db
    .select()
    .from(adminUsers)
    .where(and(eq(adminUsers.role, "platform-admin"), eq(adminUsers.isActive, 1)));

  if (activePlatformAdmins.length === 0) {
    console.warn(
      "[bootstrap] WARNING: No active platform-admin exists in the database.\n" +
        "  No one can manage users or grant permissions until one is created.\n" +
        "  Fix: set the PLATFORM_ADMIN_EMAILS environment variable to your email\n" +
        "  and restart the server."
    );
  } else {
    log(`[seed] platform-admin accounts active=${activePlatformAdmins.length} emails=${activePlatformAdmins.map(a => a.email).join(", ")}`, "seed");
  }

  log("[seed] complete", "seed");
}
