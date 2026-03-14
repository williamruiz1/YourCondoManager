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

const projectTitle = "FTPH Follow-On Phase - Vendor, Maintenance, and Property Operations";
const projectDescription =
  "Follow the payment-automation phase with the missing property-operations layer: vendor registry, work orders, maintenance workflows, preventive scheduling, inspections, and operating controls.";

const workstreams: WorkstreamDef[] = [
  {
    title: "Vendor Registry and Compliance",
    description: "Create the vendor domain that the platform currently lacks beyond invoice-level records.",
    orderIndex: 1,
    tasks: [
      {
        key: "vendor-model",
        title: "Create vendor profile model, API, and admin workspace",
        description:
          "Introduce structured vendor records with trade, contact data, service area, licensing, and association linkage instead of invoice-only vendor names.",
        effort: "large",
        priority: "high",
      },
      {
        key: "vendor-documents",
        title: "Link vendor documents, insurance certificates, and contracts",
        description:
          "Attach W-9s, insurance certificates, contracts, and other supporting files to vendor profiles using the existing document repository patterns.",
        effort: "medium",
        priority: "high",
        dependencyKeys: ["vendor-model"],
      },
      {
        key: "vendor-status",
        title: "Add vendor status tracking and renewal alerts",
        description:
          "Track active and inactive vendors, insurance expiration, and missing compliance artifacts so operators can identify vendor risk before assignment.",
        effort: "medium",
        priority: "medium",
        dependencyKeys: ["vendor-documents"],
      },
      {
        key: "vendor-reuse",
        title: "Connect vendor records to invoices and future work orders",
        description:
          "Replace free-text vendor references where possible so invoices and work orders can roll up against a consistent vendor identity.",
        effort: "medium",
        priority: "high",
        dependencyKeys: ["vendor-model"],
      },
    ],
  },
  {
    title: "Work Order Management",
    description: "Add the internal operational execution layer for property issues and maintenance delivery.",
    orderIndex: 2,
    tasks: [
      {
        key: "work-order-model",
        title: "Create work-order model, lifecycle states, and admin operations UI",
        description:
          "Introduce work-order records with scope, location, priority, assignee, estimated cost, and lifecycle states from open through closed.",
        effort: "large",
        priority: "critical",
      },
      {
        key: "request-conversion",
        title: "Convert maintenance requests into managed work orders",
        description:
          "Bridge the existing maintenance-request intake flow into the new work-order lifecycle so requests no longer stop at triage-only handling.",
        effort: "medium",
        priority: "high",
        dependencyKeys: ["work-order-model"],
      },
      {
        key: "invoice-linkage",
        title: "Link completed work orders to vendor invoices and expenses",
        description:
          "Tie maintenance delivery to actual spend so boards can trace operational work from request through invoice and payment.",
        effort: "medium",
        priority: "high",
        dependencyKeys: ["vendor-reuse", "work-order-model"],
      },
      {
        key: "unit-history",
        title: "Add unit-level maintenance history and operational timeline",
        description:
          "Expose historical work by unit and common area so recurring issues and prior remediation are visible in context.",
        effort: "medium",
        priority: "medium",
        dependencyKeys: ["request-conversion", "invoice-linkage"],
      },
    ],
  },
  {
    title: "Resident Maintenance Portal",
    description: "Turn the existing maintenance request feature into a complete resident-facing service workflow.",
    orderIndex: 3,
    tasks: [
      {
        key: "portal-request-upgrade",
        title: "Upgrade portal maintenance submission with categories, urgency, and photo evidence",
        description:
          "Expand the current request form so owners and tenants can submit more structured issues that are ready for triage and operational routing.",
        effort: "medium",
        priority: "high",
      },
      {
        key: "status-notifications",
        title: "Add request and work-order status notifications",
        description:
          "Notify submitters at key lifecycle transitions such as triaged, assigned, in progress, resolved, and closed using the communications layer.",
        effort: "medium",
        priority: "medium",
        dependencyKeys: ["request-conversion", "portal-request-upgrade"],
      },
      {
        key: "submitter-history",
        title: "Add portal history view for resident maintenance submissions",
        description:
          "Give owners and tenants visibility into their prior requests, current status, and resolution notes.",
        effort: "medium",
        priority: "medium",
        dependencyKeys: ["portal-request-upgrade", "status-notifications"],
      },
      {
        key: "sla-escalation",
        title: "Add SLA timers and escalation rules for urgent requests",
        description:
          "Track response windows and escalation triggers so urgent issues are surfaced when operational response lags.",
        effort: "medium",
        priority: "medium",
        dependencyKeys: ["status-notifications"],
      },
    ],
  },
  {
    title: "Preventive Maintenance and Inspections",
    description: "Add recurring property-care workflows so the platform is not limited to reactive issue handling.",
    orderIndex: 4,
    tasks: [
      {
        key: "pm-templates",
        title: "Create preventive maintenance templates and schedule generation",
        description:
          "Support recurring maintenance plans by component, frequency, responsibility, and due-date generation.",
        effort: "large",
        priority: "high",
      },
      {
        key: "pm-to-work-order",
        title: "Link preventive schedules to work-order creation",
        description:
          "Allow due preventive tasks to generate work orders automatically or through operator confirmation.",
        effort: "medium",
        priority: "high",
        dependencyKeys: ["pm-templates", "work-order-model"],
      },
      {
        key: "inspection-records",
        title: "Add inspection records with findings, photos, and severity",
        description:
          "Create structured inspection records for units and common areas, including evidentiary attachments and issue findings.",
        effort: "large",
        priority: "high",
      },
      {
        key: "inspection-work-orders",
        title: "Convert inspection findings into follow-up work orders",
        description:
          "Allow open findings to become actionable work items without duplicate data entry.",
        effort: "medium",
        priority: "medium",
        dependencyKeys: ["inspection-records", "work-order-model"],
      },
    ],
  },
  {
    title: "Operational Reporting and Launch Readiness",
    description: "Make the new property-operations layer measurable, supportable, and board-usable.",
    orderIndex: 5,
    tasks: [
      {
        key: "ops-dashboard",
        title: "Create operations dashboard for open work, aging, and vendor activity",
        description:
          "Give admins and boards a high-level view of open requests, work-order aging, vendor load, and unresolved inspection items.",
        effort: "medium",
        priority: "high",
        dependencyKeys: ["unit-history", "inspection-work-orders"],
      },
      {
        key: "ops-reports",
        title: "Add exportable maintenance and vendor reporting",
        description:
          "Produce board-ready and operational exports for vendor activity, work-order cost, response performance, and recurring maintenance coverage.",
        effort: "medium",
        priority: "medium",
        dependencyKeys: ["ops-dashboard", "invoice-linkage"],
      },
      {
        key: "ops-audit",
        title: "Expand audit logging and permissions for property operations",
        description:
          "Ensure work assignments, status changes, inspection edits, and vendor record updates are permissioned and auditable.",
        effort: "medium",
        priority: "high",
        dependencyKeys: ["work-order-model", "inspection-records", "vendor-model"],
      },
      {
        key: "ops-launch",
        title: "Prepare rollout checklist, operator training, and acceptance verification",
        description:
          "Define cutover steps, acceptance checks, and operator guidance before rolling property operations into live association usage.",
        effort: "small",
        priority: "medium",
        dependencyKeys: ["ops-reports", "ops-audit", "sla-escalation", "pm-to-work-order"],
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
    console.log("FTPH follow-on property operations roadmap project captured.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to capture FTPH follow-on property operations roadmap project:", error);
    process.exit(1);
  });
