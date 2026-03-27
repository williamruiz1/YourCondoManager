import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects } from "../shared/schema";

const TO_COMPLETE = [
  "Landing Page Redesign - CondoManager Public Site",
  "Active Project - Board Member UX",
];

async function main() {
  const now = new Date();
  for (const title of TO_COMPLETE) {
    const [project] = await db.select().from(roadmapProjects).where(eq(roadmapProjects.title, title));
    if (!project) { console.warn(`Not found: "${title}"`); continue; }
    if (project.status === "complete") { console.log(`Already complete: ${title}`); continue; }
    await db.update(roadmapProjects).set({ status: "complete", updatedAt: now }).where(eq(roadmapProjects.id, project.id));
    console.log(`Marked complete: ${title}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
