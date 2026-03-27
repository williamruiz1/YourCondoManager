import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks } from "../shared/schema";

const PROJECT_TITLE = "Active Project - Board Member UX";
const WORKSTREAM_TITLE = "Board Portal Feature Recovery";

const COMPLETED_TASKS = [
  "Restore Attention / Action Items panel",
  "Restore Maintenance oversight section",
  "Restore Board Packages access and workflow status",
  "Restore Notices / Communications status display",
  "Restore open governance tasks list",
  "Restore financial detail surfaces (ledger entries, invoices, open balance)",
  "Restore delinquency snapshot",
  "Restore board member own term and access status display",
  "Restore Resident Feedback access from board portal",
  "Restore Announcements access from board portal",
  "Restore Insurance Policies access from board portal",
  "Restore Inspections access from board portal",
  "Restore Maintenance Schedules access from board portal",
  "Add Maintenance to Quick Launch panel",
  "Restore document browse and search capability in portal mode",
  "Restore mobile navigation for board portal",
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

  console.log(`Found project: ${project.title} (${project.id})`);

  const tasks = await db
    .select()
    .from(roadmapTasks)
    .where(eq(roadmapTasks.projectId, project.id));

  const now = new Date();
  let updated = 0;
  let alreadyDone = 0;
  let notFound = 0;

  for (const title of COMPLETED_TASKS) {
    const task = tasks.find((t) => t.title === title);

    if (!task) {
      console.warn(`  ! Task not found: "${title}"`);
      notFound++;
      continue;
    }

    if (task.status === "done") {
      console.log(`  - Already done: "${title}"`);
      alreadyDone++;
      continue;
    }

    await db
      .update(roadmapTasks)
      .set({ status: "done", completedDate: now, updatedAt: now })
      .where(and(eq(roadmapTasks.id, task.id), eq(roadmapTasks.projectId, project.id)));

    console.log(`  + Marked done: "${title}"`);
    updated++;
  }

  console.log(`\nWorkstream "${WORKSTREAM_TITLE}" complete.`);
  console.log(`Updated: ${updated}, Already done: ${alreadyDone}, Not found: ${notFound}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
