import { promises as fs } from "fs";
import path from "path";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../server/db";
import { analysisRuns, analysisVersions, roadmapProjects, roadmapTasks } from "../shared/schema";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUTPUT_DIR = path.join(ROOT, "docs", "agent-bootstrap");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "backbone-metrics.json");
const RESOURCE_ID = "admin-roadmap-backbone";
const MODULE = "agent-bootstrap-backbone";
const BACKBONE_TITLE = "Admin Roadmap Backbone - Agent Bootstrap and Continuous Improvement";
const MANIFEST_PATH = path.join(ROOT, "docs", "agent-bootstrap", "workspace-manifest.json");
const MEMORY_PATH = path.join(ROOT, "docs", "agent-bootstrap", "durable-memory.json");
const GUARDRAILS_PATH = path.join(ROOT, "docs", "projects", "agent-bootstrap-self-amend-guardrails.md");
const METRICS_DOC_PATH = path.join(ROOT, "docs", "projects", "agent-bootstrap-success-metrics.md");

function rel(filePath: string) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const [project] = await db.select().from(roadmapProjects).where(eq(roadmapProjects.title, BACKBONE_TITLE));
  if (!project) throw new Error("Backbone roadmap project not found");

  const [tasks, runs, versions] = await Promise.all([
    db.select().from(roadmapTasks).where(eq(roadmapTasks.projectId, project.id)),
    db.select().from(analysisRuns).where(and(eq(analysisRuns.resourceId, RESOURCE_ID), eq(analysisRuns.module, MODULE))),
    db.select().from(analysisVersions).where(and(eq(analysisVersions.resourceId, RESOURCE_ID), eq(analysisVersions.module, MODULE))),
  ]);

  const frictionRuns = runs.filter((run) => run.action === "friction-observed");
  const closeoutRuns = runs.filter((run) => run.action === "closeout-snapshot");
  const syncRuns = runs.filter((run) => run.action === "friction-task-sync");
  const repeatableFriction = frictionRuns.filter((run) => (run.metadataJson as any)?.repeatable === "yes");
  const precomputableFriction = frictionRuns.filter((run) => (run.metadataJson as any)?.couldPrecompute === "yes");
  const categories = new Set(frictionRuns.map((run) => String((run.metadataJson as any)?.category || "unknown")));
  const createdFromSync = syncRuns.reduce((acc, run) => acc + Number((run.metadataJson as any)?.createdCount || 0), 0);
  const updatedFromSync = syncRuns.reduce((acc, run) => acc + Number((run.metadataJson as any)?.updatedCount || 0), 0);

  const payload = {
    generatedAt: new Date().toISOString(),
    resourceId: RESOURCE_ID,
    module: MODULE,
    artifactCoverage: {
      workspaceManifest: await exists(MANIFEST_PATH),
      durableMemory: await exists(MEMORY_PATH),
      guardrailsDoc: await exists(GUARDRAILS_PATH),
      metricsDoc: await exists(METRICS_DOC_PATH),
      closeoutSnapshotCount: closeoutRuns.length,
      metricsSnapshotCount: versions.filter((version) => version.trigger === "agent-backbone-metrics").length,
    },
    seedRoadmapCompletion: {
      totalTasks: tasks.length,
      completedTasks: tasks.filter((task) => task.status === "done").length,
      remainingTasks: tasks.filter((task) => task.status !== "done").length,
    },
    frictionCaptureRate: {
      totalFrictionObservations: frictionRuns.length,
      distinctCategories: categories.size,
      repeatableObservations: repeatableFriction.length,
      precomputableObservations: precomputableFriction.length,
    },
    frictionToBacklogConversion: {
      syncRunCount: syncRuns.length,
      tasksCreatedFromFriction: createdFromSync,
      tasksUpdatedFromFriction: updatedFromSync,
    },
    verificationReuse: {
      verificationRelatedFrictionObservations: frictionRuns.filter((run) => String((run.metadataJson as any)?.category || "") === "verification").length,
      durableVerificationPathsCaptured: 4,
    },
    startupCostReductionProxy: {
      backboneArtifactRefreshes: 1,
      closeoutRecommendationsGenerated: closeoutRuns.reduce((acc, run) => acc + Number((run.metadataJson as any)?.recommendationCount || 0), 0),
      repeatableFrictionObserved: repeatableFriction.length,
    },
    sourceArtifacts: {
      workspaceManifest: rel(MANIFEST_PATH),
      durableMemory: rel(MEMORY_PATH),
      guardrails: rel(GUARDRAILS_PATH),
      metricsDefinition: rel(METRICS_DOC_PATH),
    },
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const [lastVersion] = await db
    .select({ version: analysisVersions.version })
    .from(analysisVersions)
    .where(and(eq(analysisVersions.resourceId, RESOURCE_ID), eq(analysisVersions.module, MODULE)))
    .orderBy(desc(analysisVersions.version))
    .limit(1);

  await db.insert(analysisVersions).values({
    resourceId: RESOURCE_ID,
    module: MODULE,
    version: (lastVersion?.version ?? 0) + 1,
    payloadJson: payload,
    itemCount: 6,
    trigger: "agent-backbone-metrics",
  });

  await db.$client.end();
  console.log(`Wrote ${rel(OUTPUT_PATH)}`);
}

main().catch(async (error) => {
  console.error(error);
  await db.$client.end();
  process.exit(1);
});
