/**
 * Marks implemented Admin Contextual Feedback Widget roadmap tasks as done.
 *
 * Run with: npx tsx scripts/update-feedback-roadmap-completed.ts
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
  // WS0 – all three are implemented
  "Confirm service model and success criteria for contextual admin feedback",
  "Restrict widget visibility and submission authority to platform-admin users",
  "Resolve roadmap ticket editing model for marker interactions",
  // WS1 – remaining three (toolbar activation already done)
  "Implement viewport overlay, hover highlighting, and inspector tooltip at 60fps",
  "Suppress native clicks, form submissions, and navigation while keeping scroll active",
  "Support touch interaction with move, long-press select, and mobile-safe overlay behavior",
  // WS3 – in-widget editing flow
  "Implement in-widget editing flow for existing contextual tickets",
  // WS4 – marker persistence and route-filtered markers
  "Persist marker registry in local storage with capped retention and stale-position fallback",
  "Render route-filtered open-ticket markers with status refresh and stale detection",
  // WS5 – CSS isolation and API-only enforcement
  "Keep widget CSS and portals isolated from host application styles",
  "Enforce screenshot and feedback handling through first-party authenticated APIs only",
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
      .set({ status: "done" })
      .where(eq(schema.roadmapTasks.id, task.id));
    console.log(`Marked done: ${task.title.slice(0, 70)}`);
    updated++;
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
