import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks } from "../shared/schema";

const PROJECT_TITLE = "Production Deployment Stability";

// A-6: Cherry Hill Court Condominiums (f301d073) verified in DB:
//      EIN=06-1513429, dateFormed=1990-07-16, address=1405 Quinnipiac Ave,
//      New Haven CT, 4 buildings, 18 units. Archived duplicate (628b7d4b)
//      is intentionally inactive and not the target.
//
// B-5: yourcondomanagement@gmail.com verified:
//      admin_users role=platform-admin is_active=1
//      auth_users is_active=1 linked to admin_user_id correctly.

const COMPLETED_TASKS = [
  "A-6 Verify Cherry Hill Court data is visible in production post-fix",
  "B-5 Confirm yourcondomanagement@gmail.com signs in and sees correct admin workspace",
];

async function main() {
  const [project] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, PROJECT_TITLE));

  if (!project) { console.error(`Project not found: "${PROJECT_TITLE}"`); process.exit(1); }
  console.log(`Found project: ${project.title}`);

  const tasks = await db.select().from(roadmapTasks).where(eq(roadmapTasks.projectId, project.id));
  const now = new Date();
  let updated = 0;

  for (const title of COMPLETED_TASKS) {
    const task = tasks.find((t) => t.title === title);
    if (!task) { console.warn(`  ! Not found: "${title}"`); continue; }
    if (task.status === "done") { console.log(`  - Already done: "${title}"`); continue; }
    await db.update(roadmapTasks)
      .set({ status: "done", completedDate: now, updatedAt: now })
      .where(and(eq(roadmapTasks.id, task.id), eq(roadmapTasks.projectId, project.id)));
    console.log(`  + Marked done: "${title}"`);
    updated++;
  }

  // Check if all tasks are now done and close the project
  const remaining = tasks.filter((t) => t.status !== "done" && !COMPLETED_TASKS.includes(t.title));
  const allDone = remaining.length === 0;
  if (allDone) {
    await db.update(roadmapProjects)
      .set({ status: "complete", updatedAt: now })
      .where(eq(roadmapProjects.id, project.id));
    console.log(`\nProject marked complete: ${PROJECT_TITLE}`);
  }

  console.log(`Updated: ${updated}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
