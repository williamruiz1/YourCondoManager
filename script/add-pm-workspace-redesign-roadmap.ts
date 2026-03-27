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

type ProjectDef = {
  title: string;
  description: string;
  workstreams: WorkstreamDef[];
};

const project: ProjectDef = {
  title: "Property Manager Workspace Redesign",
  description:
    "Full-scale redesign of the property manager workspace — covering both the top-level Portfolio Dashboard and the per-Association Workspace view. The redesign adopts an editorial design language ('The Modern Estate') using Newsreader serif display type paired with Manrope for body/label text, a Material 3-inspired color token system, glass-effect navigation, bento-grid KPI cards, and a rich activity ledger/alert sidebar pattern. The goal is to give property managers a premium, high-information-density workspace that surfaces portfolio health, critical alerts, and per-association detail in a single coherent visual system.",
  workstreams: [
    // ── 1. Design System & Theming Foundation ────────────────────────────────
    {
      title: "Design System & Theming Foundation",
      description:
        "Establish the editorial design language, typography scale, color token system, and shared visual primitives that underpin both the Portfolio Dashboard and Association Workspace. This workstream must be completed before UI-layer workstreams begin.",
      orderIndex: 0,
      tasks: [
        {
          title: "Integrate Newsreader serif + Manrope sans-serif typefaces",
          description:
            "Add Google Fonts imports for Newsreader (ital, opsz, wght: 6..72, 200..800) and Manrope (wght: 200..800). Define font-family tokens in tailwind.config: headline → Newsreader, body/label → Manrope. Apply base body font in global CSS. Audit all existing pages to replace hard-coded font-family values with the token system.",
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Implement Material 3 color token system in Tailwind config",
          description:
            "Extend tailwind.config.theme.colors with the full M3 token set: primary (#003d9b), primary-container (#0052cc), on-primary, on-primary-container, secondary (#4c5d8d), secondary-container (#b6c8fe), surface (#f8f9fa), surface-container-lowest through surface-container-highest, outline, outline-variant, error (#ba1a1a), error-container, tertiary (#7b2600), tertiary-fixed, tertiary-container, and all 'on-*' counterparts. Replace all existing hard-coded hex colors in shared components with these tokens.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Define border-radius and shadow tokens",
          description:
            "Set borderRadius tokens: DEFAULT 0.25rem, lg 0.5rem, xl 0.75rem, full 9999px. Define a reusable 'editorial-shadow' box-shadow class (box-shadow: 0px 12px 32px rgba(25,28,29,0.06)) for card elevation. Document usage conventions: xl for main workspace cards, lg for inline widgets, DEFAULT for inline badges/inputs.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Create typography scale utility classes",
          description:
            "Define reusable Tailwind utility classes for the type scale used in the designs: display-xl (serif 5xl bold), display-lg (serif 4xl bold), display-md (serif 2xl semibold), display-sm (serif xl), label-caps (sans 10px uppercase tracking-widest), body-sm (sans text-sm), body-xs (sans text-xs). Use @layer utilities or extend the Tailwind config as appropriate.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Add Material Symbols Outlined icon font",
          description:
            "Include the Google Material Symbols Outlined font (wght,FILL 100..700, 0..1 variable axes) in the global HTML head. Define a global .material-symbols-outlined CSS rule with font-variation-settings defaults (FILL 0, wght 400, GRAD 0, opsz 24). Replace all existing Lucide/Heroicon icon usages in shared navigation components with Material Symbols equivalents to match the design spec.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
      ],
    },

    // ── 2. Shared Navigation Components ─────────────────────────────────────
    {
      title: "Shared Navigation Components",
      description:
        "Redesign the top navigation bar and left sidebar that appear across all property manager workspace pages. These are shared components — changes here cascade to every page in the workspace.",
      orderIndex: 1,
      tasks: [
        {
          title: "Redesign top navigation bar with glass-blur effect",
          description:
            "Rebuild the top nav as a sticky header (z-40, h-16) with bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm. Left section: serif italic 'Estate Admin' branding + horizontal tab-nav links (Portfolio, Associations, Financials, Units) with active state shown as border-b-2 border-blue-700. Right section: notifications icon with error dot badge, settings icon, and user avatar circle (h-8 w-8 rounded-full). Separate the nav from main content with a 1px bg-slate-100 divider.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Redesign left sidebar with fixed 256px width and hover animations",
          description:
            "Rebuild the sidebar as a fixed left panel (w-64, h-screen, top-0, z-30, z-50 for the association workspace). Background: bg-slate-50 dark:bg-slate-950 with border-r border-slate-200/50. Header: serif italic 'Estate Admin' title + 'Premium Management' subtitle (text-xs uppercase tracking-widest). Nav items: flex items-center gap-3, icon (material-symbols-outlined text-[20px]), label (font-sans text-sm tracking-tight). Active state: bg-white shadow-sm text-blue-700 font-bold rounded-lg. Hover state: hover:bg-slate-200/50 hover:translate-x-1 transition-all. Nav items: Dashboard, Associations, Leasing, Maintenance, Accounting, Reports.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Add sidebar bottom section: CTA button, Help, Logout",
          description:
            "At the bottom of the sidebar (mt-auto), add: (1) a full-width 'New Property' CTA button (bg-primary text-white py-2.5 rounded-lg flex items-center gap-2 with add icon, active:scale-95 transition); (2) a Help Center link row with help icon; (3) a Log Out link row with logout icon. Separate from main nav items with a pt-4 border-t border-slate-200/50.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Implement sidebar + top nav layout wrapper component",
          description:
            "Create a reusable WorkspaceLayout React component that wraps both the fixed left sidebar and the sticky top nav, with a main content slot rendered as ml-64 (to clear the sidebar). This layout component should be used by all property manager workspace pages: Portfolio Dashboard, Association Workspace, and any sub-pages. Remove duplicated nav/sidebar markup from individual pages.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Breadcrumb navigation component for sub-pages",
          description:
            "Build a reusable Breadcrumb component rendering a horizontal trail of links (e.g. 'Associations / Workspace'). Style: flex gap-2 text-xs font-label uppercase tracking-widest text-on-surface-variant, with the last segment in text-primary font-bold. Use this component at the top of the Association Workspace hero section. Support 1–3 levels of depth.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
      ],
    },

    // ── 3. Portfolio Dashboard View ──────────────────────────────────────────
    {
      title: "Portfolio Dashboard View",
      description:
        "Build the top-level Portfolio Dashboard — the first screen a property manager sees when they log in. Shows a portfolio-wide KPI summary, the full association list with statuses and balances, a critical alerts panel, and a recent activity timeline.",
      orderIndex: 2,
      tasks: [
        {
          title: "Portfolio hero header with period selector and export action",
          description:
            "Render a header section below the nav with two columns: left — serif display 'Portfolio at a Glance' (text-4xl font-bold) with a subtitle 'Global performance overview across N managed associations.' in text-on-surface-variant; right — two buttons: 'Export Report' (bg-surface-container rounded-lg) and 'Period: Q3 2023' period picker (bg-primary text-on-primary with expand_more icon). Use flex justify-between items-end layout.",
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Financial KPI bento grid (4 cards)",
          description:
            "Render a 4-column responsive grid (grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6) of KPI cards: (1) Total Operating Funds — border-b-2 border-primary/10, serif text-3xl value in text-primary, inline green up-trend badge; (2) Total Reserve Funds — border-b-2 border-secondary/10, serif text-3xl value; (3) Delinquency Rate — border-b-2 border-error/10, value in text-error with red up-trend badge; (4) Portfolio Yield — full bg-primary gradient card (from-primary to-primary-container), white text, large background trending_up icon at -bottom-4 -right-4 opacity-10. All cards: bg-surface-container-lowest p-6 rounded-xl shadow-sm.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Portfolio distribution table with association rows",
          description:
            "Build an 8-column-span table panel (bg-surface-container-lowest rounded-xl shadow-sm) with a filter toggle (All Properties / Residential / Commercial) in the header. Table columns: Association Name (with thumbnail image + name/city), Status badge, Operating Balance (font-mono), Units count, overflow menu button. Status badge variants: Stable (bg-green-100 text-green-800), Critical (bg-tertiary-fixed text-on-tertiary-fixed), Transitioning (bg-secondary-container text-on-secondary-container). Row hover: hover:bg-surface-container-low. Footer: 'View All N Properties' link button.",
          effort: "large",
          priority: "high",
          status: "todo",
        },
        {
          title: "Critical alerts sidebar panel",
          description:
            "Build a 4-column-span right sidebar section titled 'Critical Alerts' (serif xl) with an active count badge (bg-error text-on-error text-[10px] rounded-full). Render alert cards with left border accent and icon: error severity (border-error, warning icon in text-error), tertiary/warning (border-tertiary, water_damage icon), secondary/info (border-secondary, gavel icon). Each card: p-4, bg-{color}-container/30, bold title, xs description text. Connect to real association alert data (low reserve balance, overdue maintenance, election quorum failures).",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Recent activity timeline widget",
          description:
            "Build a recent activity timeline card (bg-surface-container-lowest rounded-xl p-6 shadow-sm) using a vertical connector line (before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-outline-variant/30). Each activity entry: relative pl-8, colored dot (w-4 h-4 rounded-full ring-4 ring-white) in primary/secondary/tertiary/outline depending on type, xs timestamp label (uppercase tracking-widest), sm text description with bolded entity names. 'View Audit Log' button at the bottom (border border-outline-variant hover:bg-surface-container).",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Floating action button on portfolio dashboard",
          description:
            "Render a fixed FAB (bottom-8 right-8 w-14 h-14 bg-primary text-on-primary rounded-full shadow-2xl z-50) with an add icon (text-2xl). On click, open a quick-action menu or 'New Property' creation flow. Apply hover:scale-110 active:scale-95 transition-all.",
          effort: "small",
          priority: "low",
          status: "todo",
        },
      ],
    },

    // ── 4. Association Workspace View ────────────────────────────────────────
    {
      title: "Association Workspace View",
      description:
        "Build the per-association detail workspace — the screen managers land on when drilling into a specific HOA or condo association. Features an editorial hero, quick action tiles, an association health overview strip, onboarding progress tracker, an alerts panel, activity ledger, and a property map widget.",
      orderIndex: 3,
      tasks: [
        {
          title: "Editorial hero header for the association workspace",
          description:
            "Render a hero section (px-10 py-12) with two columns: left — breadcrumb (Associations / Workspace), serif text-5xl association name, text-lg subtitle (e.g. 'Central District Premium Residences • Managed since 2019'); right — 'Property Map' outline button and 'Edit Settings' primary button with arrow_forward icon. Use flex justify-between items-end gap-6 layout. Association name and subtitle should be populated from the selected association record.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Quick actions bento grid (3 tiles)",
          description:
            "Render a 3-column grid of action tiles (bg-surface-container-lowest rounded-xl editorial-shadow group cursor-pointer). Each tile: large icon (text-primary text-[32px] block mb-4), bold heading, xs description. Hover state: bg-primary with all text switching to text-on-primary and text-on-primary/80 using group-hover variants. Tiles: (1) New Work Order — add_task icon, routes to work order creation; (2) Schedule Meeting — calendar_today icon, routes to meeting scheduler; (3) Post Ledger Entry — account_balance_wallet icon, opens ledger entry form.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Association overview stats strip (4 KPI tiles)",
          description:
            "Below the quick action grid, render a full-width card (bg-surface-container-lowest rounded-xl editorial-shadow) with a header bar ('Association Overview' serif text-2xl + 'Full Report' link). The body is a 4-column grid divided by vertical borders (divide-x divide-slate-100). Each tile: p-8, xs uppercase label, text-4xl serif bold value, small status pill beneath. Stats: Total Units (occupancy pill), Active Owners (leased units note), Reserve Fund (YoY change pill), Open Tickets (high-priority pill in error colors). Connect all values to live association data.",
          effort: "large",
          priority: "high",
          status: "todo",
        },
        {
          title: "Onboarding progress tracker card",
          description:
            "Render a card (bg-surface-container-lowest rounded-xl editorial-shadow p-8) with a side-by-side layout: left third — property thumbnail image (rounded-lg object-cover h-48 w-full shadow-inner); right two-thirds — header with 'Onboarding Progress' serif title + subtitle, large percentage value (text-3xl font-headline text-primary font-bold), a progress bar (bg-surface-container h-2 rounded-full with a primary-colored fill div at the correct percentage width), and a checklist of steps (check_circle icons in green for complete, pending icon in primary for in-progress). Connect percentage and step completion to actual association onboarding data.",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Attention required alerts card (right column)",
          description:
            "In the right 4-column panel, render an 'Attention Required' card (bg-white rounded-xl editorial-shadow border-l-4 border-error p-6). Header: warning icon in text-error + bold title. Alert items inside (space-y-4): each alert is a rounded-lg p-4 card in the relevant container color, with a bold title, xs description, and an underlined action link (e.g. 'Review Ledger', 'Resend Notifications'). Populate from real delinquency data and upcoming meeting quorum status.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Activity ledger timeline (right column)",
          description:
            "Build the Activity Ledger card (bg-surface-container-lowest rounded-xl editorial-shadow p-6) using a vertical connector line (before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-surface-container). Each entry: relative pl-8, a 24px circle avatar with icon (payments, edit_document, person_add, build) in contextual background/text colors, bold event title, xs description, 10px uppercase timestamp. 'View Full History' full-width button at the bottom. Pull entries from the association's audit log / ledger history.",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Property map widget (right column)",
          description:
            "Render a map widget card (rounded-xl overflow-hidden editorial-shadow h-48 relative) in the right column. Display a grayscale map background image (opacity-50) with a centered location pin (h-8 w-8 bg-primary rounded-full ring-8 ring-primary/20 with location_on FILL icon). Overlay a bottom bar (bg-white/90 backdrop-blur p-3 rounded-lg) showing the property address on the left and a 'Directions' link in text-primary on the right. The address should be sourced from the association's address field.",
          effort: "medium",
          priority: "low",
          status: "todo",
        },
      ],
    },

    // ── 5. Data Wiring & API Integration ────────────────────────────────────
    {
      title: "Data Wiring & API Integration",
      description:
        "Connect all redesigned UI components to live data from the existing API. Replace any mock/placeholder values with real queries. Add any missing API endpoints or storage methods needed to support the new portfolio-level views.",
      orderIndex: 4,
      tasks: [
        {
          title: "Portfolio-level aggregation API endpoint",
          description:
            "Add a GET /api/admin/portfolio/summary endpoint that returns aggregated metrics across all associations the current admin user manages: total operating funds, total reserve funds, portfolio-wide delinquency rate, average delinquency rate, and portfolio yield. Aggregate from existing financial accounts and ledger data. Cache for 5 minutes to avoid heavy queries on every dashboard load.",
          effort: "large",
          priority: "high",
          status: "todo",
        },
        {
          title: "Portfolio association list with status and operating balance",
          description:
            "Extend the existing associations list API (or add a dedicated /api/admin/portfolio/associations endpoint) to include: operating account balance (from financialAccounts), reserve fund balance, unit count, occupancy percentage, and a computed status field (Stable / Critical / Transitioning) based on reserve fund level, delinquency rate, and open critical tickets. Used to populate the Portfolio Distribution table.",
          effort: "large",
          priority: "high",
          status: "todo",
        },
        {
          title: "Critical alerts aggregation across associations",
          description:
            "Add a GET /api/admin/portfolio/alerts endpoint that returns a prioritized list of critical conditions across all managed associations: low reserve balances (below 15% of annual budget), overdue work orders (high priority > 7 days), board election quorum failures, and delinquency spikes (> 5% MoM increase). Each alert includes associationId, type, severity, and a short description. Used to populate the Critical Alerts sidebar on the Portfolio Dashboard.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Association workspace data aggregation query",
          description:
            "Add or extend the association detail API to return all data needed by the Association Workspace in a single call: unit count + occupancy, active owner count, leased unit count, reserve fund balance + YoY change, open work order count + high-priority count, onboarding progress percentage + step completion array, and the association address for the map widget. Reduces waterfall queries on workspace load.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Activity ledger feed for association workspace",
          description:
            "Add a GET /api/admin/associations/:id/activity endpoint that returns a chronological feed of recent association activity: financial transactions, new owner onboarding events, work order status changes, document uploads, meeting scheduling, and bylaw revisions. Limit to the 10 most recent events by default. Each event: type, title, description, actor name, and timestamp.",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
      ],
    },

    // ── 6. Responsive Layout & QA ────────────────────────────────────────────
    {
      title: "Responsive Layout & QA",
      description:
        "Ensure the redesigned workspace is production-quality: responsive on tablet and large desktop, dark mode compliant, accessible, and visually consistent across Chrome, Firefox, and Safari.",
      orderIndex: 5,
      tasks: [
        {
          title: "Responsive 12-column grid layout for main content areas",
          description:
            "Apply the grid grid-cols-12 gap-8 layout for the main content zones on both the Portfolio Dashboard (8/4 split) and Association Workspace (8/4 split). Ensure the 8-column primary panel collapses to full-width on screens below lg. The 4-column right sidebar stacks below the main content on md and below. Verify all bento grids and stat strips reflow correctly at mobile widths.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Dark mode support for redesigned components",
          description:
            "Add dark: variants for all redesigned components: sidebar (dark:bg-slate-950 dark:border-slate-800/50), top nav (dark:bg-slate-900/80), card backgrounds (use dark:bg-slate-900), text tokens (dark:text-blue-100, dark:text-slate-400), and dividers (dark:bg-slate-800). Test with the 'dark' class on the html element. Ensure all color token usages in the new components have dark equivalents.",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Accessibility audit of redesigned workspace",
          description:
            "Run an axe or Lighthouse accessibility audit on the Portfolio Dashboard and Association Workspace. Fix: missing aria-labels on icon-only buttons (notifications, settings, FAB), insufficient color contrast on badge variants (check tertiary-fixed and secondary-container text), missing table caption/scope on the Portfolio Distribution table, and keyboard focus styles on all interactive elements.",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Cross-browser visual QA pass",
          description:
            "Test the redesigned workspace in Chrome, Firefox, and Safari. Verify: backdrop-blur-xl renders correctly (needs -webkit-backdrop-filter in Safari), font-variation-settings on Material Symbols work in all browsers, before: pseudo-element timeline connectors render at correct positions, and grid layouts do not overflow on any tested browser.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Page load performance optimization",
          description:
            "Add font-display: swap to Google Fonts requests to prevent FOUT. Lazy-load association thumbnail images in the Portfolio Distribution table using loading='lazy'. Ensure the portfolio summary API call is initiated before the component tree renders (prefetch via React Query or server-side loader). Measure and document Time to Interactive on the Portfolio Dashboard.",
          effort: "medium",
          priority: "low",
          status: "todo",
        },
      ],
    },
  ],
};

async function upsertProject(def: ProjectDef) {
  let [project] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, def.title));

  if (!project) {
    [project] = await db
      .insert(roadmapProjects)
      .values({ title: def.title, description: def.description, status: "active", isCollapsed: 0 })
      .returning();
    console.log(`\n[+] Created project: ${project.title}`);
  } else {
    [project] = await db
      .update(roadmapProjects)
      .set({ description: def.description, updatedAt: new Date() })
      .where(eq(roadmapProjects.id, project.id))
      .returning();
    console.log(`\n[~] Updated project: ${project.title}`);
  }

  for (const wsDef of def.workstreams) {
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
      console.log(`  [+] Workstream: ${workstream.title}`);
    } else {
      [workstream] = await db
        .update(roadmapWorkstreams)
        .set({ description: wsDef.description, orderIndex: wsDef.orderIndex, updatedAt: new Date() })
        .where(eq(roadmapWorkstreams.id, workstream.id))
        .returning();
      console.log(`  [~] Workstream: ${workstream.title}`);
    }

    for (const taskDef of wsDef.tasks) {
      const [existing] = await db
        .select()
        .from(roadmapTasks)
        .where(
          and(
            eq(roadmapTasks.projectId, project.id),
            eq(roadmapTasks.workstreamId, workstream.id),
            eq(roadmapTasks.title, taskDef.title)
          )
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
        console.log(`    [+] Task: ${taskDef.title}`);
      } else {
        await db
          .update(roadmapTasks)
          .set({ description: taskDef.description, effort: taskDef.effort, priority: taskDef.priority, updatedAt: new Date() })
          .where(eq(roadmapTasks.id, existing.id));
        console.log(`    [~] Task (updated): ${taskDef.title}`);
      }
    }
  }
}

async function run() {
  console.log("Seeding Property Manager Workspace Redesign into Admin Roadmap...\n");
  await upsertProject(project);
  console.log("\nDone.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
