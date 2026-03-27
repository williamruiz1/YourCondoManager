/**
 * Adds tasks to the existing Navigation & Feature Accessibility Audit project
 * for implementing sub-page navigation within primary pages.
 */
import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapWorkstreams, roadmapTasks } from "../shared/schema";

const PROJECT_TITLE = "Navigation & Feature Accessibility Audit";

const WORKSTREAM = {
  title: "Sub-Page Navigation Within Primary Pages",
  description:
    "Some pages are logically sub-pages of a primary page and don't need their own sidebar entry. Instead, they should appear as navigable sub-pages when the user clicks into the primary page. This requires a sub-page nav component and applying it to Finance, Operations, and Platform Controls.",
  orderIndex: 5,
};

const tasks = [
  {
    title: "Build a sub-page navigation component for WorkspacePageHeader",
    description:
      "Create a `subPages` prop (or similar) on WorkspacePageHeader that renders a horizontal tab-style nav bar below the page header. " +
      "Each sub-page entry should have a label, href, and optional icon. The active sub-page should be highlighted based on the current route. " +
      "This is distinct from the existing `shortcuts` prop — shortcuts are action buttons, sub-pages are persistent navigation that appears on every page within the module. " +
      "Design should be consistent with the existing sidebar children pattern (e.g., how Board shows Meetings, Elections, etc.) but rendered inline within the page content area.",
    priority: "critical" as const,
    effort: "medium" as const,
    status: "todo" as const,
  },
  {
    title: "Apply sub-page nav to Finance primary page",
    description:
      "When a user clicks 'Finance' in the sidebar and lands on /app/financial/foundation, they should see a sub-page nav bar showing all financial modules:\n" +
      "• Chart of Accounts (foundation) — current page\n" +
      "• Owner Ledger (/app/financial/ledger)\n" +
      "• Budgets (/app/financial/budgets)\n" +
      "• Invoices (/app/financial/invoices)\n" +
      "• Payments (/app/financial/payments)\n" +
      "• Assessments (/app/financial/assessments)\n" +
      "• Late Fees (/app/financial/late-fees)\n" +
      "• Reports (/app/financial/reports)\n" +
      "• Reconciliation (/app/financial/reconciliation)\n" +
      "• Utilities (/app/financial/utilities)\n" +
      "• Recurring Charges (/app/financial/recurring-charges)\n\n" +
      "This nav should appear on ALL financial sub-pages so users can move between them without going back to the sidebar. " +
      "This replaces the need for 10 sidebar children under Finance.",
    priority: "critical" as const,
    effort: "medium" as const,
    status: "todo" as const,
  },
  {
    title: "Apply sub-page nav to Operations primary page",
    description:
      "When a user clicks 'Operations' in the sidebar, the operations dashboard and all its sub-pages should show a sub-page nav:\n" +
      "• Dashboard (/app/operations/dashboard) — current landing\n" +
      "• Work Orders (/app/work-orders)\n" +
      "• Vendors (/app/vendors)\n" +
      "• Maintenance Schedules (/app/maintenance-schedules)\n" +
      "• Inspections (/app/inspections)\n" +
      "• Resident Feedback (/app/resident-feedback)\n\n" +
      "Work Orders and Vendors already have sidebar children but Maintenance Schedules, Inspections, and Resident Feedback do not. " +
      "With sub-page nav, all five become discoverable from within the Operations module.",
    priority: "high" as const,
    effort: "medium" as const,
    status: "todo" as const,
  },
  {
    title: "Apply sub-page nav to Platform Controls primary page",
    description:
      "When a user clicks 'Platform Controls' in the sidebar, the page and its sub-pages should show a sub-page nav:\n" +
      "• Controls (/app/platform/controls) — current landing\n" +
      "• Admin Users (/app/admin/users)\n" +
      "• Executive Summary (/app/admin/executive)\n" +
      "• Admin Roadmap (/app/admin/roadmap)\n" +
      "• Feature Flags (/app/admin/feature-flags)\n" +
      "• Owner Portal (/portal)\n\n" +
      "Admin Users and Executive Summary currently have no sidebar entry at all — this makes them discoverable.",
    priority: "high" as const,
    effort: "small" as const,
    status: "todo" as const,
  },
  {
    title: "Apply sub-page nav to Board/Governance primary page",
    description:
      "The Board page already has sidebar children (Board Packages, Meetings, Elections, Compliance, Communications). " +
      "Add the same sub-page nav within each of these pages so users can navigate laterally between governance modules without returning to the sidebar. " +
      "Also add Announcements (/app/announcements) as a sub-page here — it's a natural fit under Board/Governance rather than a top-level sidebar item.",
    priority: "medium" as const,
    effort: "small" as const,
    status: "todo" as const,
  },
];

async function run() {
  console.log("Adding sub-page navigation tasks to the Navigation Audit project...\n");

  // Find the project
  const [project] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, PROJECT_TITLE))
    .limit(1);

  if (!project) {
    console.error(`Project "${PROJECT_TITLE}" not found!`);
    process.exit(1);
  }

  const projectId = project.id;

  // Create workstream
  const [existingWs] = await db
    .select()
    .from(roadmapWorkstreams)
    .where(eq(roadmapWorkstreams.title, WORKSTREAM.title))
    .limit(1);

  let wsId: string;
  if (existingWs && existingWs.projectId === projectId) {
    wsId = existingWs.id;
    console.log(`[~] Workstream exists: ${WORKSTREAM.title}`);
  } else {
    const [created] = await db
      .insert(roadmapWorkstreams)
      .values({
        projectId,
        title: WORKSTREAM.title,
        description: WORKSTREAM.description,
        orderIndex: WORKSTREAM.orderIndex,
      })
      .returning();
    wsId = created.id;
    console.log(`[+] Workstream: ${WORKSTREAM.title}`);
  }

  // Create tasks
  for (const taskDef of tasks) {
    const [existing] = await db
      .select()
      .from(roadmapTasks)
      .where(eq(roadmapTasks.title, taskDef.title))
      .limit(1);

    if (existing && existing.workstreamId === wsId) {
      console.log(`  [~] Task exists: ${taskDef.title}`);
    } else {
      await db.insert(roadmapTasks).values({
        projectId,
        workstreamId: wsId,
        title: taskDef.title,
        description: taskDef.description,
        status: taskDef.status,
        effort: taskDef.effort,
        priority: taskDef.priority,
        dependencyTaskIds: [],
      });
      console.log(`  [+] Task: ${taskDef.title}`);
    }
  }

  console.log("\nDone.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
