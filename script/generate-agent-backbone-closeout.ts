import { promises as fs } from "fs";
import path from "path";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../server/db";
import { analysisRuns, analysisVersions, roadmapProjects, roadmapTasks, roadmapWorkstreams } from "../shared/schema";

const RESOURCE_ID = "admin-roadmap-backbone";
const MODULE = "agent-bootstrap-backbone";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MANIFEST_PATH = path.join(ROOT, "docs", "agent-bootstrap", "workspace-manifest.json");
const MEMORY_PATH = path.join(ROOT, "docs", "agent-bootstrap", "durable-memory.json");
const GUARDRAILS_PATH = path.join(ROOT, "docs", "projects", "agent-bootstrap-self-amend-guardrails.md");
const BACKBONE_TITLE = "Admin Roadmap Backbone - Agent Bootstrap and Continuous Improvement";

async function main() {
  const startedAt = Date.now();
  const [manifestRaw, memoryRaw, guardrailsRaw] = await Promise.all([
    fs.readFile(MANIFEST_PATH, "utf8"),
    fs.readFile(MEMORY_PATH, "utf8"),
    fs.readFile(GUARDRAILS_PATH, "utf8"),
  ]);

  const [project] = await db.select().from(roadmapProjects).where(eq(roadmapProjects.title, BACKBONE_TITLE));
  if (!project) {
    throw new Error("Backbone roadmap project not found");
  }

  const [workstreams, tasks] = await Promise.all([
    db.select().from(roadmapWorkstreams).where(eq(roadmapWorkstreams.projectId, project.id)),
    db.select().from(roadmapTasks).where(eq(roadmapTasks.projectId, project.id)),
  ]);

  const manifest = JSON.parse(manifestRaw);
  const durableMemory = JSON.parse(memoryRaw);
  const openTasks = tasks
    .filter((task) => task.status !== "done")
    .map((task) => ({
      title: task.title,
      status: task.status,
      priority: task.priority,
      workstreamTitle: workstreams.find((workstream) => workstream.id === task.workstreamId)?.title ?? null,
    }));

  const recommendations = openTasks.slice(0, 5).map((task) => ({
    type: "next-slice",
    title: task.title,
    rationale: `Open backbone task in ${task.workstreamTitle || "unknown workstream"} with ${task.priority} priority.`,
  }));

  const payloadJson = {
    generatedAt: new Date().toISOString(),
    project: {
      title: project.title,
      status: project.status,
      totalTasks: tasks.length,
      completedTasks: tasks.filter((task) => task.status === "done").length,
      openTasks,
    },
    artifacts: {
      workspaceManifestGeneratedAt: manifest.generatedAt,
      durableMemoryGeneratedAt: durableMemory.generatedAt,
      guardrailsDocument: path.relative(ROOT, GUARDRAILS_PATH).replace(/\\/g, "/"),
    },
    guardrails: {
      headings: guardrailsRaw
        .split("\n")
        .filter((line) => line.startsWith("## "))
        .map((line) => line.replace(/^##\s+/, "").trim()),
    },
    knownIssues: durableMemory.recurringRepoIssues ?? [],
    recommendations,
  };

  const [lastVersion] = await db
    .select({ version: analysisVersions.version })
    .from(analysisVersions)
    .where(and(eq(analysisVersions.resourceId, RESOURCE_ID), eq(analysisVersions.module, MODULE)))
    .orderBy(desc(analysisVersions.version))
    .limit(1);

  const [version] = await db
    .insert(analysisVersions)
    .values({
      resourceId: RESOURCE_ID,
      module: MODULE,
      version: (lastVersion?.version ?? 0) + 1,
      payloadJson,
      itemCount: recommendations.length,
      trigger: "agent-backbone-closeout",
    })
    .returning();

  const [run] = await db
    .insert(analysisRuns)
    .values({
      resourceId: RESOURCE_ID,
      module: MODULE,
      action: "closeout-snapshot",
      success: 1,
      durationMs: Date.now() - startedAt,
      itemCount: recommendations.length,
      metadataJson: {
        analysisVersionId: version.id,
        recommendationCount: recommendations.length,
        openTaskCount: openTasks.length,
      },
    })
    .returning();

  console.log(JSON.stringify({ versionId: version.id, runId: run.id, recommendationCount: recommendations.length }, null, 2));
  await db.$client.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.$client.end();
  process.exit(1);
});
