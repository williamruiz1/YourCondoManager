import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks, roadmapWorkstreams } from "../shared/schema";

type TaskDef = {
  key: string;
  workstream: string;
  title: string;
  description: string;
  status: "todo" | "in-progress" | "done";
  effort?: "small" | "medium" | "large";
  priority?: "low" | "medium" | "high" | "critical";
  targetStartDate?: string;
  targetEndDate?: string;
  dependencies?: string[];
};

const projectOrder = [
  "Phase 1 - Foundation, Registry, and Core Admin",
  "Phase 2 - Financial Operations and Budget Control",
  "Phase 3 - Governance, Meetings, and Compliance Operations",
  "Phase 4 - Document Intelligence, Intake, and Operational Scale",
  "Phase 5 - Portals, Communications, and SaaS Expansion",
] as const;

const taskDefsByProject: Record<string, TaskDef[]> = {
  "Phase 1 - Foundation, Registry, and Core Admin": [
    {
      key: "1.1.1",
      workstream: "Unit Registry",
      title: "1.1.1 Create Unit Record",
      description: "Create and persist unit records with unique identifiers in the master registry.",
      status: "done",
      effort: "small",
      priority: "high",
      targetStartDate: "2026-03-01",
      targetEndDate: "2026-03-06",
    },
    {
      key: "1.1.2",
      workstream: "Unit Registry",
      title: "1.1.2 Edit Unit Attributes",
      description: "Support updates to structural and identifying unit attributes.",
      status: "done",
      effort: "small",
      priority: "high",
      targetStartDate: "2026-03-01",
      targetEndDate: "2026-03-06",
      dependencies: ["1.1.1"],
    },
    {
      key: "1.1.3",
      workstream: "Unit Registry",
      title: "1.1.3 Track Unit Lifecycle History",
      description: "Capture historical change logs for unit configuration and lifecycle events.",
      status: "todo",
      effort: "medium",
      priority: "medium",
      targetStartDate: "2026-03-15",
      targetEndDate: "2026-03-28",
      dependencies: ["1.1.2"],
    },
    {
      key: "1.2.1",
      workstream: "Person Registry",
      title: "1.2.1 Create Owner Profile",
      description: "Create owner profiles to support ownership relationships.",
      status: "done",
      effort: "small",
      priority: "high",
      targetStartDate: "2026-03-01",
      targetEndDate: "2026-03-06",
    },
    {
      key: "1.2.2",
      workstream: "Ownership History",
      title: "1.2.2 Link Owner to Unit",
      description: "Persist ownership links between people and units.",
      status: "done",
      effort: "small",
      priority: "high",
      targetStartDate: "2026-03-01",
      targetEndDate: "2026-03-06",
      dependencies: ["1.2.1", "1.1.1"],
    },
    {
      key: "1.2.3",
      workstream: "Ownership History",
      title: "1.2.3 Manage Multiple Owners",
      description: "Support joint ownership per unit and owner-to-multiple-unit mapping.",
      status: "done",
      effort: "small",
      priority: "high",
      targetStartDate: "2026-03-01",
      targetEndDate: "2026-03-06",
      dependencies: ["1.2.2"],
    },
    {
      key: "1.3.1",
      workstream: "Occupancy Contact Tracking",
      title: "1.3.1 Submit Tenant Information Form",
      description: "Capture tenant contact and emergency details through admin workflow.",
      status: "todo",
      effort: "medium",
      priority: "medium",
      targetStartDate: "2026-03-18",
      targetEndDate: "2026-03-24",
    },
    {
      key: "1.3.2",
      workstream: "Occupancy Contact Tracking",
      title: "1.3.2 Store Tenant Contact Record",
      description: "Persist tenant contact records associated with occupied units.",
      status: "done",
      effort: "small",
      priority: "high",
      targetStartDate: "2026-03-01",
      targetEndDate: "2026-03-06",
      dependencies: ["1.3.1"],
    },
    {
      key: "1.3.3",
      workstream: "Occupancy Contact Tracking",
      title: "1.3.3 Track Occupancy History",
      description: "Track start/end occupancy changes over time for auditability.",
      status: "done",
      effort: "small",
      priority: "high",
      targetStartDate: "2026-03-01",
      targetEndDate: "2026-03-06",
      dependencies: ["1.3.2"],
    },
    {
      key: "2.1.1",
      workstream: "Board Role Tracking",
      title: "2.1.1 Assign Board Member Role",
      description: "Assign officer and board roles to people records.",
      status: "done",
      effort: "small",
      priority: "high",
      targetStartDate: "2026-03-01",
      targetEndDate: "2026-03-06",
    },
    {
      key: "2.1.2",
      workstream: "Board Role Tracking",
      title: "2.1.2 Store Board Role Metadata",
      description: "Store role title, dates, and association linkage metadata.",
      status: "done",
      effort: "small",
      priority: "high",
      targetStartDate: "2026-03-01",
      targetEndDate: "2026-03-06",
      dependencies: ["2.1.1"],
    },
    {
      key: "2.1.3",
      workstream: "Board Role Tracking",
      title: "2.1.3 Track Board Service History",
      description: "Preserve board service timeline history for governance records.",
      status: "done",
      effort: "small",
      priority: "medium",
      targetStartDate: "2026-03-01",
      targetEndDate: "2026-03-06",
      dependencies: ["2.1.2"],
    },
    {
      key: "4.1.1",
      workstream: "Document Repository",
      title: "4.1.1 Upload Document",
      description: "Upload and store governing and operational documents.",
      status: "done",
      effort: "small",
      priority: "high",
      targetStartDate: "2026-03-01",
      targetEndDate: "2026-03-06",
    },
    {
      key: "4.1.2",
      workstream: "Document Repository",
      title: "4.1.2 Tag Document to Entity",
      description: "Associate documents with entities such as association, unit, or person.",
      status: "todo",
      effort: "medium",
      priority: "medium",
      targetStartDate: "2026-03-20",
      targetEndDate: "2026-03-29",
      dependencies: ["4.1.1"],
    },
    {
      key: "4.1.3",
      workstream: "Document Repository",
      title: "4.1.3 Maintain Document Version History",
      description: "Track and retain document revisions with history metadata.",
      status: "todo",
      effort: "medium",
      priority: "medium",
      targetStartDate: "2026-03-25",
      targetEndDate: "2026-04-05",
      dependencies: ["4.1.2"],
    },
    {
      key: "8.1.1",
      workstream: "Auth, Roles, and Audit Logging",
      title: "8.1.1 Assign User Role",
      description: "Role assignment foundation for platform access control.",
      status: "todo",
      effort: "medium",
      priority: "high",
      targetStartDate: "2026-03-12",
      targetEndDate: "2026-03-20",
    },
    {
      key: "8.1.2",
      workstream: "Auth, Roles, and Audit Logging",
      title: "8.1.2 Restrict Data Access",
      description: "Enforce role-based restrictions for admin modules.",
      status: "in-progress",
      effort: "medium",
      priority: "critical",
      targetStartDate: "2026-03-07",
      targetEndDate: "2026-03-18",
      dependencies: ["8.1.1"],
    },
    {
      key: "8.1.3",
      workstream: "Auth, Roles, and Audit Logging",
      title: "8.1.3 Validate Permission Changes",
      description: "Track and validate permission change events with auditability.",
      status: "todo",
      effort: "medium",
      priority: "high",
      targetStartDate: "2026-03-19",
      targetEndDate: "2026-03-31",
      dependencies: ["8.1.2"],
    },
    {
      key: "F1.ASSOC.CONFIG",
      workstream: "Association Setup",
      title: "Foundation: Configure Association Baseline",
      description: "Establish association profile, governance baseline, and configuration needed by downstream registry modules.",
      status: "done",
      effort: "small",
      priority: "high",
      targetStartDate: "2026-03-01",
      targetEndDate: "2026-03-04",
    },
    {
      key: "F1.UNIT.LOAD18",
      workstream: "Unit Registry",
      title: "Foundation: Load Initial 18-Unit Roster with Addresses",
      description: "Load and verify the initial 18-unit roster and addresses for New Haven deployment.",
      status: "done",
      effort: "small",
      priority: "high",
      targetStartDate: "2026-03-04",
      targetEndDate: "2026-03-06",
      dependencies: ["F1.ASSOC.CONFIG", "1.1.1"],
    },
    {
      key: "F1.DASH.ADMIN",
      workstream: "Basic Dashboard",
      title: "Foundation: Admin Dashboard Shell for Registry Modules",
      description: "Provide left-nav admin dashboard shell and quick metrics for registry and governance modules.",
      status: "done",
      effort: "small",
      priority: "medium",
      targetStartDate: "2026-03-03",
      targetEndDate: "2026-03-08",
      dependencies: ["F1.ASSOC.CONFIG"],
    },
  ],
  "Phase 2 - Financial Operations and Budget Control": [
    {
      key: "3.1.1",
      workstream: "HOA/Common Fee Engine",
      title: "3.1.1 Create HOA Fee Schedule",
      description: "Define recurring HOA/common charge schedules.",
      status: "todo",
      effort: "large",
      priority: "critical",
      targetStartDate: "2026-04-01",
      targetEndDate: "2026-04-20",
    },
    {
      key: "3.1.2",
      workstream: "Assessment Engine",
      title: "3.1.2 Create Special Assessment",
      description: "Model and issue special assessments including installments.",
      status: "todo",
      effort: "large",
      priority: "high",
      targetStartDate: "2026-04-15",
      targetEndDate: "2026-05-05",
      dependencies: ["3.1.1"],
    },
    {
      key: "3.1.3",
      workstream: "Late Fee Rules",
      title: "3.1.3 Calculate Late Fees",
      description: "Implement configurable late fee policy and calculation logic.",
      status: "todo",
      effort: "medium",
      priority: "high",
      targetStartDate: "2026-04-22",
      targetEndDate: "2026-05-08",
      dependencies: ["3.1.1"],
    },
    {
      key: "3.1.4",
      workstream: "Owner Ledger",
      title: "3.1.4 Track Owner Ledger Balance",
      description: "Compute and present per-owner charges, payments, and balance.",
      status: "todo",
      effort: "large",
      priority: "critical",
      targetStartDate: "2026-04-25",
      targetEndDate: "2026-05-20",
      dependencies: ["3.1.1", "3.1.2", "3.1.3"],
    },
    {
      key: "3.2.1",
      workstream: "Expense and Invoice Tracking",
      title: "3.2.1 Record Vendor Invoice",
      description: "Record vendor invoices and base expense metadata.",
      status: "todo",
      effort: "medium",
      priority: "high",
      targetStartDate: "2026-04-10",
      targetEndDate: "2026-04-28",
    },
    {
      key: "3.2.2",
      workstream: "Utility Payment Tracking",
      title: "3.2.2 Track Utility Payments",
      description: "Track utility payment entries and payment status.",
      status: "todo",
      effort: "medium",
      priority: "medium",
      targetStartDate: "2026-04-18",
      targetEndDate: "2026-05-06",
      dependencies: ["3.2.1"],
    },
    {
      key: "3.2.3",
      workstream: "Expense and Invoice Tracking",
      title: "3.2.3 Store Expense Attachments",
      description: "Attach and retain invoice/expense supporting files.",
      status: "todo",
      effort: "small",
      priority: "medium",
      targetStartDate: "2026-04-22",
      targetEndDate: "2026-05-03",
      dependencies: ["3.2.1"],
    },
    {
      key: "3.2.FINCFG",
      workstream: "Budget Planning and Ratification",
      title: "Finance Foundation: Configure Financial Accounts and Categories",
      description: "Create baseline financial account/category configuration for invoice, utility, and budget workflows.",
      status: "todo",
      effort: "medium",
      priority: "medium",
      targetStartDate: "2026-04-12",
      targetEndDate: "2026-04-24",
    },
  ],
  "Phase 3 - Governance, Meetings, and Compliance Operations": [
    {
      key: "5.1.1",
      workstream: "Meeting Tracker",
      title: "5.1.1 Schedule Meeting Record",
      description: "Create and manage meeting records with date/type/status.",
      status: "todo",
      effort: "medium",
      priority: "high",
      targetStartDate: "2026-05-15",
      targetEndDate: "2026-05-30",
    },
    {
      key: "5.1.2",
      workstream: "Notes and Minutes Repository",
      title: "5.1.2 Record Meeting Notes",
      description: "Capture meeting notes/minutes and attachments.",
      status: "todo",
      effort: "medium",
      priority: "high",
      targetStartDate: "2026-05-25",
      targetEndDate: "2026-06-10",
      dependencies: ["5.1.1"],
    },
    {
      key: "5.1.3",
      workstream: "Governance Dashboard",
      title: "5.1.3 Publish Meeting Summary",
      description: "Generate and expose approved meeting summary for governance review.",
      status: "todo",
      effort: "small",
      priority: "medium",
      targetStartDate: "2026-06-08",
      targetEndDate: "2026-06-20",
      dependencies: ["5.1.2"],
    },
    {
      key: "6.1.1",
      workstream: "Annual Checklist and Compliance Engine",
      title: "6.1.1 Create Annual Governance Tasks",
      description: "Generate annual governance checklist tasks and due dates.",
      status: "todo",
      effort: "medium",
      priority: "high",
      targetStartDate: "2026-06-01",
      targetEndDate: "2026-06-18",
    },
    {
      key: "6.1.2",
      workstream: "Calendar and Task Workflows",
      title: "6.1.2 Track Task Completion",
      description: "Track completion state transitions for annual compliance tasks.",
      status: "todo",
      effort: "medium",
      priority: "high",
      targetStartDate: "2026-06-12",
      targetEndDate: "2026-06-28",
      dependencies: ["6.1.1"],
    },
    {
      key: "6.1.3",
      workstream: "Governance Dashboard",
      title: "6.1.3 Display Compliance Dashboard",
      description: "Provide governance dashboard with deadlines, open tasks, and completion.",
      status: "todo",
      effort: "medium",
      priority: "medium",
      targetStartDate: "2026-06-22",
      targetEndDate: "2026-07-08",
      dependencies: ["6.1.2"],
    },
    {
      key: "5.1.BUDGET.MTG",
      workstream: "Meeting Tracker",
      title: "Governance: Budget Meeting Support Workflow",
      description: "Support budget-meeting-specific scheduling metadata and linkage to annual checklist obligations.",
      status: "todo",
      effort: "small",
      priority: "medium",
      targetStartDate: "2026-06-05",
      targetEndDate: "2026-06-16",
      dependencies: ["5.1.1", "6.1.1"],
    },
    {
      key: "6.1.KANBAN",
      workstream: "Calendar and Task Workflows",
      title: "Governance: Kanban/Workstream Task Visibility",
      description: "Expose governance checklist tasks via Kanban/workstream views for operational execution tracking.",
      status: "todo",
      effort: "medium",
      priority: "medium",
      targetStartDate: "2026-06-16",
      targetEndDate: "2026-06-30",
      dependencies: ["6.1.2"],
    },
    {
      key: "6.1.CT.BASELINE",
      workstream: "Annual Checklist and Compliance Engine",
      title: "Governance: CT-Level Compliance Baseline Template",
      description: "Seed checklist template with Connecticut-priority obligations before condo-bylaw automation layers.",
      status: "todo",
      effort: "small",
      priority: "medium",
      targetStartDate: "2026-06-02",
      targetEndDate: "2026-06-14",
      dependencies: ["6.1.1"],
    },
  ],
  "Phase 4 - Document Intelligence, Intake, and Operational Scale": [
    {
      key: "4.2.1",
      workstream: "AI Document Ingestion",
      title: "4.2.1 Upload Raw Document for Parsing",
      description: "Support raw file upload path into AI parsing pipeline.",
      status: "todo",
      effort: "large",
      priority: "high",
      targetStartDate: "2026-07-15",
      targetEndDate: "2026-08-05",
    },
    {
      key: "4.2.2",
      workstream: "Metadata Extraction",
      title: "4.2.2 Extract Document Metadata",
      description: "Extract structured metadata from parsed documents for review.",
      status: "todo",
      effort: "large",
      priority: "high",
      targetStartDate: "2026-08-01",
      targetEndDate: "2026-08-25",
      dependencies: ["4.2.1"],
    },
    {
      key: "4.2.3",
      workstream: "Record Suggestion Engine",
      title: "4.2.3 Store Parsed Data",
      description: "Persist extracted data drafts with review/approval state.",
      status: "todo",
      effort: "medium",
      priority: "medium",
      targetStartDate: "2026-08-20",
      targetEndDate: "2026-09-05",
      dependencies: ["4.2.2"],
    },
  ],
  "Phase 5 - Portals, Communications, and SaaS Expansion": [
    {
      key: "7.1.1",
      workstream: "Notice Templates",
      title: "7.1.1 Generate Notice Template",
      description: "Create reusable notice templates for association communication.",
      status: "todo",
      effort: "medium",
      priority: "medium",
      targetStartDate: "2026-09-10",
      targetEndDate: "2026-09-25",
    },
    {
      key: "7.1.2",
      workstream: "Gmail/Email Integration",
      title: "7.1.2 Send Email Notice",
      description: "Enable outbound email notice delivery via integration layer.",
      status: "todo",
      effort: "large",
      priority: "medium",
      targetStartDate: "2026-09-20",
      targetEndDate: "2026-10-15",
      dependencies: ["7.1.1"],
    },
    {
      key: "7.1.3",
      workstream: "Communications Layer",
      title: "7.1.3 Log Communication History",
      description: "Persist communication event history for audit and support.",
      status: "todo",
      effort: "medium",
      priority: "medium",
      targetStartDate: "2026-10-01",
      targetEndDate: "2026-10-20",
      dependencies: ["7.1.2"],
    },
    {
      key: "8.MULTI.FOUNDATION",
      workstream: "Multi-Association Architecture",
      title: "Platform: Multi-Association Data Isolation Foundation",
      description: "Establish tenancy boundaries and association-scoped data patterns for future multi-complex scaling.",
      status: "todo",
      effort: "large",
      priority: "high",
      targetStartDate: "2026-09-15",
      targetEndDate: "2026-10-10",
    },
    {
      key: "8.PORTAL.PERM",
      workstream: "Subscription and SaaS Admin Controls",
      title: "Platform: Future Self-Service Permission Envelope",
      description: "Define permission envelope for future owner/tenant self-service roles without exposing internal admin operations.",
      status: "todo",
      effort: "medium",
      priority: "medium",
      targetStartDate: "2026-10-05",
      targetEndDate: "2026-10-25",
      dependencies: ["8.MULTI.FOUNDATION", "8.1.2"],
    },
  ],
};

function isoDate(value?: string) {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

async function run() {
  const projects = await db.select().from(roadmapProjects);
  const workstreams = await db.select().from(roadmapWorkstreams);

  const projectByTitle = new Map(projects.map((p) => [p.title, p]));
  const wsByProjectAndTitle = new Map(workstreams.map((ws) => [`${ws.projectId}::${ws.title}`, ws]));

  const keyToTaskId = new Map<string, string>();

  for (const projectTitle of projectOrder) {
    const project = projectByTitle.get(projectTitle);
    if (!project) {
      throw new Error(`Missing roadmap project: ${projectTitle}`);
    }

    const defs = taskDefsByProject[projectTitle] ?? [];
    for (const def of defs) {
      const ws = wsByProjectAndTitle.get(`${project.id}::${def.workstream}`);
      if (!ws) {
        throw new Error(`Missing workstream '${def.workstream}' under project '${projectTitle}'`);
      }

      const [existing] = await db
        .select()
        .from(roadmapTasks)
        .where(and(eq(roadmapTasks.workstreamId, ws.id), eq(roadmapTasks.title, def.title)));

      const basePayload = {
        projectId: project.id,
        workstreamId: ws.id,
        title: def.title,
        description: def.description,
        status: def.status,
        effort: def.effort ?? null,
        priority: def.priority ?? null,
        targetStartDate: isoDate(def.targetStartDate),
        targetEndDate: isoDate(def.targetEndDate),
        completedDate: def.status === "done" ? new Date() : null,
        updatedAt: new Date(),
      };

      if (existing) {
        const [updated] = await db
          .update(roadmapTasks)
          .set(basePayload)
          .where(eq(roadmapTasks.id, existing.id))
          .returning();
        keyToTaskId.set(def.key, updated.id);
      } else {
        const [inserted] = await db
          .insert(roadmapTasks)
          .values({ ...basePayload, dependencyTaskIds: [] })
          .returning();
        keyToTaskId.set(def.key, inserted.id);
      }
    }
  }

  for (const projectTitle of projectOrder) {
    const project = projectByTitle.get(projectTitle)!;
    for (const def of taskDefsByProject[projectTitle] ?? []) {
      const taskId = keyToTaskId.get(def.key);
      if (!taskId) continue;
      const dependencyTaskIds = (def.dependencies ?? []).map((depKey) => keyToTaskId.get(depKey)).filter(Boolean) as string[];

      await db
        .update(roadmapTasks)
        .set({ dependencyTaskIds, updatedAt: new Date() })
        .where(and(eq(roadmapTasks.id, taskId), eq(roadmapTasks.projectId, project.id)));
    }
  }

  console.log("FTPH v2.1 roadmap mapping complete.");
  console.log("Tasks mapped:", keyToTaskId.size);
}

run().catch((error) => {
  console.error("Mapping failed:", error);
  process.exit(1);
});
