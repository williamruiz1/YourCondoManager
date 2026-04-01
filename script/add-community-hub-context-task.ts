import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks, roadmapWorkstreams } from "../shared/schema";

const PROJECT_TITLE = "Association Community Hub";
const WORKSTREAM_TITLE = "Service Intent & Operating Model";

const task = {
  title: "Implementation checkpoint — session 1 handoff context",
  description: `## What was completed (session 1, 2026-03-28)

### Schema & Database (WS2 — substantially done)
- 7 new enums: hub_visibility_level, hub_info_block_category, hub_action_route_type, hub_map_node_type, hub_map_issue_category, hub_map_issue_status, hub_notice_category
- 6 new tables created and migrated: hub_page_configs, hub_action_links, hub_info_blocks, hub_map_layers, hub_map_nodes, hub_map_issues
- Extended community_announcements with 5 hub notice fields: notice_category, visibility_level, attachments, is_draft, scheduled_publish_at
- Migration script: script/create-hub-schema.ts

### API Endpoints (WS2 — substantially done)
- Admin CRUD APIs (requireAdmin-protected): hub config (GET/PUT upsert), action links (GET/POST/PUT/DELETE, max 8 enforced), info blocks (GET/POST/PUT/DELETE), map layers (GET/POST/PUT), map nodes (GET/POST/PUT/DELETE), map issues (GET with status/category filters, PUT for status updates), notices (GET/POST/PUT/DELETE)
- Public API: GET /api/hub/:identifier/public — unauthenticated, resolves by slug or association ID, returns only public-safe data (config, association, public notices, info blocks, action links)
- Portal API: GET /api/hub/portal/home — role-filtered hub data for authenticated residents with visibility hierarchy (public < resident < owner < board), POST /api/hub/portal/map/issues — issue reporting, GET /api/hub/portal/map/issues/mine
- All endpoints added to server/routes.ts near the end of registerRoutes(), before return httpServer

### Frontend (WS4, WS7 — initial scaffolding)
- Admin config page: client/src/pages/community-hub.tsx — tabbed interface (Configuration, Quick Actions, Info Blocks, Map) with full CRUD for each entity type
- Public hub page: client/src/pages/community-hub-public.tsx — themed hero banner, quick actions grid, notices with priority badges, info blocks with category icons, resident portal CTA
- Route: /app/community-hub (admin), /community/:identifier (public)
- Sidebar nav entry added to app-sidebar.tsx under association modules with Globe icon

### Roadmap seed scripts
- script/add-community-hub-roadmap.ts — 11 workstreams, 64 tasks
- script/add-community-hub-gap-tasks.ts — 11 additional gap/opportunity tasks (75 total)

## What's next (priority order)

### Immediate (WS2 remaining)
- Audit log entries for hub content changes — the task exists but no implementation yet
- File upload infrastructure (gap task) — no upload endpoint exists; logo/banner/site plan/issue photos all use URL fields currently

### WS3: Authentication & Role-Based Access
- Verify tenant PIN auth works (portalAccess role="tenant")
- Build public-to-authenticated transition flow on the hub page (login prompt → portal auth → return to hub with elevated content)
- Session persistence for portal users viewing the hub

### WS4: Landing Page & Branding Engine (extend existing scaffolding)
- Section reordering UI (drag-and-drop or arrow buttons in admin)
- Enabled sections toggles in admin config
- Events & upcoming meetings section (gap task)
- Resident feedback submission integration (gap task)
- Key documents shelf section (gap task)

### WS5: Notices & Bulletins Authoring
- Draft/publish workflow UI (is_draft, scheduled_publish_at already in schema)
- Notice category filtering in admin and public views
- Notice archive view for expired notices (gap task)
- Rich text editor for notice body

### WS6: Community Infrastructure Map
- Interactive map viewer component (click-on-site-plan to report issues)
- Map node placement UI (admin defines buildings/areas on uploaded site plan)
- Issue photo upload in reporting flow
- Category auto-suggestion (gap task)
- Heatmap overlay for board/admin (gap task)

### WS8: Hub Onboarding & Setup Wizard
- Association-type-specific templates and defaults (gap task)
- Guided setup flow for first-time hub configuration

### WS9: Platform Integration & Discovery
- Friendly URL slugs (slug field exists in schema, needs uniqueness validation UI)
- SEO meta tags for public hub pages (gap task)
- Prospective buyer welcome experience (gap task)

### WS10: Mobile Optimization
- Responsive testing and mobile-specific layout adjustments
- Touch-optimized map interaction

### WS11: Verification, QA & Launch
- End-to-end testing of public → auth → role-filtered content flow
- Hub analytics dashboard (gap task)
`,
  effort: "small" as const,
  priority: "high" as const,
  status: "done" as const,
};

async function run() {
  console.log("Adding implementation checkpoint task...\n");

  const [project] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, PROJECT_TITLE));

  if (!project) {
    console.error(`Project "${PROJECT_TITLE}" not found.`);
    process.exit(1);
  }

  const [workstream] = await db
    .select()
    .from(roadmapWorkstreams)
    .where(
      and(
        eq(roadmapWorkstreams.projectId, project.id),
        eq(roadmapWorkstreams.title, WORKSTREAM_TITLE),
      ),
    );

  if (!workstream) {
    console.error(`Workstream "${WORKSTREAM_TITLE}" not found.`);
    process.exit(1);
  }

  // Check if already exists
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
    // Update it
    await db.update(roadmapTasks).set({
      description: task.description,
      effort: task.effort,
      priority: task.priority,
      status: task.status,
      updatedAt: new Date(),
    }).where(eq(roadmapTasks.id, existing.id));
    console.log(`[~] Updated: ${task.title}`);
  } else {
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
    console.log(`[+] Added: ${task.title}`);
  }

  console.log("\nDone.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
