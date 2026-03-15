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

const projectTitle = "Active Project - Association-Scoped Board Member Access";
const projectDescription =
  "Deliver invited board-member workspace access with association-scoped permissions, combined owner-plus-board identity resolution, and audit-safe lifecycle controls.";

const workstreams: WorkstreamDef[] = [
  {
    title: "Access Model and Data Foundations",
    description: "Add the association-scoped board-member access model and lifecycle fields needed to represent invite-driven board permissions.",
    orderIndex: 1,
    tasks: [
      {
        title: "Add board-member access role and lifecycle fields",
        description:
          "Extend portal or access-control data model with a first-class board-member role plus invite, acceptance, suspension, and revocation lifecycle timestamps.",
        effort: "large",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Link board-member access grants to board service and association scope",
        description:
          "Persist the relationship between invited access, active board-role assignment, person identity, and a single association boundary so elevated access is not global.",
        effort: "medium",
        priority: "critical",
        status: "todo",
      },
    ],
  },
  {
    title: "Invitation and Activation Workflow",
    description: "Create the admin workflow to invite board members and activate access only after invite acceptance and active board service validation.",
    orderIndex: 2,
    tasks: [
      {
        title: "Build admin board-member invite flow",
        description:
          "Allow admins to invite a person from governance or board workflows into a board-member association workspace using their existing person record where possible.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Implement invite acceptance and activation rules",
        description:
          "Activate board-member access only after invite acceptance and confirmation that the linked board role is active for the same association.",
        effort: "medium",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Handle reinvite, expiry, suspension, and revocation states",
        description:
          "Prevent duplicate conflicting active records and ensure board-member access can be expired, suspended, revoked, and later reissued cleanly.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
    ],
  },
  {
    title: "Permission Resolution and Enforcement",
    description: "Resolve effective rights for owner-board members and enforce association-scoped read and write access server-side.",
    orderIndex: 3,
    tasks: [
      {
        title: "Resolve combined owner and board-member permissions under one identity",
        description:
          "When a person is both an owner and an active invited board member in the same association, combine owner self-service and board-member workspace permissions under one signed-in identity.",
        effort: "large",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Enforce association-scoped board permissions across API reads and writes",
        description:
          "Apply authorization checks that allow board-member access only within the invited association and reject attempts to access platform-global or other-association records.",
        effort: "large",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Preserve owner self-service access when board service ends",
        description:
          "If the same person retains valid owner access after board service ends or access is revoked, remove elevated board permissions without breaking owner self-service flows.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
    ],
  },
  {
    title: "Board Workspace Experience",
    description: "Present a dedicated board-member association view that exposes in-scope modules without leaking platform-admin controls.",
    orderIndex: 4,
    tasks: [
      {
        title: "Build board-member landing view and navigation",
        description:
          "Show the active association, board-member context, and all allowed association-scoped modules while hiding platform-global administration surfaces.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Support seamless switching between owner and board capabilities",
        description:
          "For owner-board members, let the workspace expose both self-service and board operations coherently without separate disconnected logins.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
    ],
  },
  {
    title: "Audit, Verification, and Rollout",
    description: "Make elevated board access traceable and verify that permission boundaries hold across affected modules.",
    orderIndex: 5,
    tasks: [
      {
        title: "Audit log board-member invite lifecycle and write actions",
        description:
          "Record invite, activation, suspension, revocation, and board-member write events with actor identity, association scope, and timestamp.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Run end-to-end verification for board-member scope boundaries",
        description:
          "Verify invited board members can view and edit in-scope association records, cannot access other associations, and do not see platform-admin-only controls.",
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
    console.log("Association-scoped board member access roadmap project captured.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to capture association-scoped board member access roadmap project:", error);
    process.exit(1);
  });
