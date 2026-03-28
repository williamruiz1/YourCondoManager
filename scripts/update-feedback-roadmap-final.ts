/**
 * Marks remaining Admin Contextual Feedback Widget roadmap tasks as done.
 *
 * Run with: npx tsx scripts/update-feedback-roadmap-final.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, inArray } from "drizzle-orm";
import pg from "pg";
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const COMPLETED_TASK_TITLES = [
  // WS3 – image attachments
  "Enhance roadmap data model and API to support image attachments on feedback tickets",
  // WS4 – screenshot capture and marker clustering
  "Integrate screenshot capture with timeout and graceful fallback handling",
  "Support marker overlap clustering and editable detail popovers",
  // WS5 – performance budgets
  "Validate performance budgets for lazy loading, hover tracking, and marker rendering",
  // WS6 – verification, telemetry, rollout
  "Create end-to-end verification checklist for desktop, mobile, and failure-path scenarios",
  "Add roadmap and product telemetry needed to measure adoption and duplicate rate",
  "Prepare rollout notes, operator guidance, and roadmap closeout criteria",
];

async function main() {
  const [project] = await db
    .select()
    .from(schema.roadmapProjects)
    .where(eq(schema.roadmapProjects.title, "Active Project - Admin Contextual Feedback Widget"))
    .limit(1);

  if (!project) {
    console.log("Project not found");
    return;
  }

  const tasks = await db
    .select()
    .from(schema.roadmapTasks)
    .where(
      and(
        eq(schema.roadmapTasks.projectId, project.id),
        inArray(schema.roadmapTasks.title, COMPLETED_TASK_TITLES),
      ),
    );

  let updated = 0;
  for (const task of tasks) {
    if (task.status === "done") {
      console.log(`Already done: ${task.title.slice(0, 70)}`);
      continue;
    }
    await db
      .update(schema.roadmapTasks)
      .set({ status: "done", completedDate: new Date() })
      .where(eq(schema.roadmapTasks.id, task.id));
    console.log(`Marked done: ${task.title.slice(0, 70)}`);
    updated++;
  }

  // Also mark the project as complete since all tasks are done
  if (updated > 0) {
    await db
      .update(schema.roadmapProjects)
      .set({ status: "complete", updatedAt: new Date() })
      .where(eq(schema.roadmapProjects.id, project.id));
    console.log("\nProject marked as complete.");
  }

  console.log(`\nUpdated ${updated} tasks to done. ${tasks.length - updated} were already done.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
