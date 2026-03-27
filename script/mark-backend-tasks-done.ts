/**
 * Mark all "Backend Issues" workstream tasks as "done" for the
 * "Regression Testing - Platform Audit Q1 2026" roadmap project.
 */
import { db } from "../server/db";
import { roadmapProjects, roadmapWorkstreams, roadmapTasks } from "../shared/schema";
import { and, eq } from "drizzle-orm";

async function main() {
  // Find the project
  const [project] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, "Regression Testing - Platform Audit Q1 2026"));

  if (!project) {
    console.error("Project not found");
    process.exit(1);
  }
  console.log(`Found project: ${project.title} (${project.id})`);

  // Find the Backend Issues workstream
  const [workstream] = await db
    .select()
    .from(roadmapWorkstreams)
    .where(
      and(
        eq(roadmapWorkstreams.projectId, project.id),
        eq(roadmapWorkstreams.title, "Backend Issues"),
      ),
    );

  if (!workstream) {
    console.error("Backend Issues workstream not found");
    process.exit(1);
  }
  console.log(`Found workstream: ${workstream.title} (${workstream.id})`);

  // Get all tasks in this workstream
  const tasks = await db
    .select()
    .from(roadmapTasks)
    .where(eq(roadmapTasks.workstreamId, workstream.id));

  console.log(`Found ${tasks.length} tasks to update`);

  const now = new Date();
  let updated = 0;
  for (const task of tasks) {
    await db
      .update(roadmapTasks)
      .set({
        status: "done",
        completedDate: task.completedDate ?? now,
        updatedAt: now,
      })
      .where(eq(roadmapTasks.id, task.id));
    updated++;
    console.log(`  [done] ${task.title}`);
  }

  console.log(`\nUpdated ${updated} tasks to "done" status.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
