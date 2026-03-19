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

const projectTitle = "Active Project - Workspace UI/UX Streamlining";
const projectDescription =
  "Systematic review and streamlining of the CondoManager platform interface against 2025 SaaS and property-management UX best practices. Covers global navigation, Finance section (all 11 pages reviewed individually), owner portal, command palette, dashboard, and empty states.";

const workstreams: WorkstreamDef[] = [
  {
    title: "Global Navigation & Information Architecture",
    description:
      "Reduce sidebar depth, improve association context placement, add breadcrumbs and recently-visited items. Grounded in Miller's Law (7±2 chunks) and 2025 SaaS navigation research.",
    orderIndex: 1,
    tasks: [
      {
        title: "Flatten Finance sidebar from 3 parent nodes to 1 with in-page tab bar",
        description:
          "The Finance section exposes up to 11 sidebar links simultaneously (Finance Setup, Owner Accounts, Oversight & Reporting each with 2–4 children). Collapse to a single Finance entry. When any /app/financial/* route is active, render a horizontal tab bar inside the page with: Overview | Owner Accounts | Oversight | Configuration. Files: app-sidebar.tsx, App.tsx.",
        effort: "medium",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Move association context selector to sidebar header",
        description:
          'The "In Context" association block sits mid-sidebar, breaking the vertical navigation flow. Relocate it to the sidebar header directly below the CondoManager logo. Remove the mid-sidebar block. File: app-sidebar.tsx.',
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Add breadcrumb navigation to all inner pages",
        description:
          "The app header shows only the sidebar toggle and command palette — no location context. Add a breadcrumb trail (e.g., Finance › Owner Accounts › Payments) using Wouter useLocation and the shadcn Breadcrumb component. Files: App.tsx, workspace-page-header.tsx.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Add recently-visited section to sidebar using existing localStorage history",
        description:
          "The command palette already writes recent routes to localStorage (RECENT_ROUTE_STORAGE_KEY). Surface the last 3–4 routes as a Recently Visited section at the top of the sidebar. Exclude the current page. Collapse section when history is empty. File: app-sidebar.tsx.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Move Platform-admin-only items out of main sidebar",
        description:
          "Feature Flags and platform-level controls are visible in the sidebar for board-admin and manager roles, adding noise. Move them to the user menu dropdown or a dedicated settings area. File: app-sidebar.tsx.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
    ],
  },
  {
    title: "Dashboard & Empty States",
    description:
      "Surface existing data (onboarding score, attention items) on the dashboard and replace generic empty tables with action-oriented empty states.",
    orderIndex: 2,
    tasks: [
      {
        title: "Add association onboarding checklist to Dashboard when setup is incomplete",
        description:
          "When onboardingScorePercent < 100, display a Getting Started panel on Dashboard with linked steps: Add units → Add owners → Configure fees → Set up payment methods → Invite board members. Data already exists in AssociationOverview. Hide when 100% complete. File: dashboard.tsx.",
        effort: "small",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Surface BoardDashboard attention items as a dashboard alert panel",
        description:
          "BoardDashboard.attention.items contains prioritized alerts with tone severity (error/warning/info). These are buried in owner portal data. Add an Attention Required panel on the main dashboard with severity badges and direct links to resolve each item. File: dashboard.tsx.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Replace generic empty table states with action-oriented empty states",
        description:
          "Priority pages: financial-payments.tsx, work-orders.tsx, board.tsx, financial-invoices.tsx, vendors.tsx. Each empty state should show: relevant icon, one-sentence explanation, primary CTA. Create a reusable EmptyState component ({ icon, title, description, action }).",
        effort: "medium",
        priority: "medium",
        status: "todo",
      },
    ],
  },
  {
    title: "Finance Foundation & Chart of Accounts",
    description:
      "Fix the Finance Foundation page which is missing standard page headers, has unscoped data fetches, uses internal jargon, and offers no onboarding guidance.",
    orderIndex: 3,
    tasks: [
      {
        title: "Add WorkspacePageHeader and AssociationScopeBanner to Finance Foundation",
        description:
          "Finance Foundation uses a raw <h1>/<p> header while all other mature finance pages use WorkspacePageHeader + AssociationScopeBanner. Apply the standard pattern. File: financial-foundation.tsx.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Apply associationId filter to accounts and categories API calls",
        description:
          "/api/financial/accounts and /api/financial/categories are called without an associationId param, returning all associations' data. Apply activeAssociationId as a query param to scope the results. File: financial-foundation.tsx.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Rename Finance Foundation page title to Chart of Accounts",
        description:
          '"Finance Foundation" is internal jargon meaningless to volunteer board members. Rename the page title and sidebar label to "Chart of Accounts" or "Financial Setup". Files: financial-foundation.tsx, app-sidebar.tsx.',
        effort: "small",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Move Partial Payment Rules to Payments page and add forward guidance",
        description:
          "Partial Payment Rules is payment configuration that belongs on the Payments page (or Finance Configuration tab), not Finance Foundation alongside the chart of accounts. After moving it, add a Next Step prompt at the bottom of Foundation linking to Fee Schedules. File: financial-foundation.tsx.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Add empty states to accounts and categories tables",
        description:
          "When no accounts or categories exist, the table renders blank with no guidance. Add contextual empty states with CTA buttons to create the first account/category. File: financial-foundation.tsx.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
    ],
  },
  {
    title: "Finance: Recurring Charges, Assessments & Late Fees",
    description:
      "Fix workflow gaps and UX issues on the three charge configuration pages: confirmation dialogs for consequential actions, readable run history, installment previews, and structural reorganization of Late Fees.",
    orderIndex: 4,
    tasks: [
      {
        title: "Add confirmation dialog to Recurring Charges 'Run Now' button",
        description:
          "Run Now triggers immediate charge posting with no confirmation. Wrap in a ConfirmDialog showing: number of schedules due, total amount that will be posted, and a confirm/cancel choice. Risk: accidental duplicate charges. File: financial-recurring-charges.tsx.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Resolve unitId to unit number in Recurring Charges run history table",
        description:
          'The Unit column in run history shows: r.unitId.slice(0, 8) + "…" — a raw truncated UUID. Resolve using units data (already fetched elsewhere) to show human-readable unit numbers. File: financial-recurring-charges.tsx.',
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Add visible interaction affordance for schedule row filter in Recurring Charges",
        description:
          "Clicking a schedule row filters the run history below, but there is no visual affordance for this. Add a View runs button or chevron on each row. File: financial-recurring-charges.tsx.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Add live per-installment amount preview to Special Assessments form",
        description:
          "The create form takes Total Amount and Installment Count but never shows the per-installment amount. Add a live computed display (e.g., = $1,000 / installment) and add a Per Installment column to the table. File: financial-assessments.tsx.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Apply associationId filter to Special Assessments query and add page header",
        description:
          "Assessments query is unscoped and page lacks WorkspacePageHeader + AssociationScopeBanner. Apply activeAssociationId filter and add standard headers. File: financial-assessments.tsx.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Wrap Special Assessment deactivate in a confirmation dialog",
        description:
          "Deactivating an active assessment that has partially posted installments could create accounting inconsistencies. Add a ConfirmDialog with a warning about this risk. File: financial-assessments.tsx.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Reorganize Late Fees page into three tabs: Rules, Fee Activity, Recovery",
        description:
          "Late Fees contains 6 domains across 3 user intents: Configuration (rules, thresholds, escalation), Operations (late fee events), Recovery (payment plans, collections handoff). Split into three clearly labelled tabs. A daily-triage manager should not have to scroll past configuration to reach payment plans. File: financial-late-fees.tsx.",
        effort: "large",
        priority: "high",
        status: "todo",
      },
      {
        title: "Add confirmation dialogs to batch late fee application actions",
        description:
          "Apply fees and Run scan actions are financially consequential and currently have no confirmation step. Wrap in ConfirmDialogs showing scope (association, date range, estimated fee count). File: financial-late-fees.tsx.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
    ],
  },
  {
    title: "Finance: Utilities & Ledger",
    description:
      "Fix the underbuilt Utilities page (unreadable code, no filtering, no inline status update) and address ledger UX gaps (jargon, missing column, raw JSON audit log).",
    orderIndex: 5,
    tasks: [
      {
        title: "Expand Utilities table from minified JSX and add DataTableShell with filtering",
        description:
          "The utilities table is written as a single minified line with no filtering, sorting, or pagination. Expand to readable multi-line format and wrap in DataTableShell with status filter (due/scheduled/paid), sort by due date, and search. File: financial-utilities.tsx.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Add inline Mark Paid action to Utilities table rows",
        description:
          "The most common utility workflow (bill arrives → pay → mark paid) has no inline action. Add a Mark Paid button per row that PATCHes the status to paid. File: financial-utilities.tsx.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Apply associationId filter to Utilities query and fix attachment table",
        description:
          "Utilities fetches without an associationId param. Also, the attachment table shows raw expenseId UUIDs instead of utility type + provider names. File: financial-utilities.tsx.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Fix Owner Ledger amount field label and add Description column",
        description:
          'Amount field label reads "(positive=owed, negative=credit)" — developer jargon in a user form. Replace with a sign-aware Entry Type selector or help tooltip. Also add the Description field (already in schema and CSV export) as a column in the All Ledger Entries table. File: financial-ledger.tsx.',
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Format audit log Details column as readable key-value pairs",
        description:
          'The Financial Change History table renders: JSON.stringify(log.afterJson).slice(0, 80) — producing unreadable raw JSON. Format as structured key: value pairs or a human-readable diff summary. File: financial-ledger.tsx.',
        effort: "small",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Apply associationId filter to ledger entries table and add last-scan timestamp",
        description:
          "The All Ledger Entries table fetches all entries without an association filter despite assocFilter being available. Also add a Last scanned: X ago timestamp next to the Run Scan button in the Financial Alerts panel. File: financial-ledger.tsx.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Add visible label to Send Notice button in Balance Summary table",
        description:
          "The SendNoticeDialog trigger is an icon-only button — fails accessibility and discoverability. Add a visible text label or switch to a labeled small button. File: financial-ledger.tsx.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
    ],
  },
  {
    title: "Finance: Invoices, Budgets, Reports & Reconciliation",
    description:
      "Fix broken navigation, blocked attachment section, missing bulk actions in Invoices; add setup guidance in Budgets; add tooltip context in Reports; add workflow guidance in Reconciliation.",
    orderIndex: 6,
    tasks: [
      {
        title: "Fix broken Vendor Invoices shortcut route from /app/financial-ledger to /app/financial/ledger",
        description:
          "WorkspacePageHeader shortcut at line ~269 points to /app/financial-ledger which is a stale route. Update to the correct path. File: financial-invoices.tsx.",
        effort: "small",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Move Invoice Attachments card outside AsyncStateBoundary",
        description:
          "The attachments card is wrapped inside AsyncStateBoundary alongside the invoice table. When isEmpty={!invoices?.length} the attachments section is hidden entirely. Move it outside the boundary so it is always accessible. File: financial-invoices.tsx.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Add bulk approval to Vendor Invoices table",
        description:
          "Approving invoices one-by-one is tedious for routine AP batches. Add a checkbox column and an Approve Selected bulk action button that appears when rows are selected. File: financial-invoices.tsx.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Add Paid (MTD) KPI card to Vendor Invoices and fix vendor help note",
        description:
          "The three KPI cards show Pending, Approved, Overdue — but not Paid. Add a Paid (MTD) card. Also replace the raw route path in the vendor help note with a clickable link. File: financial-invoices.tsx.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Add Budget setup guidance for three-step hierarchy",
        description:
          "Budgets require: Budget → Version → Line Items in order, with no explanation for first-time users. Add a numbered callout (or wizard sequence) when no budgets exist. Disabled buttons should explain why they are disabled. File: financial-budgets.tsx.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Replace custom Budget status CSS strings with shadcn Badge variants",
        description:
          "STATUS_COLORS uses raw Tailwind class strings (bg-yellow-100 text-yellow-800 etc.) instead of <Badge variant>. Inconsistent with all other finance pages. Replace with Badge variants. File: financial-budgets.tsx.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Add color-coded variance indicators to Budget line items table",
        description:
          "BudgetVarianceRow.varianceAmount is available but shown as raw numbers. Color-code: red for overspend (positive variance), green for underspend (negative variance). A simple colored amount or indicator column is sufficient. File: financial-budgets.tsx.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Add report type descriptions and print export to Financial Reports",
        description:
          'Report type labels (P&L, AR Aging, Reserve, Board) are financial jargon. Add a subtitle or tooltip for each. Also add a print button using window.print() with print-optimized CSS — board reports are commonly needed as PDFs for meeting packets. File: financial-reports.tsx.',
        effort: "medium",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Add step progress indicator and fix CSV error handling in Reconciliation",
        description:
          "Reconciliation has a 4-step workflow (Import → Auto-match → Manual match → Lock) that is never communicated. Add a step progress indicator. Also fix parseBankCsv: return { rows, errors } instead of empty array on format failure, and show the error to the user. File: financial-reconciliation.tsx.",
        effort: "medium",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Add match progress summary and Lock Period confirmation to Reconciliation",
        description:
          "Show a matched/unmatched summary bar above the transaction table (e.g., 38 matched, 4 unmatched — $1,240 remaining). Wrap Lock Period in a ConfirmDialog with period summary — locking is irreversible and currently has no prominent warning. File: financial-reconciliation.tsx.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
    ],
  },
  {
    title: "Command Palette Enhancement",
    description:
      "Extend the command palette with financial record search and context-sensitive actions based on the current route.",
    orderIndex: 7,
    tasks: [
      {
        title: "Expand command palette search to include invoices and ledger entries",
        description:
          "Current search covers persons, units, vendors, work orders, documents — not financial records. Add invoice (by number, vendor, amount) and ledger entry (by description, date, amount) search. Add result groups: Invoices and Financial Records. File: global-command-palette.tsx.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Add context-sensitive command palette actions based on current route",
        description:
          "The Create section shows a static list regardless of current route. Associate command sets with route prefixes: /app/financial/* → Record Payment, Create Invoice, Mark Invoice Paid; /app/work-orders → Create Work Order; /app/board → Add Board Member, Schedule Meeting. File: global-command-palette.tsx.",
        effort: "medium",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Show active association context in command palette header",
        description:
          "When the palette opens, display a subtle scope pill above the search input showing the active association. Prevents accidental cross-association actions. File: global-command-palette.tsx.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
    ],
  },
  {
    title: "Owner Portal UX",
    description:
      "Deliver a role-split landing experience, persistent balance strip, and mobile-first layout for the owner portal.",
    orderIndex: 8,
    tasks: [
      {
        title: "Implement role-split portal landing for owners vs. board members",
        description:
          "hasBoardAccess and effectiveRole already exist on PortalSession. Use them to drive differentiated first screens: resident owner → balance + maintenance + documents; board member → attention items + upcoming meetings + governance tasks + financial snapshot. All tabs remain accessible for both roles. File: owner-portal.tsx.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Add persistent balance strip to all owner portal views",
        description:
          "Add a sticky header strip visible on all portal tabs showing: current balance (color-coded by status), due date, and Pay Now CTA. Strip is hidden when balance is $0 and no upcoming due date. File: owner-portal.tsx.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Redesign owner portal for mobile-first with bottom tab navigation",
        description:
          "The portal uses a desktop-centric layout. Residents' primary device is mobile. Implement: bottom tab bar on <md screens (Home, Payments, Maintenance, Documents, Account), stacked card lists replacing tables on mobile, pinned Pay Now CTA, 44px minimum touch targets. File: owner-portal.tsx.",
        effort: "large",
        priority: "high",
        status: "todo",
      },
    ],
  },
];

async function upsertProject() {
  let [project] = await db.select().from(roadmapProjects).where(eq(roadmapProjects.title, projectTitle));

  if (!project) {
    [project] = await db
      .insert(roadmapProjects)
      .values({
        title: projectTitle,
        description: projectDescription,
        status: "active",
        isCollapsed: 0,
      })
      .returning();
    console.log(`Created roadmap project: ${project.title}`);
  } else {
    [project] = await db
      .update(roadmapProjects)
      .set({
        description: projectDescription,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(roadmapProjects.id, project.id))
      .returning();
    console.log(`Updated roadmap project: ${project.title}`);
  }

  for (const wsDef of workstreams) {
    let [workstream] = await db
      .select()
      .from(roadmapWorkstreams)
      .where(and(eq(roadmapWorkstreams.projectId, project.id), eq(roadmapWorkstreams.title, wsDef.title)));

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
      console.log(`  Created workstream: ${workstream.title}`);
    } else {
      [workstream] = await db
        .update(roadmapWorkstreams)
        .set({
          description: wsDef.description,
          orderIndex: wsDef.orderIndex,
          updatedAt: new Date(),
        })
        .where(eq(roadmapWorkstreams.id, workstream.id))
        .returning();
      console.log(`  Updated workstream: ${workstream.title}`);
    }

    for (const taskDef of wsDef.tasks) {
      const [existingTask] = await db
        .select()
        .from(roadmapTasks)
        .where(
          and(
            eq(roadmapTasks.projectId, project.id),
            eq(roadmapTasks.workstreamId, workstream.id),
            eq(roadmapTasks.title, taskDef.title),
          ),
        );

      if (!existingTask) {
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
        console.log(`    Created task: ${taskDef.title}`);
      } else {
        await db
          .update(roadmapTasks)
          .set({
            description: taskDef.description,
            effort: taskDef.effort,
            priority: taskDef.priority,
            updatedAt: new Date(),
          })
          .where(eq(roadmapTasks.id, existingTask.id));
        console.log(`    Updated task: ${taskDef.title}`);
      }
    }
  }
}

upsertProject()
  .then(() => {
    console.log("\nWorkspace UI/UX Streamlining roadmap project captured.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to capture roadmap project:", error);
    process.exit(1);
  });
