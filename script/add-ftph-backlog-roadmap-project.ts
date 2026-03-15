import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks, roadmapWorkstreams } from "../shared/schema";

type TaskDef = {
  title: string;
  description: string;
  ftphUnits: string[];
  effort: "small" | "medium" | "large";
  priority: "low" | "medium" | "high" | "critical";
};

type WorkstreamDef = {
  title: string;
  description: string;
  orderIndex: number;
  tasks: TaskDef[];
};

type TaskExecutionPlanItem = {
  title: string;
  wave: number;
  dependsOn: string[];
};

const projectTitle = "FTPH Backlog Closure - Inactive and Partial Feature Delivery";
const projectDescription =
  "Cross-phase implementation plan for FTPH backlog items currently marked inactive or partial in the feature tree, including resident intake extensions, communications targeting, AI ingestion completion, managed regulatory records, governance automation, and owner-experience backlog branches.";

function formatTaskDescription(task: TaskDef) {
  return `${task.description}\n\nFTPH Functional Units: ${task.ftphUnits.join(", ")}`;
}

const workstreams: WorkstreamDef[] = [
  {
    title: "Resident Intake and Association Completeness",
    description:
      "Finish the resident-intake and association-onboarding backlog so unit data, owner/tenant submission links, occupancy state, and remediation workflows become operationally complete.",
    orderIndex: 0,
    tasks: [
      {
        title: "Implement paired owner and tenant secure submission links per unit",
        description:
          "Add distinct owner-update and tenant-submission links, token expiry, token regeneration, and unit-scoped access semantics for FTPH 1.4.1, 1.4.2, and 1.4.5.",
        ftphUnits: ["1.4.1", "1.4.2", "1.4.5"],
        effort: "large",
        priority: "high",
      },
      {
        title: "Build occupancy-conditional owner and multi-tenant intake forms",
        description:
          "Support owner-occupied vs rental branching, optional second-owner capture, add/remove tenant interactions, and validation aligned to FTPH 1.4.3 and 1.4.4.",
        ftphUnits: ["1.4.3", "1.4.4"],
        effort: "large",
        priority: "high",
      },
      {
        title: "Derive canonical unit occupancy state and counts",
        description:
          "Implement owner-occupied, rental, and vacant derivation logic plus owner/tenant count and last-occupancy-update semantics for FTPH 1.5.1.",
        ftphUnits: ["1.5.1"],
        effort: "medium",
        priority: "high",
      },
      {
        title: "Expand association completeness metrics and remediation actions",
        description:
          "Compute owner, tenant, board, payment, communications, and occupancy completion rates and surface direct remediation actions for FTPH 1.5.2 through 1.5.4.",
        ftphUnits: ["1.5.2", "1.5.3", "1.5.4"],
        effort: "medium",
        priority: "medium",
      },
    ],
  },
  {
    title: "Communications Routing and Payment Guidance",
    description:
      "Complete the communications backlog with explicit targeting, structured template composition, routing rules, and owner payment-setup guidance.",
    orderIndex: 1,
    tasks: [
      {
        title: "Implement recipient targeting by role, unit scope, and board audience",
        description:
          "Support all-owners, all-tenants, all-occupants, selected-units, individual-recipient, and board-member targeting for FTPH 7.2.1.",
        ftphUnits: ["7.2.1"],
        effort: "large",
        priority: "high",
      },
      {
        title: "Add structured template blocks and canonical merge fields",
        description:
          "Model header, body, footer, and signature composition plus canonical merge fields for association, unit, owner, tenant, maintenance, and intake links for FTPH 7.2.2 and 7.2.3.",
        ftphUnits: ["7.2.2", "7.2.3"],
        effort: "medium",
        priority: "high",
      },
      {
        title: "Enforce owner and tenant communication routing policy",
        description:
          "Apply message-class routing rules so governance and financial notices stay owner-only while operational notices can reach tenants per FTPH 7.2.4.",
        ftphUnits: ["7.2.4", "1.2.3", "1.3.2"],
        effort: "medium",
        priority: "high",
      },
      {
        title: "Replace generic payment method instructions with structured owner payment setup",
        description:
          "Store structured payment instruction fields and generate owner-specific payment setup notices for FTPH 3.3.1 through 3.3.3.",
        ftphUnits: ["3.3.1", "3.3.2", "3.3.3"],
        effort: "medium",
        priority: "medium",
      },
    ],
  },
  {
    title: "AI Ingestion Completion and Traceability",
    description:
      "Close the partial AI ingestion branch by improving raw-input support, importer coverage, durable provenance, and reprocess safety.",
    orderIndex: 2,
    tasks: [
      {
        title: "Expand AI ingestion raw-source support beyond text-centric uploads",
        description:
          "Add first-class handling for common binary admin artifacts such as PDF-derived source ingestion so FTPH 4.2.1 is no longer constrained to text-like uploads.",
        ftphUnits: ["4.2.1"],
        effort: "large",
        priority: "high",
      },
      {
        title: "Add commit importers for meeting notes and document metadata outputs",
        description:
          "Implement downstream persistence flows for currently extraction-only record types so FTPH 4.2.3 covers all published ingestion outputs.",
        ftphUnits: ["4.2.3"],
        effort: "large",
        priority: "high",
      },
      {
        title: "Persist durable source traceability across extracted records and clauses",
        description:
          "Link clause records and parsed outputs back to extracted records and repository documents so FTPH 4.2 remains review-first and traceable to origin.",
        ftphUnits: ["4.2.2", "4.2.3"],
        effort: "medium",
        priority: "high",
      },
      {
        title: "Harden ingestion reprocess and import-run history integrity",
        description:
          "Preserve historical import-run references when jobs are reprocessed and prevent extracted-record replacement from breaking review or rollback history.",
        ftphUnits: ["4.2.3"],
        effort: "medium",
        priority: "critical",
      },
    ],
  },
  {
    title: "Regulatory Records and Compliance Intelligence",
    description:
      "Turn the compliance backlog into a managed regulatory-record system with freshness controls and AI-assisted compliance monitoring.",
    orderIndex: 3,
    tasks: [
      {
        title: "Create managed regulatory source registry with freshness metadata",
        description:
          "Track source URL, source authority, jurisdiction, effective date, last verified date, last updated date, and publication state for FTPH 8.4.1.",
        ftphUnits: ["8.4.1"],
        effort: "large",
        priority: "high",
      },
      {
        title: "Implement jurisdiction sync, review, and publication workflow",
        description:
          "Fetch or stage regulatory updates from authoritative sources, review changes, and publish approved records for FTPH 8.4.2.",
        ftphUnits: ["8.4.2"],
        effort: "large",
        priority: "high",
      },
      {
        title: "Add regulatory versioning, applicability overlays, and staleness monitoring",
        description:
          "Preserve historical effective periods, apply association overlays, and flag overdue verification windows for FTPH 8.4.3 through 8.4.5.",
        ftphUnits: ["8.4.3", "8.4.4", "8.4.5"],
        effort: "large",
        priority: "high",
      },
      {
        title: "Activate AI compliance gap detection on approved regulatory and bylaw records",
        description:
          "Deliver compliance rule extraction, gap detection, alert dashboards, and suppression workflows for FTPH 8.3.1 through 8.3.4.",
        ftphUnits: ["8.3.1", "8.3.2", "8.3.3", "8.3.4"],
        effort: "large",
        priority: "medium",
      },
    ],
  },
  {
    title: "Governance Automation and Filing Workflows",
    description:
      "Advance the governance backlog with reminder automation, board package automation, and filing workflows built on the managed regulatory base.",
    orderIndex: 4,
    tasks: [
      {
        title: "Implement governance reminder cadence and recipient routing",
        description:
          "Support configurable reminder rules plus 30-day, 14-day, and 7-day cadence delivery to board members and administrators for FTPH 6.2.1 through 6.2.3.",
        ftphUnits: ["6.2.1", "6.2.2", "6.2.3"],
        effort: "medium",
        priority: "medium",
      },
      {
        title: "Deliver board package automation and notice distribution",
        description:
          "Build package generation, preview/edit, scheduled creation, and distribution workflows for FTPH 8.1.1 through 8.1.4.",
        ftphUnits: ["8.1.1", "8.1.2", "8.1.3", "8.1.4"],
        effort: "medium",
        priority: "medium",
      },
      {
        title: "Implement regulatory filing review and export workflows",
        description:
          "Use the managed regulatory record base to deliver filing template library, pre-population, review, export, and due-date tracking for FTPH 10.6.1 through 10.6.5.",
        ftphUnits: ["10.6.1", "10.6.2", "10.6.3", "10.6.4", "10.6.5"],
        effort: "large",
        priority: "medium",
      },
    ],
  },
  {
    title: "Owner Experience and Community Backlog",
    description:
      "Plan and deliver the inactive owner-experience branches that reduce management labor and extend portal utility.",
    orderIndex: 5,
    tasks: [
      {
        title: "Deliver owner financial dashboard and payment self-service",
        description:
          "Implement balance summary, payment history, statements, and payment initiation for FTPH 9.1.1 through 9.1.4.",
        ftphUnits: ["9.1.1", "9.1.2", "9.1.3", "9.1.4"],
        effort: "large",
        priority: "medium",
      },
      {
        title: "Add resident feedback and satisfaction analytics",
        description:
          "Launch feedback capture, satisfaction aggregation, and improvement-theme clustering for FTPH 9.6.1 through 9.6.3.",
        ftphUnits: ["9.6.1", "9.6.2", "9.6.3"],
        effort: "medium",
        priority: "medium",
      },
      {
        title: "Implement community announcements and bulletin board",
        description:
          "Add board announcement publishing, owner feed, categories, and push-notice integration for FTPH 9.5.1 through 9.5.4.",
        ftphUnits: ["9.5.1", "9.5.2", "9.5.3", "9.5.4"],
        effort: "medium",
        priority: "low",
      },
      {
        title: "Stage amenity booking, digital signature, and voting backlog for portal expansion",
        description:
          "Define implementation-ready delivery slices for FTPH 9.2, 9.3, and 9.4 so owner-experience expansion can proceed without reopening discovery.",
        ftphUnits: ["9.2.1", "9.2.2", "9.2.3", "9.2.4", "9.2.5", "9.3.1", "9.3.2", "9.3.3", "9.3.4", "9.3.5", "9.4.1", "9.4.2", "9.4.3", "9.4.4"],
        effort: "medium",
        priority: "low",
      },
    ],
  },
  {
    title: "Integration and Platform Expansion Backlog",
    description:
      "Package the remaining platform backlog around integrations, public APIs, reseller controls, and subscription operations.",
    orderIndex: 6,
    tasks: [
      {
        title: "Prioritize external integrations across banking, accounting, and identity",
        description:
          "Define delivery order and contract boundaries for FTPH 10.1 and non-Google 10.2 branches so the integration backlog is implementation-ready.",
        ftphUnits: ["10.1.1", "10.1.2", "10.1.3", "10.1.4", "10.1.5", "10.2.2", "10.2.3", "10.2.4", "10.2.5"],
        effort: "medium",
        priority: "low",
      },
      {
        title: "Define public API and webhook delivery plan",
        description:
          "Break out REST resources, API key management, webhook framework, and developer portal requirements for FTPH 10.3.1 through 10.3.5.",
        ftphUnits: ["10.3.1", "10.3.2", "10.3.3", "10.3.4", "10.3.5"],
        effort: "medium",
        priority: "low",
      },
      {
        title: "Plan reseller architecture and subscription billing closure",
        description:
          "Translate FTPH 10.4 and 10.5 into implementable platform-control, billing, and white-label delivery tasks.",
        ftphUnits: ["10.4.1", "10.4.2", "10.4.3", "10.4.4", "10.4.5", "10.5.1", "10.5.2", "10.5.3", "10.5.4", "10.5.5"],
        effort: "medium",
        priority: "low",
      },
    ],
  },
];

const executionPlan: TaskExecutionPlanItem[] = [
  {
    title: "Implement paired owner and tenant secure submission links per unit",
    wave: 0,
    dependsOn: [],
  },
  {
    title: "Implement recipient targeting by role, unit scope, and board audience",
    wave: 0,
    dependsOn: [],
  },
  {
    title: "Harden ingestion reprocess and import-run history integrity",
    wave: 0,
    dependsOn: [],
  },
  {
    title: "Create managed regulatory source registry with freshness metadata",
    wave: 0,
    dependsOn: [],
  },
  {
    title: "Build occupancy-conditional owner and multi-tenant intake forms",
    wave: 1,
    dependsOn: ["Implement paired owner and tenant secure submission links per unit"],
  },
  {
    title: "Add structured template blocks and canonical merge fields",
    wave: 1,
    dependsOn: ["Implement recipient targeting by role, unit scope, and board audience"],
  },
  {
    title: "Expand AI ingestion raw-source support beyond text-centric uploads",
    wave: 1,
    dependsOn: ["Harden ingestion reprocess and import-run history integrity"],
  },
  {
    title: "Implement jurisdiction sync, review, and publication workflow",
    wave: 1,
    dependsOn: ["Create managed regulatory source registry with freshness metadata"],
  },
  {
    title: "Derive canonical unit occupancy state and counts",
    wave: 2,
    dependsOn: ["Build occupancy-conditional owner and multi-tenant intake forms"],
  },
  {
    title: "Enforce owner and tenant communication routing policy",
    wave: 2,
    dependsOn: [
      "Implement recipient targeting by role, unit scope, and board audience",
      "Add structured template blocks and canonical merge fields",
    ],
  },
  {
    title: "Add commit importers for meeting notes and document metadata outputs",
    wave: 2,
    dependsOn: [
      "Expand AI ingestion raw-source support beyond text-centric uploads",
      "Harden ingestion reprocess and import-run history integrity",
    ],
  },
  {
    title: "Add regulatory versioning, applicability overlays, and staleness monitoring",
    wave: 2,
    dependsOn: ["Implement jurisdiction sync, review, and publication workflow"],
  },
  {
    title: "Expand association completeness metrics and remediation actions",
    wave: 3,
    dependsOn: ["Derive canonical unit occupancy state and counts"],
  },
  {
    title: "Replace generic payment method instructions with structured owner payment setup",
    wave: 3,
    dependsOn: [
      "Add structured template blocks and canonical merge fields",
      "Enforce owner and tenant communication routing policy",
    ],
  },
  {
    title: "Persist durable source traceability across extracted records and clauses",
    wave: 3,
    dependsOn: [
      "Add commit importers for meeting notes and document metadata outputs",
      "Expand AI ingestion raw-source support beyond text-centric uploads",
    ],
  },
  {
    title: "Activate AI compliance gap detection on approved regulatory and bylaw records",
    wave: 3,
    dependsOn: [
      "Implement jurisdiction sync, review, and publication workflow",
      "Add regulatory versioning, applicability overlays, and staleness monitoring",
      "Persist durable source traceability across extracted records and clauses",
    ],
  },
  {
    title: "Implement governance reminder cadence and recipient routing",
    wave: 4,
    dependsOn: [
      "Add structured template blocks and canonical merge fields",
      "Expand association completeness metrics and remediation actions",
    ],
  },
  {
    title: "Deliver board package automation and notice distribution",
    wave: 4,
    dependsOn: [
      "Implement governance reminder cadence and recipient routing",
      "Enforce owner and tenant communication routing policy",
    ],
  },
  {
    title: "Implement regulatory filing review and export workflows",
    wave: 4,
    dependsOn: [
      "Add regulatory versioning, applicability overlays, and staleness monitoring",
      "Activate AI compliance gap detection on approved regulatory and bylaw records",
    ],
  },
  {
    title: "Deliver owner financial dashboard and payment self-service",
    wave: 5,
    dependsOn: ["Replace generic payment method instructions with structured owner payment setup"],
  },
  {
    title: "Add resident feedback and satisfaction analytics",
    wave: 5,
    dependsOn: ["Expand association completeness metrics and remediation actions"],
  },
  {
    title: "Implement community announcements and bulletin board",
    wave: 5,
    dependsOn: [
      "Enforce owner and tenant communication routing policy",
      "Deliver board package automation and notice distribution",
    ],
  },
  {
    title: "Stage amenity booking, digital signature, and voting backlog for portal expansion",
    wave: 5,
    dependsOn: ["Deliver owner financial dashboard and payment self-service"],
  },
  {
    title: "Prioritize external integrations across banking, accounting, and identity",
    wave: 6,
    dependsOn: [
      "Implement regulatory filing review and export workflows",
      "Deliver owner financial dashboard and payment self-service",
    ],
  },
  {
    title: "Define public API and webhook delivery plan",
    wave: 6,
    dependsOn: ["Prioritize external integrations across banking, accounting, and identity"],
  },
  {
    title: "Plan reseller architecture and subscription billing closure",
    wave: 6,
    dependsOn: ["Define public API and webhook delivery plan"],
  },
];

const projectKickoff = new Date("2026-03-16T00:00:00.000Z");
const waveLengthDays = 14;

function addDays(baseDate: Date, days: number): Date {
  const next = new Date(baseDate);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function applyTaskExecutionPlan(projectId: string) {
  const tasks = await db.select().from(roadmapTasks).where(eq(roadmapTasks.projectId, projectId));
  const taskByTitle = new Map(tasks.map((task) => [task.title, task]));

  for (const planItem of executionPlan) {
    if (!taskByTitle.has(planItem.title)) {
      throw new Error(`Execution plan references unknown task title: ${planItem.title}`);
    }
    for (const dependencyTitle of planItem.dependsOn) {
      if (!taskByTitle.has(dependencyTitle)) {
        throw new Error(`Execution plan dependency not found: ${dependencyTitle}`);
      }
    }
  }

  if (executionPlan.length !== tasks.length) {
    console.warn(
      `Execution plan coverage mismatch. Planned: ${executionPlan.length}, existing tasks in project: ${tasks.length}.`,
    );
  }

  for (const planItem of executionPlan) {
    const task = taskByTitle.get(planItem.title)!;
    const dependencyTaskIds = planItem.dependsOn.map((dependencyTitle) => taskByTitle.get(dependencyTitle)!.id);
    const targetStartDate = addDays(projectKickoff, planItem.wave * waveLengthDays);
    const targetEndDate = addDays(targetStartDate, waveLengthDays - 1);

    await db
      .update(roadmapTasks)
      .set({
        dependencyTaskIds,
        targetStartDate,
        targetEndDate,
        updatedAt: new Date(),
      })
      .where(eq(roadmapTasks.id, task.id));

    console.log(
      `Planned task [wave ${planItem.wave + 1}] ${planItem.title} with ${dependencyTaskIds.length} dependencies.`,
    );
  }
}

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
        await db.insert(roadmapTasks).values({
          projectId: project.id,
          workstreamId: workstream.id,
          title: taskDef.title,
          description: formatTaskDescription(taskDef),
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
            description: formatTaskDescription(taskDef),
            effort: taskDef.effort,
            priority: taskDef.priority,
            updatedAt: new Date(),
          })
          .where(eq(roadmapTasks.id, existingTask.id));
        console.log(`Updated task: ${taskDef.title}`);
      }
    }
  }

  await applyTaskExecutionPlan(project.id);
}

upsertProject()
  .then(() => {
    console.log("FTPH backlog closure roadmap project captured.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to capture FTPH backlog closure roadmap project:", error);
    process.exit(1);
  });
