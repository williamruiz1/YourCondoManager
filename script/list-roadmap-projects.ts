import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks } from "../shared/schema";

async function main() {
  const projects = await db.select().from(roadmapProjects).orderBy(roadmapProjects.updatedAt);
  for (const p of projects) {
    const tasks = await db.select().from(roadmapTasks).where(eq(roadmapTasks.projectId, p.id));
    const done = tasks.filter((t) => t.status === "done").length;
    console.log(`[${p.status}] ${p.title} — ${done}/${tasks.length} tasks done`);
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
