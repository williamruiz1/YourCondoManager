import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks, roadmapWorkstreams } from "../shared/schema";

const PROJECT_TITLE = "Association Community Hub";

type TaskInsert = {
  workstreamTitle: string;
  title: string;
  description: string;
  effort: "small" | "medium" | "large";
  priority: "low" | "medium" | "high" | "critical";
  status: "todo" | "in-progress" | "done";
};

const newTasks: TaskInsert[] = [
  // ── GAP 1: Events/Calendar Section → WS4 (Landing Page & Branding Engine) ──
  {
    workstreamTitle: "Association Landing Page & Branding Engine",
    title: "Build Events & Upcoming Meetings section component",
    description:
      "Add an 'Upcoming Events' section to the hub that surfaces: (1) upcoming board meetings from governanceMeetings (auto-pulled, with agenda items shown publicly to encourage attendance), (2) admin-created community events (BBQs, cleanups, seasonal activities, annual meetings). Show date, time, title, description, and location. Published meeting minutes link directly from past events. Visibility-filtered like other sections. Simple chronological list — not a full calendar widget. Admin can pin featured events.",
    effort: "medium",
    priority: "medium",
    status: "todo",
  },

  // ── GAP 2: File Upload Infrastructure → WS2 (Schema & API Foundation) ──
  {
    workstreamTitle: "Schema, Data Model & API Foundation",
    title: "Establish file upload infrastructure for hub assets",
    description:
      "Define and implement the file storage strategy for all hub uploads: logo images, banner images, site plan images, map issue photos, notice attachments. Determine storage backend (S3-compatible, local filesystem, or existing platform pattern). Define size limits per file type (e.g., logo max 2MB, site plan max 10MB, issue photos max 5MB each). Implement image optimization/resizing on upload (thumbnails for map issue photos, compressed versions for site plans). Define cleanup policy for orphaned files. Expose a reusable upload endpoint scoped by association. If the platform already has an upload service, extend it for hub use cases.",
    effort: "medium",
    priority: "high",
    status: "todo",
  },

  // ── GAP 3: Association-Type Adaptive Defaults → WS8 (Onboarding) ──
  {
    workstreamTitle: "Hub Onboarding & Setup Wizard",
    title: "Define association-type-specific hub templates and defaults",
    description:
      "Create preset hub configuration templates based on association type: (1) Small condo (6-12 units): minimal sections, contacts-first, no map by default; (2) Mid-size professionally managed: full sections, notices prominent, quick actions for ticket submission and payments; (3) Large multi-building association: all sections including map, building-oriented navigation, comprehensive info blocks; (4) Self-managed HOA: governance-forward, board contacts prominent, meeting integration emphasized. Each template pre-populates: enabled sections, section order, default info block categories, suggested quick actions, and visibility defaults. Applied during onboarding wizard based on association_type field.",
    effort: "medium",
    priority: "medium",
    status: "todo",
  },

  // ── GAP 4: Map Issue Auto-Categorization → WS6 (Infrastructure Map) ──
  {
    workstreamTitle: "Community Infrastructure Map",
    title: "Build category auto-suggestion for map issue reporting",
    description:
      "When a user types an issue description during map issue reporting, auto-suggest a category based on text analysis. Phase 1: keyword matching (e.g., 'light' or 'bulb' → maintenance, 'sidewalk' or 'crack' → repair, 'tree' or 'landscaping' → landscaping, 'sign' → suggestion). Phase 2 (future): integrate with existing AI ingestion infrastructure for smarter classification. Always allow manual override — suggestion is a convenience, not a gate. Show the suggested category as a pre-selected dropdown value the user can change.",
    effort: "medium",
    priority: "medium",
    status: "todo",
  },

  // ── GAP 5: SEO & Friendly URLs → WS9 (Platform Integration) ──
  {
    workstreamTitle: "Platform Integration & Discovery",
    title: "Implement friendly URL slugs and SEO meta for public hubs",
    description:
      "Replace or supplement /community/:associationId (UUID) with human-readable slugs: /community/cherry-hill-court. Add a slug field to hub_page_configs (auto-generated from association name, admin-editable, unique). Support both slug and ID access with slug as canonical. Add OpenGraph meta tags (og:title, og:description, og:image using banner or logo) and standard meta description to public hub pages for search engine and social media preview. Add robots directives: public hubs indexable, authenticated sections noindex. Sitemap generation for enabled public hubs (future enhancement).",
    effort: "medium",
    priority: "medium",
    status: "todo",
  },

  // ── GAP 6: Notice Archive View → WS5 (Notices & Bulletins) ──
  {
    workstreamTitle: "Notices & Bulletins Authoring System",
    title: "Build expired notice archive view for residents",
    description:
      "Add a 'Past Notices' or 'Archive' link below the active notices feed on the hub. Opens a paginated, searchable list of expired notices that the current user has visibility access to. Sorted by most recently expired. Useful for residents who want to reference a past announcement (e.g., 'what were the snow removal rules from last winter?'). Admin can permanently delete archived notices if needed. Archive view clearly labeled as historical content.",
    effort: "small",
    priority: "low",
    status: "todo",
  },

  // ── OPPORTUNITY 1: Resident Feedback Integration → WS4 (Landing Page) ──
  {
    workstreamTitle: "Association Landing Page & Branding Engine",
    title: "Build structured resident feedback submission on hub",
    description:
      "Add a 'Submit Feedback' action on the hub that feeds directly into the existing residentFeedbacks table. Structured form: category (maintenance, management, amenities, communication, neighbor, financial, general — from existing enum), description, optional contact preference. This is distinct from map issues (location-based) and maintenance requests (work-order-oriented) — it captures general association feedback. Available to authenticated residents only. Submitted feedback routes to the existing admin feedback review workflow. Reduces 'email the property manager' friction.",
    effort: "medium",
    priority: "medium",
    status: "todo",
  },

  // ── OPPORTUNITY 2: Key Documents Shelf → WS4 (Landing Page) ──
  {
    workstreamTitle: "Association Landing Page & Branding Engine",
    title: "Build key documents shelf section on hub",
    description:
      "Add a 'Key Documents' section to the hub that surfaces admin-curated important documents from the existing documentVersions system. Admin pins specific documents as hub-visible (bylaws, rules & regulations, annual budget, insurance certificate, etc.). Documents respect existing ownerDocumentVisibility controls. Show document name, type badge, upload date, and download link. Different from the generic 'View Documents' quick action — this is a curated shelf of the most important documents always visible on the hub. Limit to 6-10 pinned documents. Authenticated section (resident+ visibility).",
    effort: "medium",
    priority: "medium",
    status: "todo",
  },

  // ── OPPORTUNITY 3: Board Meeting Auto-Surface → already covered by Events task above ──
  // (Merged into the Events/Calendar task to avoid redundancy)

  // ── OPPORTUNITY 4: Map Issue Heatmap → WS6 (Infrastructure Map) ──
  {
    workstreamTitle: "Community Infrastructure Map",
    title: "Build map issue density heatmap overlay for board/admin",
    description:
      "Add a heatmap toggle to the map viewer (board and admin roles only) that visualizes issue density by area. Color intensity reflects the number of issues (reported + in-progress + under-review) per zone or grid cell. Provides planning insight at a glance: 'the north parking lot has 12 open issues this quarter.' Filter by time period (last 30 days, quarter, year). Optional breakdown by category. Helps boards prioritize capital improvements and maintenance budgets based on actual reported conditions rather than anecdotal observation. Data derived from existing map issue coordinates and status.",
    effort: "medium",
    priority: "low",
    status: "todo",
  },

  // ── OPPORTUNITY 5: Hub Analytics Dashboard → WS7 (Admin Console) ──
  {
    workstreamTitle: "Admin Configuration Console",
    title: "Build hub engagement analytics dashboard for admin",
    description:
      "Add an analytics tab to the hub admin console showing: page views (total and unique), most-clicked quick actions, notice read/view rates, map interaction frequency (issues reported, zones clicked), authentication conversion rate (visitors → authenticated users), top content by engagement. Time-period selector (7d, 30d, 90d). Gives property managers concrete proof of value: 'your hub had 340 visits this month, 47 issue reports filed, 89% of residents authenticated.' Feeds the monetization story — managers can show boards the ROI. Track via lightweight server-side event logging (page load, action click, notice view, auth complete).",
    effort: "large",
    priority: "medium",
    status: "todo",
  },

  // ── OPPORTUNITY 6: Welcome Mode for Prospective Buyers → WS9 (Integration) ──
  {
    workstreamTitle: "Platform Integration & Discovery",
    title: "Build prospective buyer and new resident welcome experience",
    description:
      "Add an admin toggle 'Enable Welcome Mode' in hub config. When enabled, non-authenticated visitors see a curated welcome experience: community highlights, amenities overview, recent community improvements (resolved map issues presented positively), neighborhood information, and a 'Contact Management' or 'Request Information' CTA. This is distinct from the generic public view — it's an intentional marketing/onboarding layer. Admin configures: welcome headline, community highlights (3-5 bullet points), featured amenities, and whether to show resolved improvements. Useful for realtors sharing the community page with buyers, or management companies onboarding new tenants. The hub becomes a selling tool, not just an operations tool.",
    effort: "medium",
    priority: "low",
    status: "todo",
  },
];

async function run() {
  console.log("Adding gap and opportunity tasks to Association Community Hub...\n");

  // Find the project
  const [project] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, PROJECT_TITLE));

  if (!project) {
    console.error(`Project "${PROJECT_TITLE}" not found. Run add-community-hub-roadmap.ts first.`);
    process.exit(1);
  }

  console.log(`Found project: ${project.title} (${project.id})\n`);

  // Load all workstreams for this project
  const workstreams = await db
    .select()
    .from(roadmapWorkstreams)
    .where(eq(roadmapWorkstreams.projectId, project.id));

  const wsMap = new Map(workstreams.map((ws) => [ws.title, ws]));

  let added = 0;
  let skipped = 0;

  for (const task of newTasks) {
    const workstream = wsMap.get(task.workstreamTitle);
    if (!workstream) {
      console.error(`  [!] Workstream not found: "${task.workstreamTitle}" — skipping task "${task.title}"`);
      skipped++;
      continue;
    }

    // Check if task already exists
    const [existing] = await db
      .select()
      .from(roadmapTasks)
      .where(
        and(
          eq(roadmapTasks.projectId, project.id),
          eq(roadmapTasks.workstreamId, workstream.id),
          eq(roadmapTasks.title, task.title),
        ),
      );

    if (existing) {
      console.log(`  [~] Already exists: ${task.title}`);
      skipped++;
      continue;
    }

    await db.insert(roadmapTasks).values({
      projectId: project.id,
      workstreamId: workstream.id,
      title: task.title,
      description: task.description,
      status: task.status,
      effort: task.effort,
      priority: task.priority,
      dependencyTaskIds: [],
    });
    console.log(`  [+] Added to "${task.workstreamTitle}": ${task.title}`);
    added++;
  }

  console.log(`\nDone. Added: ${added}, Skipped: ${skipped}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
