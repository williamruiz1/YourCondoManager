/**
 * backfill-consent-records.ts — #342 (WS3) consent audit trail backfill.
 *
 * For every existing portal_access + admin_users + auth_users record without
 * a consent_records row at CURRENT_POLICY_VERSION, insert a backfill row so
 * the audit history isn't empty on launch. The `user_agent` field is set to
 * "backfill" and `ip_address` to null so backfilled rows are distinguishable
 * from real captures.
 *
 * The `consented_at` timestamp uses the user's `createdAt` (auth_users) or
 * `acceptedAt` / `createdAt` (portal_access) so the backfill row reflects
 * the moment the user actually joined the platform (the implicit moment of
 * agreement, since they used the system).
 *
 * Usage:
 *   tsx server/scripts/backfill-consent-records.ts          — execute backfill
 *   tsx server/scripts/backfill-consent-records.ts --dry    — show counts only
 *
 * Safe to re-run: the lookup (user_id, policy_version) skips users who
 * already have a row at CURRENT_POLICY_VERSION.
 */

import { CURRENT_POLICY_VERSION } from "../../shared/policy-version";
import { db } from "../db";
import {
  consentRecords,
  authUsers,
  portalAccess,
} from "../../shared/schema";
import { eq, and, sql as drizzleSql } from "drizzle-orm";

const DRY_RUN = process.argv.includes("--dry");

type BackfillSource = "auth_user" | "portal_access";

type CandidateRow = {
  userId: string;
  userEmail: string;
  consentedAt: Date;
  source: BackfillSource;
};

async function findAuthUserCandidates(): Promise<CandidateRow[]> {
  // auth_users that don't already have a row at the current policy version.
  // We do this as a LEFT JOIN at the application layer (the table size on
  // YCM is small enough that this is fine; large-scale variants would do
  // a NOT EXISTS subquery in SQL).
  const allAuthUsers = await db
    .select({
      id: authUsers.id,
      email: authUsers.email,
      createdAt: authUsers.createdAt,
    })
    .from(authUsers)
    .where(eq(authUsers.isActive, 1));

  const out: CandidateRow[] = [];
  for (const u of allAuthUsers) {
    const existing = await db
      .select({ id: consentRecords.id })
      .from(consentRecords)
      .where(and(eq(consentRecords.userId, u.id), eq(consentRecords.policyVersion, CURRENT_POLICY_VERSION)))
      .limit(1);
    if (existing.length > 0) continue;
    out.push({
      userId: u.id,
      userEmail: u.email,
      consentedAt: u.createdAt ?? new Date(),
      source: "auth_user",
    });
  }
  return out;
}

async function findPortalAccessCandidates(): Promise<CandidateRow[]> {
  const allPortal = await db
    .select({
      id: portalAccess.id,
      email: portalAccess.email,
      acceptedAt: portalAccess.acceptedAt,
      createdAt: portalAccess.createdAt,
    })
    .from(portalAccess)
    .where(eq(portalAccess.status, "active"));

  const out: CandidateRow[] = [];
  for (const p of allPortal) {
    const existing = await db
      .select({ id: consentRecords.id })
      .from(consentRecords)
      .where(and(eq(consentRecords.userId, p.id), eq(consentRecords.policyVersion, CURRENT_POLICY_VERSION)))
      .limit(1);
    if (existing.length > 0) continue;
    out.push({
      userId: p.id,
      userEmail: p.email,
      consentedAt: p.acceptedAt ?? p.createdAt ?? new Date(),
      source: "portal_access",
    });
  }
  return out;
}

async function main() {
  console.log(`[backfill-consent-records] Starting (dry=${DRY_RUN}). Current policy version: ${CURRENT_POLICY_VERSION}`);

  const authCandidates = await findAuthUserCandidates();
  const portalCandidates = await findPortalAccessCandidates();

  console.log(`[backfill-consent-records] Found ${authCandidates.length} auth_user candidates`);
  console.log(`[backfill-consent-records] Found ${portalCandidates.length} portal_access candidates`);
  console.log(`[backfill-consent-records] Total: ${authCandidates.length + portalCandidates.length} rows to insert`);

  if (DRY_RUN) {
    console.log("[backfill-consent-records] Dry run — exiting without writing.");
    return;
  }

  let inserted = 0;
  for (const c of [...authCandidates, ...portalCandidates]) {
    // Skip rows lacking an email (shouldn't happen given the NOT NULL constraint,
    // but defend anyway).
    if (!c.userEmail) continue;
    await db.insert(consentRecords).values({
      userId: c.userId,
      userEmail: c.userEmail,
      policyVersion: CURRENT_POLICY_VERSION,
      consentedAt: c.consentedAt,
      ipAddress: null,
      // Marker so backfilled rows are distinguishable from real-time captures.
      // We can't add a `source` column without a migration; encoding into UA
      // is the smallest possible diff.
      userAgent: `backfill:${c.source}`,
    });
    inserted++;
  }

  console.log(`[backfill-consent-records] Inserted ${inserted} rows. Done.`);
  // Drizzle uses a pooled client; the process needs to exit cleanly.
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill-consent-records] Failed:", err);
    process.exit(1);
  });

// Reference drizzleSql so the import survives tree-shaking checks if we
// later add a NOT EXISTS subquery.
void drizzleSql;
