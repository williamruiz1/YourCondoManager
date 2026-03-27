import { db } from '../server/db';
import { roadmapTasks } from '../shared/schema';
import { eq } from 'drizzle-orm';

const taskTitles = [
  "Election / vote creation form",
  "Voting rule configuration (unit-weighted vs person-weighted vs board-only)",
  "Asynchronous vote period (not tied to a live meeting)",
  "Secret ballot configuration option",
  "Generate unique ballot tokens per eligible owner",
  "Proxy designation: owner designates another person to vote",
  "Proxy document upload (scanned/PDF proxy forms)",
  "Duplicate vote prevention per unit",
  "Owner portal ballot page",
  "Vote submission and confirmation receipt",
  "Owner view of their voting history",
  "Real-time vote tally for administrators",
  "Quorum tracking and election validity gate",
  "Formal result certification by administrator",
  "PDF result report export",
  "Full audit trail export for legal review",
];

async function main() {
  const now = new Date();
  for (const title of taskTitles) {
    await db.update(roadmapTasks)
      .set({ status: 'done', completedDate: now, updatedAt: now })
      .where(eq(roadmapTasks.title, title));
    console.log(`done: ${title}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
