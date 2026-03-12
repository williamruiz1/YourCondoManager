import { and, eq } from 'drizzle-orm';
import { db } from '../server/db';
import { roadmapProjects, roadmapTasks } from '../shared/schema';

async function run() {
  const phase2 = (await db.select().from(roadmapProjects)).find(
    (p) => p.title === 'Phase 2 - Financial Operations and Budget Control',
  );

  if (!phase2) {
    throw new Error('Phase 2 project not found');
  }

  const tasks = (await db.select().from(roadmapTasks)).filter((t) => t.projectId === phase2.id);
  const toComplete = tasks.filter((t) => t.status !== 'done');

  for (const task of toComplete) {
    await db
      .update(roadmapTasks)
      .set({
        status: 'done',
        completedDate: task.completedDate ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(roadmapTasks.id, task.id));
    console.log(`completed: ${task.title}`);
  }

  const updated = (await db.select().from(roadmapTasks)).filter((t) => t.projectId === phase2.id);
  const summary = {
    done: updated.filter((t) => t.status === 'done').length,
    inProgress: updated.filter((t) => t.status === 'in-progress').length,
    todo: updated.filter((t) => t.status === 'todo').length,
    total: updated.length,
  };

  console.log('Phase 2 summary:', summary);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
