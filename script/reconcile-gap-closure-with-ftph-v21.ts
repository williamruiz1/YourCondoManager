import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks, roadmapWorkstreams } from "../shared/schema";

type TaskPatch = {
  oldTitle: string;
  newTitle?: string;
  newDescription?: string;
};

type MissingTask = {
  projectTitle: string;
  workstreamTitle: string;
  title: string;
  description: string;
  effort: "small" | "medium" | "large";
  priority: "low" | "medium" | "high" | "critical";
};

const patches: TaskPatch[] = [
  {
    oldTitle: "Implement budget draft and ratification states",
    newDescription:
      "Support draft/proposed/ratified lifecycle transitions aligned with FTPH 6.1 annual checklist obligations (budget review and ratification).",
  },
  {
    oldTitle: "Implement vote recording and outcome rules",
    newTitle: "Implement starter vote recording (no procedure engine)",
    newDescription:
      "Capture vote records and basic outcomes while explicitly deferring full parliamentary procedure rules per FTPH 5.1 scope boundary.",
  },
  {
    oldTitle: "Link clause artifacts to ingestion pipeline",
    newDescription:
      "Persist clause candidates via review-first extraction, keeping all AI outputs editable and traceable to source per FTPH 4.2 implementation notes.",
  },
  {
    oldTitle: "Expose approved clause references to governance modules",
    newDescription:
      "Link approved clauses to governance templates/tasks without autonomous legal interpretation, consistent with FTPH 4.2 scope boundary and CT-first rollout assumptions.",
  },
];

const missingTasks: MissingTask[] = [
  {
    projectTitle: "Gap Closure M3 - Governance Depth (Resolutions, Votes, Calendar)",
    workstreamTitle: "Resolution and Vote Workflows",
    title: "Enforce meeting-tracker scope boundaries",
    description:
      "Preserve FTPH 5.1 boundaries by shipping starter vote capture only and deferring full voting procedure engines and scheduling integrations.",
    effort: "small",
    priority: "high",
  },
  {
    projectTitle: "Gap Closure M4 - Bylaw Clause Intelligence",
    workstreamTitle: "Review and Approval Workflow",
    title: "Enforce review-first AI governance",
    description:
      "Require human approval/edit before production use, with no autonomous legal interpretation, aligned to FTPH 4.2 scope boundary.",
    effort: "small",
    priority: "critical",
  },
  {
    projectTitle: "Gap Closure M5 - Owner Portal and SaaS Tenancy",
    workstreamTitle: "SaaS Tenancy and Messaging",
    title: "Gate owner portal rollout as future-expansion capability",
    description:
      "Implement feature-flagged rollout so owner portal aligns with FTPH future expansion scope and does not violate initial deployment assumptions.",
    effort: "small",
    priority: "high",
  },
];

async function applyPatches() {
  for (const patch of patches) {
    const [task] = await db.select().from(roadmapTasks).where(eq(roadmapTasks.title, patch.oldTitle));
    if (!task) {
      console.log(`Patch skipped (task not found): ${patch.oldTitle}`);
      continue;
    }

    const updatePayload: Partial<typeof roadmapTasks.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (patch.newTitle) updatePayload.title = patch.newTitle;
    if (patch.newDescription) updatePayload.description = patch.newDescription;

    await db.update(roadmapTasks).set(updatePayload).where(eq(roadmapTasks.id, task.id));
    console.log(`Patched task: ${patch.oldTitle}${patch.newTitle ? ` -> ${patch.newTitle}` : ""}`);
  }
}

async function addMissingTasks() {
  for (const taskDef of missingTasks) {
    const [project] = await db.select().from(roadmapProjects).where(eq(roadmapProjects.title, taskDef.projectTitle));
    if (!project) {
      console.log(`Missing project; skipped task: ${taskDef.title}`);
      continue;
    }

    const [workstream] = await db
      .select()
      .from(roadmapWorkstreams)
      .where(and(eq(roadmapWorkstreams.projectId, project.id), eq(roadmapWorkstreams.title, taskDef.workstreamTitle)));

    if (!workstream) {
      console.log(`Missing workstream; skipped task: ${taskDef.title}`);
      continue;
    }

    const [existing] = await db
      .select()
      .from(roadmapTasks)
      .where(
        and(
          eq(roadmapTasks.projectId, project.id),
          eq(roadmapTasks.workstreamId, workstream.id),
          eq(roadmapTasks.title, taskDef.title),
        ),
      );

    if (existing) {
      console.log(`Task already exists: ${taskDef.title}`);
      continue;
    }

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

    console.log(`Added task: ${taskDef.title}`);
  }
}

async function main() {
  await applyPatches();
  await addMissingTasks();
  console.log("Gap-closure roadmap reconciled to FTPH v2.1 boundaries.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to reconcile gap-closure roadmap:", error);
    process.exit(1);
  });
