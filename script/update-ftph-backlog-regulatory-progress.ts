import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks, roadmapWorkstreams } from "../shared/schema";

const projectTitle = "FTPH Backlog Closure - Inactive and Partial Feature Delivery";

type TaskUpdate = {
  title: string;
  status: "todo" | "in-progress" | "done";
  implementationUpdate: string;
};

const updates: TaskUpdate[] = [
  {
    title: "Create managed regulatory source registry with freshness metadata",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-15: governance compliance records now persist source authority, source URL, source document title, source document date, effective date, last source update date, verification timestamps, next review date, publication status, published date, and review notes. Checklist items also store legal-reference and source-citation fields so jurisdiction records remain traceable to authoritative sources.",
  },
  {
    title: "Implement jurisdiction sync, review, and publication workflow",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-15: the regulatory library sync path now upserts managed CT, FL, and CA source-backed records instead of anonymous static seeds, refreshes item-level source citations, and marks synced records as reviewed and published. The governance compliance UI now surfaces source metadata and supports review-to-published lifecycle actions for selected regulatory records.",
  },
  {
    title: "Add regulatory versioning, applicability overlays, and staleness monitoring",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-15: version number and year continue to govern historical record slices, association overlays remain attached through baseTemplateId plus associationId without forking the jurisdiction source record, and freshness monitoring is now visible through last verified dates, next review due dates, and stale-record counts in the compliance workspace.",
  },
  {
    title: "Activate AI compliance gap detection on approved regulatory and bylaw records",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-15: clause-based compliance rule extraction now feeds a managed-record comparison engine that computes association-specific compliance gaps against published regulatory records, surfaces them in the governance compliance dashboard, and supports suppression or resolution overrides for reviewed alerts.",
  },
];

function mergeImplementationUpdate(description: string | null, implementationUpdate: string): string {
  const base = (description || "").trim();
  const marker = "Implementation Update:";
  const stripped = base.includes(marker) ? base.slice(0, base.indexOf(marker)).trim() : base;
  return [stripped, `${marker} ${implementationUpdate}`].filter(Boolean).join("\n\n");
}

async function main() {
  const [project] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, projectTitle))
    .limit(1);

  if (!project) {
    throw new Error(`Roadmap project not found: ${projectTitle}`);
  }

  let touched = 0;
  for (const update of updates) {
    const [task] = await db
      .select()
      .from(roadmapTasks)
      .where(and(eq(roadmapTasks.projectId, project.id), eq(roadmapTasks.title, update.title)))
      .limit(1);

    if (!task) {
      throw new Error(`Roadmap task not found: ${update.title}`);
    }

    const now = new Date();
    await db
      .update(roadmapTasks)
      .set({
        status: update.status,
        description: mergeImplementationUpdate(task.description, update.implementationUpdate),
        completedDate: update.status === "done" ? (task.completedDate ?? now) : null,
        updatedAt: now,
      })
      .where(eq(roadmapTasks.id, task.id));

    touched += 1;
  }

  const [workstream] = await db
    .select()
    .from(roadmapWorkstreams)
    .where(and(
      eq(roadmapWorkstreams.projectId, project.id),
      eq(roadmapWorkstreams.title, "Regulatory Records and Compliance Intelligence"),
    ))
    .limit(1);

  if (workstream) {
    await db
      .update(roadmapWorkstreams)
      .set({
        description:
          "Managed regulatory records are now running on source-backed compliance records with authoritative URLs, review and publication state, item-level citations, version metadata, association overlays, freshness monitoring, clause-based gap detection, alert dashboards, and suppression overrides in the compliance workspace.",
        updatedAt: new Date(),
      })
      .where(eq(roadmapWorkstreams.id, workstream.id));
  }

  console.log(`Updated ${touched} regulatory backlog roadmap tasks.`);
}

main().catch((error) => {
  console.error("Failed to update regulatory backlog roadmap tasks:", error);
  process.exit(1);
});
