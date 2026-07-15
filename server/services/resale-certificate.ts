/**
 * CT resale / "6(d)" certificate — DB-gathering glue (founder-os#8013).
 *
 * Thin layer between the DB and the PURE generator
 * (`resale-certificate-service.ts`). It LIVE-QUERIES the owner ledger, budget,
 * insurance, and delinquency-aging tables for one unit, folds in the
 * board-supplied attestation inputs (reserves §47-270(a)(5), judgments/suits,
 * declaration restrictions, statutory-agent identity, etc.), then calls
 * `buildResaleCertificateDocument`. No §47-270 logic lives here — it lives in
 * the pure service (testable without a DB). Mirrors `account-statement.ts`.
 *
 * IMPORTANT: this does NOT import `./ct-reserve-disclosure` (#8016 — not on
 * main). The reserve amount + basis (§47-270(a)(5)) are board-supplied INPUTS.
 * TODO(#8013): once #8016 (reserveDisclosureDollars/reserveDisclosureBasis)
 * merges, default the reserve input from it.
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  associations,
  budgetVersions,
  budgetLines,
  budgets,
  collectionsHandoffs,
  delinquencyEscalations,
  associationInsurancePolicies,
  ownerLedgerEntries,
  persons,
  units,
} from "@shared/schema";
import {
  buildResaleCertificateDocument,
  RESALE_CERTIFICATE_DELINQUENCY_DISCLOSURE_DAYS,
  RESALE_CERTIFICATE_FORECLOSURE_LOOKBACK_MONTHS,
  resaleCertificateFeeUsd,
  type ResaleCertificateDocument,
  type ResaleCertificateInputs,
  type ResaleCertificateLedgerEntry,
} from "./resale-certificate-service";

/** Board-supplied inputs that can't be derived from the financial tables. */
export interface ResaleCertificateBoardInputs {
  expedited?: boolean;
  purchaserName?: string | null;
  /** §47-270(a)(5) reserve for capital expenditures (board-declared). */
  reserveForCapitalExpendituresUsd: number;
  reserveBasis?: string | null;
  /** §47-270(a)(1). */
  rightsOfFirstRefusalOrRestraints?: string[];
  /** §47-270(a)(7). */
  unsatisfiedJudgments?: string[];
  pendingSuits?: string[];
  /** §47-270(a)(9). */
  alienationProceedsRestrictions?: string[];
  /** §47-270(a)(10) — cooperatives only. */
  isCooperative?: boolean;
  cooperativeTaxDeductibilityStatement?: string | null;
  /** §47-270(a)(11) — when association is unincorporated. */
  isIncorporated?: boolean;
  statutoryAgentName?: string | null;
  /** §47-270(a)(12). */
  pendingCommonElementSalesOrEncumbrances?: string[];
  /** §47-270(a)(13). */
  useOrOccupancyRestrictions?: string[];
  /** §47-270(a)(15) — override the derived foreclosure count when the board
   *  has a precise figure (statute counts foreclosure ACTIONS, not handoffs). */
  foreclosureActionsPastTwelveMonths?: number;
  /** Recurring periodic common-expense assessment (e.g. monthly dues). */
  periodicCommonExpenseAssessment: number;
  attestation: { boardMemberName: string; validityDays?: number };
}

export interface GatherResaleCertificateInput extends ResaleCertificateBoardInputs {
  associationId: string;
  unitId: string;
  personId: string;
  state?: string; // defaults "CT"
  requestedAt?: Date; // defaults now
}

/**
 * Gather live data + board inputs and produce the §47-270 certificate document.
 * Returns null when the unit/person/association can't be resolved (tenant fence).
 */
export async function gatherResaleCertificateInputs(
  input: GatherResaleCertificateInput,
): Promise<{ document: ResaleCertificateDocument; feeUsd: number } | null> {
  const state = input.state ?? "CT";
  const requestedAt = input.requestedAt ?? new Date();
  const generatedAt = requestedAt;

  // Tenant fence: association.
  const [assoc] = await db
    .select({ id: associations.id, name: associations.name })
    .from(associations)
    .where(eq(associations.id, input.associationId))
    .limit(1);
  if (!assoc) return null;

  // Unit (must belong to association).
  const [unit] = await db
    .select({ unitNumber: units.unitNumber, building: units.building })
    .from(units)
    .where(and(eq(units.id, input.unitId), eq(units.associationId, input.associationId)))
    .limit(1);
  if (!unit) return null;

  // Selling owner (must belong to association).
  const [owner] = await db
    .select({ firstName: persons.firstName, lastName: persons.lastName })
    .from(persons)
    .where(and(eq(persons.id, input.personId), eq(persons.associationId, input.associationId)))
    .limit(1);
  if (!owner) return null;

  // §47-270(a)(2)-(3): owner ledger for THIS unit (tenant + unit + owner scoped).
  const ledgerRows = await db
    .select({
      entryType: ownerLedgerEntries.entryType,
      amountCents: ownerLedgerEntries.amountCents,
      description: ownerLedgerEntries.description,
      referenceType: ownerLedgerEntries.referenceType,
    })
    .from(ownerLedgerEntries)
    .where(
      and(
        eq(ownerLedgerEntries.associationId, input.associationId),
        eq(ownerLedgerEntries.unitId, input.unitId),
        eq(ownerLedgerEntries.personId, input.personId),
      ),
    );
  const ownerLedger: ResaleCertificateLedgerEntry[] = ledgerRows.map((r) => ({
    entryType: r.entryType,
    amount: r.amountCents / 100,
    description: r.description,
    referenceType: r.referenceType,
  }));

  // §47-270(a)(6): current operating budget — latest ratified version's lines.
  const currentOperatingBudget = await loadCurrentOperatingBudget(input.associationId);

  // §47-270(a)(8): insurance coverage incl. schedule.
  const policyRows = await db
    .select({
      policyType: associationInsurancePolicies.policyType,
      carrier: associationInsurancePolicies.carrier,
      policyNumber: associationInsurancePolicies.policyNumber,
      coverageAmount: associationInsurancePolicies.coverageAmount,
      expirationDate: associationInsurancePolicies.expirationDate,
    })
    .from(associationInsurancePolicies)
    .where(eq(associationInsurancePolicies.associationId, input.associationId));

  // §47-270(a)(14): units 60+ days delinquent (active aging rows, balance > 0).
  const delinqRows = await db
    .select({ unitId: delinquencyEscalations.unitId })
    .from(delinquencyEscalations)
    .where(
      and(
        eq(delinquencyEscalations.associationId, input.associationId),
        eq(delinquencyEscalations.status, "active"),
        gte(delinquencyEscalations.daysPastDue, RESALE_CERTIFICATE_DELINQUENCY_DISCLOSURE_DAYS),
        sql`${delinquencyEscalations.balance} > 0`,
      ),
    );
  const unitsSixtyPlusDaysDelinquent = new Set(delinqRows.map((r) => r.unitId)).size;

  // §47-270(a)(15): foreclosure actions in the past 12 months. Statute counts
  // ACTIONS; we derive a best-effort count from collections handoffs that
  // reached the "judgment" stage in the lookback window, overridable by the
  // board's precise figure.
  let foreclosureActionsPastTwelveMonths = input.foreclosureActionsPastTwelveMonths;
  if (foreclosureActionsPastTwelveMonths === undefined) {
    const lookback = new Date(generatedAt.getTime());
    lookback.setUTCMonth(lookback.getUTCMonth() - RESALE_CERTIFICATE_FORECLOSURE_LOOKBACK_MONTHS);
    const fcRows = await db
      .select({ id: collectionsHandoffs.id })
      .from(collectionsHandoffs)
      .where(
        and(
          eq(collectionsHandoffs.associationId, input.associationId),
          eq(collectionsHandoffs.status, "judgment"),
          gte(collectionsHandoffs.referralDate, lookback),
        ),
      );
    foreclosureActionsPastTwelveMonths = fcRows.length;
  }

  const inputs: ResaleCertificateInputs = {
    state,
    association: {
      name: assoc.name,
      isIncorporated: input.isIncorporated ?? true,
      statutoryAgentName: input.statutoryAgentName ?? null,
      isCooperative: input.isCooperative ?? false,
    },
    unit: { unitNumber: unit.unitNumber, building: unit.building },
    sellingOwnerName: `${owner.firstName} ${owner.lastName}`.trim(),
    purchaserName: input.purchaserName ?? null,
    request: { requestedAt, expedited: Boolean(input.expedited) },
    rightsOfFirstRefusalOrRestraints: input.rightsOfFirstRefusalOrRestraints ?? [],
    periodicCommonExpenseAssessment: input.periodicCommonExpenseAssessment,
    ownerLedger,
    // §47-270(a)(4) capex is derived from the budget; the pure fn already
    // filters > $1,000. We surface ratified budget lines flagged as capital via
    // naming convention is out of scope — the board supplies capex separately in
    // a later iteration. For now derive none here (board can add via notes).
    approvedCapitalExpenditures: [],
    reserveForCapitalExpendituresUsd: input.reserveForCapitalExpendituresUsd,
    reserveBasis: input.reserveBasis ?? null,
    currentOperatingBudget,
    unsatisfiedJudgments: input.unsatisfiedJudgments ?? [],
    pendingSuits: input.pendingSuits ?? [],
    insurancePolicies: policyRows.map((p) => ({
      policyType: p.policyType,
      carrier: p.carrier,
      policyNumber: p.policyNumber,
      coverageAmount: p.coverageAmount,
      expirationDate: p.expirationDate ?? null,
    })),
    alienationProceedsRestrictions: input.alienationProceedsRestrictions ?? [],
    cooperativeTaxDeductibilityStatement: input.cooperativeTaxDeductibilityStatement ?? null,
    pendingCommonElementSalesOrEncumbrances: input.pendingCommonElementSalesOrEncumbrances ?? [],
    useOrOccupancyRestrictions: input.useOrOccupancyRestrictions ?? [],
    unitsSixtyPlusDaysDelinquent,
    foreclosureActionsPastTwelveMonths,
    attestation: input.attestation,
    generatedAt,
  };

  return {
    document: buildResaleCertificateDocument(inputs),
    feeUsd: resaleCertificateFeeUsd(Boolean(input.expedited)),
  };
}

/** §47-270(a)(6): latest ratified budget version + its lines. */
async function loadCurrentOperatingBudget(
  associationId: string,
): Promise<ResaleCertificateInputs["currentOperatingBudget"]> {
  // Most recent budget for the association (by fiscal year).
  const [budget] = await db
    .select({ id: budgets.id, fiscalYear: budgets.fiscalYear })
    .from(budgets)
    .where(eq(budgets.associationId, associationId))
    .orderBy(sql`${budgets.fiscalYear} DESC`)
    .limit(1);
  if (!budget) return null;

  // Latest ratified version (fall back to highest version number).
  const versions = await db
    .select({ id: budgetVersions.id, versionNumber: budgetVersions.versionNumber, status: budgetVersions.status })
    .from(budgetVersions)
    .where(eq(budgetVersions.budgetId, budget.id))
    .orderBy(sql`${budgetVersions.versionNumber} DESC`);
  const ratifiedVersion = versions.find((v) => v.status === "ratified");
  const chosen = ratifiedVersion ?? versions[0];
  if (!chosen) return null;

  const lines = await db
    .select({ lineItemName: budgetLines.lineItemName, plannedAmount: budgetLines.plannedAmount })
    .from(budgetLines)
    .where(eq(budgetLines.budgetVersionId, chosen.id));

  return {
    fiscalYear: budget.fiscalYear,
    lines: lines.map((l) => ({ lineItemName: l.lineItemName, plannedAmount: l.plannedAmount })),
    ratified: Boolean(ratifiedVersion),
  };
}
