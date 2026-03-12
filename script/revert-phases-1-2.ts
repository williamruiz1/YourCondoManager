import { eq, inArray } from 'drizzle-orm';
import { db } from '../server/db';
import { roadmapProjects, roadmapTasks } from '../shared/schema';

async function run() {
  const projects = await db.select().from(roadmapProjects);
  const phase1 = projects.find((p) => p.title === 'Phase 1 - Foundation, Registry, and Core Admin');
  const phase2 = projects.find((p) => p.title === 'Phase 2 - Financial Operations and Budget Control');

  if (!phase1 || !phase2) {
    throw new Error('Phase 1 or Phase 2 project not found');
  }

  await db
    .update(roadmapProjects)
    .set({ status: 'active', isCollapsed: 0, updatedAt: new Date() })
    .where(eq(roadmapProjects.id, phase1.id));

  await db
    .update(roadmapProjects)
    .set({ status: 'active', isCollapsed: 1, updatedAt: new Date() })
    .where(eq(roadmapProjects.id, phase2.id));

  await db
    .update(roadmapTasks)
    .set({ status: 'todo', completedDate: null, updatedAt: new Date() })
    .where(inArray(roadmapTasks.projectId, [phase1.id, phase2.id]));

  console.log('Reverted Phase 1 and Phase 2 tasks to todo and project status to active.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
