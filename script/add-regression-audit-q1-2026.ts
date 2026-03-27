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
  title: "Regression Testing - Platform Audit Q1 2026",
  description:
    "Comprehensive regression audit covering frontend UI/UX and backend API/data layers. 24 total issues identified across critical, high, medium, and low severity categories.",
  workstreams: [
    {
      title: "Frontend Issues",
      description: "UI regression findings from audit of all client-side pages and components",
      orderIndex: 0,
      tasks: [
        {
          title: "Fix undefined CSS color classes (text-error, bg-error, border-error)",
          description:
            "board-portal.tsx, owner-portal.tsx, owner-portal-redesign.tsx use undefined Tailwind classes. Replace with text-destructive, bg-destructive equivalents.",
          effort: "small",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Add error boundaries to owner portal data fetching",
          description:
            "Multiple useQuery calls in owner-portal.tsx return null on API failure instead of throwing — portal loads blank instead of showing error states. Implement AsyncStateBoundary or proper error state handling.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Fix portal access initialization race condition",
          description:
            'portalAccessId initialized from localStorage with || "" fallback creates empty string — falsy in some checks, truthy in others. Leads to inconsistent query enable/disable behavior.',
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Fix work-orders.tsx to use apiRequest instead of raw fetch",
          description:
            "Line 188 in work-orders.tsx uses raw fetch() for photo upload, bypassing the association scope middleware. Must use apiRequest helper.",
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Audit and fix Material Symbols icon font fallback",
          description:
            "Multiple pages rely on Material Symbols font loaded via CDN with no fallback. Icons won't render if CDN is blocked.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Fix association scoping in communications page query keys",
          description:
            "Query keys in communications.tsx manually construct associationId URLs instead of using useActiveAssociation() hook consistently.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Fix dashboard stale data on association switch",
          description:
            "Dashboard query keys don't include activeAssociationId, so cached data is not invalidated when switching associations.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Standardize error messages in demo request modal",
          description:
            "demo-request-modal.tsx throws generic error string — doesn't distinguish network vs. validation errors.",
          effort: "small",
          priority: "low",
          status: "todo",
        },
        {
          title: "Fix double redirect for /financial/fees route",
          description:
            "PublicRouter redirects /financial/fees → /app/financial/fees which then redirects → /app/financial/recurring-charges. Consolidate to single redirect.",
          effort: "small",
          priority: "low",
          status: "todo",
        },
      ],
    },
    {
      title: "Backend Issues",
      description: "API/data layer regression findings from audit of routes, schema, and storage",
      orderIndex: 1,
      tasks: [
        {
          title: "Implement DELETE endpoints for roadmap (projects, workstreams, tasks)",
          description:
            "No DELETE endpoints exist for /api/admin/projects/:id, /api/admin/workstreams/:id, /api/admin/tasks/:id. Creates orphaned data. Add cascading delete logic.",
          effort: "medium",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Implement individual GET endpoints for roadmap resources",
          description:
            "No GET /api/admin/projects/:id, /workstreams/:id, /tasks/:id endpoints. Frontend can only fetch entire roadmap to access a single item.",
          effort: "medium",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Add circular dependency detection for roadmap tasks",
          description:
            "createRoadmapTask and updateRoadmapTask validate dependency existence and project scope but do not detect circular dependencies (A→B→A). Can cause infinite loops in scheduling.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Add associationId scoping to roadmap tables",
          description:
            "roadmapProjects, roadmapWorkstreams, roadmapTasks have no associationId field — roadmap is global/shared across all tenants. Violates multi-tenant isolation.",
          effort: "large",
          priority: "high",
          status: "todo",
        },
        {
          title: "Fix VAPID JWT implementation in push-provider.ts",
          description:
            "push-provider.ts uses placeholder DER key structure and empty x/y coordinates in JWK. VAPID JWT generation will produce invalid tokens, silently breaking web push.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Add phone number normalization to SMS/contact routes",
          description:
            "normalizePhoneNumber() exists in sms-provider.ts but is never called in request handlers. Inconsistent formats stored in DB cause SMS delivery failures.",
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Complete getRoadmap() to include executive updates and analysis data",
          description:
            "storage.getRoadmap() delegates entirely to buildRoadmapResponse() which only returns projects/workstreams/tasks. Missing integration with executiveUpdates and analysisVersions tables.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Add createdAt/updatedAt timestamps to ownerships table",
          description:
            "ownerships table is missing audit timestamps unlike every other table in the schema. Breaks audit trail consistency.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Standardize error response format across all routes",
          description:
            "Routes return inconsistent error payloads — some { message }, some { message: error.message }, some with additional context. Standardize to a consistent format.",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Enhance SMS provider configuration validation",
          description:
            "isSmsProviderConfigured() only checks field presence, not format validity. Invalid credentials are reported as configured, failing at runtime.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Fix portal access unique constraint for NULL unitId",
          description:
            "PostgreSQL treats multiple NULLs as distinct, allowing duplicate owner-level portal access rows. Fix the unique constraint to handle NULL unitId correctly.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
      ],
    },
  ],
};

async function upsertProject(projectDef: ProjectDef) {
  let [proj] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, projectDef.title));

  if (!proj) {
    [proj] = await db
      .insert(roadmapProjects)
      .values({
        title: projectDef.title,
        description: projectDef.description,
        status: "active",
        isCollapsed: 0,
      })
      .returning();
    console.log(`[+] Project: ${proj.title} (id: ${proj.id})`);
  } else {
    console.log(`[~] Project already exists: ${proj.title} (id: ${proj.id})`);
  }

  for (const wsDef of projectDef.workstreams) {
    let [workstream] = await db
      .select()
      .from(roadmapWorkstreams)
      .where(
        and(
          eq(roadmapWorkstreams.projectId, proj.id),
          eq(roadmapWorkstreams.title, wsDef.title)
        )
      );

    if (!workstream) {
      [workstream] = await db
        .insert(roadmapWorkstreams)
        .values({
          projectId: proj.id,
          title: wsDef.title,
          description: wsDef.description,
          orderIndex: wsDef.orderIndex,
          isCollapsed: 0,
        })
        .returning();
      console.log(`  [+] Workstream: ${workstream.title} (id: ${workstream.id})`);
    } else {
      console.log(`  [~] Workstream already exists: ${workstream.title} (id: ${workstream.id})`);
    }

    for (const taskDef of wsDef.tasks) {
      const [existing] = await db
        .select()
        .from(roadmapTasks)
        .where(
          and(
            eq(roadmapTasks.projectId, proj.id),
            eq(roadmapTasks.workstreamId, workstream.id),
            eq(roadmapTasks.title, taskDef.title)
          )
        );

      if (!existing) {
        const [task] = await db
          .insert(roadmapTasks)
          .values({
            projectId: proj.id,
            workstreamId: workstream.id,
            title: taskDef.title,
            description: taskDef.description,
            status: taskDef.status,
            effort: taskDef.effort,
            priority: taskDef.priority,
            dependencyTaskIds: [],
          })
          .returning();
        console.log(`    [+] Task: ${task.title}`);
      } else {
        console.log(`    [~] Task already exists: ${existing.title}`);
      }
    }
  }

  return proj;
}

async function run() {
  console.log("Creating Regression Testing - Platform Audit Q1 2026 roadmap project...\n");
  const proj = await upsertProject(project);
  console.log(`\nDone. Project ID: ${proj.id}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
