import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks } from "../shared/schema";

const projectTitle = "Gap Closure M2 - Budget Domain and Variance Controls";

async function main() {
  const [project] = await db.select().from(roadmapProjects).where(eq(roadmapProjects.title, projectTitle));
  if (!project) throw new Error(`Project not found: ${projectTitle}`);

  const now = new Date();
  await db
    .update(roadmapTasks)
    .set({
      status: "done",
      completedDate: now,
      updatedAt: now,
    })
    .where(eq(roadmapTasks.projectId, project.id));

  await db
    .update(roadmapProjects)
    .set({
      status: "complete",
      updatedAt: now,
    })
    .where(eq(roadmapProjects.id, project.id));

  const tasks = await db.select().from(roadmapTasks).where(eq(roadmapTasks.projectId, project.id));
  console.log(`Updated ${tasks.length} tasks to done and marked project complete: ${projectTitle}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
