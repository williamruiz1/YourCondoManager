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

const projectTitle = "Active Project - Building-First Unit Onboarding";
const projectDescription =
  "Shift unit onboarding to a building-first workflow: create/select building with address and capacity metadata before unit creation, while preserving existing enhancements.";

const workstreams: WorkstreamDef[] = [
  {
    title: "Data Model and API Safety",
    description: "Introduce buildings as a first-class entity and enforce safe association-bound links to units.",
    orderIndex: 1,
    tasks: [
      {
        title: "Add buildings domain model and unit-to-building linkage",
        description: "Create buildings table fields and wire unit buildingId while preserving legacy building text compatibility.",
        effort: "medium",
        priority: "critical",
        status: "in-progress",
      },
      {
        title: "Add building CRUD endpoints with association scope checks",
        description: "Expose GET/POST/PATCH building endpoints and enforce scoped admin access.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
    ],
  },
  {
    title: "Unit Workflow UX",
    description: "Update the Units page so building capture is the required first step for new unit creation.",
    orderIndex: 2,
    tasks: [
      {
        title: "Implement building-first Add Unit dialog flow",
        description: "Add step 1 building capture (name, address, total units, notes) and step 2 unit creation bound to selected building.",
        effort: "large",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Preserve existing hierarchy and status indicators",
        description: "Keep current building hierarchy, occupancy badges, and ownership rollups aligned with selected building entities.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
    ],
  },
  {
    title: "Compatibility and Verification",
    description: "Prevent regressions by retaining legacy behavior for existing records and validating changed flows.",
    orderIndex: 3,
    tasks: [
      {
        title: "Retain backward compatibility for legacy units without buildingId",
        description: "Ensure existing units render and remain editable without forced migration.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Run end-to-end verification against current active project baseline",
        description: "Check unit create/edit and building flows do not reverse previously shipped enhancements.",
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
    console.log("Building-first unit onboarding roadmap project captured.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to capture building-first unit onboarding roadmap project:", error);
    process.exit(1);
  });
