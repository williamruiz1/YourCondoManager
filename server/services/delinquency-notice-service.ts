/**
 * Delinquency Notice Service — Phase 3
 *
 * Generates idempotent notice records for delinquent owners.
 * Notice delivery is stubbed (records created as "queued").
 */

import { and, eq, desc } from "drizzle-orm";
import { db } from "../db";
import {
  delinquencyNotices,
  delinquencyEscalations,
  noticeSends,
  persons,
  units,
  type DelinquencyNotice,
} from "@shared/schema";
import { getDelinquencySettings } from "./retry-service";

// ── Notice Stage Determination ───────────────────────────────────────────────

type NoticeStage = "payment_failed_notice" | "delinquency_notice_1" | "delinquency_notice_2" | "final_notice";

function determineNoticeStage(daysPastDue: number): NoticeStage {
  if (daysPastDue >= 90) return "final_notice";
  if (daysPastDue >= 60) return "delinquency_notice_2";
  if (daysPastDue >= 30) return "delinquency_notice_1";
  return "payment_failed_notice";
}

// ── Generate Notices (idempotent) ────────────────────────────────────────────

export async function generateDelinquencyNotices(associationId: string): Promise<{
  generated: number;
  skipped: number;
}> {
  const settings = await getDelinquencySettings(associationId);
  const gracePeriod = settings.gracePeriodDays ?? 15;

  // Get all active escalations for this association
  const escalations = await db
    .select()
    .from(delinquencyEscalations)
    .where(
      and(
        eq(delinquencyEscalations.associationId, associationId),
        eq(delinquencyEscalations.status, "active"),
      ),
    );

  const now = new Date();
  const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let generated = 0;
  let skipped = 0;

  for (const esc of escalations) {
    // Skip if within grace period
    if (esc.daysPastDue < gracePeriod) {
      skipped++;
      continue;
    }

    const stage = determineNoticeStage(esc.daysPastDue);
    const amountOwedCents = Math.round(Math.abs(esc.balance) * 100);

    // Dedup check — the unique index also enforces this, but checking upfront avoids exceptions
    const [existing] = await db
      .select({ id: delinquencyNotices.id })
      .from(delinquencyNotices)
      .where(
        and(
          eq(delinquencyNotices.associationId, associationId),
          eq(delinquencyNotices.personId, esc.personId),
          eq(delinquencyNotices.unitId, esc.unitId),
          eq(delinquencyNotices.noticeStage, stage),
          eq(delinquencyNotices.delinquencyPeriodKey, periodKey),
        ),
      )
      .limit(1);

    if (existing) {
      skipped++;
      continue;
    }

    // Load person/unit info for payload snapshot
    const [person] = await db
      .select({ firstName: persons.firstName, lastName: persons.lastName, email: persons.email })
      .from(persons)
      .where(eq(persons.id, esc.personId))
      .limit(1);

    const [unit] = await db
      .select({ unitNumber: units.unitNumber, building: units.building })
      .from(units)
      .where(eq(units.id, esc.unitId))
      .limit(1);

    const payloadSnapshot = {
      ownerName: person ? `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim() : "Unknown",
      ownerEmail: person?.email ?? null,
      unitNumber: unit?.unitNumber ?? "Unknown",
      building: unit?.building ?? null,
      balance: esc.balance,
      daysPastDue: esc.daysPastDue,
      stage: esc.currentStage,
      generatedAt: now.toISOString(),
    };

    // Create a stub notice_sends record (delivery stubbed)
    let noticeSendId: string | null = null;
    if (person?.email) {
      const [send] = await db
        .insert(noticeSends)
        .values({
          associationId,
          recipientEmail: person.email,
          recipientPersonId: esc.personId,
          subjectRendered: `Payment Notice: ${stage.replace(/_/g, " ")}`,
          bodyRendered: `Dear ${payloadSnapshot.ownerName}, your account has a balance of $${Math.abs(esc.balance).toFixed(2)} that is ${esc.daysPastDue} days past due.`,
          status: "queued",
          provider: "internal-mock",
          metadataJson: { noticeStage: stage, delinquencyPeriodKey: periodKey },
        })
        .returning();
      noticeSendId = send.id;
    }

    // Create delinquency_notices record
    await db.insert(delinquencyNotices).values({
      associationId,
      personId: esc.personId,
      unitId: esc.unitId,
      noticeStage: stage,
      triggerDaysPastDue: esc.daysPastDue,
      amountOwedCents,
      escalationId: esc.id,
      noticeSendId,
      status: "queued",
      delinquencyPeriodKey: periodKey,
      payloadSnapshotJson: payloadSnapshot,
    });

    generated++;
  }

  return { generated, skipped };
}

// ── Query Notice History ─────────────────────────────────────────────────────

export async function getNoticeHistory(params: {
  associationId: string;
  personId?: string;
  unitId?: string;
  stage?: string;
  limit?: number;
}): Promise<DelinquencyNotice[]> {
  const conditions = [eq(delinquencyNotices.associationId, params.associationId)];

  if (params.personId) conditions.push(eq(delinquencyNotices.personId, params.personId));
  if (params.unitId) conditions.push(eq(delinquencyNotices.unitId, params.unitId));
  if (params.stage) conditions.push(eq(delinquencyNotices.noticeStage, params.stage as any));

  return db
    .select()
    .from(delinquencyNotices)
    .where(and(...conditions))
    .orderBy(desc(delinquencyNotices.createdAt))
    .limit(params.limit ?? 100);
}
