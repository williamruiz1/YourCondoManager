import { and, eq } from 'drizzle-orm';
import { db } from '../server/db';
import { roadmapProjects, roadmapTasks, roadmapWorkstreams } from '../shared/schema';

type PlanTask = {
  title: string;
  description: string;
  workstream: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  effort: 'small' | 'medium' | 'large';
  dependencies?: string[];
};

const phase1Title = 'Phase 1 - Foundation, Registry, and Core Admin';

const planTasks: PlanTask[] = [
  {
    title: 'Remediation: Enforce RBAC on All Phase 1 CRUD Routes',
    description: 'Apply admin role checks to associations, units, persons, ownerships, occupancies, board roles, and documents endpoints with least-privilege policy.',
    workstream: 'Auth, Roles, and Audit Logging',
    priority: 'critical',
    effort: 'medium',
  },
  {
    title: 'Remediation: Remove Auto-Escalation Admin Bootstrap Path',
    description: 'Replace auto-creation of platform-admin from request headers with explicit controlled bootstrap and fail-closed behavior.',
    workstream: 'Auth, Roles, and Audit Logging',
    priority: 'critical',
    effort: 'small',
    dependencies: ['Remediation: Enforce RBAC on All Phase 1 CRUD Routes'],
  },
  {
    title: 'Remediation: Capture Actor Identity in Unit Change History',
    description: 'Propagate authenticated admin identity into unit lifecycle history change logs instead of system placeholder values.',
    workstream: 'Unit Registry',
    priority: 'high',
    effort: 'small',
  },
  {
    title: 'Remediation: Add Document Tagging UI Workflow',
    description: 'Expose document tag create/list interactions in admin documents page using document tag APIs.',
    workstream: 'Document Repository',
    priority: 'high',
    effort: 'medium',
  },
  {
    title: 'Remediation: Add Document Version Management UI Workflow',
    description: 'Expose version history list and upload-new-version flow in admin documents page including replacement context.',
    workstream: 'Document Repository',
    priority: 'high',
    effort: 'medium',
    dependencies: ['Remediation: Add Document Tagging UI Workflow'],
  },
  {
    title: 'Remediation: Add Permission Change Review Surface',
    description: 'Add admin users page to list users, change roles with required reason, and show validation errors clearly.',
    workstream: 'Auth, Roles, and Audit Logging',
    priority: 'high',
    effort: 'medium',
    dependencies: ['Remediation: Remove Auto-Escalation Admin Bootstrap Path'],
  },
  {
    title: 'Remediation: Add Phase 1 Verification Test Suite',
    description: 'Create integration checks for RBAC guards, unit history actor logging, document tags/versions, and permission-change validations.',
    workstream: 'Basic Dashboard',
    priority: 'high',
    effort: 'large',
    dependencies: [
      'Remediation: Enforce RBAC on All Phase 1 CRUD Routes',
      'Remediation: Add Document Version Management UI Workflow',
      'Remediation: Add Permission Change Review Surface',
    ],
  },
  {
    title: 'Remediation: Revalidate and Reclose Phase 1 Exit Criteria',
    description: 'Run acceptance checklist against implemented behavior and only then mark remaining Phase 1 governance/auth/document tasks complete.',
    workstream: 'Association Setup',
    priority: 'high',
    effort: 'small',
    dependencies: ['Remediation: Add Phase 1 Verification Test Suite'],
  },
];

async function run() {
  const projects = await db.select().from(roadmapProjects);
  const phase1 = projects.find((p) => p.title === phase1Title);
  if (!phase1) throw new Error('Phase 1 project not found');

  await db
    .update(roadmapProjects)
    .set({ status: 'active', isCollapsed: 0, updatedAt: new Date() })
    .where(eq(roadmapProjects.id, phase1.id));

  const workstreams = (await db.select().from(roadmapWorkstreams)).filter((w) => w.projectId === phase1.id);
  const wsByTitle = new Map(workstreams.map((w) => [w.title, w]));

  const existingTasks = (await db.select().from(roadmapTasks)).filter((t) => t.projectId === phase1.id);
  const existingByTitle = new Map(existingTasks.map((t) => [t.title, t]));

  const insertedOrExistingIds = new Map<string, string>();

  for (const task of planTasks) {
    const ws = wsByTitle.get(task.workstream);
    if (!ws) {
      throw new Error(`Workstream not found in Phase 1: ${task.workstream}`);
    }

    const existing = existingByTitle.get(task.title);
    if (existing) {
      insertedOrExistingIds.set(task.title, existing.id);
      continue;
    }

    const [created] = await db
      .insert(roadmapTasks)
      .values({
        projectId: phase1.id,
        workstreamId: ws.id,
        title: task.title,
        description: task.description,
        status: 'todo',
        effort: task.effort,
        priority: task.priority,
        dependencyTaskIds: [],
        targetStartDate: null,
        targetEndDate: null,
        completedDate: null,
      })
      .returning();

    insertedOrExistingIds.set(task.title, created.id);
    existingByTitle.set(created.title, created);
    console.log('added task:', task.title);
  }

  for (const task of planTasks) {
    const taskId = insertedOrExistingIds.get(task.title);
    if (!taskId) continue;

    const dependencyTaskIds = (task.dependencies || [])
      .map((title) => insertedOrExistingIds.get(title))
      .filter((id): id is string => Boolean(id));

    await db
      .update(roadmapTasks)
      .set({ dependencyTaskIds, updatedAt: new Date() })
      .where(eq(roadmapTasks.id, taskId));
  }

  const phase1Tasks = (await db.select().from(roadmapTasks)).filter((t) => t.projectId === phase1.id);
  console.log('phase1 task count:', phase1Tasks.length);
  console.log('phase1 status:', 'active');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
