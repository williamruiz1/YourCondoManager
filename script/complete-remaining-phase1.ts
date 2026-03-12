import { eq } from 'drizzle-orm';
import { db } from '../server/db';
import { roadmapProjects, roadmapTasks } from '../shared/schema';

async function run() {
  const phase1 = (await db.select().from(roadmapProjects)).find((p) => p.title === 'Phase 1 - Foundation, Registry, and Core Admin');
  if (!phase1) throw new Error('Phase 1 not found');

  const tasks = (await db.select().from(roadmapTasks)).filter((t) => t.projectId === phase1.id);
  const remaining = tasks.filter((t) => t.status !== 'done');

  for (const task of remaining) {
    await db
      .update(roadmapTasks)
      .set({ status: 'done', completedDate: task.completedDate ?? new Date(), updatedAt: new Date() })
      .where(eq(roadmapTasks.id, task.id));
    console.log('done:', task.title);
  }

  const updated = (await db.select().from(roadmapTasks)).filter((t) => t.projectId === phase1.id);
  console.log('Phase 1 summary', {
    done: updated.filter((t) => t.status === 'done').length,
    inProgress: updated.filter((t) => t.status === 'in-progress').length,
    todo: updated.filter((t) => t.status === 'todo').length,
    total: updated.length,
  });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
