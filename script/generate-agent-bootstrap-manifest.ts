import { promises as fs } from "fs";
import path from "path";
import { eq, inArray } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks, roadmapWorkstreams } from "../shared/schema";

type RouteRecord = {
  path: string;
  component: string | null;
  redirectTo: string | null;
};

type RoadmapProjectSummary = {
  title: string;
  status: string;
  workstreamCount: number;
  openTaskCount: number;
};

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUTPUT_DIR = path.join(ROOT, "docs", "agent-bootstrap");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "workspace-manifest.json");
const APP_PATH = path.join(ROOT, "client", "src", "App.tsx");
const AGENTS_PATH = path.join(ROOT, "AGENTS.md");
const SCHEMA_PATH = path.join(ROOT, "shared", "schema.ts");
const STORAGE_PATH = path.join(ROOT, "server", "storage.ts");
const ROUTES_PATH = path.join(ROOT, "server", "routes.ts");

function normalizePath(filePath: string) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function parseRoutes(appSource: string): RouteRecord[] {
  const routes = new Map<string, RouteRecord>();

  for (const match of appSource.matchAll(/<Route\s+path="([^"]+)"\s+component=\{([A-Za-z0-9_]+)\}\s*\/>/g)) {
    routes.set(match[1], {
      path: match[1],
      component: match[2],
      redirectTo: null,
    });
  }

  for (const match of appSource.matchAll(/<Route\s+path="([^"]+)"\s*>\s*<RouteRedirect\s+to="([^"]+)"\s*\/>\s*<\/Route>/g)) {
    const pathValue = match[1];
    routes.set(pathValue, {
      path: pathValue,
      component: routes.get(pathValue)?.component ?? null,
      redirectTo: match[2],
    });
  }

  for (const match of appSource.matchAll(/<Route\s+path="([^"]+)"\s*>([\s\S]*?)<\/Route>/g)) {
    const pathValue = match[1];
    if (routes.has(pathValue)) continue;
    routes.set(pathValue, {
      path: pathValue,
      component: null,
      redirectTo: null,
    });
  }

  return Array.from(routes.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function parseLazyPages(appSource: string) {
  return Array.from(appSource.matchAll(/const\s+([A-Za-z0-9_]+)\s*=\s*lazy\(\(\)\s*=>\s*import\("([^"]+)"\)\);/g))
    .map((match) => ({
      id: match[1],
      importPath: match[2],
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function parseSchemaAnchors(schemaSource: string) {
  return Array.from(schemaSource.matchAll(/export const\s+([A-Za-z0-9_]+)\s*=\s*(pgTable|pgEnum)\(/g))
    .map((match) => ({
      name: match[1],
      kind: match[2],
    }))
    .filter((entry) => {
      return (
        entry.name.startsWith("roadmap") ||
        entry.name.startsWith("analysis") ||
        entry.name.startsWith("executive") ||
        ["associations", "documents", "vendors", "workOrders", "maintenanceRequests", "inspectionRecords"].includes(entry.name)
      );
    });
}

function summarizeAgentInstructions(agentsSource: string) {
  const sectionRegex = /^##\s+(.+)$/gm;
  const sections = Array.from(agentsSource.matchAll(sectionRegex)).map((match) => match[1]);
  return {
    source: normalizePath(AGENTS_PATH),
    sections,
    highlights: [
      "UI code lives in client/src and server entrypoints live in server/.",
      "Use npm run dev, npm run build, npm run start, and npm run check as primary commands.",
      "Prefer path aliases @/ and @shared/ and match surrounding TypeScript style.",
      "Do not edit dist/ and do not commit secrets or local upload data.",
    ],
  };
}

async function getRoadmapSummary(): Promise<RoadmapProjectSummary[]> {
  const titles = [
    "Admin Roadmap Backbone - Agent Bootstrap and Continuous Improvement",
    "Admin Roadmap Catchall Findings Inbox",
    "Platform-wide UI and UX Opportunity Analysis",
  ];
  const projects = await db.select().from(roadmapProjects).where(inArray(roadmapProjects.title, titles));
  if (projects.length === 0) {
    return [];
  }

  const projectIds = projects.map((project) => project.id);
  const [workstreams, tasks] = await Promise.all([
    db.select().from(roadmapWorkstreams).where(inArray(roadmapWorkstreams.projectId, projectIds)),
    db.select().from(roadmapTasks).where(inArray(roadmapTasks.projectId, projectIds)),
  ]);

  return projects
    .map((project) => ({
      title: project.title,
      status: project.status,
      workstreamCount: workstreams.filter((workstream) => workstream.projectId === project.id).length,
      openTaskCount: tasks.filter((task) => task.projectId === project.id && task.status !== "done").length,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

async function main() {
  const [appSource, agentsSource, schemaSource] = await Promise.all([
    fs.readFile(APP_PATH, "utf8"),
    fs.readFile(AGENTS_PATH, "utf8"),
    fs.readFile(SCHEMA_PATH, "utf8"),
  ]);

  const routes = parseRoutes(appSource);
  const lazyPages = parseLazyPages(appSource);
  const roadmapSummary = await getRoadmapSummary();

  const manifest = {
    generatedAt: new Date().toISOString(),
    purpose: "Reusable startup snapshot for coding agents working in the CondoManager workspace.",
    repository: {
      root: ROOT,
      keyFiles: {
        appShell: normalizePath(APP_PATH),
        routes: normalizePath(ROUTES_PATH),
        storage: normalizePath(STORAGE_PATH),
        schema: normalizePath(SCHEMA_PATH),
        agentInstructions: normalizePath(AGENTS_PATH),
      },
    },
    environment: {
      packageManager: "npm",
      requiredEnv: ["DATABASE_URL"],
      primaryCommands: [
        "npm run dev",
        "npm run build",
        "npm run start",
        "npm run check",
        "npm run db:push",
        "npm run bootstrap:agent",
      ],
      verificationNote:
        "TypeScript checks currently surface an existing RegExpStringIterator issue in server/storage.ts around matchAll iteration. Treat it as a known repo issue unless that area is being changed.",
    },
    routes: {
      total: routes.length,
      appRoutes: routes.filter((route) => route.path.startsWith("/app")).length,
      publicRoutes: routes.filter((route) => !route.path.startsWith("/app")).length,
      entries: routes,
    },
    pages: {
      totalLazyPages: lazyPages.length,
      entries: lazyPages,
    },
    backendAnchors: {
      storage: normalizePath(STORAGE_PATH),
      routes: normalizePath(ROUTES_PATH),
      schemaEntities: parseSchemaAnchors(schemaSource),
      focusAreas: [
        "Roadmap and executive modules live in shared/schema.ts, server/storage.ts, and server/routes.ts.",
        "App shell and route registration live in client/src/App.tsx.",
        "Operational UI surfaces are spread across client/src/pages/*.tsx with shared UI primitives in client/src/components/ui.",
      ],
    },
    roadmapContext: roadmapSummary,
    workingRules: summarizeAgentInstructions(agentsSource),
    refreshTriggers: [
      "client/src/App.tsx route or lazy-page changes",
      "shared/schema.ts changes to roadmap, analysis, executive, or primary domain tables",
      "server/routes.ts or server/storage.ts structural changes",
      "AGENTS.md workflow or verification rule changes",
      "meaningful roadmap backbone updates",
    ],
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Wrote ${normalizePath(OUTPUT_PATH)}`);
  await db.$client.end();
}

main().catch(async (error) => {
  console.error(error);
  await db.$client.end();
  process.exit(1);
});
