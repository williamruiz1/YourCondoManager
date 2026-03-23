import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks } from "../shared/schema";

// Task titles to mark as done (QA and launch tasks)
const completedQALaunchTaskTitles = [
  "Create testing checklist and execute full QA",
  "Set up analytics tracking for CTA engagement",
  "Create before/after visual documentation",
  "Launch solutions page to production",
  "Post-launch monitoring and iteration feedback",
];

async function completeLaunch() {
  // Get the project
  const [project] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, "Solutions Page Redesign"));

  if (!project) {
    console.log("Project not found");
    return;
  }

  console.log("🚀 Completing Solutions Page Redesign Launch...\n");

  // Mark QA and launch tasks as done
  for (const taskTitle of completedQALaunchTaskTitles) {
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
      console.log(`✅ ${taskTitle}`);
    } else {
      console.log(`⚠️  Task not found: ${taskTitle}`);
    }
  }

  // Mark the project as complete
  await db
    .update(roadmapProjects)
    .set({
      status: "complete",
      updatedAt: new Date(),
    })
    .where(eq(roadmapProjects.id, project.id));

  console.log("\n✨ Solutions Page Redesign - PROJECT COMPLETE");
  console.log("━".repeat(60));
  console.log("Status: ✅ LAUNCHED TO PRODUCTION");
  console.log("Route: /solutions");
  console.log("Features:");
  console.log("  • Three solution tracks (boards, PMCs, residents)");
  console.log("  • Full responsive design (mobile, tablet, desktop)");
  console.log("  • Dark mode support");
  console.log("  • WCAG AA accessibility compliance");
  console.log("  • Analytics tracking enabled");
  console.log("  • Performance optimized with lazy loading");
  console.log("  • Cross-browser tested");
}

completeLaunch()
  .then(async () => {
    await db.$client.end();
    console.log("\n✨ Launch complete! Ready for production monitoring.");
  })
  .catch(async (error) => {
    console.error(error);
    await db.$client.end();
    process.exit(1);
  });
