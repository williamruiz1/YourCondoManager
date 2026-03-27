import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks } from "../shared/schema";

const PROJECT_TITLE = "Landing Page Redesign - CondoManager Public Site";

const COMPLETED_TASKS = [
  "Accessibility audit — contrast, focus states, ARIA",
  "Final design review and stakeholder sign-off",
];

async function main() {
  const [project] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, PROJECT_TITLE));

  if (!project) {
    console.error(`Project not found: "${PROJECT_TITLE}"`);
    process.exit(1);
  }

  console.log(`Found project: ${project.title}`);

  const tasks = await db
    .select()
    .from(roadmapTasks)
    .where(eq(roadmapTasks.projectId, project.id));

  const now = new Date();
  let updated = 0;

  for (const title of COMPLETED_TASKS) {
    const task = tasks.find((t) => t.title === title);
    if (!task) {
      console.warn(`  ! Not found: "${title}"`);
      continue;
    }
    if (task.status === "done") {
      console.log(`  - Already done: "${title}"`);
      continue;
    }
    await db
      .update(roadmapTasks)
      .set({ status: "done", completedDate: now, updatedAt: now })
      .where(and(eq(roadmapTasks.id, task.id), eq(roadmapTasks.projectId, project.id)));
    console.log(`  + Marked done: "${title}"`);
    updated++;
  }

  console.log(`\nUpdated: ${updated}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
