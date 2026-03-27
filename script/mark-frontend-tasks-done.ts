import { eq, and, ilike } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapWorkstreams, roadmapTasks } from "../shared/schema";

async function main() {
  // Find the project
  const projects = await db.select().from(roadmapProjects);
  const project = projects.find(p => p.title.includes("Regression") && p.title.includes("Q1 2026"));
  if (!project) {
    console.error("Project not found. Available projects:");
    projects.forEach(p => console.log(`  - ${p.title} (${p.id})`));
    process.exit(1);
  }
  console.log("Found project:", project.title, project.id);

  // Find the Frontend Issues workstream
  const workstreams = await db.select().from(roadmapWorkstreams).where(eq(roadmapWorkstreams.projectId, project.id));
  const frontendWs = workstreams.find(w => w.title.toLowerCase().includes("frontend"));
  if (!frontendWs) {
    console.error("Frontend workstream not found. Available workstreams:");
    workstreams.forEach(w => console.log(`  - ${w.title} (${w.id})`));
    process.exit(1);
  }
  console.log("Found workstream:", frontendWs.title, frontendWs.id);

  // Get all tasks in this workstream
  const tasks = await db.select().from(roadmapTasks).where(
    and(
      eq(roadmapTasks.projectId, project.id),
      eq(roadmapTasks.workstreamId, frontendWs.id)
    )
  );
  console.log(`Found ${tasks.length} tasks in Frontend workstream`);

  // Mark all tasks as done
  const now = new Date();
  for (const task of tasks) {
    await db.update(roadmapTasks)
      .set({ status: "done", completedDate: task.completedDate ?? now, updatedAt: now })
      .where(eq(roadmapTasks.id, task.id));
    console.log(`  [done] ${task.title}`);
  }

  console.log(`\nAll ${tasks.length} Frontend tasks marked as done.`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
