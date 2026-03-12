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

type TaskExecutionPlanItem = {
  title: string;
  wave: number;
  dependsOn: string[];
};

const projectTitle = "Communications, Onboarding, and Resident Data Foundation - 2026-03-11";
const projectDescription =
  "Structured implementation project derived from exploratory findings across communications architecture, resident data modeling, onboarding workflows, and payment instruction automation.";

const workstreams: WorkstreamDef[] = [
  {
    title: "Messaging and Notification Architecture",
    description:
      "Establish the platform communications core for outbound notifications, inbound submissions, templates, and recipient targeting.",
    orderIndex: 0,
    tasks: [
      {
        title: "Define event-driven notification scheduler and milestone reminder rules",
        description:
          "Implement configurable reminder intervals (for example 14-day pre-milestone notices) with association-level enablement and auditable send history. (ISS-001)",
        effort: "large",
        priority: "high",
      },
      {
        title: "Implement bidirectional communications service for outbound and inbound flows",
        description:
          "Support outbound notices plus inbound resident submissions through a unified message routing layer with thread context and role-based access. (ISS-002)",
        effort: "large",
        priority: "high",
      },
      {
        title: "Build template management with standard header/footer and merge fields",
        description:
          "Create reusable communication templates with placeholder validation, association overrides, and versioning for governance control. (ISS-008)",
        effort: "medium",
        priority: "high",
      },
      {
        title: "Implement communication history log as a first-class record",
        description:
          "Store outbound and inbound communication events with sender, recipients, channel, delivery status, timestamps, and related entity links for traceability. (FTPH 7.1.3)",
        effort: "medium",
        priority: "high",
      },
      {
        title: "Add send preview and approval workflow before dispatch",
        description:
          "Require optional approval checkpoints for selected notice types before emails are sent, with approver audit trail and override notes. (FTPH 7.1 Open Question)",
        effort: "small",
        priority: "medium",
      },
      {
        title: "Define template scoping model for global and association-level templates",
        description:
          "Support global baseline templates with per-association overrides and conflict resolution rules to preserve consistency while allowing local policy differences. (FTPH 7.1 Open Question)",
        effort: "small",
        priority: "medium",
      },
      {
        title: "Create recipient targeting engine by role and occupancy state",
        description:
          "Encode delivery logic for occupants, owners, and CC rules, including fallback handling for missing contacts and per-message audience preview. (ISS-010)",
        effort: "large",
        priority: "high",
      },
    ],
  },
  {
    title: "Resident Data Model and Contact Collection",
    description:
      "Close core data integrity gaps for owners, tenants, and household-level contact records required by communications and operations.",
    orderIndex: 1,
    tasks: [
      {
        title: "Implement normalized resident contact schema with multi-occupant support",
        description:
          "Add data model and validation for phone/email/contact preference with multiple tenants per unit and owner-to-occupant relationship linkage. (ISS-004)",
        effort: "large",
        priority: "high",
      },
      {
        title: "Build owner and tenant onboarding forms with occupancy-conditional logic",
        description:
          "Create structured forms for owner-occupied vs rental units with required-field validation and lifecycle state tracking. (ISS-005)",
        effort: "medium",
        priority: "high",
      },
      {
        title: "Implement owner-submitted tenant update review and approval queue",
        description:
          "Introduce moderation workflow so owner-submitted occupant changes can be reviewed and approved before becoming active records. (FTPH 1.3 Open Question)",
        effort: "medium",
        priority: "medium",
      },
      {
        title: "Separate emergency contact fields from primary occupant contact records",
        description:
          "Add dedicated emergency contact capture and routing flags to avoid conflating emergency and routine communication targets. (FTPH 1.3 Open Question)",
        effort: "small",
        priority: "medium",
      },
      {
        title: "Add association-level contact data quality checks and completion gates",
        description:
          "Block key communications workflows when required contact fields are incomplete and provide actionable validation errors to admins.",
        effort: "medium",
        priority: "medium",
      },
    ],
  },
  {
    title: "Onboarding Experience and Association Visibility",
    description:
      "Deliver the administration experience for setup completeness tracking and consolidated association-level management.",
    orderIndex: 2,
    tasks: [
      {
        title: "Implement onboarding completeness scoring and progress bar",
        description:
          "Track setup milestones across units, owners, tenants, contacts, payment setup, and communications readiness with weighted progress. (ISS-006)",
        effort: "medium",
        priority: "medium",
      },
      {
        title: "Create association overview dashboard with key metrics and quick actions",
        description:
          "Build a centralized association page aggregating onboarding status, communications readiness, data quality, and operational shortcuts. (ISS-007)",
        effort: "medium",
        priority: "medium",
      },
      {
        title: "Define onboarding state machine and reopen/remediation workflow",
        description:
          "Formalize statuses (not started, in progress, blocked, complete) with explicit blockers and remediation assignments.",
        effort: "small",
        priority: "medium",
      },
    ],
  },
  {
    title: "Maintenance Intake and Payment Instruction Automation",
    description:
      "Complete operational flows tied to inbound requests and automatic owner guidance for association payment setup.",
    orderIndex: 3,
    tasks: [
      {
        title: "Define maintenance request schema with attachments and routing metadata",
        description:
          "Capture requester, location, category, severity, description, and photo attachments with validation and storage strategy. (ISS-003)",
        effort: "medium",
        priority: "high",
      },
      {
        title: "Implement maintenance submission intake pipeline and ticket creation",
        description:
          "Accept inbound requests through resident channels, generate work items, assign queues, and trigger status notifications.",
        effort: "large",
        priority: "high",
      },
      {
        title: "Add submitter-facing maintenance request history and status timeline",
        description:
          "Expose request history for owners/tenants with status progression and latest updates to reduce duplicate submissions and support transparency. (FTPH 7.3.4)",
        effort: "medium",
        priority: "medium",
      },
      {
        title: "Implement SLA timers and escalation rules for high-priority maintenance requests",
        description:
          "Configure response and resolution SLAs with automated escalation notices when urgent requests are not acknowledged in target windows. (FTPH 7.3 Open Question)",
        effort: "medium",
        priority: "medium",
      },
      {
        title: "Build payment method configuration registry per association",
        description:
          "Store accepted methods, processing instructions, and support contacts in a normalized configuration model tied to financial settings. (ISS-009)",
        effort: "medium",
        priority: "medium",
      },
      {
        title: "Automate payment instruction messaging using templates and config merge",
        description:
          "Generate and deliver payment setup emails populated from association payment configuration with role-aware recipient routing. (ISS-009, ISS-010)",
        effort: "medium",
        priority: "medium",
      },
    ],
  },
];

const executionPlan: TaskExecutionPlanItem[] = [
  {
    title: "Implement normalized resident contact schema with multi-occupant support",
    wave: 0,
    dependsOn: [],
  },
  {
    title: "Define maintenance request schema with attachments and routing metadata",
    wave: 0,
    dependsOn: [],
  },
  {
    title: "Build payment method configuration registry per association",
    wave: 0,
    dependsOn: [],
  },
  {
    title: "Build template management with standard header/footer and merge fields",
    wave: 0,
    dependsOn: [],
  },
  {
    title: "Define template scoping model for global and association-level templates",
    wave: 0,
    dependsOn: ["Build template management with standard header/footer and merge fields"],
  },
  {
    title: "Implement communication history log as a first-class record",
    wave: 0,
    dependsOn: [],
  },
  {
    title: "Define onboarding state machine and reopen/remediation workflow",
    wave: 0,
    dependsOn: [],
  },
  {
    title: "Implement bidirectional communications service for outbound and inbound flows",
    wave: 1,
    dependsOn: [
      "Build template management with standard header/footer and merge fields",
      "Implement communication history log as a first-class record",
    ],
  },
  {
    title: "Build owner and tenant onboarding forms with occupancy-conditional logic",
    wave: 1,
    dependsOn: [
      "Implement normalized resident contact schema with multi-occupant support",
      "Define onboarding state machine and reopen/remediation workflow",
    ],
  },
  {
    title: "Separate emergency contact fields from primary occupant contact records",
    wave: 1,
    dependsOn: ["Implement normalized resident contact schema with multi-occupant support"],
  },
  {
    title: "Implement maintenance submission intake pipeline and ticket creation",
    wave: 1,
    dependsOn: [
      "Define maintenance request schema with attachments and routing metadata",
      "Implement bidirectional communications service for outbound and inbound flows",
    ],
  },
  {
    title: "Create recipient targeting engine by role and occupancy state",
    wave: 2,
    dependsOn: [
      "Implement normalized resident contact schema with multi-occupant support",
      "Implement bidirectional communications service for outbound and inbound flows",
    ],
  },
  {
    title: "Implement owner-submitted tenant update review and approval queue",
    wave: 2,
    dependsOn: ["Build owner and tenant onboarding forms with occupancy-conditional logic"],
  },
  {
    title: "Add send preview and approval workflow before dispatch",
    wave: 2,
    dependsOn: [
      "Build template management with standard header/footer and merge fields",
      "Implement bidirectional communications service for outbound and inbound flows",
    ],
  },
  {
    title: "Define event-driven notification scheduler and milestone reminder rules",
    wave: 2,
    dependsOn: [
      "Implement bidirectional communications service for outbound and inbound flows",
      "Build template management with standard header/footer and merge fields",
    ],
  },
  {
    title: "Add association-level contact data quality checks and completion gates",
    wave: 2,
    dependsOn: [
      "Build owner and tenant onboarding forms with occupancy-conditional logic",
      "Create recipient targeting engine by role and occupancy state",
    ],
  },
  {
    title: "Add submitter-facing maintenance request history and status timeline",
    wave: 2,
    dependsOn: ["Implement maintenance submission intake pipeline and ticket creation"],
  },
  {
    title: "Implement onboarding completeness scoring and progress bar",
    wave: 3,
    dependsOn: [
      "Define onboarding state machine and reopen/remediation workflow",
      "Add association-level contact data quality checks and completion gates",
    ],
  },
  {
    title: "Implement SLA timers and escalation rules for high-priority maintenance requests",
    wave: 3,
    dependsOn: [
      "Define event-driven notification scheduler and milestone reminder rules",
      "Implement maintenance submission intake pipeline and ticket creation",
    ],
  },
  {
    title: "Automate payment instruction messaging using templates and config merge",
    wave: 3,
    dependsOn: [
      "Build payment method configuration registry per association",
      "Build template management with standard header/footer and merge fields",
      "Create recipient targeting engine by role and occupancy state",
      "Define event-driven notification scheduler and milestone reminder rules",
    ],
  },
  {
    title: "Create association overview dashboard with key metrics and quick actions",
    wave: 4,
    dependsOn: ["Implement onboarding completeness scoring and progress bar"],
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

  await applyTaskExecutionPlan(project.id);
}

upsertProject()
  .then(() => {
    console.log("Communications and onboarding foundation roadmap project captured.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to capture communications and onboarding foundation roadmap project:", error);
    process.exit(1);
  });
