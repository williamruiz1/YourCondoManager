import { db } from "../server/db";
import { roadmapProjects, roadmapTasks, roadmapWorkstreams } from "../shared/schema";
import { eq } from "drizzle-orm";

async function run() {
  const projects = await db.select().from(roadmapProjects);
  console.log("=== ROADMAP PROJECTS ===");
  for (const p of projects) {
    console.log(`  [${p.status}] ${p.title} (id: ${p.id})`);
  }

  console.log("\n=== PROJECTS WITH TASKS STATUS BREAKDOWN ===");
  for (const p of projects) {
    const workstreams = await db.select().from(roadmapWorkstreams).where(eq(roadmapWorkstreams.projectId, p.id));
    const tasks = await db.select().from(roadmapTasks).where(eq(roadmapTasks.projectId, p.id));
    const done = tasks.filter(t => t.status === "done").length;
    const inProgress = tasks.filter(t => t.status === "in-progress").length;
    const todo = tasks.filter(t => t.status === "todo").length;
    console.log(`\n  ${p.title} [project status: ${p.status}]`);
    console.log(`    Workstreams: ${workstreams.length} | Tasks: ${tasks.length} (done: ${done}, in-progress: ${inProgress}, todo: ${todo})`);

    // Check if all tasks are done but project not marked complete
    if (tasks.length > 0 && done === tasks.length && p.status !== "complete") {
      console.log(`    ⚠️  ALL TASKS DONE but project status is "${p.status}" — should be "complete"`);
    }
  }

  // Check which project titles are referenced by feature tree roadmap rules
  const ruleProjectTitles = [
    "FTPH Next Phase - Payment Processing and Financial Automation",
    "FTPH Follow-On Phase - Vendor, Maintenance, and Property Operations",
    "Platform Gap Analysis - 2026-03-07",
    "Active Project - Google OAuth Sign-In (Session-Based)",
    "Active Project - Association-Scoped Board Member Access",
  ];

  console.log("\n=== FEATURE TREE ROADMAP RULE PROJECT REFERENCES ===");
  for (const title of ruleProjectTitles) {
    const match = projects.find(p => p.title === title);
    if (match) {
      console.log(`  ✓ "${title}" → status: ${match.status}`);
    } else {
      console.log(`  ✗ "${title}" → NOT FOUND in roadmap_projects`);
    }
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
