import { db } from '../server/db';
import { roadmapProjects, roadmapTasks } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const [p] = await db.select().from(roadmapProjects).where(eq(roadmapProjects.title, 'Document Version Control'));
  const tasks = await db.select({ title: roadmapTasks.title, status: roadmapTasks.status }).from(roadmapTasks).where(eq(roadmapTasks.projectId, p.id));
  const done = tasks.filter(t => t.status === 'done').length;
  console.log(`${done}/${tasks.length} tasks done`);
  tasks.forEach(t => console.log(`  [${t.status}] ${t.title}`));
}

main().catch(console.error).finally(() => process.exit(0));
