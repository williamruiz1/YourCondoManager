/**
 * Connecticut resale certificate / "6(d)" generator — DB-backed loader.
 *
 * Statutory basis: Conn. Gen. Stat. §47-270 (CIOA resale certificate). This
 * module pulls the LIVE data §47-270(a) requires for a single unit and hands it
 * to the pure assembler in `resale-certificate-template.ts`. The split mirrors
 * account-statement.ts (DB loader) + account-statement-math.ts (pure math) so
 * the assembly is unit-testable without Postgres.
 *
 * Why live data matters: §47-270(c) makes the purchaser NOT liable for any
 * unpaid amount greater than the certificate states — so the figures must be
 * the association's true, current ledger position, never a stale snapshot.
 *
 * Tenant isolation: every query is fenced by `associationId`.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  associations,
  associationInsurancePolicies,
  budgetVersions,
  ownerLedgerEntries,
  recurringChargeSchedules,
  resaleCertificateRequests,
  units,
  persons,
  type InsertResaleCertificateRequest,
  type ResaleCertificateRequest,
} from "@shared/schema";
import {
  assembleResaleCertificate,
  computeSlaDueDate,
  getResaleCertStatuteParams,
  type ResaleCertificate,
  type ResaleCertFieldInput,
} from "./resale-certificate-template";

export { assembleResaleCertificate } from "./resale-certificate-template";
export type { ResaleCertificate } from "./resale-certificate-template";

const DAY_MS = 24 * 60 * 60 * 1000;
const CAPEX_HINT_THRESHOLD = 1000; // §47-270(a)(4): "> $1,000"
const DELINQUENT_DAYS_THRESHOLD = 60; // §47-270(a)(14): "60 or more days"

/**
 * Generate the live §47-270 resale certificate for a unit.
 *
 * Returns null if the unit doesn't belong to the association (tenant fence).
 */
export async function buildResaleCertificate(input: {
  associationId: string;
  unitId: string;
  generatedAt?: Date;
}): Promise<ResaleCertificate | null> {
  const { associationId, unitId } = input;
  const generatedAt = input.generatedAt ?? new Date();

  // ── Association + unit header (tenant fence) ──────────────────────────────
  const [assoc] = await db
    .select({ name: associations.name, state: associations.state })
    .from(associations)
    .where(eq(associations.id, associationId))
    .limit(1);
  if (!assoc) return null;

  const [unit] = await db
    .select({ unitNumber: units.unitNumber, building: units.building })
    .from(units)
    .where(and(eq(units.id, unitId), eq(units.associationId, associationId)))
    .limit(1);
  if (!unit) return null; // unit not in this association → no cert (no leak)

  // ── (a)(2) periodic assessment + unpaid balance for the unit ──────────────
  const unitLedger = await db
    .select({
      entryType: ownerLedgerEntries.entryType,
      amount: ownerLedgerEntries.amount,
      postedAt: ownerLedgerEntries.postedAt,
    })
    .from(ownerLedgerEntries)
    .where(
      and(
        eq(ownerLedgerEntries.associationId, associationId),
        eq(ownerLedgerEntries.unitId, unitId),
      ),
    );

  // Signed sum; positive = owes (matches storage.getOwnerLedgerSummary +
  // account-statement-math: charges/assessments/late-fees positive, payments/
  // credits negative).
  const unitBalance = round2(
    unitLedger.reduce((acc, e) => acc + e.amount, 0),
  );
  const unpaidAssessment = unitBalance > 0 ? unitBalance : 0;

  // (a)(3) "other fees" = gross late-fee + non-assessment charge total on the
  // account. Reported gross (not payment-allocated) and labeled as such by the
  // assembler so it is never mistaken for a derived net-unpaid-by-category.
  const otherFees = round2(
    unitLedger
      .filter((e) => e.entryType === "late-fee" || e.entryType === "charge")
      .reduce((acc, e) => acc + e.amount, 0),
  );

  // Current periodic assessment: active assessment recurring schedules that
  // apply to this unit (all-units, the legacy single-unit binding, or an
  // inclusion list containing the unit). Summed as the current periodic figure.
  const schedules = await db
    .select()
    .from(recurringChargeSchedules)
    .where(
      and(
        eq(recurringChargeSchedules.associationId, associationId),
        eq(recurringChargeSchedules.status, "active"),
        eq(recurringChargeSchedules.entryType, "assessment"),
      ),
    );
  let periodicAssessment: number | null = null;
  for (const s of schedules) {
    const applies =
      s.unitScopeMode === "all-units" ||
      (s.unitId !== null && s.unitId === unitId) ||
      (s.unitScopeMode === "inclusion-list" &&
        Array.isArray(s.includedUnitIdsJson) &&
        s.includedUnitIdsJson.includes(unitId));
    if (applies) periodicAssessment = round2((periodicAssessment ?? 0) + s.amount);
  }

  // ── (a)(6) current operating budget + (a)(4) capex hints ──────────────────
  const { operatingBudgetTotal, capitalExpenditureHints } =
    await loadBudgetFigures(associationId, generatedAt);

  // ── (a)(8) association insurance summary ──────────────────────────────────
  const insuranceSummary = await loadInsuranceSummary(associationId);

  // ── (a)(14) units 60+ days delinquent (association-wide) ──────────────────
  const unitsDelinquent60Plus = await countUnitsDelinquent60Plus(
    associationId,
    generatedAt,
  );

  const fieldInput: ResaleCertFieldInput = {
    periodicAssessment,
    unpaidAssessment,
    otherFees,
    capitalExpenditureHints,
    reservesTotal: null, // §47-270(a)(5) owned by reserve-disclosure (#8016)
    operatingBudgetTotal,
    insuranceSummary,
    unitsDelinquent60Plus,
  };

  return assembleResaleCertificate({
    state: assoc.state,
    associationId,
    associationName: assoc.name,
    unitId,
    unitNumber: unit.unitNumber,
    building: unit.building ?? null,
    generatedAt,
    fieldInput,
  });
}

/**
 * Load the current operating-budget total + the capital-expenditure hint list
 * (>$1,000 budget lines) from the association's ratified budget version.
 */
async function loadBudgetFigures(
  associationId: string,
  asOf: Date,
): Promise<{
  operatingBudgetTotal: number | null;
  capitalExpenditureHints: Array<{ name: string; amount: number }>;
}> {
  const budgets = await storage.getBudgets(associationId);
  if (budgets.length === 0) {
    return { operatingBudgetTotal: null, capitalExpenditureHints: [] };
  }

  // Prefer the budget whose period spans `asOf`; else the latest fiscal year.
  const spanning = budgets.find(
    (b) =>
      b.periodStart &&
      b.periodEnd &&
      new Date(b.periodStart).getTime() <= asOf.getTime() &&
      asOf.getTime() <= new Date(b.periodEnd).getTime(),
  );
  const budget =
    spanning ??
    [...budgets].sort((a, b) => b.fiscalYear - a.fiscalYear)[0];

  // Newest RATIFIED version (the legally operative budget).
  const versions = await db
    .select()
    .from(budgetVersions)
    .where(
      and(
        eq(budgetVersions.budgetId, budget.id),
        eq(budgetVersions.status, "ratified"),
      ),
    )
    .orderBy(desc(budgetVersions.versionNumber));
  const ratified = versions[0];
  if (!ratified) return { operatingBudgetTotal: null, capitalExpenditureHints: [] };

  const lines = await storage.getBudgetLines(ratified.id);
  if (lines.length === 0) {
    return { operatingBudgetTotal: 0, capitalExpenditureHints: [] };
  }

  const operatingBudgetTotal = round2(
    lines.reduce((acc, l) => acc + (l.plannedAmount ?? 0), 0),
  );
  const capitalExpenditureHints = lines
    .filter((l) => (l.plannedAmount ?? 0) > CAPEX_HINT_THRESHOLD)
    .map((l) => ({ name: l.lineItemName, amount: round2(l.plannedAmount) }));

  return { operatingBudgetTotal, capitalExpenditureHints };
}

/** Summarize the association's master/liability insurance for §47-270(a)(8). */
async function loadInsuranceSummary(
  associationId: string,
): Promise<string | null> {
  const policies = await db
    .select()
    .from(associationInsurancePolicies)
    .where(
      and(
        eq(associationInsurancePolicies.associationId, associationId),
        inArray(associationInsurancePolicies.policyType, [
          "master",
          "liability",
          "umbrella",
        ]),
      ),
    );
  if (policies.length === 0) return null;

  return policies
    .map((p) => {
      const coverage =
        p.coverageAmount != null
          ? `$${p.coverageAmount.toLocaleString("en-US")}`
          : "coverage on file";
      const exp = p.expirationDate
        ? ` (exp ${new Date(p.expirationDate).toISOString().slice(0, 10)})`
        : "";
      const num = p.policyNumber ? ` #${p.policyNumber}` : "";
      return `${p.policyType}: ${p.carrier}${num} — ${coverage}${exp}`;
    })
    .join("; ");
}

/**
 * Count association units that are 60+ days delinquent (§47-270(a)(14)).
 *
 * Per-unit balance = signed ledger sum (positive = owes). Days delinquent is
 * measured from the oldest unpaid charge/assessment posting (the same
 * approximation the delinquency-escalation route uses). A unit counts when it
 * owes a positive balance AND its oldest charge is >= 60 days old.
 */
async function countUnitsDelinquent60Plus(
  associationId: string,
  asOf: Date,
): Promise<number> {
  const entries = await storage.getOwnerLedgerEntries(associationId);
  const perUnit = new Map<string, { balance: number; oldestCharge: Date | null }>();
  for (const e of entries) {
    const cur = perUnit.get(e.unitId) ?? { balance: 0, oldestCharge: null };
    cur.balance += e.amount;
    if (
      (e.entryType === "charge" || e.entryType === "assessment") &&
      e.postedAt
    ) {
      const d = new Date(e.postedAt);
      if (!cur.oldestCharge || d < cur.oldestCharge) cur.oldestCharge = d;
    }
    perUnit.set(e.unitId, cur);
  }

  let count = 0;
  for (const u of perUnit.values()) {
    if (u.balance <= 0) continue; // positive = owes
    const days = u.oldestCharge
      ? Math.floor((asOf.getTime() - u.oldestCharge.getTime()) / DAY_MS)
      : 0;
    if (days >= DELINQUENT_DAYS_THRESHOLD) count += 1;
  }
  return count;
}

// ── Request workflow (§47-270(b): 10-business-day SLA + $185 fee) ────────────

/**
 * Create a resale-certificate request. Computes the §47-270(b) furnishing
 * deadline (10 business days) and assesses the §47-270(b)(1) statutory fee
 * server-side (never trusted from the client). The unit must belong to the
 * association (tenant fence) — returns null otherwise.
 */
export async function createResaleCertificateRequest(input: {
  associationId: string;
  unitId: string;
  sellerPersonId?: string | null;
  requestedByName?: string | null;
  requestedByEmail?: string | null;
  copyFeeCents?: number;
  expediteFeeCents?: number;
  notes?: string | null;
  now?: Date;
}): Promise<ResaleCertificateRequest | null> {
  const now = input.now ?? new Date();

  // Tenant fence — unit + (optional) seller must belong to the association.
  const [unit] = await db
    .select({ id: units.id })
    .from(units)
    .where(and(eq(units.id, input.unitId), eq(units.associationId, input.associationId)))
    .limit(1);
  if (!unit) return null;

  if (input.sellerPersonId) {
    const [seller] = await db
      .select({ id: persons.id })
      .from(persons)
      .where(
        and(
          eq(persons.id, input.sellerPersonId),
          eq(persons.associationId, input.associationId),
        ),
      )
      .limit(1);
    if (!seller) return null;
  }

  const [assoc] = await db
    .select({ state: associations.state })
    .from(associations)
    .where(eq(associations.id, input.associationId))
    .limit(1);
  const params = getResaleCertStatuteParams(assoc?.state);

  const slaDueAt = computeSlaDueDate(now, params.slaBusinessDays);

  const values: InsertResaleCertificateRequest = {
    associationId: input.associationId,
    unitId: input.unitId,
    sellerPersonId: input.sellerPersonId ?? null,
    requestedByName: input.requestedByName ?? null,
    requestedByEmail: input.requestedByEmail ?? null,
    state: params.state,
    status: "requested",
    requestedAt: now,
    slaDueAt,
    statutoryFeeCents: params.statutoryFeeCents,
    copyFeeCents: input.copyFeeCents ?? 0,
    expediteFeeCents: input.expediteFeeCents ?? 0,
    notes: input.notes ?? null,
  };

  const [row] = await db
    .insert(resaleCertificateRequests)
    .values(values)
    .returning();
  return row;
}

/**
 * Generate the certificate for an existing request and persist the live-ledger
 * snapshot + validity window. Advances the request to "generated".
 */
export async function generateForRequest(input: {
  associationId: string;
  requestId: string;
  now?: Date;
}): Promise<{ request: ResaleCertificateRequest; certificate: ResaleCertificate } | null> {
  const now = input.now ?? new Date();
  const [request] = await db
    .select()
    .from(resaleCertificateRequests)
    .where(
      and(
        eq(resaleCertificateRequests.id, input.requestId),
        eq(resaleCertificateRequests.associationId, input.associationId),
      ),
    )
    .limit(1);
  if (!request) return null;

  const certificate = await buildResaleCertificate({
    associationId: input.associationId,
    unitId: request.unitId,
    generatedAt: now,
  });
  if (!certificate) return null;

  const [updated] = await db
    .update(resaleCertificateRequests)
    .set({
      status: request.status === "requested" ? "generated" : request.status,
      generatedAt: now,
      certValidUntil: new Date(certificate.validUntil),
      generatedSnapshotJson: certificate as unknown as Record<string, unknown>,
      updatedAt: now,
    })
    .where(eq(resaleCertificateRequests.id, request.id))
    .returning();

  return { request: updated, certificate };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
