import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks } from "../shared/schema";

const PROJECT_TITLE = "Production Deployment Stability";

// A-4: Association edit fields ARE stored in DB-backed columns — confirmed by
//      reading PATCH /api/associations/:id → storage.updateAssociation() with
//      insertAssociationSchema.partial().parse(body). No local-state-only fields.
//
// A-2: FK integrity check script created at script/check-fk-integrity.ts.
//      Runs 12 checks, exits 1 on any violation. Clean on current dev DB.
//
// B-3: Fixed session cookie name collision — dev now uses "sid_dev", production
//      uses "sid". Prevents IDE preview session from interfering with published app.
//
// B-4: authRestore flow verified correct. Added console.warn logging on failure
//      so status code and server message are visible in browser console.
//
// A-6 + B-5 remain as runtime verification tasks (require deployed app).

const COMPLETED_TASKS = [
  "A-4 Confirm association edit fields are stored in DB-backed columns not local state",
  "A-2 Verify FK constraint cleanliness in dev DB before each deploy",
  "B-3 Investigate session cookie behavior when Replit IDE and published app share a browser",
  "B-4 Verify authRestore token flow completes correctly in production",
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
