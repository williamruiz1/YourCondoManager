import { db } from "../server/db";
import { roadmapProjects, roadmapTasks } from "../shared/schema";
import { eq, and } from "drizzle-orm";

async function run() {
  const projects = await db.select().from(roadmapProjects);
  let fixed = 0;

  for (const p of projects) {
    if (p.status !== "archived") continue;

    const tasks = await db.select().from(roadmapTasks).where(eq(roadmapTasks.projectId, p.id));
    if (tasks.length === 0) continue;

    const allDone = tasks.every(t => t.status === "done");
    if (!allDone) continue;

    await db.update(roadmapProjects)
      .set({ status: "complete" })
      .where(eq(roadmapProjects.id, p.id));

    console.log(`  [archived → complete] ${p.title}`);
    fixed++;
  }

  console.log(`\nUpdated ${fixed} projects from "archived" to "complete".`);
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
