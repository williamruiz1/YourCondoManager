import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks, roadmapWorkstreams } from "../shared/schema";

async function run() {
  console.log("Adding Full Help Center to Admin Roadmap backlog...\n");

  const projectTitle = "Full Help Center";
  const projectDescription =
    "Build a comprehensive, searchable help center with authored articles, guides, video walkthroughs, and integrated support contact. Replaces the current static FAQ page with a full knowledge base that supports categories, search indexing, and admin-authored content management.";

  // Upsert project
  let [project] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, projectTitle));

  if (!project) {
    [project] = await db
      .insert(roadmapProjects)
      .values({ title: projectTitle, description: projectDescription, status: "active", isCollapsed: 0 })
      .returning();
    console.log(`[+] Created project: ${project.title}`);
  } else {
    console.log(`[~] Project already exists: ${project.title}`);
  }

  // Workstream
  const wsTitle = "Help Center Platform";
  const wsDescription =
    "Core infrastructure and UI for the full help center — article CMS, search, category management, and support integration.";

  let [workstream] = await db
    .select()
    .from(roadmapWorkstreams)
    .where(and(eq(roadmapWorkstreams.projectId, project.id), eq(roadmapWorkstreams.title, wsTitle)));

  if (!workstream) {
    [workstream] = await db
      .insert(roadmapWorkstreams)
      .values({ projectId: project.id, title: wsTitle, description: wsDescription, orderIndex: 0, isCollapsed: 0 })
      .returning();
    console.log(`  [+] Workstream: ${workstream.title}`);
  } else {
    console.log(`  [~] Workstream already exists: ${workstream.title}`);
  }

  // Tasks (all backlog/todo)
  const tasks = [
    {
      title: "Article content management system",
      description:
        "Build an admin interface for creating, editing, and publishing help articles. Support rich text editing, image uploads, draft/published status, and revision history.",
      effort: "large" as const,
      priority: "high" as const,
      status: "todo" as const,
    },
    {
      title: "Category and tag taxonomy",
      description:
        "Implement a category hierarchy and tagging system for organizing articles. Support nested categories, tag-based filtering, and automatic article grouping.",
      effort: "medium" as const,
      priority: "medium" as const,
      status: "todo" as const,
    },
    {
      title: "Full-text search with relevance ranking",
      description:
        "Add full-text search across all help articles with relevance-based ranking. Support typo tolerance, synonym matching, and search analytics to identify gaps in documentation.",
      effort: "large" as const,
      priority: "high" as const,
      status: "todo" as const,
    },
    {
      title: "Contextual help integration",
      description:
        "Add contextual help tooltips and links throughout the application that deep-link to relevant help articles based on the current page or feature being used.",
      effort: "medium" as const,
      priority: "medium" as const,
      status: "todo" as const,
    },
    {
      title: "Support contact and ticket submission",
      description:
        "Integrate a support contact form within the help center allowing users to submit support tickets with category selection, priority, and file attachments.",
      effort: "medium" as const,
      priority: "medium" as const,
      status: "todo" as const,
    },
    {
      title: "Video walkthrough and guide embeds",
      description:
        "Support embedding video walkthroughs and step-by-step visual guides within help articles. Include a dedicated 'Getting Started' guide section with onboarding videos.",
      effort: "medium" as const,
      priority: "low" as const,
      status: "todo" as const,
    },
  ];

  for (const taskDef of tasks) {
    const [existing] = await db
      .select()
      .from(roadmapTasks)
      .where(
        and(
          eq(roadmapTasks.projectId, project.id),
          eq(roadmapTasks.workstreamId, workstream.id),
          eq(roadmapTasks.title, taskDef.title),
        ),
      );

    if (!existing) {
      await db.insert(roadmapTasks).values({
        projectId: project.id,
        workstreamId: workstream.id,
        title: taskDef.title,
        description: taskDef.description,
        status: taskDef.status,
        effort: taskDef.effort,
        priority: taskDef.priority,
        dependencyTaskIds: [],
      });
      console.log(`    [+] Task: ${taskDef.title}`);
    } else {
      console.log(`    [~] Task already exists: ${taskDef.title}`);
    }
  }

  console.log("\nDone.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
