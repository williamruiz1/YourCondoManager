import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks, roadmapWorkstreams } from "../shared/schema";

type TaskDef = {
  key: string;
  title: string;
  description: string;
  effort: "small" | "medium" | "large";
  priority: "low" | "medium" | "high" | "critical";
  dependencyKeys?: string[];
};

type WorkstreamDef = {
  title: string;
  description: string;
  orderIndex: number;
  tasks: TaskDef[];
};

const projectTitle = "FTPH Phase 8 - Advanced Reporting, Analytics, and Compliance Intelligence";
const projectDescription =
  "Stage the next post-operations phase from the FTPH documentation: board reporting automation, financial analytics, AI compliance monitoring, state-specific compliance templates, and cross-association benchmarking.";

const workstreams: WorkstreamDef[] = [
  {
    title: "Board Reporting Package Automation",
    description: "Automatically compile and distribute board-ready report packages spanning financial, governance, delinquency, and maintenance data.",
    orderIndex: 1,
    tasks: [
      {
        key: "package-builder",
        title: "Create configurable board report package builder",
        description:
          "Allow operators to define package sections, ordering, and included source modules for recurring board packet generation.",
        effort: "large",
        priority: "high",
      },
      {
        key: "scheduled-generation",
        title: "Add scheduled board package generation",
        description:
          "Generate board packages automatically relative to meeting cadence and package schedule rules.",
        effort: "medium",
        priority: "high",
        dependencyKeys: ["package-builder"],
      },
      {
        key: "preview-edit",
        title: "Add board packet preview, annotation, and approval workflow",
        description:
          "Allow board admins to review and edit a package before release so generated output is still controlled and defensible.",
        effort: "medium",
        priority: "medium",
        dependencyKeys: ["scheduled-generation"],
      },
      {
        key: "package-distribution",
        title: "Distribute approved packages through the communications layer",
        description:
          "Send finalized packages to board recipients with traceable distribution records and version-safe attachments or links.",
        effort: "medium",
        priority: "medium",
        dependencyKeys: ["preview-edit"],
      },
    ],
  },
  {
    title: "Financial Analytics and Trend Visualization",
    description: "Turn the finance data model into trend and forecasting views for boards and operators.",
    orderIndex: 2,
    tasks: [
      {
        key: "collection-rate",
        title: "Add dues collection rate analytics",
        description:
          "Calculate and visualize rolling collection performance against posted charges over time.",
        effort: "medium",
        priority: "high",
      },
      {
        key: "delinquency-trends",
        title: "Add delinquency trend and aging movement analysis",
        description:
          "Track changes in aged receivables month-over-month so boards can see whether collections performance is improving or degrading.",
        effort: "medium",
        priority: "high",
      },
      {
        key: "reserve-projection",
        title: "Build reserve fund projection model",
        description:
          "Project reserve balance under current contribution and expense assumptions across multiple forecast windows.",
        effort: "large",
        priority: "medium",
      },
      {
        key: "expense-trends",
        title: "Add expense category trend visualization",
        description:
          "Compare actual expense movement by category and period against historical and budget baselines.",
        effort: "medium",
        priority: "medium",
      },
    ],
  },
  {
    title: "AI Compliance Monitor",
    description: "Use ingested bylaws and governance data to identify likely compliance gaps before they become board issues.",
    orderIndex: 3,
    tasks: [
      {
        key: "rule-extraction",
        title: "Extract compliance rules from bylaw intelligence artifacts",
        description:
          "Turn bylaw clause intelligence into structured obligations that can be evaluated against platform records.",
        effort: "large",
        priority: "high",
      },
      {
        key: "gap-detector",
        title: "Build compliance gap detector across bylaws and platform records",
        description:
          "Cross-reference extracted obligations against meetings, budgets, board terms, and checklist history to surface probable gaps.",
        effort: "large",
        priority: "high",
        dependencyKeys: ["rule-extraction"],
      },
      {
        key: "alert-dashboard",
        title: "Create compliance alert dashboard with source evidence",
        description:
          "Show compliance issues, severity, and supporting source references in a board-facing review dashboard.",
        effort: "medium",
        priority: "medium",
        dependencyKeys: ["gap-detector"],
      },
      {
        key: "suppression-override",
        title: "Add compliance alert suppression and override workflow",
        description:
          "Allow operators to resolve, suppress, or exempt alerts with traceable rationale and timestamps.",
        effort: "medium",
        priority: "medium",
        dependencyKeys: ["alert-dashboard"],
      },
    ],
  },
  {
    title: "Managed Regulatory Record System",
    description: "Convert static state templates into a managed regulatory-record service with authoritative sourcing, freshness controls, and reviewed updates.",
    orderIndex: 4,
    tasks: [
      {
        key: "state-library",
        title: "Create regulatory source registry for compliance obligations",
        description:
          "Store jurisdiction records with authoritative source URLs, source authorities, effective dates, last verified dates, and last updated dates.",
        effort: "medium",
        priority: "medium",
      },
      {
        key: "template-assignment",
        title: "Add jurisdiction record sync and reviewed publication workflow",
        description:
          "Fetch or stage updated regulatory records from internet sources, review the changes, and publish approved records into the platform baseline.",
        effort: "medium",
        priority: "medium",
        dependencyKeys: ["state-library"],
      },
      {
        key: "template-versioning",
        title: "Add regulatory record versioning and effective dating",
        description:
          "Ensure evolving legal content does not overwrite already-issued compliance records and remains reproducible by effective period.",
        effort: "medium",
        priority: "medium",
        dependencyKeys: ["template-assignment"],
      },
      {
        key: "custom-overlays",
        title: "Support association-specific applicability overlays",
        description:
          "Allow local requirements to extend the managed regulatory base without forking source-backed jurisdiction records.",
        effort: "medium",
        priority: "low",
        dependencyKeys: ["template-versioning"],
      },
      {
        key: "staleness-monitoring",
        title: "Add staleness monitoring and refresh cadence controls",
        description:
          "Flag records that have not been verified within policy windows and run periodic refresh review sweeps.",
        effort: "medium",
        priority: "low",
        dependencyKeys: ["template-versioning"],
      },
    ],
  },
  {
    title: "Cross-Association Benchmarking",
    description: "Surface comparative portfolio performance metrics across associations for operators managing more than one community.",
    orderIndex: 5,
    tasks: [
      {
        key: "portfolio-overview",
        title: "Create portfolio overview KPI dashboard",
        description:
          "Show key association-level KPIs side by side across the portfolio, including collections, delinquency, compliance health, and operations load.",
        effort: "medium",
        priority: "medium",
      },
      {
        key: "benchmarking-charts",
        title: "Add comparative benchmarking charts and rankings",
        description:
          "Rank and compare associations on configurable metrics so managers can spot outliers quickly.",
        effort: "medium",
        priority: "medium",
        dependencyKeys: ["portfolio-overview"],
      },
      {
        key: "portfolio-alerts",
        title: "Add portfolio-level threshold alerts",
        description:
          "Raise portfolio alerts when an association crosses configurable risk thresholds such as delinquency or compliance-health deterioration.",
        effort: "medium",
        priority: "medium",
        dependencyKeys: ["benchmarking-charts"],
      },
      {
        key: "portfolio-export",
        title: "Add exportable portfolio performance reports",
        description:
          "Generate portfolio-level exports for management leadership and investor-style review use cases.",
        effort: "small",
        priority: "low",
        dependencyKeys: ["portfolio-alerts"],
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
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(roadmapProjects.id, project.id))
      .returning();
    console.log(`Updated roadmap project: ${project.title}`);
  }

  const taskIdByKey = new Map<string, string>();

  for (const workstreamDef of workstreams) {
    let [workstream] = await db
      .select()
      .from(roadmapWorkstreams)
      .where(and(eq(roadmapWorkstreams.projectId, project.id), eq(roadmapWorkstreams.title, workstreamDef.title)));

    if (!workstream) {
      [workstream] = await db
        .insert(roadmapWorkstreams)
        .values({
          projectId: project.id,
          title: workstreamDef.title,
          description: workstreamDef.description,
          orderIndex: workstreamDef.orderIndex,
          isCollapsed: 0,
        })
        .returning();
      console.log(`Created workstream: ${workstream.title}`);
    } else {
      [workstream] = await db
        .update(roadmapWorkstreams)
        .set({
          description: workstreamDef.description,
          orderIndex: workstreamDef.orderIndex,
          updatedAt: new Date(),
        })
        .where(eq(roadmapWorkstreams.id, workstream.id))
        .returning();
      console.log(`Updated workstream: ${workstream.title}`);
    }

    for (const taskDef of workstreamDef.tasks) {
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
        const [createdTask] = await db
          .insert(roadmapTasks)
          .values({
            projectId: project.id,
            workstreamId: workstream.id,
            title: taskDef.title,
            description: taskDef.description,
            status: "todo",
            effort: taskDef.effort,
            priority: taskDef.priority,
            dependencyTaskIds: [],
          })
          .returning();
        taskIdByKey.set(taskDef.key, createdTask.id);
        console.log(`Created task: ${taskDef.title}`);
      } else {
        const [updatedTask] = await db
          .update(roadmapTasks)
          .set({
            description: taskDef.description,
            effort: taskDef.effort,
            priority: taskDef.priority,
            updatedAt: new Date(),
          })
          .where(eq(roadmapTasks.id, existingTask.id))
          .returning();
        taskIdByKey.set(taskDef.key, updatedTask.id);
        console.log(`Updated task: ${taskDef.title}`);
      }
    }
  }

  for (const workstreamDef of workstreams) {
    for (const taskDef of workstreamDef.tasks) {
      const taskId = taskIdByKey.get(taskDef.key);
      if (!taskId) continue;

      const dependencyTaskIds = (taskDef.dependencyKeys ?? [])
        .map((key) => taskIdByKey.get(key))
        .filter((value): value is string => Boolean(value));

      await db
        .update(roadmapTasks)
        .set({
          dependencyTaskIds,
          updatedAt: new Date(),
        })
        .where(eq(roadmapTasks.id, taskId));
    }
  }
}

upsertProject()
  .then(() => {
    console.log("FTPH Phase 8 analytics/compliance roadmap project captured.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to capture FTPH Phase 8 analytics/compliance roadmap project:", error);
    process.exit(1);
  });
