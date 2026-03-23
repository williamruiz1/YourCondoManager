import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks } from "../shared/schema";

// Task titles to mark as done (design and development tasks completed)
const completedTaskTitles = [
  // Hero Section tasks
  "Redesign hero section headline and messaging",
  "Design hero layout and two-column split",
  "Design call-to-action hierarchy in hero",

  // Self-Managed Associations tasks
  "Design section header and intro messaging",
  "Design feature card grid (3 features: Dues, Maintenance, Voting)",
  "Design background image and color overlay treatment",
  "Design section CTA and progression to next section",

  // Enterprise PMC Section tasks
  "Design section header and enterprise messaging",
  "Design bento-grid layout (8 cards: 4+4 asymmetric placement)",
  "Design individual feature cards with icons and descriptions",
  "Design interactive elements (Learn more button, icon accents)",
  "Design background and visual polish for bento section",

  // Resident Engagement Section tasks
  "Design section header and resident-focused messaging",
  "Design mobile phone mockup showcase (left side)",
  "Design floating glass-morphism card (overlapping phone)",
  "Design numbered feature list (3 items: 01, 02, 03)",
  "Design section background and responsive mobile layout",

  // CTA Canvas & Footer tasks
  "Design CTA canvas (dark background with dotted pattern)",
  "Design footer layout and content structure",
  "Design footer typography and link hierarchy",

  // Development & Implementation tasks
  "Build hero section component with responsive layout",
  "Build self-managed associations section (cards + image)",
  "Build enterprise bento-grid section with 8-card layout",
  "Build resident engagement section (phone mockup + floating card)",
  "Build CTA canvas and footer sections",
  "Wire up all CTAs and navigation links",
];

// Task titles to mark as in-progress
const inProgressTaskTitles = [
  "Cross-browser and device testing",
  "Accessibility compliance check (WCAG AA)",
  "Performance optimization and image loading",
  "Dark mode testing and verification",
];

async function updateTaskProgress() {
  // Get the project
  const [project] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, "Solutions Page Redesign"));

  if (!project) {
    console.log("Project not found");
    return;
  }

  // Mark completed tasks as done
  for (const taskTitle of completedTaskTitles) {
    const [task] = await db
      .select()
      .from(roadmapTasks)
      .where(
        and(
          eq(roadmapTasks.projectId, project.id),
          eq(roadmapTasks.title, taskTitle),
        ),
      );

    if (task) {
      await db
        .update(roadmapTasks)
        .set({
          status: "done",
          updatedAt: new Date(),
        })
        .where(eq(roadmapTasks.id, task.id));
      console.log(`✓ Marked as done: ${taskTitle}`);
    } else {
      console.log(`✗ Task not found: ${taskTitle}`);
    }
  }

  // Mark in-progress tasks
  for (const taskTitle of inProgressTaskTitles) {
    const [task] = await db
      .select()
      .from(roadmapTasks)
      .where(
        and(
          eq(roadmapTasks.projectId, project.id),
          eq(roadmapTasks.title, taskTitle),
        ),
      );

    if (task) {
      await db
        .update(roadmapTasks)
        .set({
          status: "in-progress",
          updatedAt: new Date(),
        })
        .where(eq(roadmapTasks.id, task.id));
      console.log(`→ Marked as in-progress: ${taskTitle}`);
    }
  }
}

updateTaskProgress()
  .then(async () => {
    await db.$client.end();
    console.log("\nTask progress updated successfully!");
  })
  .catch(async (error) => {
    console.error(error);
    await db.$client.end();
    process.exit(1);
  });
