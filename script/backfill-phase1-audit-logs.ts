import { eq, inArray } from "drizzle-orm";
import { db } from "../server/db";
import { adminUsers, auditLogs, permissionChangeLogs, unitChangeHistory, units } from "../shared/schema";

type SourceKey = `unit_change_history:${string}` | `permission_change_logs:${string}`;

function buildSourceKey(table: "unit_change_history" | "permission_change_logs", id: string): SourceKey {
  return `${table}:${id}`;
}

function getSourceKeyFromAudit(afterJson: unknown): SourceKey | null {
  if (!afterJson || typeof afterJson !== "object") return null;
  const candidate = (afterJson as Record<string, unknown>)._sourceKey;
  if (typeof candidate !== "string") return null;
  if (candidate.startsWith("unit_change_history:") || candidate.startsWith("permission_change_logs:")) {
    return candidate as SourceKey;
  }
  return null;
}

async function main() {
  const existingBackfillLogs = await db
    .select({ afterJson: auditLogs.afterJson })
    .from(auditLogs)
    .where(inArray(auditLogs.action, ["backfill-update", "backfill-permission-change"]));

  const existingKeys = new Set<SourceKey>();
  for (const row of existingBackfillLogs) {
    const key = getSourceKeyFromAudit(row.afterJson);
    if (key) existingKeys.add(key);
  }

  let inserted = 0;

  const unitHistoryRows = await db.select().from(unitChangeHistory);
  const unitIds = Array.from(new Set(unitHistoryRows.map((r) => r.unitId)));
  const unitRows = unitIds.length
    ? await db.select({ id: units.id, associationId: units.associationId }).from(units).where(inArray(units.id, unitIds))
    : [];
  const unitAssociationMap = new Map(unitRows.map((row) => [row.id, row.associationId]));

  for (const row of unitHistoryRows) {
    const sourceKey = buildSourceKey("unit_change_history", row.id);
    if (existingKeys.has(sourceKey)) continue;

    await db.insert(auditLogs).values({
      actorEmail: row.changedBy || "system",
      action: "backfill-update",
      entityType: "unit",
      entityId: row.unitId,
      associationId: unitAssociationMap.get(row.unitId) || null,
      beforeJson: {
        [row.fieldName]: row.oldValue,
        _sourceKey: sourceKey,
      },
      afterJson: {
        [row.fieldName]: row.newValue,
        _sourceKey: sourceKey,
      },
      createdAt: row.changedAt,
    });

    inserted += 1;
    existingKeys.add(sourceKey);
  }

  const permissionRows = await db.select().from(permissionChangeLogs);
  const adminIds = Array.from(new Set(permissionRows.map((r) => r.userId)));
  const adminRows = adminIds.length
    ? await db.select({ id: adminUsers.id, email: adminUsers.email }).from(adminUsers).where(inArray(adminUsers.id, adminIds))
    : [];
  const adminEmailMap = new Map(adminRows.map((row) => [row.id, row.email]));

  for (const row of permissionRows) {
    const sourceKey = buildSourceKey("permission_change_logs", row.id);
    if (existingKeys.has(sourceKey)) continue;

    await db.insert(auditLogs).values({
      actorEmail: row.changedBy || "system",
      action: "backfill-permission-change",
      entityType: "admin-user-role",
      entityId: row.userId,
      associationId: null,
      beforeJson: {
        role: row.oldRole,
        userEmail: adminEmailMap.get(row.userId) || null,
        _sourceKey: sourceKey,
      },
      afterJson: {
        role: row.newRole,
        reason: row.reason || null,
        userEmail: adminEmailMap.get(row.userId) || null,
        _sourceKey: sourceKey,
      },
      createdAt: row.createdAt,
    });

    inserted += 1;
    existingKeys.add(sourceKey);
  }

  console.log(`Backfill complete. Inserted ${inserted} audit log records.`);
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
