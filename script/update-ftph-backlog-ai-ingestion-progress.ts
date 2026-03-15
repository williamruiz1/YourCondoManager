import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks } from "../shared/schema";

const projectTitle = "FTPH Backlog Closure - Inactive and Partial Feature Delivery";

type TaskUpdate = {
  title: string;
  status: "todo" | "in-progress" | "done";
  implementationUpdate: string;
};

const updates: TaskUpdate[] = [
  {
    title: "Expand AI ingestion raw-source support beyond text-centric uploads",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-15: ingestion now accepts PDFs, DOCX files, and XLSX workbooks as first-class raw sources using server-side extraction, and the operator workflow/documentation were updated accordingly. Remaining broader backlog scope is binary coverage beyond those formats.",
  },
  {
    title: "Add commit importers for meeting notes and document metadata outputs",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-15: approved meeting-notes records now import into governance meetings/meeting notes, and approved document-metadata records now reconcile into the document repository by updating a linked source document or creating a repository document from the ingestion source file.",
  },
  {
    title: "Harden ingestion reprocess and import-run history integrity",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-15: reprocessing now supersedes prior extracted records and clause records instead of deleting them, preserving historical import-run foreign-key integrity while keeping active review queues scoped to unsuperseded outputs. The admin ingestion workspace surfaces active versus superseded outputs per job, can include superseded records/clauses in review, reports superseded-output accumulation in rollout monitoring, and provides retention-based cleanup preview/execution for purgeable superseded clauses and unreferenced extracted records.",
  },
  {
    title: "Persist durable source traceability across extracted records and clauses",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-15: ingestion jobs and clause outputs now preserve repository-document provenance when a source document is linked, and clause outputs are anchored to a concrete extracted record from the same ingestion job for durable review traceability. Remaining separate backlog scope is superseded-history lifecycle UX.",
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

  console.log(`Updated ${touched} AI ingestion backlog roadmap tasks.`);
}

main().catch((error) => {
  console.error("Failed to update AI ingestion backlog roadmap tasks:", error);
  process.exit(1);
});
