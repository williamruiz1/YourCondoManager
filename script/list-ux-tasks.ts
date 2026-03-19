import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks } from "../shared/schema";

async function main() {
  const [project] = await db.select().from(roadmapProjects).where(eq(roadmapProjects.title, "Active Project - Workspace UI/UX Streamlining"));
  if (!project) { console.error("not found"); process.exit(1); }
  const tasks = await db.select({ title: roadmapTasks.title, status: roadmapTasks.status }).from(roadmapTasks).where(eq(roadmapTasks.projectId, project.id));
  tasks.forEach(t => console.log(`${t.status} | ${t.title}`));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
