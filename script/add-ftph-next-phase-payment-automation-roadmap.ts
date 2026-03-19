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

const projectTitle = "FTPH Next Phase - Payment Processing and Financial Automation";
const projectDescription =
  "Close the biggest remaining FTPH gap by converting the current payment foundation into a production-ready financial operations layer with live collection, autopay, delinquency controls, reconciliation, and board-ready reporting.";

const workstreams: WorkstreamDef[] = [
  {
    title: "Payment Gateway Productionization",
    description: "Replace the current validation and test-harness foundation with a real provider-backed transaction flow.",
    orderIndex: 1,
    tasks: [
      {
        key: "gateway-live-verification",
        title: "Implement live provider verification and secure credential storage",
        description:
          "Replace structural-only gateway validation with a real provider connectivity check and move secrets into a production-safe handling path.",
        effort: "large",
        priority: "critical",
      },
      {
        key: "hosted-checkout",
        title: "Build hosted ACH checkout/session flow",
        description:
          "Create a real ACH payment-session flow so owner balances can be paid through a provider-backed bank-account checkout instead of admin-side token testing only.",
        effort: "large",
        priority: "critical",
        dependencyKeys: ["gateway-live-verification"],
      },
      {
        key: "signed-webhooks",
        title: "Add signed webhook verification and hardened payment event states",
        description:
          "Verify provider signatures, enforce idempotency, and expand event handling so successful, failed, pending, and replayed payments behave predictably.",
        effort: "medium",
        priority: "critical",
        dependencyKeys: ["gateway-live-verification"],
      },
      {
        key: "admin-payment-activity",
        title: "Create admin payment activity and exception review view",
        description:
          "Give admins a dedicated operational view of payment attempts, webhook outcomes, posting status, and exceptions tied back to the owner ledger.",
        effort: "medium",
        priority: "high",
        dependencyKeys: ["hosted-checkout", "signed-webhooks"],
      },
    ],
  },
  {
    title: "Owner Payment Experience",
    description: "Turn the payment foundation into a usable owner-facing payment experience inside the portal.",
    orderIndex: 2,
    tasks: [
      {
        key: "portal-payment-screen",
        title: "Add portal payment screen with live balance summary",
        description:
          "Expose a payment view in the owner portal that shows outstanding balance, payable amount, due context, and next action into checkout.",
        effort: "medium",
        priority: "high",
        dependencyKeys: ["hosted-checkout"],
      },
      {
        key: "saved-payment-methods",
        title: "Support saved payment methods and owner-managed defaults",
        description:
          "Allow owners to save and manage ACH bank-account methods through the provider-backed workflow instead of relying only on static payment instructions.",
        effort: "large",
        priority: "high",
        dependencyKeys: ["hosted-checkout"],
      },
      {
        key: "partial-payments-receipts",
        title: "Support partial-payment rules, receipts, and payment confirmations",
        description:
          "Apply configurable full-vs-partial payment rules and send a durable confirmation trail for every completed payment.",
        effort: "medium",
        priority: "high",
        dependencyKeys: ["portal-payment-screen", "signed-webhooks"],
      },
      {
        key: "payment-reminders",
        title: "Link payment reminders and due notices to portal payment actions",
        description:
          "Connect communications templates and payment links so reminders drive owners directly into the live payment experience.",
        effort: "medium",
        priority: "medium",
        dependencyKeys: ["portal-payment-screen"],
      },
    ],
  },
  {
    title: "Autopay and Delinquency Automation",
    description: "Move from one-off owner payments to policy-driven collection workflows.",
    orderIndex: 3,
    tasks: [
      {
        key: "autopay-enrollment",
        title: "Add autopay enrollment and schedule management",
        description:
          "Allow owners to opt into recurring payment schedules using saved payment methods and visible enrollment controls.",
        effort: "large",
        priority: "high",
        dependencyKeys: ["saved-payment-methods"],
      },
      {
        key: "charge-runner",
        title: "Build recurring charge runner with retry controls",
        description:
          "Initiate scheduled charges from fee obligations, track retry state, and prevent duplicate postings on retries or replays.",
        effort: "large",
        priority: "high",
        dependencyKeys: ["autopay-enrollment", "signed-webhooks"],
      },
      {
        key: "delinquency-rules",
        title: "Add delinquency thresholds, notice sequencing, and escalation tracking",
        description:
          "Create configurable 30/60/90-style delinquency policy controls linked to communications and balance-aging logic.",
        effort: "medium",
        priority: "high",
        dependencyKeys: ["payment-reminders", "charge-runner"],
      },
      {
        key: "collections-handoff",
        title: "Create collections handoff records and aging dashboard",
        description:
          "Provide finance and board users a clear aging view plus formal referral tracking when delinquent balances move into collections.",
        effort: "medium",
        priority: "medium",
        dependencyKeys: ["delinquency-rules"],
      },
    ],
  },
  {
    title: "Reconciliation and Financial Reporting",
    description: "Close the loop from payment collection through bank matching and board reporting.",
    orderIndex: 4,
    tasks: [
      {
        key: "bank-import",
        title: "Add bank statement import and normalization",
        description:
          "Support manual bank-statement import first, with normalized transaction records ready for matching against ledger activity.",
        effort: "medium",
        priority: "high",
      },
      {
        key: "auto-match",
        title: "Build reconciliation match queue and manual review workflow",
        description:
          "Auto-match bank transactions to ledger entries by amount, date, and reference, then surface unresolved items for operator review.",
        effort: "large",
        priority: "high",
        dependencyKeys: ["bank-import", "admin-payment-activity"],
      },
      {
        key: "period-close",
        title: "Add reconciliation period close controls and edit locks",
        description:
          "Prevent retroactive mutation of closed finance periods once reconciliation is completed and approved.",
        effort: "medium",
        priority: "high",
        dependencyKeys: ["auto-match"],
      },
      {
        key: "financial-report-pack",
        title: "Deliver AR aging, income and expense, reserve, and exportable board reports",
        description:
          "Generate board-ready financial views and export outputs directly from platform data rather than spreadsheet-only workflows.",
        effort: "large",
        priority: "high",
        dependencyKeys: ["collections-handoff", "period-close"],
      },
    ],
  },
  {
    title: "Launch Controls and Finance Readiness",
    description: "Make the phase safe to ship, support, and scale.",
    orderIndex: 5,
    tasks: [
      {
        key: "audit-and-alerting",
        title: "Expand audit coverage, alerts, and finance-grade error handling",
        description:
          "Capture critical payment and reconciliation actions in audit logs, add operator alerts, and harden failure paths for finance operations.",
        effort: "medium",
        priority: "high",
        dependencyKeys: ["signed-webhooks", "auto-match"],
      },
      {
        key: "feature-flags",
        title: "Add staged rollout controls by association",
        description:
          "Release the payment stack behind association-scoped controls so the rollout can be canaried before full activation.",
        effort: "medium",
        priority: "medium",
        dependencyKeys: ["hosted-checkout"],
      },
      {
        key: "acceptance-coverage",
        title: "Create acceptance coverage for payment success, failure, retry, and reconciliation scenarios",
        description:
          "Establish verification coverage across the operational states that matter before the feature is called production-ready.",
        effort: "medium",
        priority: "high",
        dependencyKeys: ["financial-report-pack", "audit-and-alerting"],
      },
      {
        key: "runbook-cutover",
        title: "Prepare operator runbook, cutover plan, and launch KPIs",
        description:
          "Document finance operations, launch gates, rollback considerations, and the KPI set used to judge post-release stability.",
        effort: "small",
        priority: "medium",
        dependencyKeys: ["acceptance-coverage", "feature-flags"],
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
    console.log("FTPH next-phase payment automation roadmap project captured.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to capture FTPH next-phase payment automation roadmap project:", error);
    process.exit(1);
  });
