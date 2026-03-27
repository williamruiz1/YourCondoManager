import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapTasks } from "../shared/schema";

const title = process.argv[2];
if (!title) { console.error("Usage: npx tsx script/mark-task-done.ts <title>"); process.exit(1); }

async function main() {
  const tasks = await db.select().from(roadmapTasks);
  const task = tasks.find(t => t.title === title);
  if (!task) { console.error("Task not found:", title); process.exit(1); }
  await db.update(roadmapTasks)
    .set({ status: "done", completedDate: task.completedDate ?? new Date(), updatedAt: new Date() })
    .where(eq(roadmapTasks.id, task.id));
  console.log("done:", title);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
