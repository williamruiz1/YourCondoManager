import { and, eq, like, inArray } from "drizzle-orm";
import { db } from "../server/db";
import { executiveEvidence, executiveUpdates } from "../shared/schema";

type ExecutiveRow = typeof executiveUpdates.$inferSelect;

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+completed$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPhaseKey(text: string): string | null {
  const match = text.match(/\bphase\s*([1-9][0-9]*)\b/i);
  if (!match) return null;
  return `phase:${match[1]}`;
}

function getGroupKey(row: ExecutiveRow): string {
  const combined = `${row.title} ${row.headline}`;
  const phaseKey = extractPhaseKey(combined);
  if (phaseKey) return phaseKey;
  if (row.projectId) return `project:${row.projectId}`;
  return `title:${normalizeTitle(row.title)}`;
}

function score(row: ExecutiveRow): number {
  const sourceBonus = row.sourceKey?.startsWith("slide:roadmap-project:") ? 1_000_000_000_000 : 0;
  const seededPenalty = row.sourceKey?.startsWith("slide:phase") ? -100_000_000_000 : 0;
  const statusBonus = row.status === "published" ? 100_000_000_000 : 0;
  const deliveredAt = row.deliveredAt ? new Date(row.deliveredAt).getTime() : 0;
  const updatedAt = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
  return sourceBonus + seededPenalty + statusBonus + deliveredAt + Math.floor(updatedAt / 1000);
}

async function cleanup() {
  const slides = await db
    .select()
    .from(executiveUpdates)
    .where(like(executiveUpdates.sourceKey, "slide:%"));

  const groups = new Map<string, ExecutiveRow[]>();
  for (const row of slides) {
    const key = getGroupKey(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const deleteIds: string[] = [];
  const keepIds: string[] = [];

  for (const [groupKey, rows] of groups.entries()) {
    if (rows.length <= 1) {
      keepIds.push(rows[0].id);
      continue;
    }

    const sorted = [...rows].sort((a, b) => score(b) - score(a));
    const keeper = sorted[0];
    keepIds.push(keeper.id);

    for (const row of sorted.slice(1)) {
      deleteIds.push(row.id);
    }

    console.log(`Group ${groupKey}: keeping ${keeper.id}, deleting ${sorted.length - 1}`);
  }

  if (deleteIds.length > 0) {
    await db.delete(executiveEvidence).where(inArray(executiveEvidence.executiveUpdateId, deleteIds));
    await db.delete(executiveUpdates).where(inArray(executiveUpdates.id, deleteIds));
  }

  if (keepIds.length > 0) {
    // Ensure remaining slides are published for deck visibility.
    await db
      .update(executiveUpdates)
      .set({ status: "published", updatedAt: new Date() })
      .where(and(like(executiveUpdates.sourceKey, "slide:%"), inArray(executiveUpdates.id, keepIds)));
  }

  console.log(`Cleanup complete. groups=${groups.size}, kept=${keepIds.length}, deleted=${deleteIds.length}`);
}

cleanup()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to cleanup executive slide duplicates:", error);
    process.exit(1);
  });
