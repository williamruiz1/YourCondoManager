import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapWorkstreams, roadmapTasks } from "../shared/schema";

async function main() {
  const [project] = await db.select().from(roadmapProjects)
    .where(eq(roadmapProjects.title, "Property Manager Workspace Redesign"));

  const workstreams = await db.select().from(roadmapWorkstreams)
    .where(eq(roadmapWorkstreams.projectId, project.id));

  const tasks = await db.select().from(roadmapTasks)
    .where(eq(roadmapTasks.projectId, project.id));

  const wsMap = new Map(workstreams.map((w) => [w.id, w]));
  const done = tasks.filter((t) => t.status === "done");
  const inProgress = tasks.filter((t) => t.status === "in-progress");
  const todo = tasks.filter((t) => t.status === "todo");

  console.log(`Total: ${tasks.length} | Done: ${done.length} | In-progress: ${inProgress.length} | Todo: ${todo.length}\n`);
  console.log("TODO tasks:");
  todo.forEach((t) => {
    const ws = wsMap.get(t.workstreamId);
    console.log(`  [${t.priority}] ${ws?.title} > ${t.title}`);
  });
  if (inProgress.length > 0) {
    console.log("\nIN-PROGRESS tasks:");
    inProgress.forEach((t) => {
      const ws = wsMap.get(t.workstreamId);
      console.log(`  [${t.priority}] ${ws?.title} > ${t.title}`);
    });
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
