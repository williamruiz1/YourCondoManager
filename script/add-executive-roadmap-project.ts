import { eq, and } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapWorkstreams, roadmapTasks } from "../shared/schema";

type TaskDef = {
  title: string;
  description: string;
  effort: "small" | "medium" | "large";
  priority: "low" | "medium" | "high" | "critical";
};

const projectTitle = "Executive Highlights & Defend Logs";
const projectDescription =
  "Admin module for concise executive delivery highlights and defensible evidence logs, with roadmap-completion sync.";

const workstreams: Array<{ title: string; description: string; orderIndex: number; tasks: TaskDef[] }> = [
  {
    title: "Data Model & API",
    description: "Schema and endpoints for executive updates and evidence artifacts.",
    orderIndex: 1,
    tasks: [
      {
        title: "Create executive updates and evidence tables",
        description: "Add normalized tables for executive highlights and defend/evidence entries with timestamps and ownership.",
        effort: "medium",
        priority: "high",
      },
      {
        title: "Add admin-restricted executive API contracts",
        description: "Implement list/create/update endpoints for highlights and evidence logs.",
        effort: "medium",
        priority: "high",
      },
    ],
  },
  {
    title: "Executive UI",
    description: "Admin page with Highlights and Defend tabs, concise formatting, and quick entry.",
    orderIndex: 2,
    tasks: [
      {
        title: "Build Executive page with Highlights and Defend tabs",
        description: "Create a two-tab admin module for customer-facing highlights and proof-oriented evidence entries.",
        effort: "medium",
        priority: "high",
      },
      {
        title: "Enforce concise executive copy standards",
        description: "Apply headline length and summary constraints to keep updates short, clear, and sales-ready.",
        effort: "small",
        priority: "medium",
      },
    ],
  },
  {
    title: "Roadmap Sync Automation",
    description: "Generate or refresh executive summaries from completed roadmap tasks/projects.",
    orderIndex: 3,
    tasks: [
      {
        title: "Implement roadmap-to-executive sync job",
        description: "Create a sync path that captures completed roadmap items and generates executive summary cards.",
        effort: "medium",
        priority: "high",
      },
      {
        title: "Deduplicate sync updates by source task linkage",
        description: "Ensure repeated sync operations do not create duplicate executive updates.",
        effort: "small",
        priority: "high",
      },
    ],
  },
  {
    title: "Verification & Launch",
    description: "Testing, QA, and launch readiness for executive reporting workflows.",
    orderIndex: 4,
    tasks: [
      {
        title: "Add verification script for executive module",
        description: "Validate API behavior, sync generation, and evidence linkage.",
        effort: "small",
        priority: "medium",
      },
      {
        title: "Validate end-to-end admin workflow",
        description: "Confirm users can create, edit, and review executive highlights and defend logs from the admin UI.",
        effort: "small",
        priority: "medium",
      },
    ],
  },
];

async function upsertExecutiveRoadmapProject() {
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
    console.log(`Roadmap project already exists: ${project.title}`);
  }

  for (const ws of workstreams) {
    let [workstream] = await db
      .select()
      .from(roadmapWorkstreams)
      .where(and(eq(roadmapWorkstreams.projectId, project.id), eq(roadmapWorkstreams.title, ws.title)));

    if (!workstream) {
      [workstream] = await db
        .insert(roadmapWorkstreams)
        .values({
          projectId: project.id,
          title: ws.title,
          description: ws.description,
          orderIndex: ws.orderIndex,
          isCollapsed: 0,
        })
        .returning();
      console.log(`Created workstream: ${ws.title}`);
    }

    for (const task of ws.tasks) {
      const [existing] = await db
        .select()
        .from(roadmapTasks)
        .where(and(eq(roadmapTasks.projectId, project.id), eq(roadmapTasks.workstreamId, workstream.id), eq(roadmapTasks.title, task.title)));

      if (existing) continue;

      await db.insert(roadmapTasks).values({
        projectId: project.id,
        workstreamId: workstream.id,
        title: task.title,
        description: task.description,
        status: "todo",
        effort: task.effort,
        priority: task.priority,
        dependencyTaskIds: [],
      });
      console.log(`Created task: ${task.title}`);
    }
  }
}

upsertExecutiveRoadmapProject()
  .then(() => {
    console.log("Executive roadmap project setup complete.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to create executive roadmap project:", error);
    process.exit(1);
  });
