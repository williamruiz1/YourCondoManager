/**
 * Marks completed workspace UX streamlining tasks as done in the admin roadmap.
 * Run after each batch of implementation work.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks, roadmapWorkstreams } from "../shared/schema";

const PROJECT_TITLE = "Active Project - Workspace UI/UX Streamlining";

const COMPLETED_TASKS: string[] = [
  // Navigation & Sidebar
  "Flatten Finance sidebar from 3 parent nodes to 1 with in-page tab bar",
  "Move association context selector to sidebar header",
  // Finance Foundation
  "Add WorkspacePageHeader and AssociationScopeBanner to Finance Foundation",
  "Apply associationId filter to accounts and categories API calls",
  "Rename Finance Foundation page title to Chart of Accounts",
  "Add empty states to accounts and categories tables",
  // Recurring Charges
  "Add confirmation dialog to Recurring Charges 'Run Now' button",
  "Resolve unitId to unit number in Recurring Charges run history table",
  // Special Assessments
  "Add live per-installment amount preview to Special Assessments form",
  "Apply associationId filter to Special Assessments query and add page header",
  // Vendor Invoices
  "Fix broken Vendor Invoices shortcut route from /app/financial-ledger to /app/financial/ledger",
  "Move Invoice Attachments card outside AsyncStateBoundary",
  "Add Paid (MTD) KPI card to Vendor Invoices and fix vendor help note",
  // Owner Ledger
  "Fix Owner Ledger amount field label and add Description column",
  "Apply associationId filter to ledger entries table and add last-scan timestamp",
  "Add visible label to Send Notice button in Balance Summary table",
  // Utilities
  "Expand Utilities table from minified JSX and add DataTableShell with filtering",
  "Add inline Mark Paid action to Utilities table rows",
  "Apply associationId filter to Utilities query and fix attachment table",
  // Budgets
  "Add Budget setup guidance for three-step hierarchy",
  "Replace custom Budget status CSS strings with shadcn Badge variants",
  "Add color-coded variance indicators to Budget line items table",
  // Late Fees
  "Reorganize Late Fees page into three tabs: Rules, Fee Activity, Recovery",
  "Add confirmation dialogs to batch late fee application actions",
  // Dashboard
  "Add association onboarding checklist to Dashboard when setup is incomplete",
  "Surface BoardDashboard attention items as a dashboard alert panel",
  // Financial Reports
  "Add report type descriptions and print export to Financial Reports",
  // Reconciliation
  "Add step progress indicator and fix CSV error handling in Reconciliation",
  "Add match progress summary and Lock Period confirmation to Reconciliation",
  // Owner Ledger (new session)
  "Format audit log Details column as readable key-value pairs",
  // Sidebar (new session)
  "Add recently-visited section to sidebar using existing localStorage history",
  // Command Palette (new session)
  "Show active association context in command palette header",
  "Add context-sensitive command palette actions based on current route",
  "Expand command palette search to include invoices and ledger entries",
  // Vendor Invoices (new session)
  "Add bulk approval to Vendor Invoices table",
  // Owner Portal (new session)
  "Add persistent balance strip to all owner portal views",
  "Redesign owner portal for mobile-first with bottom tab navigation",
  // Assessment (new session)
  "Wrap Special Assessment deactivate in a confirmation dialog",
  // Recurring Charges (new session)
  "Add visible interaction affordance for schedule row filter in Recurring Charges",
  // Navigation (new session)
  "Add breadcrumb navigation to all inner pages",
  "Move Platform-admin-only items out of main sidebar",
  // Finance Foundation (new session)
  "Move Partial Payment Rules to Payments page and add forward guidance",
  // Empty States (new session)
  "Replace generic empty table states with action-oriented empty states",
];

async function markTasksDone() {
  const [project] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, PROJECT_TITLE));

  if (!project) {
    console.error(`Project not found: "${PROJECT_TITLE}"`);
    process.exit(1);
  }

  console.log(`Found project: ${project.title} (${project.id})`);

  let updated = 0;
  let notFound = 0;

  for (const taskTitle of COMPLETED_TASKS) {
    const [task] = await db
      .select()
      .from(roadmapTasks)
      .where(
        and(
          eq(roadmapTasks.projectId, project.id),
          eq(roadmapTasks.title, taskTitle),
        ),
      );

    if (!task) {
      console.warn(`  ⚠ Task not found: "${taskTitle}"`);
      notFound++;
      continue;
    }

    if (task.status === "done") {
      console.log(`  ✓ Already done: "${taskTitle}"`);
      continue;
    }

    await db
      .update(roadmapTasks)
      .set({ status: "done", updatedAt: new Date() })
      .where(eq(roadmapTasks.id, task.id));

    console.log(`  ✓ Marked done: "${taskTitle}"`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Not found: ${notFound}`);
}

markTasksDone()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
