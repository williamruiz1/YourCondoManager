import { promises as fs } from "fs";
import path from "path";
import { inArray } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks } from "../shared/schema";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUTPUT_DIR = path.join(ROOT, "docs", "agent-bootstrap");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "durable-memory.json");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "workspace-manifest.json");
const BACKBONE_PATH = path.join(ROOT, "docs", "projects", "admin-roadmap-service-journey-backbone.md");
const GUARDRAILS_PATH = path.join(ROOT, "docs", "projects", "agent-bootstrap-self-amend-guardrails.md");

function normalizePath(filePath: string) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

async function getRoadmapContext() {
  const titles = [
    "Admin Roadmap Backbone - Agent Bootstrap and Continuous Improvement",
    "Admin Roadmap Catchall Findings Inbox",
    "Platform-wide UI and UX Opportunity Analysis",
  ];
  const projects = await db.select().from(roadmapProjects).where(inArray(roadmapProjects.title, titles));
  if (projects.length === 0) return [];

  const tasks = await db.select().from(roadmapTasks).where(inArray(roadmapTasks.projectId, projects.map((project) => project.id)));
  return projects
    .map((project) => ({
      title: project.title,
      status: project.status,
      openTasks: tasks.filter((task) => task.projectId === project.id && task.status !== "done").map((task) => ({
        title: task.title,
        priority: task.priority,
        status: task.status,
      })),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

async function main() {
  const [manifestRaw, backboneSource] = await Promise.all([
    fs.readFile(MANIFEST_PATH, "utf8"),
    fs.readFile(BACKBONE_PATH, "utf8"),
  ]);
  const manifest = JSON.parse(manifestRaw);
  const roadmapContext = await getRoadmapContext();

  const memory = {
    generatedAt: new Date().toISOString(),
    purpose: "Durable working memory for stable repo facts and repeatable operating knowledge.",
    sourceArtifacts: {
      workspaceManifest: normalizePath(MANIFEST_PATH),
      roadmapBackbone: normalizePath(BACKBONE_PATH),
      guardrails: normalizePath(GUARDRAILS_PATH),
    },
    separationRule: {
      durableMemoryContains: [
        "stable repo structure",
        "preferred commands",
        "verification paths by change type",
        "long-lived planning and roadmap context",
        "known recurring repo issues",
      ],
      durableMemoryExcludes: [
        "task-specific hypotheses",
        "temporary debugging notes",
        "one-off findings from a single session",
        "implementation advice not yet accepted into roadmap or backbone artifacts",
      ],
    },
    stableRepoFacts: [
      {
        fact: "This is a full-stack TypeScript app with a React/Vite frontend and an Express backend.",
        evidence: "AGENTS.md",
      },
      {
        fact: "UI code is primarily under client/src, server wiring under server/, and shared types/schema under shared/schema.ts.",
        evidence: "AGENTS.md",
      },
      {
        fact: "DATABASE_URL is required for local startup and Drizzle-backed roadmap/database scripts.",
        evidence: "AGENTS.md and server/db.ts",
      },
      {
        fact: "Admin roadmap work is backed by roadmapProjects, roadmapWorkstreams, and roadmapTasks in shared/schema.ts with storage logic in server/storage.ts.",
        evidence: "workspace-manifest.json",
      },
    ],
    preferredCommands: manifest.environment.primaryCommands,
    verificationByChangeType: [
      {
        changeType: "roadmap or planning scripts",
        commands: ["npm run bootstrap:agent"],
        notes: "Regenerate bootstrap artifacts and verify roadmap context is reflected in durable artifacts.",
      },
      {
        changeType: "frontend or route shell changes",
        commands: ["npm run bootstrap:agent", "npm run check"],
        notes: "Refresh route surface data and run TypeScript validation.",
      },
      {
        changeType: "server, storage, or schema changes",
        commands: ["npm run check"],
        notes: "Database-affecting work may also require npm run db:push when schema is intentionally changed.",
      },
      {
        changeType: "database schema updates",
        commands: ["npm run check", "npm run db:push"],
        notes: "Use db:push only when schema changes are intentional and DATABASE_URL is valid.",
      },
    ],
    workflowEntryPoints: [
      {
        workflow: "workspace shell and route map",
        path: "client/src/App.tsx",
      },
      {
        workflow: "admin roadmap data and KPI logic",
        path: "server/storage.ts",
      },
      {
        workflow: "HTTP route registration",
        path: "server/routes.ts",
      },
      {
        workflow: "shared schema and roadmap tables",
        path: "shared/schema.ts",
      },
      {
        workflow: "bootstrap artifacts",
        path: "docs/agent-bootstrap/",
      },
    ],
    currentProductDecisions: [
      {
        decision: "Service-oriented roadmap work should follow the planning backbone before implementation when the request changes service model or workflow.",
        evidence: normalizePath(BACKBONE_PATH),
      },
      {
        decision: "Repeated agent setup work should be converted into backbone automation work rather than normalized as repeated manual exploration.",
        evidence: normalizePath(BACKBONE_PATH),
      },
      {
        decision: "Bootstrap and durable memory artifacts may self-amend, but product behavior changes still require explicit implementation work.",
        evidence: normalizePath(BACKBONE_PATH),
      },
      {
        decision: "Backbone automation may write analysis artifacts and backbone docs, but must not silently change schema, business logic, authorization, or user-facing workflows.",
        evidence: normalizePath(GUARDRAILS_PATH),
      },
      {
        decision: "Validated findings that do not yet have a dedicated implementation project must still be captured in the forever-active Admin Roadmap Catchall Findings Inbox before closeout.",
        evidence: normalizePath(BACKBONE_PATH),
      },
    ],
    recurringRepoIssues: [
      {
        issue: "npm run check currently fails on an existing IStorage mismatch in server/storage.ts for previewAiIngestionSupersededCleanup and executeAiIngestionSupersededCleanup.",
        impact: "TypeScript validation is not currently a clean signal for unrelated changes.",
      },
      {
        issue: "A separate known TypeScript/iterator issue has also surfaced around matchAll iteration in server/storage.ts.",
        impact: "Some checks may expose pre-existing compiler targets or iterator compatibility issues outside the current task.",
      },
    ],
    activeRoadmapContext: roadmapContext,
    backboneHighlights: backboneSource
      .split("\n")
      .filter((line) => line.startsWith("## ") || line.startsWith("### "))
      .slice(0, 20),
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(memory, null, 2)}\n`, "utf8");
  console.log(`Wrote ${normalizePath(OUTPUT_PATH)}`);
  await db.$client.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.$client.end();
  process.exit(1);
});
