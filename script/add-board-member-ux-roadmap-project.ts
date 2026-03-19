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

const projectTitle = "Active Project - Board Member UX";
const projectDescription =
  "Design and deliver an association-scoped board-member workspace for one-association governance users who need clear decisions, meeting readiness, financial oversight, compliance visibility, and auditable board actions without platform-admin exposure.";

const workstreams: WorkstreamDef[] = [
  {
    title: "Service Intent and Role Boundaries",
    description: "Define the board-member service model, operating posture, and authority boundaries before implementation.",
    orderIndex: 1,
    tasks: [
      {
        title: "Document association-scoped board-member oversight model",
        description:
          "Record that board members are one-association governance and oversight users whose primary needs are review, approval, acknowledgment, and decision-making rather than platform administration.",
        effort: "small",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Define board role emphasis and authority boundaries",
        description:
          "Clarify how president, treasurer, secretary, and director-at-large views should differ in emphasis while preserving the same association-scoped workspace and least-privilege boundary.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
    ],
  },
  {
    title: "Journey Review and Findings Capture",
    description: "Review the current invited board-member and owner-plus-board experience from a board-oversight perspective and capture the gaps.",
    orderIndex: 2,
    tasks: [
      {
        title: "Review current board-member journey against oversight-first goals",
        description:
          "Assess entry, first-use, recurring-use, meeting-prep, and decision-taking flows to identify where the current experience still behaves like an admin surface or passive data view.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Translate board journey findings into UX opportunities",
        description:
          "Convert the findings into explicit opportunities across action-first navigation, decision support, meeting readiness, board package access, financial exceptions, compliance visibility, and trust signals.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
    ],
  },
  {
    title: "Product Decisions and Scope Boundaries",
    description: "Lock the product-policy decisions that keep the board-member UX focused, safe, and association-scoped.",
    orderIndex: 3,
    tasks: [
      {
        title: "Define board-member navigation and one-association context rules",
        description:
          "Set the canonical board-member navigation, keep the experience scoped to the served association, and prevent drift into portfolio-wide or platform-global module exposure.",
        effort: "small",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Define decision, approval, and escalation workflow boundaries",
        description:
          "Specify which actions board members can approve, acknowledge, comment on, or escalate and which actions remain internal-admin or operator responsibilities.",
        effort: "small",
        priority: "critical",
        status: "todo",
      },
    ],
  },
  {
    title: "Board Home and Decision Workspace",
    description: "Plan the core board experience around action, decisions, and meaningful change rather than passive modules.",
    orderIndex: 4,
    tasks: [
      {
        title: "Plan board home with action queue and since-last-meeting summary",
        description:
          "Define a landing experience that leads with needs-board-action items, urgent deadlines, recent material changes, and the next meeting context for the active association.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Plan board decision detail and recommendation pattern",
        description:
          "Design the decision card and detail view to show recommendation, due date, supporting documents, responsible operator, audit trail, and explicit next step.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
    ],
  },
  {
    title: "Meetings, Board Package, and Messaging",
    description: "Center the board experience on meeting readiness, board package review, and board-appropriate communication loops.",
    orderIndex: 5,
    tasks: [
      {
        title: "Plan meeting-centered board workflow and package experience",
        description:
          "Define the workspace for agenda readiness, minutes review, resolutions, attendance, quorum signals, and board package access so meetings become the operational center of the board UX.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Plan board messaging, acknowledgments, and follow-up loop",
        description:
          "Define how board members should receive messages, request follow-up, acknowledge notices, and track unresolved communications without exposing full admin communication tooling.",
        effort: "medium",
        priority: "medium",
        status: "todo",
      },
    ],
  },
  {
    title: "Financial, Compliance, and Risk Oversight",
    description: "Design the oversight surfaces that let board members understand financial health, deadlines, and risk without turning them into accountants or admins.",
    orderIndex: 6,
    tasks: [
      {
        title: "Plan board financial snapshot and exception-drilldown UX",
        description:
          "Define the board-facing financial overview for cash, reserves, receivables, delinquency trend, variance, and unusual transactions with summary-first, exception-second presentation.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Plan compliance and risk oversight workspace",
        description:
          "Define how compliance deadlines, insurance or governance exposures, unresolved policy exceptions, and other association risks should be surfaced with clear why-it-matters and decision-needed framing.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
    ],
  },
  {
    title: "Trust, Auditability, Verification, and Rollout",
    description: "Make the board-member UX understandable, auditable, and verifiable before implementation is treated as complete.",
    orderIndex: 7,
    tasks: [
      {
        title: "Plan board scope, term-status, and action-history trust signals",
        description:
          "Define the visible cues that show active association, board role, service period, permission basis, recent approvals, and other audit-safe trust signals inside the workspace.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Define verification and rollout checklist for board-member UX",
        description:
          "Specify the validation path for role visibility, association boundaries, owner-plus-board identity handling, meeting flows, decision actions, and honest roadmap closeout criteria.",
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
    console.log("Board member UX roadmap project captured.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to capture board member UX roadmap project:", error);
    process.exit(1);
  });
