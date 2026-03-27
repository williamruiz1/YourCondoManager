/**
 * Admin Contextual Feedback Widget Roadmap Seed Script
 *
 * Creates an admin-roadmap project for planning and implementing the
 * platform-admin-only contextual feedback widget. Safe to rerun: if the
 * project already exists by title, the script exits without creating duplicates.
 *
 * Run with: npx tsx scripts/seed-admin-contextual-feedback-widget-roadmap.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import pg from "pg";
import * as schema from "../shared/schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const { roadmapProjects, roadmapWorkstreams, roadmapTasks } = schema;

const projectTitle = "Active Project - Admin Contextual Feedback Widget";

async function createProject(data: schema.InsertRoadmapProject) {
  const [result] = await db.insert(roadmapProjects).values(data).returning();
  return result;
}

async function createWorkstream(data: schema.InsertRoadmapWorkstream) {
  const [result] = await db.insert(roadmapWorkstreams).values(data).returning();
  return result;
}

async function createTask(data: schema.InsertRoadmapTask) {
  const [result] = await db.insert(roadmapTasks).values(data).returning();
  return result;
}

async function main() {
  const [existingProject] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, projectTitle))
    .limit(1);

  if (existingProject) {
    console.log(`Roadmap project already exists: ${existingProject.id}`);
    return;
  }

  console.log("Creating admin contextual feedback roadmap project...");

  const project = await createProject({
    title: projectTitle,
    description:
      "Plan and implement a platform-admin-only contextual feedback widget that lets admins inspect live UI elements, capture route and DOM context, attach screenshots to roadmap tickets, reopen and edit existing findings in place, and support mobile touch interactions without disturbing the underlying page workflow.",
    status: "active",
  });

  const workstreams = [
    {
      title: "Service Intent, Access Model, and Scope Boundaries",
      description:
        "Lock the operating model for a platform-admin-only inspection and feedback workflow that writes into the existing Admin roadmap instead of a separate backlog system.",
      orderIndex: 0,
      tasks: [
        {
          title: "Confirm service model and success criteria for contextual admin feedback",
          description:
            "Define the intended operator workflow from noticing a UI issue to creating or updating a roadmap ticket in under 30 seconds. Keep the feature scoped to this repo and this platform rather than package extraction in the initial delivery.",
          priority: "critical",
          effort: "small",
        },
        {
          title: "Restrict widget visibility and submission authority to platform-admin users",
          description:
            "Map the client gating, server authorization, and route protections so the widget has zero footprint for non-admin users and remains non-usable for board-admin or manager roles even if the roadmap page itself is broader.",
          priority: "critical",
          effort: "small",
        },
        {
          title: "Resolve roadmap ticket editing model for marker interactions",
          description:
            "Define how an existing marker opens an editable ticket experience in place, including which fields can be updated from the widget and how those updates map into existing roadmap records without creating duplicates.",
          priority: "high",
          effort: "small",
        },
      ],
    },
    {
      title: "Toolbar Activation, Inspect Mode, and Mobile Interaction Foundations",
      description:
        "Build the activation and element-selection workflow across desktop and touch devices without allowing the inspected page to mutate underneath the operator.",
      orderIndex: 1,
      tasks: [
        {
          title: "Add lazy-loaded admin toolbar activation control with inactive, inspect, and marker states",
          description:
            "Integrate the widget into the admin toolbar with the cycle Inactive -> Inspect -> Markers -> Inactive, support Escape reset, and preserve zero bundle impact when the viewer is not a platform admin.",
          priority: "critical",
          effort: "medium",
        },
        {
          title: "Implement viewport overlay, hover highlighting, and inspector tooltip at 60fps",
          description:
            "Use an interception overlay plus throttled element detection to highlight the target node, show tag and class context, and keep cursor tracking responsive without layout thrashing.",
          priority: "critical",
          effort: "medium",
        },
        {
          title: "Suppress native clicks, form submissions, and navigation while keeping scroll active",
          description:
            "Ensure inspect mode is non-destructive by blocking page actions, preserving scroll, and exiting cleanly if the route changes or the inspected DOM mutates mid-flow.",
          priority: "critical",
          effort: "medium",
        },
        {
          title: "Support touch interaction with move, long-press select, and mobile-safe overlay behavior",
          description:
            "Translate the desktop inspector into a mobile-safe interaction model using touchmove and long-press selection, while keeping accidental taps from triggering the underlying page.",
          priority: "high",
          effort: "medium",
        },
      ],
    },
    {
      title: "Context Capture and Feedback Authoring",
      description:
        "Capture enough positional and technical context on selection that the ticket reviewer can locate the exact element without re-interviewing the admin.",
      orderIndex: 2,
      tasks: [
        {
          title: "Capture selector, DOM path, route, scroll, viewport, timestamp, and admin identity on selection",
          description:
            "Create a stable context payload including CSS selector, DOM path, current route, scroll position, viewport metrics, element bounds, timestamp, and current platform-admin identity before the feedback form opens.",
          priority: "critical",
          effort: "medium",
        },
        {
          title: "Add best-effort React component-name detection from the rendered tree",
          description:
            "Inspect React fiber internals when available and persist the nearest named component as best-effort debugging context without making the feature dependent on React DevTools or development-only builds.",
          priority: "medium",
          effort: "small",
        },
        {
          title: "Build anchored feedback form with bug or enhancement type, priority, and keyboard support",
          description:
            "Open a smart-positioned floating panel near the selected element that supports title, description, type toggle, priority, context summary, cancel and submit actions, and keyboard shortcuts including Ctrl/Cmd+Enter submit.",
          priority: "critical",
          effort: "medium",
        },
      ],
    },
    {
      title: "Roadmap Persistence, Attachments, and Editable Ticket Flow",
      description:
        "Write captured findings into the existing Admin roadmap and extend that model so screenshots can live with the ticket record instead of only inside text blobs.",
      orderIndex: 3,
      tasks: [
        {
          title: "Define roadmap ticket mapping from contextual feedback into existing roadmap records",
          description:
            "Map bug and enhancement submissions into the current Admin roadmap structure with consistent title prefixes, descriptive context blocks, route tagging, priority mapping, and a predictable backlog location for triage.",
          priority: "critical",
          effort: "small",
        },
        {
          title: "Enhance roadmap data model and API to support image attachments on feedback tickets",
          description:
            "Add first-party attachment support so screenshots can be stored with the roadmap ticket record rather than embedded as fragile base64 text inside the description. Cover storage shape, upload path, retrieval, and rendering in the roadmap UI.",
          priority: "critical",
          effort: "large",
        },
        {
          title: "Implement widget submission adapter against the Admin roadmap endpoints",
          description:
            "Create the in-repo adapter that persists newly captured contextual feedback into the Admin roadmap backlog and returns the created ticket identifier for marker registration and toast confirmation.",
          priority: "critical",
          effort: "medium",
        },
        {
          title: "Implement in-widget editing flow for existing contextual tickets",
          description:
            "Allow a marker click to reopen the ticket in an editable form, update the roadmap record and attached screenshot metadata when needed, and preserve an audit-friendly update path rather than creating duplicate tickets.",
          priority: "high",
          effort: "medium",
        },
      ],
    },
    {
      title: "Screenshot Capture, Marker Persistence, and Recall Experience",
      description:
        "Provide a reliable visual capture and a route-aware recall layer so admins can see what has already been reported and reopen work directly in context.",
      orderIndex: 4,
      tasks: [
        {
          title: "Integrate screenshot capture with timeout and graceful fallback handling",
          description:
            "Capture a padded region around the selected element, handle failures and timeouts cleanly, and make screenshot capture optional so ticket creation still succeeds if the browser or page blocks rendering.",
          priority: "high",
          effort: "medium",
        },
        {
          title: "Persist marker registry in local storage with capped retention and stale-position fallback",
          description:
            "Store ticket ID, route, selector, element bounds, and verification metadata locally, cap the registry at 200 entries, and gracefully degrade when local storage is unavailable.",
          priority: "high",
          effort: "medium",
        },
        {
          title: "Render route-filtered open-ticket markers with status refresh and stale detection",
          description:
            "Reconcile local markers against live roadmap task status, hide resolved items, re-anchor markers to relocated elements when possible, and show stale-position indicators when the original element no longer exists.",
          priority: "high",
          effort: "medium",
        },
        {
          title: "Support marker overlap clustering and editable detail popovers",
          description:
            "Cluster dense marker regions on routes with many open findings, open a popover with ticket details and screenshot preview, and allow an operator to jump into editing or deep-link into the roadmap page.",
          priority: "medium",
          effort: "medium",
        },
      ],
    },
    {
      title: "Security, Performance, and UI Isolation",
      description:
        "Harden the feature so it performs predictably, does not leak data, and does not collide with the surrounding application styles or workflows.",
      orderIndex: 5,
      tasks: [
        {
          title: "Enforce screenshot and feedback handling through first-party authenticated APIs only",
          description:
            "Keep screenshots and text on platform-owned infrastructure, reuse existing sanitization for admin-authored content, and ensure ticket status or attachment data is never trusted from local storage alone.",
          priority: "critical",
          effort: "medium",
        },
        {
          title: "Keep widget CSS and portals isolated from host application styles",
          description:
            "Scope the overlay, form, markers, and tooltip styles with a resilient isolation strategy so the widget remains visually stable across the existing admin pages without global CSS collisions.",
          priority: "high",
          effort: "small",
        },
        {
          title: "Validate performance budgets for lazy loading, hover tracking, and marker rendering",
          description:
            "Measure bundle impact, hover responsiveness, marker refresh cost, and screenshot overhead to keep the admin tool responsive on both desktop and mobile hardware.",
          priority: "high",
          effort: "small",
        },
      ],
    },
    {
      title: "Verification, Rollout, and Closure",
      description:
        "Verify the feature end to end across the intended operating scenarios and leave the roadmap with explicit rollout evidence rather than implied completion.",
      orderIndex: 6,
      tasks: [
        {
          title: "Create end-to-end verification checklist for desktop, mobile, and failure-path scenarios",
          description:
            "Verify activation cycling, inspect-mode suppression, context capture, screenshot failure fallback, marker recall, ticket editing, stale selectors, route changes, and touch interactions across supported browsers.",
          priority: "critical",
          effort: "small",
        },
        {
          title: "Add roadmap and product telemetry needed to measure adoption and duplicate rate",
          description:
            "Capture enough signals to track how many admin backlog items come from the widget, how often markers are reopened or edited, and whether duplicate findings on the same route and selector are dropping over time.",
          priority: "medium",
          effort: "small",
        },
        {
          title: "Prepare rollout notes, operator guidance, and roadmap closeout criteria",
          description:
            "Document how platform admins access the feature, where screenshots are stored, which behaviors are best-effort, and what verification evidence is required before marking the project complete.",
          priority: "medium",
          effort: "small",
        },
      ],
    },
  ] as const;

  for (const workstreamInput of workstreams) {
    const workstream = await createWorkstream({
      projectId: project.id,
      title: workstreamInput.title,
      description: workstreamInput.description,
      orderIndex: workstreamInput.orderIndex,
    });

    for (const taskInput of workstreamInput.tasks) {
      await createTask({
        projectId: project.id,
        workstreamId: workstream.id,
        title: taskInput.title,
        description: taskInput.description,
        priority: taskInput.priority,
        effort: taskInput.effort,
        status: "todo",
      });
    }
  }

  console.log(`Created roadmap project: ${project.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
