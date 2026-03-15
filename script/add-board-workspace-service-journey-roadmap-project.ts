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

const projectTitle = "Active Project - Board Workspace Service Journey and Implementation Backbone";
const projectDescription =
  "Capture the board self-service workspace findings in full, structure the implementation plan thoroughly, and codify a repeatable review-first, implement-next roadmap rhythm for future service-oriented projects.";

const workstreams: WorkstreamDef[] = [
  {
    title: "Service Intent and Journey Backbone",
    description: "Formalize the service intent, operating model, and reusable planning backbone for service-oriented roadmap work.",
    orderIndex: 1,
    tasks: [
      {
        title: "Document board self-service workspace operating model",
        description:
          "Record that board members are lightweight operators with direct write authority for in-scope association workflows, especially for self-managed or highly involved boards.",
        effort: "small",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Publish admin roadmap service-journey backbone standard",
        description:
          "Create the reusable planning standard that requires service intent, journey review, findings, decisions, opportunities, implementation chunks, and verification before implementation begins.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
    ],
  },
  {
    title: "Journey Review and Findings Capture",
    description: "Break down the current board-member experience from the user's perspective and capture the findings and opportunities in full.",
    orderIndex: 2,
    tasks: [
      {
        title: "Capture current-state board workspace journey review",
        description:
          "Describe the current board-member entry, activation, first-use, recurring-use, and failure/confusion points as a user journey rather than a code inventory.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Translate journey findings into service opportunities",
        description:
          "Convert findings into explicit service opportunities across action-first workflow, activity visibility, state clarity, board operating loops, and trust communication.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
    ],
  },
  {
    title: "Product Decisions and Scope Boundaries",
    description: "Lock the product-policy decisions that should guide implementation so future chunks do not drift.",
    orderIndex: 3,
    tasks: [
      {
        title: "Record direct-write board authority and association scope rules",
        description:
          "Make direct-write authority, one-identity owner-plus-board access, and association-only boundaries explicit in the roadmap project plan.",
        effort: "small",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Define activity and state as essential product requirements",
        description:
          "Promote activity records and state transitions from implementation detail to first-class requirements for the board workspace service model.",
        effort: "small",
        priority: "critical",
        status: "todo",
      },
    ],
  },
  {
    title: "Board Workspace Experience Expansion Plan",
    description: "Structure the implementation plan for the next experience layers needed to make the board workspace feel operationally complete.",
    orderIndex: 4,
    tasks: [
      {
        title: "Plan action-first landing and attention queue",
        description:
          "Break down the work needed to make the board home screen lead with what requires action now instead of passive summaries alone.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Plan board-visible activity feed and change summaries",
        description:
          "Define the feed, event model, and UI summaries that let board members understand what changed, who changed it, and when.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Plan explicit workflow state system across board surfaces",
        description:
          "Define the state model and visible status treatment for access, governance tasks, meetings, notices, maintenance, and board distribution workflows.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
    ],
  },
  {
    title: "Board Operating Loops Implementation Plan",
    description: "Break the future implementation into concrete board-managed workflow slices that can ship in chunks.",
    orderIndex: 5,
    tasks: [
      {
        title: "Plan governance task and meeting management chunk",
        description:
          "Define the next implementation slice that allows board members to manage governance tasks and meeting workflows directly in the workspace.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Plan communications and document-publishing chunk",
        description:
          "Define the implementation slice that lets board members draft, review, send, and publish in-scope board communications and documents.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Plan maintenance and financial action surfaces",
        description:
          "Define the board-facing write and review actions needed for maintenance triage and financial operating loops without promoting board members into platform admins.",
        effort: "medium",
        priority: "medium",
        status: "todo",
      },
    ],
  },
  {
    title: "Verification and Working Rhythm",
    description: "Turn the planning structure into an operational rhythm for future roadmap work.",
    orderIndex: 6,
    tasks: [
      {
        title: "Define plan-first then implement-next roadmap workflow",
        description:
          "Write down the recurring working practice: clarify service intent, review journey, create plan/project, implement in chunks, verify, then close.",
        effort: "small",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Add verification and closeout expectations to the project plan",
        description:
          "Ensure every future service-oriented roadmap project includes explicit verification tasks and honest status updates before closure.",
        effort: "small",
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
    console.log("Board workspace service journey roadmap project captured.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to capture board workspace service journey roadmap project:", error);
    process.exit(1);
  });
