import { and, eq } from 'drizzle-orm';
import { db } from '../server/db';
import { roadmapProjects, roadmapTasks } from '../shared/schema';

async function setStatus(projectId: string, title: string, status: 'todo'|'in-progress'|'done') {
  const [task] = await db
    .select()
    .from(roadmapTasks)
    .where(and(eq(roadmapTasks.projectId, projectId), eq(roadmapTasks.title, title)));

  if (!task) {
    console.log('missing task:', title);
    return;
  }

  await db
    .update(roadmapTasks)
    .set({
      status,
      completedDate: status === 'done' ? (task.completedDate ?? new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(roadmapTasks.id, task.id));

  console.log('updated', title, '=>', status);
}

async function run() {
  const projects = await db.select().from(roadmapProjects);
  const phase1 = projects.find((p) => p.title === 'Phase 1 - Foundation, Registry, and Core Admin');
  if (!phase1) throw new Error('Phase 1 project not found');

  await setStatus(phase1.id, '1.3.1 Submit Tenant Information Form', 'done');
  await setStatus(phase1.id, '1.1.3 Track Unit Lifecycle History', 'in-progress');
  await setStatus(phase1.id, '4.1.2 Tag Document to Entity', 'in-progress');
  await setStatus(phase1.id, '8.1.1 Assign User Role', 'in-progress');

  const tasks = (await db.select().from(roadmapTasks)).filter((t) => t.projectId === phase1.id);
  const summary = {
    todo: tasks.filter((t) => t.status === 'todo').length,
    inProgress: tasks.filter((t) => t.status === 'in-progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
    total: tasks.length,
  };

  console.log('phase1 summary', summary);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
