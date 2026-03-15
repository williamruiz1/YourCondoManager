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
    title: "Implement paired owner and tenant secure submission links per unit",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-15: association admins can now generate or reuse unit-scoped owner-update and tenant-submission links from the onboarding workspace, copy those links directly, and explicitly regenerate them by revoking prior active unit-link invites. The implementation reuses onboarding invites with deliveryChannel = unit-link so expiry and token semantics stay aligned to the existing onboarding system.",
  },
  {
    title: "Build occupancy-conditional owner and multi-tenant intake forms",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-15: the public owner onboarding form now captures occupancy intent (owner-occupied, rental, or vacant), supports optional second-owner entry, and provides add/remove tenant interactions for rental units. Submission review persists the structured owner/tenant payload and approval creates the primary owner, optional second owner, and tenant occupancy records within the existing onboarding workflow.",
  },
  {
    title: "Derive canonical unit occupancy state and counts",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-15: residential dataset and association overview responses now derive canonical unit occupancy state from active ownership and occupancy records, exposing owner-occupied, rental-occupied, vacant, and unassigned statuses plus owner count, tenant count, occupant count, last occupancy update, vacancy rollups, and occupancy-rate summary metrics for association operations views.",
  },
  {
    title: "Expand association completeness metrics and remediation actions",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-15: onboarding completeness now computes explicit setup domains for units, owner data, tenant data, board setup, payment methods, and communication templates. The association onboarding console renders those domain-level completion metrics and direct remediation cards that route administrators to owner-link collection, tenant-data collection, board setup, payments, and communications configuration.",
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

  const [residentWorkstream] = await db
    .select()
    .from(roadmapWorkstreams)
    .where(and(
      eq(roadmapWorkstreams.projectId, project.id),
      eq(roadmapWorkstreams.title, "Resident Intake and Association Completeness"),
    ))
    .limit(1);

  if (residentWorkstream) {
    await db
      .update(roadmapWorkstreams)
      .set({
        description:
          "Resident intake and association completeness are delivered: unit-scoped owner and tenant links, token regeneration, occupancy-conditional owner intake, bundled multi-tenant capture, canonical occupancy derivation, domain-level completeness metrics, and remediation actions are now live in the onboarding workspace.",
        updatedAt: new Date(),
      })
      .where(eq(roadmapWorkstreams.id, residentWorkstream.id));
  }

  console.log(`Updated ${touched} resident-intake backlog roadmap tasks.`);
}

main().catch((error) => {
  console.error("Failed to update resident-intake backlog roadmap tasks:", error);
  process.exit(1);
});
