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
    title: "Implement recipient targeting by role, unit scope, and board audience",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-15: communications recipient resolution now supports all owners, all tenants, all occupants, selected units with scoped recipient selection, individual owner, individual tenant, and board-member targeting. The communications admin UI and preview API were updated to drive those target types directly.",
  },
  {
    title: "Enforce owner and tenant communication routing policy",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-15: targeted communications now accept a message class and enforce owner-or-board-only delivery for financial and governance sends while allowing operational and maintenance sends to include tenants. Payment-instruction sends were tightened onto the owner-targeting model and now ride the financial message class.",
  },
  {
    title: "Add structured template blocks and canonical merge fields",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-15: notice templates now store optional header, footer, and signature blocks alongside the body template, and canonical merge variables are resolved server-side for association identity, unit number, owner or tenant names, maintenance link, and owner or tenant onboarding links before custom variables are applied.",
  },
  {
    title: "Replace generic payment method instructions with structured owner payment setup",
    status: "done",
    implementationUpdate:
      "Delivered on 2026-03-15: payment methods now store structured owner setup fields including account name, bank name, routing number, account number, mailing address, payment notes, Zelle handle, and support contacts. Owner payment instruction sends now render those structured values into canonical financial notice variables and stay on the owner-targeted routing path.",
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

  const [communicationsWorkstream] = await db
    .select()
    .from(roadmapWorkstreams)
    .where(and(
      eq(roadmapWorkstreams.projectId, project.id),
      eq(roadmapWorkstreams.title, "Communications Routing and Payment Guidance"),
    ))
    .limit(1);

  if (communicationsWorkstream) {
    await db
      .update(roadmapWorkstreams)
      .set({
        description:
          "Communications routing and payment guidance are delivered: recipient targeting by role, selected units, individual resident, and board audience; owner-vs-tenant routing policy by message class; structured template blocks with canonical merge variables; structured owner payment setup guidance; and campaign-level recipient-set audit semantics are now live.",
        updatedAt: new Date(),
      })
      .where(eq(roadmapWorkstreams.id, communicationsWorkstream.id));
  }

  console.log(`Updated ${touched} communications backlog roadmap tasks.`);
}

main().catch((error) => {
  console.error("Failed to update communications backlog roadmap tasks:", error);
  process.exit(1);
});
