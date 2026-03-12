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

const projectTitle = "Active Project - Google OAuth Sign-In (Session-Based)";
const projectDescription =
  "Implement backend-managed Google OAuth 2.0 login with durable server sessions, account linking, session recovery fallback, and post-login workspace bootstrap.";

const workstreams: WorkstreamDef[] = [
  {
    title: "Identity and Session Data Model",
    description: "Add first-class internal user identity and external OAuth account-linking entities with durable session storage.",
    orderIndex: 1,
    tasks: [
      {
        title: "Create internal user identity model and external account-link table",
        description:
          "Add internal app user table plus OAuth account-link table keyed by provider + providerAccountId, keeping email as secondary linking key for migration.",
        effort: "large",
        priority: "critical",
        status: "in-progress",
      },
      {
        title: "Configure durable express-session storage in PostgreSQL",
        description:
          "Replace implicit header-based auth for browser flows with server sessions persisted in Postgres using connect-pg-simple and environment-safe cookie settings.",
        effort: "large",
        priority: "critical",
        status: "todo",
      },
    ],
  },
  {
    title: "Google OAuth Backend Flow",
    description: "Implement Google OAuth strategy and backend callback flow as the primary browser login contract.",
    orderIndex: 2,
    tasks: [
      {
        title: "Add Passport Google OAuth strategy and auth routes",
        description:
          "Implement /auth/google and /auth/google/callback with profile+email scopes and backend OAuth code exchange using Google client credentials.",
        effort: "large",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Implement account resolution and linking rules",
        description:
          "On callback, resolve user by external Google ID first, fallback to email match, then link existing users or create new internal users from profile data.",
        effort: "large",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Serialize internal user ID into session and hydrate on request",
        description:
          "Store only internal user ID in session; deserialize to full user object from database for authenticated request context.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
    ],
  },
  {
    title: "Frontend Login Experience and Recovery",
    description: "Provide app-level OAuth launch flow, callback handling, and robust session restoration in constrained environments.",
    orderIndex: 3,
    tasks: [
      {
        title: "Build frontend Google launch flow (redirect or popup/new tab)",
        description:
          "Start auth via backend endpoint and support account-selection prompts plus popup/new-tab completion for embedded/preview browser constraints.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Implement callback completion handshake to main app window",
        description:
          "After OAuth callback, notify primary app context of login success and reload into authenticated state.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Add session-restoration fallback token flow",
        description:
          "Store short-lived encoded auth payload post-login and allow backend validation endpoint to recreate session only when normal session checks fail.",
        effort: "large",
        priority: "high",
        status: "todo",
      },
    ],
  },
  {
    title: "Workspace Bootstrap, Guardrails, and Logout",
    description: "Ensure authenticated users enter initialized workspace context and protected routes enforce session-backed identity.",
    orderIndex: 4,
    tasks: [
      {
        title: "Auto-provision default workspace/tenant membership on first login",
        description:
          "If a first-time authenticated user has no business/workspace membership, create a default workspace context and grant owner-level access.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Add resilient auth middleware for protected APIs",
        description:
          "Guard routes with Passport session checks and include recovery logic for partially hydrated request/session state.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Implement complete logout cleanup",
        description:
          "Clear Passport login state, destroy server session, clear cookie, and remove client-side session-recovery artifacts.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
    ],
  },
  {
    title: "Migration and Cutover Plan",
    description: "Move from API-key header admin auth to session-based auth without service interruption or privilege regressions.",
    orderIndex: 5,
    tasks: [
      {
        title: "Define transitional coexistence of API-key and session auth",
        description:
          "Support controlled migration period where legacy admin API-key flows coexist with session auth, then remove header-key reliance.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Map OAuth-authenticated users to admin roles/scopes",
        description:
          "Integrate session-authenticated internal users with current admin role and association-scope authorization rules.",
        effort: "medium",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Run production-readiness verification and rollback plan",
        description:
          "Verify login, callback, session persistence, route protection, logout, and recovery paths across local and hosted environments with rollback playbook.",
        effort: "medium",
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
      console.log(`Created workstream: ${workstream.title}`);
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
      console.log(`Updated workstream: ${workstream.title}`);
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
          completedDate: taskDef.status === "done" ? new Date() : null,
        });
        console.log(`Created task: ${taskDef.title}`);
      } else {
        await db
          .update(roadmapTasks)
          .set({
            description: taskDef.description,
            status: taskDef.status,
            effort: taskDef.effort,
            priority: taskDef.priority,
            completedDate: taskDef.status === "done" ? (existingTask.completedDate ?? new Date()) : null,
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
    console.log("Google OAuth sign-in roadmap project captured.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to capture Google OAuth sign-in roadmap project:", error);
    process.exit(1);
  });
