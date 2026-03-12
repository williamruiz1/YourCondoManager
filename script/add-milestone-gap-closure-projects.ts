import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks, roadmapWorkstreams } from "../shared/schema";

type TaskDef = {
  title: string;
  description: string;
  effort: "small" | "medium" | "large";
  priority: "low" | "medium" | "high" | "critical";
};

type WorkstreamDef = {
  title: string;
  description: string;
  orderIndex: number;
  tasks: TaskDef[];
};

type ProjectDef = {
  title: string;
  description: string;
  orderHint: number;
  workstreams: WorkstreamDef[];
};

const gapProjects: ProjectDef[] = [
  {
    title: "Gap Closure M1 - Audit Logging and Delete Controls",
    description:
      "Close Milestone 1 gaps: full CRUD auditability, explicit delete workflows, and tamper-resistant action history across core registry entities.",
    orderHint: 1,
    workstreams: [
      {
        title: "Audit Model Expansion",
        description: "Add canonical audit log entity and event schema for all create, update, and delete operations.",
        orderIndex: 1,
        tasks: [
          {
            title: "Introduce canonical AuditLog table",
            description: "Add a global audit table with actor, entity, action, before/after payload, and timestamp.",
            effort: "medium",
            priority: "critical",
          },
          {
            title: "Backfill existing unit/admin role history into canonical audit model",
            description: "Normalize prior logging artifacts into shared audit shape for consistent querying.",
            effort: "medium",
            priority: "high",
          },
        ],
      },
      {
        title: "Delete API and Safeguards",
        description: "Implement explicit delete endpoints with constraints, confirmations, and soft-delete policy where needed.",
        orderIndex: 2,
        tasks: [
          {
            title: "Add delete handlers for Phase 1 registries",
            description: "Implement delete routes/services for associations, units, people, ownership, occupancy, board roles, and documents.",
            effort: "large",
            priority: "critical",
          },
          {
            title: "Add integrity guards for destructive actions",
            description: "Block or cascade deletes safely when linked records would become invalid.",
            effort: "medium",
            priority: "high",
          },
        ],
      },
      {
        title: "Audit Enforcement and Verification",
        description: "Ensure every mutating path emits audit events and is validated by tests/verification scripts.",
        orderIndex: 3,
        tasks: [
          {
            title: "Enforce audit writes on all mutation endpoints",
            description: "Wrap service-layer create/update/delete operations with mandatory audit event emission.",
            effort: "large",
            priority: "critical",
          },
          {
            title: "Add verification script for CRUD audit coverage",
            description: "Validate all mutating endpoints generate audit records with actor attribution.",
            effort: "small",
            priority: "high",
          },
        ],
      },
    ],
  },
  {
    title: "Gap Closure M2 - Budget Domain and Variance Controls",
    description:
      "Close Milestone 2 budget gaps: budget entities, version lifecycle, ratification workflow, and budget-vs-actual reporting.",
    orderHint: 2,
    workstreams: [
      {
        title: "Budget Data Model",
        description: "Implement Budget, BudgetLine, and BudgetVersion entities with associations and lifecycle states.",
        orderIndex: 1,
        tasks: [
          {
            title: "Create budget schema entities",
            description: "Add Budget, BudgetLine, and BudgetVersion tables plus insert schemas and types.",
            effort: "medium",
            priority: "critical",
          },
          {
            title: "Add budget storage interfaces",
            description: "Implement CRUD/query methods for budget drafts, versions, and line items.",
            effort: "medium",
            priority: "high",
          },
        ],
      },
      {
        title: "Budget Workflow",
        description: "Draft, ratify, supersede, and lock budget versions with governance-ready controls.",
        orderIndex: 2,
        tasks: [
          {
            title: "Implement budget draft and ratification states",
            description: "Support draft, proposed, ratified, and archived lifecycle transitions.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Expose budget API endpoints",
            description: "Add list/create/update and versioning routes under financial APIs.",
            effort: "medium",
            priority: "high",
          },
        ],
      },
      {
        title: "Budget UX and Reporting",
        description: "Deliver budget pages and variance analysis connected to ledger/expense actuals.",
        orderIndex: 3,
        tasks: [
          {
            title: "Build budget management screens",
            description: "Add budget page for version timeline, line items, and ratification actions.",
            effort: "large",
            priority: "high",
          },
          {
            title: "Add budget-vs-actual report",
            description: "Compute and display planned vs actual variance by account/category and period.",
            effort: "medium",
            priority: "high",
          },
        ],
      },
    ],
  },
  {
    title: "Gap Closure M3 - Governance Depth (Resolutions, Votes, Calendar)",
    description:
      "Close Milestone 3 governance depth gaps: agenda items, notes, resolutions, vote records, and calendar event modeling.",
    orderHint: 3,
    workstreams: [
      {
        title: "Governance Entity Expansion",
        description: "Add meeting agenda, note, resolution, vote, and calendar entities with links to meetings/tasks.",
        orderIndex: 1,
        tasks: [
          {
            title: "Create governance detail schema",
            description: "Add MeetingAgendaItem, MeetingNote, Resolution, VoteRecord, and CalendarEvent tables.",
            effort: "large",
            priority: "critical",
          },
          {
            title: "Add storage and API methods for governance details",
            description: "Implement endpoints for creating, searching, and updating governance artifacts.",
            effort: "large",
            priority: "high",
          },
        ],
      },
      {
        title: "Resolution and Vote Workflows",
        description: "Track decision lifecycle from proposal to vote result and searchable history.",
        orderIndex: 2,
        tasks: [
          {
            title: "Implement resolution lifecycle states",
            description: "Support draft, open, approved, rejected, and archived resolution states.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Implement vote recording and outcome rules",
            description: "Capture individual votes, quorum metadata, and computed outcomes.",
            effort: "medium",
            priority: "high",
          },
        ],
      },
      {
        title: "Calendar and Timeline Integration",
        description: "Show governance deadlines, meetings, and obligations in unified calendar/timeline views.",
        orderIndex: 3,
        tasks: [
          {
            title: "Create governance calendar API",
            description: "Aggregate meeting events and compliance deadlines into a single event feed.",
            effort: "medium",
            priority: "medium",
          },
          {
            title: "Add calendar UI linked to tasks and meetings",
            description: "Render upcoming obligations with drilldown into records and owners.",
            effort: "medium",
            priority: "medium",
          },
        ],
      },
    ],
  },
  {
    title: "Gap Closure M4 - Bylaw Clause Intelligence",
    description:
      "Close Milestone 4 bylaw intelligence gaps: clause-level structured extraction, tagging, and suggested entity linkage.",
    orderHint: 4,
    workstreams: [
      {
        title: "Clause Data Model",
        description: "Introduce clause records, clause tags, and suggested links tied to ingestion jobs and source documents.",
        orderIndex: 1,
        tasks: [
          {
            title: "Create clause intelligence schema",
            description: "Add ClauseRecord, ClauseTag, and SuggestedLink entities with provenance metadata.",
            effort: "medium",
            priority: "critical",
          },
          {
            title: "Link clause artifacts to ingestion pipeline",
            description: "Persist clause candidates during AI processing and retain source traceability.",
            effort: "medium",
            priority: "high",
          },
        ],
      },
      {
        title: "Review and Approval Workflow",
        description: "Allow admins to approve, reject, edit, and tag clause drafts from the intake review queue.",
        orderIndex: 2,
        tasks: [
          {
            title: "Add clause review endpoints",
            description: "Expose API operations for review status, edits, and tag assignment for clause drafts.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Extend AI ingestion UI for clause review",
            description: "Add before/after editing, confidence display, and approval controls for clause records.",
            effort: "medium",
            priority: "high",
          },
        ],
      },
      {
        title: "Bylaw Knowledge Reuse",
        description: "Enable searching and reuse of approved clauses for governance and communications workflows.",
        orderIndex: 3,
        tasks: [
          {
            title: "Add clause search and filtering",
            description: "Support filter by topic/tag/source document and confidence/review state.",
            effort: "small",
            priority: "medium",
          },
          {
            title: "Expose approved clause references to governance modules",
            description: "Allow governance tasks and templates to link to approved bylaw clauses.",
            effort: "small",
            priority: "medium",
          },
        ],
      },
    ],
  },
  {
    title: "Gap Closure M5 - Owner Portal and SaaS Tenancy",
    description:
      "Close Milestone 5 productization gaps: owner-facing portal access, membership model, tenant config, and email-thread visibility.",
    orderHint: 5,
    workstreams: [
      {
        title: "Portal and Membership Model",
        description: "Add data model for portal users, memberships, and role-scoped document access.",
        orderIndex: 1,
        tasks: [
          {
            title: "Create portal access schema",
            description: "Add PortalAccess and AssociationMembership entities with status and role constraints.",
            effort: "medium",
            priority: "critical",
          },
          {
            title: "Enforce owner-safe authorization",
            description: "Implement scoped permission checks for owner-facing reads and profile updates.",
            effort: "medium",
            priority: "critical",
          },
        ],
      },
      {
        title: "Owner Portal UX",
        description: "Deliver external portal shell for selected documents, notices, and contact update requests.",
        orderIndex: 2,
        tasks: [
          {
            title: "Build owner portal routes and layout",
            description: "Add owner-specific navigation and authenticated portal pages.",
            effort: "large",
            priority: "high",
          },
          {
            title: "Implement contact update workflow",
            description: "Allow owner-managed contact updates with moderation/audit trail.",
            effort: "medium",
            priority: "high",
          },
        ],
      },
      {
        title: "SaaS Tenancy and Messaging",
        description: "Finalize multi-association product controls with tenant config and communication threading.",
        orderIndex: 3,
        tasks: [
          {
            title: "Add TenantConfig and EmailThread entities",
            description: "Model per-association product settings and threaded communication artifacts.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Add cross-association isolation tests",
            description: "Verify hard tenant boundaries for portal, communications, and admin surfaces.",
            effort: "medium",
            priority: "high",
          },
        ],
      },
    ],
  },
];

async function upsertProject(projectDef: ProjectDef) {
  let [project] = await db.select().from(roadmapProjects).where(eq(roadmapProjects.title, projectDef.title));

  if (!project) {
    [project] = await db
      .insert(roadmapProjects)
      .values({
        title: projectDef.title,
        description: projectDef.description,
        status: "active",
        isCollapsed: 0,
      })
      .returning();
    console.log(`Created project: ${project.title}`);
  } else {
    console.log(`Project already exists: ${project.title}`);
  }

  for (const workstreamDef of projectDef.workstreams) {
    let [workstream] = await db
      .select()
      .from(roadmapWorkstreams)
      .where(and(eq(roadmapWorkstreams.projectId, project.id), eq(roadmapWorkstreams.title, workstreamDef.title)));

    if (!workstream) {
      [workstream] = await db
        .insert(roadmapWorkstreams)
        .values({
          projectId: project.id,
          title: workstreamDef.title,
          description: workstreamDef.description,
          orderIndex: workstreamDef.orderIndex,
          isCollapsed: 0,
        })
        .returning();
      console.log(`  Created workstream: ${workstream.title}`);
    } else {
      console.log(`  Workstream exists: ${workstream.title}`);
    }

    for (const task of workstreamDef.tasks) {
      const [existingTask] = await db
        .select()
        .from(roadmapTasks)
        .where(
          and(
            eq(roadmapTasks.projectId, project.id),
            eq(roadmapTasks.workstreamId, workstream.id),
            eq(roadmapTasks.title, task.title),
          ),
        );

      if (existingTask) {
        continue;
      }

      await db.insert(roadmapTasks).values({
        projectId: project.id,
        workstreamId: workstream.id,
        title: task.title,
        description: task.description,
        status: "todo",
        effort: task.effort,
        priority: task.priority,
        dependencyTaskIds: [],
      });
      console.log(`    Created task: ${task.title}`);
    }
  }
}

async function main() {
  const ordered = [...gapProjects].sort((a, b) => a.orderHint - b.orderHint);
  for (const project of ordered) {
    await upsertProject(project);
  }
  console.log("Milestone gap-closure roadmap setup complete.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to create milestone gap-closure roadmap projects:", error);
    process.exit(1);
  });
