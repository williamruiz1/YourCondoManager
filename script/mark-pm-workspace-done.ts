/**
 * Marks completed PM Workspace Redesign tasks as "done" in the roadmap.
 *
 * Completed workstreams/tasks based on code audit:
 *  - Workstream 1 (Design System): all 5 tasks done
 *  - Workstream 2 (Navigation): tasks 2, 3, 5 done (sidebar, bottom CTA, breadcrumb)
 *  - Workstream 3 (Portfolio Dashboard): all 6 tasks done
 *  - Workstream 4 (Association Workspace): all 7 tasks done
 */

import { eq, and } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapWorkstreams, roadmapTasks } from "../shared/schema";

const DONE_TASK_TITLE_PATTERNS: string[] = [
  // Workstream 1 — all 5
  "Integrate Newsreader serif + Manrope sans-serif typefaces",
  "Implement Material 3 color token system in Tailwind config",
  "Define border-radius and shadow tokens",
  "Create typography scale utility classes",
  "Add Material Symbols Outlined icon font",

  // Workstream 2 — tasks 2, 3, 5
  "Redesign left sidebar with fixed 256px width and hover animations",
  "Add sidebar bottom section: CTA button, Help, Logout",
  "Breadcrumb navigation component for sub-pages",

  // Workstream 3 — all 6
  "Portfolio hero header with period selector and export action",
  "Financial KPI bento grid (4 cards)",
  "Portfolio distribution table with association rows",
  "Critical alerts sidebar panel",
  "Recent activity timeline widget",
  "Floating action button on portfolio dashboard",

  // Workstream 4 — all 7
  "Editorial hero header for the association workspace",
  "Quick actions bento grid (3 tiles)",
  "Association overview stats strip (4 KPI tiles)",
  "Onboarding progress tracker card",
  "Attention required alerts card (right column)",
  "Activity ledger timeline (right column)",
  "Property map widget (right column)",
];

async function main() {
  // Find the project
  const [project] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, "Property Manager Workspace Redesign"));

  if (!project) {
    console.error("Project not found");
    process.exit(1);
  }
  console.log(`Found project: ${project.title} (${project.id})`);

  // Fetch all tasks for this project
  const allTasks = await db
    .select()
    .from(roadmapTasks)
    .where(eq(roadmapTasks.projectId, project.id));

  console.log(`Total tasks in project: ${allTasks.length}`);

  let updated = 0;
  let skipped = 0;
  const notFound: string[] = [];

  for (const titlePattern of DONE_TASK_TITLE_PATTERNS) {
    const task = allTasks.find((t) => t.title === titlePattern);
    if (!task) {
      notFound.push(titlePattern);
      continue;
    }
    if (task.status === "done") {
      console.log(`  [skip] already done: ${task.title}`);
      skipped++;
      continue;
    }
    await db
      .update(roadmapTasks)
      .set({ status: "done", completedDate: new Date().toISOString() })
      .where(eq(roadmapTasks.id, task.id));
    console.log(`  [done] ${task.title}`);
    updated++;
  }

  if (notFound.length > 0) {
    console.warn(`\nNot found (${notFound.length}):`);
    notFound.forEach((t) => console.warn(`  - ${t}`));
  }

  console.log(`\nDone: marked ${updated} tasks as done, ${skipped} already done.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
