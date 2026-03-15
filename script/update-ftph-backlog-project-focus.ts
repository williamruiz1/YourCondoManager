import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapWorkstreams } from "../shared/schema";

const projectTitle = "FTPH Backlog Closure - Inactive and Partial Feature Delivery";

async function main() {
  const [project] = await db.select().from(roadmapProjects).where(eq(roadmapProjects.title, projectTitle)).limit(1);
  if (!project) {
    throw new Error(`Roadmap project not found: ${projectTitle}`);
  }

  await db
    .update(roadmapProjects)
    .set({
      description:
        "Cross-phase implementation plan for FTPH backlog items currently marked inactive or partial in the feature tree. AI ingestion is now largely delivered; active execution focus has shifted to resident intake, communications routing, managed regulatory records, governance automation, owner experience, and platform expansion backlog branches.",
      updatedAt: new Date(),
    })
    .where(eq(roadmapProjects.id, project.id));

  const [aiWorkstream] = await db
    .select()
    .from(roadmapWorkstreams)
    .where(and(eq(roadmapWorkstreams.projectId, project.id), eq(roadmapWorkstreams.title, "AI Ingestion Completion and Traceability")))
    .limit(1);
  if (aiWorkstream) {
    await db
      .update(roadmapWorkstreams)
      .set({
        description:
          "AI ingestion backlog is largely delivered: raw-source support, importer coverage, durable provenance, reprocess integrity, monitoring, and cleanup are in place. Remaining work is optional expansion to additional binary formats.",
        updatedAt: new Date(),
      })
      .where(eq(roadmapWorkstreams.id, aiWorkstream.id));
  }

  const [residentWorkstream] = await db
    .select()
    .from(roadmapWorkstreams)
    .where(and(eq(roadmapWorkstreams.projectId, project.id), eq(roadmapWorkstreams.title, "Resident Intake and Association Completeness")))
    .limit(1);
  if (residentWorkstream) {
    await db
      .update(roadmapWorkstreams)
      .set({
        description:
          "Current execution focus. Finish resident intake and association onboarding so unit-scoped owner/tenant submission links, occupancy state derivation, and completeness remediation workflows become operationally complete.",
        updatedAt: new Date(),
      })
      .where(eq(roadmapWorkstreams.id, residentWorkstream.id));
  }

  console.log("Updated backlog project focus and workstream summaries.");
}

main().catch((error) => {
  console.error("Failed to update backlog project focus:", error);
  process.exit(1);
});
