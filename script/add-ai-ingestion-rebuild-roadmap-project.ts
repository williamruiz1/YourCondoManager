import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks, roadmapWorkstreams } from "../shared/schema";

type TaskDef = {
  title: string;
  description: string;
  effort: "small" | "medium" | "large";
  priority: "low" | "medium" | "high" | "critical";
};

type WorkstreamDef = {
  title: string;
  description: string;
  orderIndex: number;
  tasks: TaskDef[];
};

const projectTitle = "AI Ingestion Rebuild - Cross-Module Data Intake";
const projectDescription =
  "Evolve the current AI ingestion foundation in-place: keep job/review/governance scaffolding, replace extraction and module-routing internals, and add robust cross-module import for owners, contacts, invoices, bank statements, and related data.";

const workstreams: WorkstreamDef[] = [
  {
    title: "Intake Experience and Input Handling",
    description: "Extend the existing intake flow without replacing the current job/review UX shell.",
    orderIndex: 1,
    tasks: [
      {
        title: "Unify intake into file upload or pasted text with contextual notes",
        description:
          "Allow an admin to provide a file, pasted text, or both, plus optional context instructions (for example period, association intent, and reconciliation notes) while retaining current job submission and review patterns.",
        effort: "medium",
        priority: "critical",
      },
      {
        title: "Expand source parsing coverage for common admin artifacts",
        description:
          "Handle owner rosters, contact lists, invoices, and bank statement exports with reliable normalization for csv, txt, json, and future document formats.",
        effort: "large",
        priority: "critical",
      },
      {
        title: "Add ingestion job preflight validation and actionable errors",
        description:
          "Validate required association context, source readability, and minimum content quality before processing. Return field-level error messages and remediation guidance.",
        effort: "medium",
        priority: "high",
      },
    ],
  },
  {
    title: "AI Extraction and Document Type Intelligence",
    description: "Replace the current limited extractor with a classifier plus schema-specific extractors, while preserving existing ingestion entities and endpoints.",
    orderIndex: 2,
    tasks: [
      {
        title: "Introduce explicit document classifier with confidence thresholds",
        description:
          "Classify each submission into supported types such as owner/contact roster, invoice, bank statement, governance text, or unknown with score and explanation metadata.",
        effort: "large",
        priority: "critical",
      },
      {
        title: "Create schema-specific extractors per document type",
        description:
          "Enforce structured extraction contracts for each type so downstream import logic receives stable fields (for example owner identity fields, invoice line/amount/date, and transaction rows).",
        effort: "large",
        priority: "critical",
      },
      {
        title: "Add fallback heuristics and partial extraction handling",
        description:
          "When AI responses are incomplete or low-confidence, preserve partially extracted records, mark uncertainty reasons, and route for review rather than silently failing.",
        effort: "medium",
        priority: "high",
      },
    ],
  },
  {
    title: "Module Routing and Import Execution",
    description: "Expand beyond owner-roster-only imports to true cross-module routing and staged commit workflows.",
    orderIndex: 3,
    tasks: [
      {
        title: "Build ingestion-to-module routing matrix",
        description:
          "Define authoritative mapping from extracted record types to target modules (owners/persons/ownerships, invoices, financial accounts/ledger, documents/governance) with versioned routing rules.",
        effort: "medium",
        priority: "critical",
      },
      {
        title: "Implement staged import pipeline with dry-run and commit modes",
        description:
          "Provide preview mode that shows creates/updates/skips before write operations, then execute commit with per-row outcomes and idempotency protections.",
        effort: "large",
        priority: "critical",
      },
      {
        title: "Add duplicate detection and smart matching",
        description:
          "Match existing entities by normalized keys and fuzzy checks (unit, name, email, invoice reference, transaction amount/date) to reduce duplicate records and wrong module inserts.",
        effort: "large",
        priority: "high",
      },
    ],
  },
  {
    title: "Review Workflow, Auditability, and Recovery",
    description: "Keep the existing review-based operating model, but strengthen traceability and remediation controls.",
    orderIndex: 4,
    tasks: [
      {
        title: "Redesign review UI for record-level approve/edit/reject",
        description:
          "Show extracted records grouped by target module with confidence, source excerpts, and inline correction before approval.",
        effort: "medium",
        priority: "high",
      },
      {
        title: "Capture import audit trail and provenance links",
        description:
          "Store who approved what, source job reference, extracted payload snapshot, target entity IDs, and timestamps for traceability and compliance review.",
        effort: "medium",
        priority: "high",
      },
      {
        title: "Add rollback and remediation tools for failed imports",
        description:
          "Provide controlled rollback or compensating actions for failed/incorrect commits, including partial-failure reports and retry support.",
        effort: "large",
        priority: "high",
      },
    ],
  },
  {
    title: "Quality Gate and Launch Readiness",
    description: "Establish objective readiness criteria before enabling broad admin use.",
    orderIndex: 5,
    tasks: [
      {
        title: "Define ingestion accuracy benchmarks by document type",
        description:
          "Track precision/recall style metrics for key fields and require minimum pass thresholds before release for each supported document category.",
        effort: "medium",
        priority: "high",
      },
      {
        title: "Create verification scripts for end-to-end ingestion scenarios",
        description:
          "Automate validation of representative owner list, contact update, invoice, and bank statement ingestion flows from intake to module write.",
        effort: "medium",
        priority: "medium",
      },
      {
        title: "Run staged rollout with monitoring and alerting",
        description:
          "Release behind a feature flag, monitor ingestion success/failure patterns, and alert on classification drift, routing errors, and abnormal duplicate rates.",
        effort: "medium",
        priority: "medium",
      },
    ],
  },
];

async function upsertProject() {
  let [project] = await db.select().from(roadmapProjects).where(eq(roadmapProjects.title, projectTitle));

  if (!project) {
    [project] = await db
      .insert(roadmapProjects)
      .values({
        title: projectTitle,
        description: projectDescription,
        status: "active",
        isCollapsed: 0,
      })
      .returning();
    console.log(`Created roadmap project: ${project.title}`);
  } else {
    [project] = await db
      .update(roadmapProjects)
      .set({
        description: projectDescription,
        updatedAt: new Date(),
      })
      .where(eq(roadmapProjects.id, project.id))
      .returning();
    console.log(`Updated roadmap project: ${project.title}`);
  }

  for (const wsDef of workstreams) {
    let [workstream] = await db
      .select()
      .from(roadmapWorkstreams)
      .where(and(eq(roadmapWorkstreams.projectId, project.id), eq(roadmapWorkstreams.title, wsDef.title)));

    if (!workstream) {
      [workstream] = await db
        .insert(roadmapWorkstreams)
        .values({
          projectId: project.id,
          title: wsDef.title,
          description: wsDef.description,
          orderIndex: wsDef.orderIndex,
          isCollapsed: 0,
        })
        .returning();
      console.log(`Created workstream: ${workstream.title}`);
    } else {
      [workstream] = await db
        .update(roadmapWorkstreams)
        .set({
          description: wsDef.description,
          orderIndex: wsDef.orderIndex,
          updatedAt: new Date(),
        })
        .where(eq(roadmapWorkstreams.id, workstream.id))
        .returning();
      console.log(`Updated workstream: ${workstream.title}`);
    }

    for (const taskDef of wsDef.tasks) {
      const [existingTask] = await db
        .select()
        .from(roadmapTasks)
        .where(
          and(
            eq(roadmapTasks.projectId, project.id),
            eq(roadmapTasks.workstreamId, workstream.id),
            eq(roadmapTasks.title, taskDef.title),
          ),
        );

      if (!existingTask) {
        await db.insert(roadmapTasks).values({
          projectId: project.id,
          workstreamId: workstream.id,
          title: taskDef.title,
          description: taskDef.description,
          status: "todo",
          effort: taskDef.effort,
          priority: taskDef.priority,
          dependencyTaskIds: [],
        });
        console.log(`Created task: ${taskDef.title}`);
      } else {
        await db
          .update(roadmapTasks)
          .set({
            description: taskDef.description,
            effort: taskDef.effort,
            priority: taskDef.priority,
            updatedAt: new Date(),
          })
          .where(eq(roadmapTasks.id, existingTask.id));
        console.log(`Updated task: ${taskDef.title}`);
      }
    }
  }
}

upsertProject()
  .then(() => {
    console.log("AI ingestion rebuild roadmap project captured.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to capture AI ingestion rebuild roadmap project:", error);
    process.exit(1);
  });
