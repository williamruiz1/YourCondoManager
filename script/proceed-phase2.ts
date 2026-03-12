import { and, eq } from 'drizzle-orm';
import { db } from '../server/db';
import { roadmapProjects, roadmapTasks } from '../shared/schema';

async function run() {
  const projects = await db.select().from(roadmapProjects);
  const phase1 = projects.find((p) => p.title === 'Phase 1 - Foundation, Registry, and Core Admin');
  const phase2 = projects.find((p) => p.title === 'Phase 2 - Financial Operations and Budget Control');

  if (!phase1 || !phase2) {
    throw new Error('Phase 1 or Phase 2 not found');
  }

  await db
    .update(roadmapProjects)
    .set({ status: 'complete', isCollapsed: 1, updatedAt: new Date() })
    .where(eq(roadmapProjects.id, phase1.id));

  await db
    .update(roadmapProjects)
    .set({ status: 'active', isCollapsed: 0, updatedAt: new Date() })
    .where(eq(roadmapProjects.id, phase2.id));

  const [phase2Lead] = await db
    .select()
    .from(roadmapTasks)
    .where(and(eq(roadmapTasks.projectId, phase2.id), eq(roadmapTasks.title, '3.1.1 Create HOA Fee Schedule')));

  if (phase2Lead) {
    await db
      .update(roadmapTasks)
      .set({ status: 'in-progress', completedDate: null, updatedAt: new Date() })
      .where(eq(roadmapTasks.id, phase2Lead.id));
  }

  const phase2Tasks = (await db.select().from(roadmapTasks)).filter((t) => t.projectId === phase2.id);
  const summary = {
    todo: phase2Tasks.filter((t) => t.status === 'todo').length,
    inProgress: phase2Tasks.filter((t) => t.status === 'in-progress').length,
    done: phase2Tasks.filter((t) => t.status === 'done').length,
    total: phase2Tasks.length,
  };

  console.log('Phase 1 set to complete.');
  console.log('Phase 2 summary:', summary);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
