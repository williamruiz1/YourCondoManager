import { db } from '../server/db';
import { roadmapTasks } from '../shared/schema';
import { eq } from 'drizzle-orm';

const tasks = [
  "Data model: add version chain to documents",
  "Upload UI: 'New version of' option on document upload",
  "Amendment notes field on version upload",
  "Effective date field on version upload",
  "Version history panel on document detail page",
  "Download any prior version directly",
  "Document list view: show version count and current version number",
  "Mark any version as current (rollback)",
  "Rollback confirmation and audit log entry",
  "Owner portal: show current version by default",
  "Configurable prior version access for owners",
  "Amendment history report export (PDF / CSV)",
];

async function main() {
  const now = new Date();
  for (const title of tasks) {
    await db.update(roadmapTasks)
      .set({ status: 'done', completedDate: now, updatedAt: now })
      .where(eq(roadmapTasks.title, title));
    console.log('Marked done:', title);
  }
}

main().catch(console.error).finally(() => process.exit(0));
