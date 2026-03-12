import { and, eq } from 'drizzle-orm';
import { db } from '../server/db';
import { roadmapProjects, roadmapTasks } from '../shared/schema';

const targets = [
  '1.1.3 Track Unit Lifecycle History',
  '4.1.2 Tag Document to Entity',
  '4.1.3 Maintain Document Version History',
  '8.1.1 Assign User Role',
  '8.1.3 Validate Permission Changes',
] as const;

async function run() {
  const phase1 = (await db.select().from(roadmapProjects)).find((p) => p.title === 'Phase 1 - Foundation, Registry, and Core Admin');
  if (!phase1) throw new Error('Phase 1 not found');

  for (const title of targets) {
    const [task] = await db
      .select()
      .from(roadmapTasks)
      .where(and(eq(roadmapTasks.projectId, phase1.id), eq(roadmapTasks.title, title)));

    if (!task) {
      console.log('missing:', title);
      continue;
    }

    await db
      .update(roadmapTasks)
      .set({ status: 'done', completedDate: task.completedDate ?? new Date(), updatedAt: new Date() })
      .where(eq(roadmapTasks.id, task.id));

    console.log('done:', title);
  }

  const tasks = (await db.select().from(roadmapTasks)).filter((t) => t.projectId === phase1.id);
  console.log('Phase 1 summary', {
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
