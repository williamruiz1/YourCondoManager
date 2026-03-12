import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks } from "../shared/schema";

const projectTitle = "Executive Highlights & Defend Logs";

async function main() {
  const [project] = await db.select().from(roadmapProjects).where(eq(roadmapProjects.title, projectTitle));
  if (!project) {
    throw new Error(`Roadmap project not found: ${projectTitle}`);
  }

  await db
    .update(roadmapTasks)
    .set({
      status: "done",
      completedDate: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(roadmapTasks.projectId, project.id));

  await db
    .update(roadmapProjects)
    .set({
      status: "complete",
      updatedAt: new Date(),
    })
    .where(eq(roadmapProjects.id, project.id));

  console.log(`Marked project complete: ${projectTitle}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
