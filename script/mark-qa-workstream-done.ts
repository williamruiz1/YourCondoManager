import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks } from "../shared/schema";

const DONE_TITLES = [
  "Responsive 12-column grid layout for main content areas",
  "Dark mode support for redesigned components",
  "Accessibility audit of redesigned workspace",
  "Cross-browser visual QA pass",
  "Page load performance optimization",
];

async function main() {
  const [project] = await db.select().from(roadmapProjects)
    .where(eq(roadmapProjects.title, "Property Manager Workspace Redesign"));

  const tasks = await db.select().from(roadmapTasks)
    .where(eq(roadmapTasks.projectId, project.id));

  let updated = 0;
  for (const title of DONE_TITLES) {
    const task = tasks.find((t) => t.title === title);
    if (!task) { console.warn(`Not found: ${title}`); continue; }
    await db.update(roadmapTasks)
      .set({ status: "done", completedDate: new Date() })
      .where(eq(roadmapTasks.id, task.id));
    console.log(`[done] ${task.title}`);
    updated++;
  }

  console.log(`\nMarked ${updated} tasks done.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
