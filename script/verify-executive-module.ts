import { db } from "../server/db";
import { executiveEvidence, executiveUpdates, roadmapTasks } from "../shared/schema";
import { storage } from "../server/storage";
import { eq } from "drizzle-orm";

async function run() {
  const syncResult = await storage.syncExecutiveFromRoadmap();
  console.log("Sync result:", syncResult);

  const updates = await storage.getExecutiveUpdates();
  console.log("Total executive updates:", updates.length);
  if (updates.length === 0) {
    throw new Error("No executive updates found after sync.");
  }

  const [doneTask] = await db.select().from(roadmapTasks).where(eq(roadmapTasks.status, "done"));
  if (doneTask) {
    const expectedSourceKey = `roadmap-task:${doneTask.id}`;
    const found = updates.find((u) => u.sourceKey === expectedSourceKey);
    if (!found) {
      throw new Error(`Expected synced update for ${expectedSourceKey} not found.`);
    }
  }

  const manual = await storage.createExecutiveUpdate({
    title: "Manual Executive Checkpoint",
    headline: "Manual highlight created",
    summary: "Verification created this record to confirm create API path.",
    businessValue: "Confirms admin can draft customer-facing executive copy.",
    status: "draft",
    sourceType: "manual",
    sourceKey: null,
    projectId: null,
    workstreamId: null,
    taskId: null,
    deliveredAt: new Date(),
    displayOrder: 0,
    createdBy: "verify-script",
  });

  await storage.createExecutiveEvidence({
    executiveUpdateId: manual.id,
    evidenceType: "note",
    label: "Verification evidence",
    value: "Evidence row created successfully.",
    metadataJson: { script: "verify-executive-module" },
  });

  const evidenceRows = await storage.getExecutiveEvidence(manual.id);
  console.log("Evidence rows for manual update:", evidenceRows.length);
  if (evidenceRows.length === 0) {
    throw new Error("Expected evidence rows for manual executive update.");
  }

  await db.delete(executiveEvidence).where(eq(executiveEvidence.executiveUpdateId, manual.id));
  await db.delete(executiveUpdates).where(eq(executiveUpdates.id, manual.id));
  console.log("Verification cleanup complete.");
}

run()
  .then(() => {
    console.log("Executive module verification passed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Executive module verification failed:", error);
    process.exit(1);
  });
