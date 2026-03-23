import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks } from "../shared/schema";

// Task titles to mark as done (testing tasks completed)
const completedTestingTaskTitles = [
  "Accessibility compliance check (WCAG AA)",
  "Performance optimization and image loading",
  "Dark mode testing and verification",
  "Cross-browser and device testing",
];

// Task titles to mark as in-progress (QA & launch phase)
const inProgressQATitles = [
  "Create testing checklist and execute full QA",
  "Set up analytics tracking for CTA engagement",
];

async function updateTestingProgress() {
  // Get the project
  const [project] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, "Solutions Page Redesign"));

  if (!project) {
    console.log("Project not found");
    return;
  }

  // Mark testing tasks as done
  for (const taskTitle of completedTestingTaskTitles) {
    const [task] = await db
      .select()
      .from(roadmapTasks)
      .where(
        and(
          eq(roadmapTasks.projectId, project.id),
          eq(roadmapTasks.title, taskTitle),
        ),
      );

    if (task) {
      await db
        .update(roadmapTasks)
        .set({
          status: "done",
          updatedAt: new Date(),
        })
        .where(eq(roadmapTasks.id, task.id));
      console.log(`✓ Marked as done: ${taskTitle}`);
    }
  }

  // Mark QA tasks as in-progress
  for (const taskTitle of inProgressQATitles) {
    const [task] = await db
      .select()
      .from(roadmapTasks)
      .where(
        and(
          eq(roadmapTasks.projectId, project.id),
          eq(roadmapTasks.title, taskTitle),
        ),
      );

    if (task) {
      await db
        .update(roadmapTasks)
        .set({
          status: "in-progress",
          updatedAt: new Date(),
        })
        .where(eq(roadmapTasks.id, task.id));
      console.log(`→ Marked as in-progress: ${taskTitle}`);
    }
  }
}

updateTestingProgress()
  .then(async () => {
    await db.$client.end();
    console.log("\nTesting phase marked complete! Moving to QA & launch phase.");
  })
  .catch(async (error) => {
    console.error(error);
    await db.$client.end();
    process.exit(1);
  });
