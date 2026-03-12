import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks, roadmapWorkstreams } from "../shared/schema";

type TaskDef = {
  title: string;
  description: string;
  effort: "small" | "medium" | "large";
  priority: "low" | "medium" | "high" | "critical";
};

type WorkstreamDef = {
  title: string;
  description: string;
  orderIndex: number;
  tasks: TaskDef[];
};

const projectTitle = "Platform Gap Analysis - 2026-03-07";
const projectDescription =
  "Findings from a full end-to-end verification pass across admin, financial, governance, AI ingestion, communications, platform controls, and owner portal workflows.";

const workstreams: WorkstreamDef[] = [
  {
    title: "Authentication and Session Hardening",
    description: "Close high-risk authentication and session gaps in admin and portal access flows.",
    orderIndex: 1,
    tasks: [
      {
        title: "Replace default admin API key fallback with environment-required auth",
        description:
          "The platform currently falls back to a shared dev admin key and default admin identity. Require configured credentials and move to a real authenticated admin session model.",
        effort: "large",
        priority: "critical",
      },
      {
        title: "Replace email-only owner portal login with verifiable authentication",
        description:
          "Portal sessions can be started with only associationId and email, and the returned portal access identifier becomes the long-lived credential. Add a verifiable login or magic-link flow with revocable session tokens.",
        effort: "large",
        priority: "critical",
      },
    ],
  },
  {
    title: "Authorization Enforcement",
    description: "Align modeled access controls with actual server-side enforcement.",
    orderIndex: 2,
    tasks: [
      {
        title: "Enforce admin association scopes on server queries and mutations",
        description:
          "Admin association scopes are configurable in the data model and UI, but request handling still trusts raw associationId filters. Apply scope checks centrally across read and write operations.",
        effort: "large",
        priority: "critical",
      },
      {
        title: "Protect uploaded documents behind authenticated authorization checks",
        description:
          "Uploaded files are retrievable from a public endpoint without admin or portal authorization. Gate file reads by caller identity and document audience before serving content.",
        effort: "medium",
        priority: "critical",
      },
    ],
  },
  {
    title: "Feature Integrity and Delivery",
    description: "Resolve places where the UI implies production-ready behavior but the implementation is still simulated or inconsistent.",
    orderIndex: 3,
    tasks: [
      {
        title: "Replace internal mock communications delivery with a real provider or explicit simulation state",
        description:
          "Communication sends are persisted as sent using an internal mock provider and synthetic message IDs. Integrate a real delivery channel or clearly mark simulated sends to avoid false operational confidence.",
        effort: "medium",
        priority: "high",
      },
      {
        title: "Fix Platform Controls role mismatch for non-platform admins",
        description:
          "The Platform Controls page fetches platform-admin-only datasets even though managers and board-admins can access the page, causing 403-driven broken states. Split privileged sections or gate the page by role.",
        effort: "medium",
        priority: "high",
      },
    ],
  },
  {
    title: "Document Delivery Integrity",
    description: "Fix document publishing and file lifecycle gaps that break admin and portal access flows.",
    orderIndex: 4,
    tasks: [
      {
        title: "Persist portal visibility fields during document creation",
        description:
          "Document creation currently omits portal publication fields on create, which can leave intended owner-visible uploads unpublished. Persist isPortalVisible and portalAudience during initial upload or make the two-step publish flow explicit.",
        effort: "medium",
        priority: "high",
      },
      {
        title: "Validate document file references and surface missing assets",
        description:
          "Some stored document fileUrl values resolve to missing files. Add file existence validation, broken-link detection, and recovery handling so documents do not appear available when the asset is gone.",
        effort: "medium",
        priority: "high",
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
        updatedAt: new Date(),
      })
      .where(eq(roadmapProjects.id, project.id))
      .returning();
    console.log(`Updated roadmap project: ${project.title}`);
  }

  for (const workstreamDef of workstreams) {
    let [workstream] = await db
      .select()
      .from(roadmapWorkstreams)
      .where(and(eq(roadmapWorkstreams.projectId, project.id), eq(roadmapWorkstreams.title, workstreamDef.title)));

    if (!workstream) {
      [workstream] = await db
        .insert(roadmapWorkstreams)
        .values({
          projectId: project.id,
          title: workstreamDef.title,
          description: workstreamDef.description,
          orderIndex: workstreamDef.orderIndex,
          isCollapsed: 0,
        })
        .returning();
      console.log(`Created workstream: ${workstream.title}`);
    } else {
      [workstream] = await db
        .update(roadmapWorkstreams)
        .set({
          description: workstreamDef.description,
          orderIndex: workstreamDef.orderIndex,
          updatedAt: new Date(),
        })
        .where(eq(roadmapWorkstreams.id, workstream.id))
        .returning();
      console.log(`Updated workstream: ${workstream.title}`);
    }

    for (const taskDef of workstreamDef.tasks) {
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
          status: "todo",
          effort: taskDef.effort,
          priority: taskDef.priority,
          dependencyTaskIds: [],
        });
        console.log(`Created task: ${taskDef.title}`);
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
        console.log(`Updated task: ${taskDef.title}`);
      }
    }
  }
}

upsertProject()
  .then(() => {
    console.log("Platform gap analysis roadmap project captured.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to capture platform gap analysis roadmap project:", error);
    process.exit(1);
  });
