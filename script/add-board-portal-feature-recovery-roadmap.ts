import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks, roadmapWorkstreams } from "../shared/schema";

type TaskDef = {
  title: string;
  description: string;
  effort: "small" | "medium" | "large";
  priority: "low" | "medium" | "high" | "critical";
  status: "todo" | "in-progress" | "done";
};

type WorkstreamDef = {
  title: string;
  description: string;
  orderIndex: number;
  tasks: TaskDef[];
};

const projectTitle = "Active Project - Board Member UX";

const workstreamDef: WorkstreamDef = {
  title: "Board Portal Feature Recovery",
  description:
    "Post-redesign audit recovery: features confirmed missing or inaccessible in the board member workspace after the UI redesign. Each task restores a specific feature or data surface that was available before the redesign but is no longer reachable or rendered.",
  orderIndex: 99,
  tasks: [
    {
      title: "Restore Attention / Action Items panel",
      description:
        "The boardDashboard.attention object is fetched (overdue maintenance count, overdue governance tasks, draft meeting count, unpublished document count, attention items array) but is never rendered in the redesigned portal. Add a dedicated Needs Attention section to the board home that surfaces these items with clear action framing.",
      effort: "medium",
      priority: "critical",
      status: "todo",
    },
    {
      title: "Restore Maintenance oversight section",
      description:
        "boardDashboard.workflowStates.maintenance (requestsByStatus, urgentOpenCount, recent items array) is included in the API response but has no UI surface in the redesigned portal. Add a Maintenance Status card showing open/urgent counts and recent items, with a link to the full work orders view.",
      effort: "medium",
      priority: "high",
      status: "todo",
    },
    {
      title: "Restore Board Packages access and workflow status",
      description:
        "The Board Packages page (/app/governance/board-packages) and its workflow state (boardPackagesByStatus: draft/approved/distributed counts from workflowStates.communications) are entirely unreachable from the redesigned board portal. Add a Board Packages card and navigation link to the portal sidebar and Quick Launch panel.",
      effort: "medium",
      priority: "critical",
      status: "todo",
    },
    {
      title: "Restore Notices / Communications status display",
      description:
        "workflowStates.communications.noticesByStatus is fetched but never displayed. The Communications section in the portal shows an audit trail only; pending and distributed notices are invisible. Restore a notices status summary within the Communications section.",
      effort: "small",
      priority: "high",
      status: "todo",
    },
    {
      title: "Restore open governance tasks list",
      description:
        "boardDashboard.governance.openTasks is returned as an array but only a total count is shown in the Active Board Vote card. Restore a rendered list of open governance tasks with title, due date, and status so board members can see what requires action.",
      effort: "small",
      priority: "high",
      status: "todo",
    },
    {
      title: "Restore financial detail surfaces (ledger entries, invoices, open balance)",
      description:
        "boardDashboard.financial.recentLedgerEntries, recentInvoices, and openBalance are all fetched but unused in the redesigned portal. The Financial Integrity card shows summary totals only. Restore a recent transactions list and open balance indicator, and add portal-mode sub-navigation links to Budgets, Reports, and Reconciliation.",
      effort: "medium",
      priority: "high",
      status: "todo",
    },
    {
      title: "Restore delinquency snapshot",
      description:
        "The pre-redesign board dashboard included a delinquency snapshot (unit-level overdue balances). The redesigned portal shows collection rate only with no breakdown. Restore a delinquency summary showing count and total overdue, consistent with board oversight needs without exposing individual owner PII.",
      effort: "medium",
      priority: "high",
      status: "todo",
    },
    {
      title: "Restore board member own term and access status display",
      description:
        "workflowStates.access (status, effectiveRole, boardRole, boardTerm) is included in the dashboard response but is never surfaced in the portal UI. Board members cannot see their own active role, term dates, or access status. Restore a visible trust signal in the sidebar or profile area showing the current role and term.",
      effort: "small",
      priority: "medium",
      status: "todo",
    },
    {
      title: "Restore Resident Feedback access from board portal",
      description:
        "Resident feedback (/app/resident-feedback) was accessible from the board member workspace before the redesign. The redesigned portal has no link or section for it. Add a Resident Feedback entry to the portal sidebar or Quick Launch panel.",
      effort: "small",
      priority: "medium",
      status: "todo",
    },
    {
      title: "Restore Announcements access from board portal",
      description:
        "Announcements (/app/announcements) were accessible from the board workspace before the redesign. The redesigned portal has no access point. Add an Announcements link to the portal navigation.",
      effort: "small",
      priority: "medium",
      status: "todo",
    },
    {
      title: "Restore Insurance Policies access from board portal",
      description:
        "Insurance Policies (/app/insurance) were reachable from the governance area before the redesign. The redesigned portal does not surface them. Add an Insurance entry to the portal sidebar under Governance or Compliance.",
      effort: "small",
      priority: "medium",
      status: "todo",
    },
    {
      title: "Restore Inspections access from board portal",
      description:
        "Inspections (/app/inspections) were accessible in the prior workspace. The redesigned portal has no link to them. Add an Inspections entry to the Operations or Governance area of the portal sidebar.",
      effort: "small",
      priority: "medium",
      status: "todo",
    },
    {
      title: "Restore Maintenance Schedules access from board portal",
      description:
        "Maintenance Schedules (/app/maintenance-schedules) were accessible before the redesign. The redesigned portal does not expose them. Add a Maintenance Schedules link to the portal navigation.",
      effort: "small",
      priority: "low",
      status: "todo",
    },
    {
      title: "Add Maintenance to Quick Launch panel",
      description:
        "The Director Quick-Launch panel in the redesigned portal has four entries: Vendors, Meetings, Financials, Comms. Maintenance was present before the redesign and is missing. Add a Maintenance quick-launch button linking to work orders.",
      effort: "small",
      priority: "medium",
      status: "todo",
    },
    {
      title: "Restore document browse and search capability in portal mode",
      description:
        "The redesigned portal Documents section shows only 3 recent items with a static fallback when no document activity exists. The prior experience allowed board members to browse and search the full document library. Restore a browse/filter view within the Documents section for portal mode users.",
      effort: "medium",
      priority: "high",
      status: "todo",
    },
    {
      title: "Restore mobile navigation for board portal",
      description:
        "The redesigned board portal hides the sidebar on mobile (hidden md:flex) with no alternative navigation. Mobile users have no way to reach any section other than scrolling. Restore a mobile bottom tab bar or hamburger drawer for the board portal matching the section structure of the sidebar.",
      effort: "medium",
      priority: "high",
      status: "todo",
    },
  ],
};

async function run() {
  // Find the existing Board Member UX project
  let [project] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, projectTitle));

  if (!project) {
    // Create it if it doesn't exist yet
    [project] = await db
      .insert(roadmapProjects)
      .values({
        title: projectTitle,
        description:
          "Design and deliver an association-scoped board-member workspace for one-association governance users who need clear decisions, meeting readiness, financial oversight, compliance visibility, and auditable board actions without platform-admin exposure.",
        status: "active",
        isCollapsed: 0,
      })
      .returning();
    console.log(`Created project: ${project.title}`);
  } else {
    console.log(`Found existing project: ${project.title}`);
  }

  const wsDef = workstreamDef;

  let [workstream] = await db
    .select()
    .from(roadmapWorkstreams)
    .where(
      and(
        eq(roadmapWorkstreams.projectId, project.id),
        eq(roadmapWorkstreams.title, wsDef.title),
      ),
    );

  if (!workstream) {
    [workstream] = await db
      .insert(roadmapWorkstreams)
      .values({
        projectId: project.id,
        title: wsDef.title,
        description: wsDef.description,
        orderIndex: wsDef.orderIndex,
        isCollapsed: 0,
      })
      .returning();
    console.log(`Created workstream: ${workstream.title}`);
  } else {
    [workstream] = await db
      .update(roadmapWorkstreams)
      .set({ description: wsDef.description, updatedAt: new Date() })
      .where(eq(roadmapWorkstreams.id, workstream.id))
      .returning();
    console.log(`Updated workstream: ${workstream.title}`);
  }

  for (const taskDef of wsDef.tasks) {
    const [existing] = await db
      .select()
      .from(roadmapTasks)
      .where(
        and(
          eq(roadmapTasks.projectId, project.id),
          eq(roadmapTasks.workstreamId, workstream.id),
          eq(roadmapTasks.title, taskDef.title),
        ),
      );

    if (!existing) {
      await db.insert(roadmapTasks).values({
        projectId: project.id,
        workstreamId: workstream.id,
        title: taskDef.title,
        description: taskDef.description,
        status: taskDef.status,
        effort: taskDef.effort,
        priority: taskDef.priority,
        dependencyTaskIds: [],
      });
      console.log(`  + task: ${taskDef.title}`);
    } else {
      await db
        .update(roadmapTasks)
        .set({ description: taskDef.description, effort: taskDef.effort, priority: taskDef.priority, updatedAt: new Date() })
        .where(eq(roadmapTasks.id, existing.id));
      console.log(`  ~ task (updated): ${taskDef.title}`);
    }
  }

  console.log(`\nDone. ${wsDef.tasks.length} tasks in workstream "${wsDef.title}".`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
