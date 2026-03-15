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

const projectTitle = "Admin Roadmap Backbone - Agent Bootstrap and Continuous Improvement";
const projectDescription =
  "Reduce repeated agent setup work by creating a reusable bootstrap layer, durable working memory, friction logging, and closed-loop roadmap updates so future agent interactions start with more context and less rediscovery.";

const workstreams: WorkstreamDef[] = [
  {
    title: "Bootstrap Snapshot and Workspace Manifest",
    description: "Create a fast, machine-readable startup layer that summarizes the repo, routes, schema touchpoints, verification commands, and active roadmap context.",
    orderIndex: 1,
    tasks: [
      {
        title: "Create machine-readable workspace bootstrap manifest",
        description:
          "Generate a durable workspace manifest that captures stable route groups, key server and storage entry points, schema anchors, and standard verification commands so agents do not have to rediscover the repo shape on every session.",
        effort: "medium",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Add refresh rules for manifest drift detection",
        description:
          "Define when the bootstrap manifest should be regenerated, such as route changes, schema changes, or roadmap structure changes, so the bootstrap layer remains reliable instead of going stale silently.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Expose active roadmap context in bootstrap output",
        description:
          "Include live roadmap context in the bootstrap layer so agents can see current planning priorities, open backbone projects, and related workstreams before beginning new exploration.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
    ],
  },
  {
    title: "Durable Working Memory and Reusable Facts",
    description: "Persist the stable facts that agents repeatedly discover so they can be reused safely across sessions and contributors.",
    orderIndex: 2,
    tasks: [
      {
        title: "Define durable memory format for stable repo facts",
        description:
          "Create a structured format for persistent facts such as environment requirements, preferred commands, key modules, and established product decisions while keeping temporary findings out of durable memory.",
        effort: "medium",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Store repeatable setup knowledge separately from transient task notes",
        description:
          "Split stable workspace knowledge from short-lived task discoveries so agents can reuse foundational context without inheriting stale or speculative details from unrelated work.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Add verification command memory for common change types",
        description:
          "Capture the standard verification paths for UI, server, database, and roadmap work so agents can move from implementation to validation with less repeated inspection.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
    ],
  },
  {
    title: "Friction Logging and Closed-Loop Improvement",
    description: "Turn repeated setup friction into explicit analysis and roadmap inputs that can improve the system after each interaction.",
    orderIndex: 3,
    tasks: [
      {
        title: "Log repeated setup friction into analysis records",
        description:
          "Use the existing admin analysis tables to record what agents repeatedly had to inspect, why it was needed, and whether a durable automation could remove the work next time.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Auto-create or update roadmap tasks from repeated friction patterns",
        description:
          "When the same setup friction appears enough times, create or update a roadmap task in the backbone project so improvement work becomes visible and accumulates instead of disappearing in chat history.",
        effort: "large",
        priority: "high",
        status: "todo",
      },
      {
        title: "Generate session closeout improvements for future agent runs",
        description:
          "At the end of substantial agent work, produce a compact set of candidate bootstrap and memory updates that can be accepted into the durable backbone rather than leaving learning trapped in a single session.",
        effort: "medium",
        priority: "medium",
        status: "todo",
      },
    ],
  },
  {
    title: "Governance, Safety, and Backbone Adoption",
    description: "Keep self-amending behavior bounded and make the backbone the standard path for roadmap-oriented agent work.",
    orderIndex: 4,
    tasks: [
      {
        title: "Define guardrails for self-amending agent behavior",
        description:
          "Require that bootstrap and planning artifacts may update automatically, but product behavior, schema changes, and broader implementation changes must still be driven by explicit roadmap work and verification.",
        effort: "small",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Adopt agent bootstrap backbone in admin roadmap planning standard",
        description:
          "Extend the admin roadmap backbone so future service-oriented planning explicitly includes reusable bootstrap context, friction logging, and durable memory as first-class planning outputs.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Define success metrics for reduced startup and rediscovery cost",
        description:
          "Measure bootstrap effectiveness with metrics such as setup time avoided, repeated searches reduced, roadmap improvements generated, and verification paths reused so the backbone can improve based on evidence.",
        effort: "small",
        priority: "medium",
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
      console.log(`  Added workstream: ${workstream.title}`);
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
      console.log(`  Updated workstream: ${workstream.title}`);
    }

    for (const taskDef of wsDef.tasks) {
      const [existingTask] = await db
        .select()
        .from(roadmapTasks)
        .where(and(eq(roadmapTasks.projectId, project.id), eq(roadmapTasks.workstreamId, workstream.id), eq(roadmapTasks.title, taskDef.title)));

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
        console.log(`    Added task: ${taskDef.title}`);
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
        console.log(`    Updated task: ${taskDef.title}`);
      }
    }
  }
}

upsertProject()
  .then(async () => {
    await db.$client.end();
  })
  .catch(async (error) => {
    console.error(error);
    await db.$client.end();
    process.exit(1);
  });
