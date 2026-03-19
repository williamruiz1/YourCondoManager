import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks } from "../shared/schema";

const projectTitle = "Active Project - Board Member UX";

const completedTasks = [
  "Document association-scoped board-member oversight model",
  "Define board role emphasis and authority boundaries",
  "Review current board-member journey against oversight-first goals",
  "Translate board journey findings into UX opportunities",
  "Define board-member navigation and one-association context rules",
  "Define decision, approval, and escalation workflow boundaries",
  "Plan board home with action queue and since-last-meeting summary",
  "Plan board decision detail and recommendation pattern",
  "Plan meeting-centered board workflow and package experience",
  "Plan board messaging, acknowledgments, and follow-up loop",
  "Plan board financial snapshot and exception-drilldown UX",
  "Plan compliance and risk oversight workspace",
  "Plan board scope, term-status, and action-history trust signals",
  "Define verification and rollout checklist for board-member UX",
];

async function main() {
  const [project] = await db.select().from(roadmapProjects).where(eq(roadmapProjects.title, projectTitle));
  if (!project) {
    throw new Error(`Roadmap project not found: ${projectTitle}`);
  }

  const tasks = await db.select().from(roadmapTasks).where(eq(roadmapTasks.projectId, project.id));
  const now = new Date();

  for (const title of completedTasks) {
    const task = tasks.find((entry) => entry.title === title);
    if (!task) {
      throw new Error(`Roadmap task not found: ${title}`);
    }
    await db
      .update(roadmapTasks)
      .set({
        status: "done",
        completedDate: task.completedDate ?? now,
        updatedAt: now,
      })
      .where(and(eq(roadmapTasks.id, task.id), eq(roadmapTasks.projectId, project.id)));
    console.log(`Completed: ${title}`);
  }

  await db
    .update(roadmapProjects)
    .set({
      status: "complete",
      updatedAt: now,
    })
    .where(eq(roadmapProjects.id, project.id));

  console.log(`Marked project complete: ${projectTitle}`);
}

main().catch((error) => {
  console.error("Failed to update board member UX roadmap progress:", error);
  process.exit(1);
});
