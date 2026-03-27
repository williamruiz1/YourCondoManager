/**
 * Creates a roadmap project capturing the navigation & feature accessibility audit.
 *
 * Findings: After the redesign, many features are either missing from the sidebar
 * or only reachable through embedded links/breadcrumbs within other pages.
 */
import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapWorkstreams, roadmapTasks } from "../shared/schema";

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

const PROJECT_TITLE = "Navigation & Feature Accessibility Audit";

const workstreams: WorkstreamDef[] = [
  {
    title: "Missing Sidebar Navigation Entries",
    description: "Pages/routes that exist but have no sidebar link — users cannot discover or reach them without knowing the URL.",
    orderIndex: 0,
    tasks: [
      {
        title: "Add Announcements to sidebar",
        description: "Route /app/announcements exists (community announcements with publish/expiration controls) but has no sidebar entry. Should be under Board or as a top-level association-scoped item.",
        priority: "high",
        effort: "small",
        status: "todo",
      },
      {
        title: "Add Insurance page to sidebar",
        description: "Route /app/insurance exists (insurance policy management) but has no sidebar entry. Should be under Operations or as its own association-scoped module.",
        priority: "medium",
        effort: "small",
        status: "todo",
      },
      {
        title: "Add AI Ingestion to sidebar",
        description: "Route /app/ai/ingestion exists (AI document ingestion and clause extraction) but has no sidebar entry. Currently gated by WIP feature flag — ensure it appears for users with access.",
        priority: "low",
        effort: "small",
        status: "todo",
      },
      {
        title: "Add User Settings to sidebar or user menu",
        description: "Route /app/settings exists (profile, notifications, appearance) but has no discoverable navigation path. Should be in the sidebar footer or user avatar dropdown.",
        priority: "high",
        effort: "small",
        status: "todo",
      },
    ],
  },
  {
    title: "Finance Sub-Module Navigation",
    description: "The Finance sidebar entry links only to Chart of Accounts. 10+ financial sub-pages have no sidebar presence and are only reachable via breadcrumbs or cross-page links.",
    orderIndex: 1,
    tasks: [
      {
        title: "Add Finance sub-navigation to sidebar",
        description:
          "The sidebar 'Finance' link goes to /app/financial/foundation (Chart of Accounts) only. The following 10 sub-pages have NO sidebar entry and are only reachable via breadcrumbs or embedded links:\n" +
          "• Owner Ledger (/app/financial/ledger)\n" +
          "• Budgets (/app/financial/budgets)\n" +
          "• Vendor Invoices (/app/financial/invoices)\n" +
          "• Payments (/app/financial/payments)\n" +
          "• Special Assessments (/app/financial/assessments)\n" +
          "• Late Fees (/app/financial/late-fees)\n" +
          "• Reports (/app/financial/reports)\n" +
          "• Reconciliation (/app/financial/reconciliation)\n" +
          "• Utility Payments (/app/financial/utilities)\n" +
          "• Recurring Charges (/app/financial/recurring-charges)\n\n" +
          "Add these as children under the Finance sidebar item, similar to how Board has children for Meetings, Elections, etc.",
        priority: "critical",
        effort: "medium",
        status: "todo",
      },
      {
        title: "Add Finance landing/hub page or ensure foundation page links to sub-modules",
        description: "The financial-foundation.tsx page (Chart of Accounts) is the Finance entry point but has minimal links to other financial modules. Consider adding a finance hub with module cards, or ensure the sidebar children provide full discoverability.",
        priority: "medium",
        effort: "medium",
        status: "todo",
      },
    ],
  },
  {
    title: "Operations Sub-Module Navigation",
    description: "Operations sidebar only lists Work Orders and Vendors. Maintenance Schedules, Inspections, and Resident Feedback pages exist but have no sidebar entry.",
    orderIndex: 2,
    tasks: [
      {
        title: "Add Maintenance Schedules to Operations sidebar children",
        description: "Route /app/maintenance-schedules exists (preventive maintenance templates, asset tracking, schedule instances) but has no sidebar entry. Should be a child under Operations alongside Work Orders and Vendors.",
        priority: "high",
        effort: "small",
        status: "todo",
      },
      {
        title: "Add Inspections to Operations sidebar children",
        description: "Route /app/inspections exists (property inspection records and finding management) but has no sidebar entry. Should be a child under Operations.",
        priority: "high",
        effort: "small",
        status: "todo",
      },
      {
        title: "Add Resident Feedback to sidebar",
        description: "Route /app/resident-feedback exists (resident feedback collection and analytics) but has no sidebar entry. Could go under Operations or Board/Communications.",
        priority: "high",
        effort: "small",
        status: "todo",
      },
    ],
  },
  {
    title: "Embedded/Hidden Features Within Pages",
    description: "Features that are only accessible as tabs or inline links within other pages, making them hard to discover.",
    orderIndex: 3,
    tasks: [
      {
        title: "Audit financial-payments.tsx embedded tabs",
        description: "The Payments page contains 6 tabs (Methods, Gateway, Links, Webhooks, Activity, Exceptions) that represent distinct sub-features. Evaluate whether any should be promoted to standalone pages or at minimum documented in sidebar hover/tooltip.",
        priority: "medium",
        effort: "small",
        status: "todo",
      },
      {
        title: "Audit financial-late-fees.tsx embedded tabs",
        description: "Late Fees page contains 3 tabs (Rules & Calculator, Fee Activity, Recovery). These are distinct workflows that may warrant sidebar visibility.",
        priority: "low",
        effort: "small",
        status: "todo",
      },
      {
        title: "Audit owner-portal.tsx embedded election tabs",
        description: "Owner Portal embeds election participation (Active, Upcoming, Past, My History tabs). Verify these are discoverable to portal users and consider whether elections deserve its own portal section.",
        priority: "medium",
        effort: "small",
        status: "todo",
      },
      {
        title: "Audit user-settings.tsx discoverability",
        description: "User Settings has nested tabs (Profile & Regional, Notifications with 3 sub-tabs, Appearance). The page itself has no navigation entry — the nested tabs compound the discoverability problem.",
        priority: "medium",
        effort: "small",
        status: "todo",
      },
    ],
  },
  {
    title: "Platform & Admin Navigation Gaps",
    description: "Admin-scoped pages that exist but are missing from the Platform Controls section of the sidebar.",
    orderIndex: 4,
    tasks: [
      {
        title: "Add Admin Users page to sidebar",
        description: "Route /app/admin/users exists (manage platform admin users, roles, permissions) but has no sidebar entry. Should be under Platform Controls.",
        priority: "high",
        effort: "small",
        status: "todo",
      },
      {
        title: "Add Executive Summary page to sidebar",
        description: "Route /app/admin/executive exists (executive highlights deck and defend view) but has no sidebar entry. Should be under Platform Controls or as a top-level admin item.",
        priority: "medium",
        effort: "small",
        status: "todo",
      },
    ],
  },
];

async function run() {
  console.log("Seeding Navigation & Feature Accessibility Audit into Admin Roadmap...\n");

  // Upsert project
  const [existing] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, PROJECT_TITLE))
    .limit(1);

  let projectId: string;
  if (existing) {
    projectId = existing.id;
    console.log(`[~] Project already exists: ${projectId}`);
  } else {
    const [created] = await db
      .insert(roadmapProjects)
      .values({
        title: PROJECT_TITLE,
        description:
          "Post-redesign audit of the platform sidebar and page structure. Multiple features are inaccessible or buried — missing sidebar entries, features only reachable via embedded links or breadcrumbs, and entire modules with no navigable path from the sidebar.",
        status: "active",
      })
      .returning();
    projectId = created.id;
    console.log(`[+] Project created: ${projectId}`);
  }

  // Upsert workstreams and tasks
  for (const wsDef of workstreams) {
    const [existingWs] = await db
      .select()
      .from(roadmapWorkstreams)
      .where(eq(roadmapWorkstreams.title, wsDef.title))
      .limit(1);

    let wsId: string;
    if (existingWs && existingWs.projectId === projectId) {
      wsId = existingWs.id;
      console.log(`  [~] Workstream exists: ${wsDef.title}`);
    } else {
      const [created] = await db
        .insert(roadmapWorkstreams)
        .values({
          projectId,
          title: wsDef.title,
          description: wsDef.description,
          orderIndex: wsDef.orderIndex,
        })
        .returning();
      wsId = created.id;
      console.log(`  [+] Workstream: ${wsDef.title}`);
    }

    for (const taskDef of wsDef.tasks) {
      const [existingTask] = await db
        .select()
        .from(roadmapTasks)
        .where(eq(roadmapTasks.title, taskDef.title))
        .limit(1);

      if (existingTask && existingTask.workstreamId === wsId) {
        console.log(`    [~] Task exists: ${taskDef.title}`);
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
        console.log(`    [+] Task: ${taskDef.title}`);
      }
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
