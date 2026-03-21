import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks } from "../shared/schema";

const projectTitle = "Phase 6 - Ingestion Engine Fortification and Trust";

type TaskUpdate = {
  title: string;
  status: "todo" | "in-progress" | "done";
  implementationUpdate: string;
};

const updates: TaskUpdate[] = [
  {
    title: "Capture operator corrections as structured feedback for future parser and routing improvements",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-21: owner-roster and bank-statement operator corrections now persist into a dedicated association-scoped correction-memory table, are refreshed during ingestion/review flows, and are covered by the ingestion rebuild verification script so future extraction and routing logic can consume structured remediation history instead of scraping prior payloads.",
  },
  {
    title: "Create unresolved-exception buckets for facts that do not cleanly map to the platform",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-21: ingestion now writes unresolved facts into first-class AI ingestion exception rows, supersedes stale exceptions on reprocess, and verifies persistence for unresolved bank-statement mappings so ambiguous facts land in a durable review bucket instead of disappearing in payload JSON.",
  },
  {
    title: "Build explicit destination routing rules from canonical entities to units, persons, ownerships, contacts, and exceptions",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-21: owner-roster, contact-roster, and bank-statement outputs now attach a canonical entity graph, destination planning reads entity counts from that graph, and the importers route units, persons, ownership candidates, contact points, bank transactions, and unresolved exceptions from canonical entities rather than relying on record-specific raw payload shapes.",
  },
  {
    title: "Create canonical ingestion entities for building, unit, person, contact point, ownership candidate, and notes",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-21: extracted owner/contact/bank payloads now persist a canonical entity graph with building, unit, person, contact-point, ownership-candidate, bank-transaction, note, and exception entities, creating an explicit intermediate normalization layer that preserves source facts before importer routing.",
  },
  {
    title: "Support multi-owner, multi-email, multi-phone, and relationship-note preservation",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-21: hierarchical owner-roster segmentation preserves compound owner candidates, owner/contact imports now retain multiple emails and phones in person contact points, ownership rows store relationship notes, and the ingestion rebuild verification script confirms those structured facts survive review and commit.",
  },
  {
    title: "Inject tenant-specific context such as known units, buildings, and prior owners into extraction and matching",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-21: ingestion jobs now build an association-scoped context snapshot with known unit numbers, building names, prior owners, and correction memory, pass that context into AI/fallback extraction, persist it alongside canonical entities, and use association-specific ownership/contact history during owner and bank-statement matching.",
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

  console.log(`Updated ${touched} Phase 6 roadmap tasks.`);
}

main().catch((error) => {
  console.error("Failed to update Phase 6 roadmap tasks:", error);
  process.exit(1);
});
