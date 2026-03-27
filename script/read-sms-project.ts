import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapWorkstreams, roadmapTasks } from "../shared/schema";

async function main() {
  const projects = await db.select().from(roadmapProjects);
  const p = projects.find(x => x.title === 'SMS & Push Notifications');
  if (!p) { console.log('Project not found'); return; }
  const ws = await db.select().from(roadmapWorkstreams).where(eq(roadmapWorkstreams.projectId, p.id));
  const tasks = await db.select().from(roadmapTasks).where(eq(roadmapTasks.projectId, p.id));
  ws.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  tasks.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  console.log(JSON.stringify({ project: p, workstreams: ws, tasks }, null, 2));
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
