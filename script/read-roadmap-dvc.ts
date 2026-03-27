import { db } from '../server/db';
import { roadmapProjects, roadmapWorkstreams, roadmapTasks } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const [p] = await db.select().from(roadmapProjects).where(eq(roadmapProjects.title, 'Document Version Control'));
  const ws = await db.select().from(roadmapWorkstreams).where(eq(roadmapWorkstreams.projectId, p.id));
  const tasks = await db.select().from(roadmapTasks).where(eq(roadmapTasks.projectId, p.id));
  console.log(JSON.stringify({ project: p, workstreams: ws, tasks }, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
