import { and, eq } from 'drizzle-orm';
import { db } from '../server/db';
import { roadmapProjects, roadmapTasks } from '../shared/schema';

async function updateTask(projectId: string, title: string, status: 'todo'|'in-progress'|'done') {
  const [task] = await db.select().from(roadmapTasks).where(and(eq(roadmapTasks.projectId, projectId), eq(roadmapTasks.title, title)));
  if (!task) return;
  await db.update(roadmapTasks).set({
    status,
    completedDate: status === 'done' ? (task.completedDate ?? new Date()) : null,
    updatedAt: new Date(),
  }).where(eq(roadmapTasks.id, task.id));
  console.log(`updated ${title} -> ${status}`);
}

async function run() {
  const phase1 = (await db.select().from(roadmapProjects)).find((p) => p.title === 'Phase 1 - Foundation, Registry, and Core Admin');
  if (!phase1) throw new Error('Phase 1 not found');

  await updateTask(phase1.id, '1.1.1 Create Unit Record', 'done');
  await updateTask(phase1.id, '1.1.2 Edit Unit Attributes', 'in-progress');

  const tasks = (await db.select().from(roadmapTasks)).filter((t) => t.projectId === phase1.id);
  console.log('phase1 summary', {
    done: tasks.filter((t) => t.status === 'done').length,
    inProgress: tasks.filter((t) => t.status === 'in-progress').length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    total: tasks.length,
  });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
