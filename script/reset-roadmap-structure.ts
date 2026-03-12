import { db } from "../server/db";
import { roadmapProjects, roadmapTasks, roadmapWorkstreams } from "../shared/schema";

async function resetRoadmapStructure() {
  await db.transaction(async (tx) => {
    await tx.delete(roadmapTasks);
    await tx.delete(roadmapWorkstreams);
    await tx.delete(roadmapProjects);

    const [phase1, phase2, phase3, phase4, phase5] = await tx.insert(roadmapProjects).values([
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

    await tx.insert(roadmapWorkstreams).values([
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
  });

  console.log("Roadmap structure reset complete.");
}

resetRoadmapStructure().catch((error) => {
  console.error("Failed to reset roadmap structure:", error);
  process.exit(1);
});
