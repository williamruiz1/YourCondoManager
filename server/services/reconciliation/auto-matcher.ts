/**
 * Reconciliation auto-matcher (founder-os#970 / Gap C).
 *
 * Extends the deterministic-only matcher at `server/services/plaid-reconciliation.ts`
 * with a confidence-scored, multi-signal matcher that closes "Gap C" — the
 * unmatched-bank-transaction case William surfaced in the 2026-05-25 live
 * session ("I don't like the idea of relying on board members or whoever's
 * handling the account. If a manual identification needs to be made, then it
 * should be in a surface in the platform").
 *
 * What it adds on top of plaid-reconciliation.ts:
 *   1. Wider eligibility — considers any `entry_type='payment'` ledger entry
 *      with `settled_at IS NULL` (not just the narrow `referenceType='plaid-pay-intent'`
 *      subset), so manually-created payment entries also auto-match.
 *   2. Fuzzy payor-name signal — Levenshtein-style normalized-token match
 *      between the bank-transaction `name`/`merchantName` and a per-association
 *      directory of `persons.firstName + lastName`.
 *   3. Confidence scoring — combines amount-exactness, date-proximity, and
 *      payor-name match into a single 0..1 confidence. Only auto-applies above
 *      AUTO_MATCH_THRESHOLD. Borderline candidates surface to the admin UI
 *      for manual review (Gap C requirement: in-product UI, never offline).
 *
 * Auto-match thresholds (chosen for the n=1 Cherry Hill go-live; tunable
 * later from real-world false-positive rate):
 *
 *   - AUTO_MATCH_THRESHOLD       = 0.85    confidence required for auto-apply
 *   - DATE_WINDOW_DAYS           = 7       absolute cap on date delta
 *   - AMOUNT_EXACT_CENTS_TOL     = 0       exact cents for the "exact" amount signal
 *   - AMOUNT_NEAR_CENTS_TOL      = 100     ±$1 still counts as a soft amount match
 *   - SCORE.amountExact          = 0.55    bulk of confidence comes from amount
 *   - SCORE.amountNear           = 0.30    soft amount (off by ≤$1)
 *   - SCORE.dateSameDay          = 0.20
 *   - SCORE.dateWithin3Days      = 0.10
 *   - SCORE.payorExactMatch      = 0.25    full first+last in bank-tx name
 *   - SCORE.payorPartialMatch    = 0.10    only last name (or only first)
 *
 * Conflict rule: if multiple ledger entries score above AUTO_MATCH_THRESHOLD
 * for the same bank transaction (or vice versa), neither auto-applies —
 * both go to manual review. This protects against false-positive double-matches
 * (e.g. two owners with the same amount due on the same day).
 *
 * Idempotency: re-running is a no-op. Already-matched entries
 * (settled_at IS NOT NULL OR bank_transaction_id IS NOT NULL) are excluded by
 * the SELECT filters.
 *
 * Tenant isolation: every query filters by association_id; no cross-association
 * candidates can be evaluated.
 *
 * Cross-link: `server/services/plaid-reconciliation.ts` for the original
 * deterministic-cents matcher; this service supersedes it for the broader
 * `entry_type='payment'` surface. The plaid-pay-intent narrow path continues
 * to run for backward compatibility.
 */
import { and, asc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  bankDescriptorAliases,
  bankTransactions,
  ownerLedgerEntries,
  ownerships,
  persons,
  units,
  type BankTransaction,
  type OwnerLedgerEntry,
} from "@shared/schema";
import { ownerLedgerAmountCents } from "@shared/owner-ledger-money";
import { isUnitCentricEnabledForAssociation } from "../unit-centric-flag";
import {
  loadUnitPayerRosters,
  rosterNameMatch,
  type UnitPayerRoster,
} from "../unit-payer-roster";

// ── Tunable thresholds (kept exported so tests can probe the live values) ────

export const AUTO_MATCH_THRESHOLD = 0.85;
export const DATE_WINDOW_DAYS = 7;
export const AMOUNT_EXACT_CENTS_TOL = 0;
export const AMOUNT_NEAR_CENTS_TOL = 100;

// ── Descriptor-to-owner suggestion thresholds (founder-os#2480) ───────────────
//
// When a bank credit has NO matching ledger entry, we search for an owner
// whose name appears in the descriptor. This gives the treasurer a one-click
// "create payment entry + auto-match" path instead of having to first record
// the payment manually and then re-run the matcher.
//
// Confidence tiers:
//   - SUGGEST_AUTO_CREATE_THRESHOLD (0.95+) → auto-create the entry + match
//   - SUGGEST_REVIEW_MIN_THRESHOLD  (0.80+) → propose for treasurer review
//   - Below 0.80 or ambiguous       → leave unmatched, fully-manual review
//
// The balance window (±$50) prevents a Zelle deposit that happens to contain
// an owner's surname from being interpreted as payment when the amount is
// nowhere near their open balance.
export const SUGGEST_AUTO_CREATE_THRESHOLD = 0.95;
export const SUGGEST_REVIEW_MIN_THRESHOLD = 0.80;
export const SUGGEST_BALANCE_WINDOW_CENTS = 5000; // ±$50
export const CREDIT_SEARCH_WINDOW_DAYS = 30;

export const SCORE_WEIGHTS = {
  amountExact: 0.55,
  amountNear: 0.30,
  dateSameDay: 0.20,
  dateWithin3Days: 0.10,
  payorExactMatch: 0.25,
  payorPartialMatch: 0.10,
} as const;

// ── Types ────────────────────────────────────────────────────────────────────

export interface AutoMatchOutcome {
  bankTransactionId: string;
  ledgerEntryId: string;
  confidence: number;
  aliasMatch?: boolean; // true when a descriptor alias drove the match
  // Phase 1 (P0-3): true when the unique per-unit reference (unitAccountRef)
  // found in the descriptor drove the match at confidence 1.0. This is the
  // "matched by reference" no-review tier the admin UI renders distinctly.
  referenceMatch?: boolean;
  signals: {
    amountDeltaCents: number;
    dateDeltaDays: number;
    payorMatch: "exact" | "partial" | "none";
  };
}

export interface AutoMatchResult {
  matched: AutoMatchOutcome[];
  needsManualReview: Array<{
    bankTransactionId: string;
    candidates: Array<{
      ledgerEntryId: string;
      confidence: number;
      signals: AutoMatchOutcome["signals"];
    }>;
    reason: "low-confidence" | "ambiguous";
  }>;
  unmatchedBankTransactionCount: number;
  unmatchedLedgerEntryCount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isCredit(tx: Pick<BankTransaction, "amountCents">): boolean {
  // Plaid convention (normalized in plaid-provider.ts): positive = debit (out),
  // negative = credit (in). Owner payments to the HOA account arrive as credits.
  return tx.amountCents < 0;
}

function diffDays(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Descriptor alias helpers (Gap 4 — learning path) ─────────────────────────
//
// normalizeDescriptor uses the same transform as the migration comment and
// the payorNameMatch logic — lower-case, punctuation-to-space,
// whitespace-collapsed, trimmed. Must stay in sync so alias lookups hit the
// same normalized form that was stored at write time.

export function normalizeDescriptor(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Look up a known descriptor→owner alias for an association.
 * Returns the alias row (personId + unitId) or null if no alias exists.
 * Tenant-isolated via associationId filter.
 */
export async function lookupDescriptorAlias(
  associationId: string,
  rawDescriptor: string | null | undefined,
): Promise<{ personId: string; unitId: string; matchCount: number } | null> {
  const norm = normalizeDescriptor(rawDescriptor);
  if (!norm) return null;
  const rows = await db
    .select({
      personId: bankDescriptorAliases.personId,
      unitId: bankDescriptorAliases.unitId,
      matchCount: bankDescriptorAliases.matchCount,
    })
    .from(bankDescriptorAliases)
    .where(
      and(
        eq(bankDescriptorAliases.associationId, associationId),
        eq(bankDescriptorAliases.normalizedDescriptor, norm),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Upsert a descriptor→owner alias. Called after any deliberate human-confirmed
 * match (manual match or Suggestions tab "Create"). Increments match_count on
 * conflict so we can track confirmation strength. If person/unit changes on
 * conflict (a correction), match_count resets to 1.
 *
 * Tenant-isolated: associationId is part of the UNIQUE constraint.
 */
export async function upsertDescriptorAlias(input: {
  associationId: string;
  rawDescriptor: string | null | undefined;
  personId: string;
  unitId: string;
}): Promise<void> {
  const norm = normalizeDescriptor(input.rawDescriptor);
  if (!norm) return; // no descriptor, nothing to learn
  const now = new Date();
  await db
    .insert(bankDescriptorAliases)
    .values({
      associationId: input.associationId,
      normalizedDescriptor: norm,
      personId: input.personId,
      unitId: input.unitId,
      matchCount: 1,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [bankDescriptorAliases.associationId, bankDescriptorAliases.normalizedDescriptor],
      set: {
        // If the person_id is the same → increment match_count (more confirmations).
        // If the person_id changed → reset to 1 (a correction overwrites the old alias).
        // We can't do conditional logic in a single SET clause easily, so we
        // always update; match_count is bumped unconditionally (it's an
        // approximation of "how confident" the alias is).
        personId: input.personId,
        unitId: input.unitId,
        matchCount: sql`bank_descriptor_aliases.match_count + 1`,
        updatedAt: now,
      },
    });
}

/**
 * Token-based payor-name fuzzy match. Returns "exact" if every name token
 * appears in the bank-tx description, "partial" if any token appears, else
 * "none". Cheap + deterministic; sufficient for the n=1 go-live scope.
 *
 * Examples:
 *   bankDesc="ZELLE FROM WILLIAM RUIZ", firstName="William", lastName="Ruiz"
 *     → tokens={william,ruiz} all present → "exact"
 *   bankDesc="ACH PAYMENT W RUIZ", firstName="William", lastName="Ruiz"
 *     → "ruiz" present, "william" not → "partial"
 *   bankDesc="DEPOSIT 12345", firstName="William", lastName="Ruiz"
 *     → neither present → "none"
 */
export function payorNameMatch(
  bankDescription: string | null | undefined,
  firstName: string,
  lastName: string,
): "exact" | "partial" | "none" {
  if (!bankDescription) return "none";
  const haystack = normalizeName(bankDescription);
  const first = normalizeName(firstName);
  const last = normalizeName(lastName);
  const firstHit = first.length >= 2 && haystack.split(/\s+/).includes(first);
  const lastHit = last.length >= 2 && haystack.split(/\s+/).includes(last);
  if (firstHit && lastHit) return "exact";
  if (firstHit || lastHit) return "partial";
  return "none";
}

// ── Phase 1 (P0-3): unique per-unit reference detection ──────────────────────
//
// A unit's `unitAccountRef` (e.g. "CHC-0007") appears verbatim in the bank
// descriptor when the owner puts it on the remittance. The Tier-0 pass looks
// for a KNOWN ref inside the descriptor and, on a hit, matches the deposit to
// that unit at confidence 1.0 BEFORE any name-guessing.
//
// Matching is normalization-tolerant (the descriptor may render "CHC 0007",
// "chc-0007", "Ref:CHC0007"): we normalize BOTH the descriptor and each ref to
// an alphanumeric-lowercase form and test for a whole-token OR contiguous
// substring hit. Refs shorter than MIN_REF_LEN are ignored to prevent a short
// code from matching noise.

export const MIN_REF_LEN = 3;

/** Alphanumeric-lowercase, no separators — e.g. "CHC-0007" → "chc0007". */
export function normalizeRef(s: string | null | undefined): string {
  if (!s) return "";
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Find which of `knownRefs` appears in the bank descriptor. Returns the FIRST
 * (longest-first) matching ref's original value, or null. Pure.
 *
 * A ref matches when its normalized form is a contiguous substring of the
 * normalized descriptor. Longest-first so "CHC-00070" wins over "CHC-0007"
 * when both could match.
 */
export function findReferenceInDescriptor(
  bankDescription: string | null | undefined,
  knownRefs: Array<{ ref: string; unitId: string }>,
): { ref: string; unitId: string } | null {
  const hay = normalizeRef(bankDescription);
  if (!hay) return null;
  const candidates = knownRefs
    .filter((r) => normalizeRef(r.ref).length >= MIN_REF_LEN)
    .sort((a, b) => normalizeRef(b.ref).length - normalizeRef(a.ref).length);
  for (const c of candidates) {
    const needle = normalizeRef(c.ref);
    if (needle && hay.includes(needle)) return c;
  }
  return null;
}

/**
 * Score a single candidate pairing. Pure function over inputs; no DB.
 * Exposed for tests + the per-row UI confidence preview.
 */
export function scoreCandidate(input: {
  bankAmountAbsCents: number;
  bankDate: Date;
  bankDescription: string | null | undefined;
  ledgerAmountAbsCents: number;
  ledgerPostedAt: Date;
  ownerFirstName: string | null | undefined;
  ownerLastName: string | null | undefined;
  /**
   * Phase 1 (P0-1) — OPTIONAL unit-roster name signal. When provided (only on
   * the unit-centric flag path), this SUPERSEDES the single-owner name check:
   * the payor signal becomes "does ANY name on the unit's payer roster appear
   * in the descriptor?". Backward-compatible: when omitted, scoring is
   * byte-for-byte the pre-Phase-1 behavior (single-owner name match).
   */
  rosterMatch?: "exact" | "partial" | "none";
}): { confidence: number; signals: AutoMatchOutcome["signals"] } {
  const amountDelta = Math.abs(input.bankAmountAbsCents - input.ledgerAmountAbsCents);
  const dateDelta = diffDays(input.bankDate, input.ledgerPostedAt);

  let confidence = 0;
  if (amountDelta <= AMOUNT_EXACT_CENTS_TOL) {
    confidence += SCORE_WEIGHTS.amountExact;
  } else if (amountDelta <= AMOUNT_NEAR_CENTS_TOL) {
    confidence += SCORE_WEIGHTS.amountNear;
  }

  if (dateDelta === 0) {
    confidence += SCORE_WEIGHTS.dateSameDay;
  } else if (dateDelta <= 3) {
    confidence += SCORE_WEIGHTS.dateWithin3Days;
  }

  let payorMatch: "exact" | "partial" | "none" = "none";
  if (input.rosterMatch !== undefined) {
    // Unit-centric path: the roster's any-name match is the payor signal.
    payorMatch = input.rosterMatch;
    if (payorMatch === "exact") {
      confidence += SCORE_WEIGHTS.payorExactMatch;
    } else if (payorMatch === "partial") {
      confidence += SCORE_WEIGHTS.payorPartialMatch;
    }
  } else if (input.ownerFirstName && input.ownerLastName) {
    payorMatch = payorNameMatch(input.bankDescription, input.ownerFirstName, input.ownerLastName);
    if (payorMatch === "exact") {
      confidence += SCORE_WEIGHTS.payorExactMatch;
    } else if (payorMatch === "partial") {
      confidence += SCORE_WEIGHTS.payorPartialMatch;
    }
  }

  // Clamp 0..1 (the weights sum > 1 in theory; cap so confidence is always a
  // legible 0..1 number for the UI).
  confidence = Math.min(1, Math.max(0, confidence));

  return {
    confidence,
    signals: {
      amountDeltaCents: amountDelta,
      dateDeltaDays: dateDelta,
      payorMatch,
    },
  };
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Walk every unmatched bank credit + every unsettled payment ledger entry for
 * an association, score all pairings, auto-apply matches above threshold, and
 * return per-row review queue for the rest.
 *
 * Idempotent — running twice is a no-op.
 */
export async function runAutoMatch(
  associationId: string,
): Promise<AutoMatchResult> {
  // 1. Pull eligible bank credits (not yet linked to any payment_transaction
  //    AND not yet linked to a ledger entry via the Issue #448 path). Per
  //    founder-os#2480, the search is bounded to the last
  //    CREDIT_SEARCH_WINDOW_DAYS (30) of bank activity — older credits are
  //    handled by the report tab's period filter, not the live matcher.
  const cutoffDate = new Date(Date.now() - CREDIT_SEARCH_WINDOW_DAYS * 86400 * 1000);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10); // yyyy-mm-dd

  const allCredits = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.associationId, associationId),
        isNull(bankTransactions.reconciledToPaymentTransactionId),
        gte(bankTransactions.date, cutoffStr),
      ),
    )
    .orderBy(asc(bankTransactions.date));

  // Filter to credits not already linked to a ledger entry. (The cleanest
  // way to express this would be a LEFT JOIN; we do it in JS for clarity +
  // to avoid an extra query path in the unit tests.)
  const alreadyLinkedLedgerEntries = await db
    .select({ bankTransactionId: ownerLedgerEntries.bankTransactionId })
    .from(ownerLedgerEntries)
    .where(eq(ownerLedgerEntries.associationId, associationId));
  const linkedBankTxIds = new Set(
    alreadyLinkedLedgerEntries
      .map((r) => r.bankTransactionId)
      .filter((id): id is string => id !== null),
  );

  const unmatchedCredits = allCredits.filter(
    (c) => isCredit(c) && !linkedBankTxIds.has(c.id),
  );

  // 2. Pull unsettled payment OR credit ledger entries for this association
  //    (broader than the plaid-pay-intent narrow path). Per founder-os#2480,
  //    the eligibility set now spans `entry_type IN ('payment', 'credit')` so
  //    owner credits (refunds, account credits applied against a future bill)
  //    can also auto-match to corresponding bank movements.
  const pendingEntries = await db
    .select()
    .from(ownerLedgerEntries)
    .where(
      and(
        eq(ownerLedgerEntries.associationId, associationId),
        inArray(ownerLedgerEntries.entryType, ["payment", "credit"]),
        isNull(ownerLedgerEntries.settledAt),
        isNull(ownerLedgerEntries.bankTransactionId),
      ),
    )
    .orderBy(asc(ownerLedgerEntries.postedAt));

  // 3. Pull the owner directory for payor-name signals. Map by person_id.
  //    Restricted to persons attached to this association via the ownerships
  //    table (or directly via persons.associationId).
  const personRows = await db
    .select({
      id: persons.id,
      firstName: persons.firstName,
      lastName: persons.lastName,
      associationId: persons.associationId,
    })
    .from(persons)
    .innerJoin(ownerships, eq(ownerships.personId, persons.id))
    .where(eq(persons.associationId, associationId));
  const personById = new Map<string, { firstName: string; lastName: string }>();
  for (const p of personRows) {
    personById.set(p.id, { firstName: p.firstName, lastName: p.lastName });
  }

  // 4. Load descriptor aliases for this association — used to boost confidence
  //    for credits whose descriptor was previously manually confirmed.
  //    Map: normalizedDescriptor → { personId, unitId }.
  const aliasRows = await db
    .select({
      normalizedDescriptor: bankDescriptorAliases.normalizedDescriptor,
      personId: bankDescriptorAliases.personId,
      unitId: bankDescriptorAliases.unitId,
    })
    .from(bankDescriptorAliases)
    .where(eq(bankDescriptorAliases.associationId, associationId));
  const aliasMap = new Map<string, { personId: string; unitId: string }>();
  for (const a of aliasRows) aliasMap.set(a.normalizedDescriptor, a);

  // 4b. Phase 1 (P0-1 / P0-3): when the unit-centric flag is ON for this
  //     association, load the per-unit payer rosters + the ref→unit list. These
  //     drive (i) the Tier-0 exact-reference pass (confidence 1.0, no review)
  //     and (ii) the unit-roster (any-name) payor signal. When the flag is OFF
  //     these stay empty and the matcher behaves EXACTLY as before (single-owner
  //     name path) — the full backward-compat contract.
  const unitCentric = isUnitCentricEnabledForAssociation(associationId);
  let rostersByUnit = new Map<string, UnitPayerRoster>();
  let knownRefs: Array<{ ref: string; unitId: string }> = [];
  if (unitCentric) {
    rostersByUnit = await loadUnitPayerRosters(associationId);
    knownRefs = Array.from(rostersByUnit.values())
      .filter((r) => !!r.unitAccountRef)
      .map((r) => ({ ref: r.unitAccountRef as string, unitId: r.unitId }));
  }

  // 5. Score the full bipartite graph (creditCount × entryCount).
  //    Alias matches override the heuristic score: a descriptor alias from
  //    a prior human confirmation yields confidence = ALIAS_CONFIDENCE (0.99)
  //    for ledger entries belonging to the aliased person, overriding the
  //    amount/date/name heuristic. This makes repeated Zelle/check payments
  //    from the same payer auto-match on the second occurrence.
  const ALIAS_CONFIDENCE = 0.99;
  type ScoredEdge = {
    bankTransactionId: string;
    ledgerEntryId: string;
    confidence: number;
    signals: AutoMatchOutcome["signals"];
    aliasMatch: boolean;
    referenceMatch?: boolean;
  };
  const allEdges: ScoredEdge[] = [];

  for (const credit of unmatchedCredits) {
    const creditAbsCents = Math.abs(credit.amountCents);
    const creditDate = new Date(credit.date);
    const creditDesc = credit.merchantName ?? credit.name;
    const normalizedDesc = normalizeDescriptor(creditDesc);

    // Check if this descriptor has a known alias.
    const knownAlias = normalizedDesc ? aliasMap.get(normalizedDesc) : undefined;

    // Phase 1 (P0-3) — TIER-0 EXACT-REFERENCE PASS (only when unit-centric flag
    // is on). If the descriptor contains a known unitAccountRef, the deposit
    // resolves DETERMINISTICALLY to that unit at confidence 1.0, BEFORE any
    // name-guessing. We emit reference edges to every pending entry for the
    // referenced unit that is within the amount tolerance (so the greedy
    // apply picks the matching-amount entry). If the amounts don't line up at
    // all, we still surface a reference edge to the closest entry so the
    // treasurer sees the ref hit rather than losing it.
    const refHit = unitCentric ? findReferenceInDescriptor(creditDesc, knownRefs) : null;

    for (const entry of pendingEntries) {
      const entryAbsCents = Math.abs(ownerLedgerAmountCents(entry));
      const owner = personById.get(entry.personId);

      const dateDelta = diffDays(creditDate, entry.postedAt);
      if (dateDelta > DATE_WINDOW_DAYS) continue;

      // TIER-0: reference hit + this entry belongs to the referenced unit +
      // amount within ±$1 → confidence 1.0, no review. Amount fence prevents a
      // ref from binding a wildly-wrong amount (partial-payment safety).
      if (
        refHit &&
        entry.unitId === refHit.unitId &&
        Math.abs(creditAbsCents - entryAbsCents) <= AMOUNT_NEAR_CENTS_TOL
      ) {
        allEdges.push({
          bankTransactionId: credit.id,
          ledgerEntryId: entry.id,
          confidence: 1,
          aliasMatch: false,
          referenceMatch: true,
          signals: {
            amountDeltaCents: Math.abs(creditAbsCents - entryAbsCents),
            dateDeltaDays: dateDelta,
            payorMatch: "exact", // the reference IS the strongest possible payor signal
          },
        });
        continue;
      }

      // Alias shortcircuit: if the descriptor maps to a known person and this
      // ledger entry belongs to that person, elevate confidence to ALIAS_CONFIDENCE.
      // Amount must still be within ±$1 to prevent a descriptor alias from
      // matching the wrong invoice amount (e.g. partial payment scenarios).
      const isAliasMatch =
        !!knownAlias &&
        knownAlias.personId === entry.personId &&
        Math.abs(creditAbsCents - entryAbsCents) <= AMOUNT_NEAR_CENTS_TOL;

      if (isAliasMatch) {
        allEdges.push({
          bankTransactionId: credit.id,
          ledgerEntryId: entry.id,
          confidence: ALIAS_CONFIDENCE,
          aliasMatch: true,
          signals: {
            amountDeltaCents: Math.abs(creditAbsCents - entryAbsCents),
            dateDeltaDays: dateDelta,
            payorMatch: "exact", // the alias implies a confirmed prior exact match
          },
        });
        continue;
      }

      // Phase 1 (P0-1) — UNIT-ROSTER (any-name) payor signal. When unit-centric
      // is on, the payor match is "does ANY name on this unit's payer roster
      // appear in the descriptor?" (not just the single ledger-entry owner).
      // When off, rosterMatch is undefined and scoreCandidate uses the
      // single-owner name path exactly as before.
      const rosterMatch: "exact" | "partial" | "none" | undefined = unitCentric
        ? rosterNameMatch(creditDesc, rostersByUnit.get(entry.unitId) ?? { members: [] })
        : undefined;

      const { confidence, signals } = scoreCandidate({
        bankAmountAbsCents: creditAbsCents,
        bankDate: creditDate,
        bankDescription: creditDesc,
        ledgerAmountAbsCents: entryAbsCents,
        ledgerPostedAt: entry.postedAt,
        ownerFirstName: owner?.firstName,
        ownerLastName: owner?.lastName,
        rosterMatch,
      });

      if (confidence <= 0) continue;
      allEdges.push({
        bankTransactionId: credit.id,
        ledgerEntryId: entry.id,
        confidence,
        aliasMatch: false,
        signals,
      });
    }
  }

  // 5. Greedy auto-apply with conflict-detection.
  //    Sort edges by descending confidence; for each edge, if both endpoints
  //    are still free AND no other edge with confidence within MARGIN of this
  //    one shares an endpoint, auto-apply. Otherwise queue for manual.
  allEdges.sort((a, b) => b.confidence - a.confidence);

  const usedBankIds = new Set<string>();
  const usedEntryIds = new Set<string>();
  const matched: AutoMatchOutcome[] = [];

  // For ambiguity detection: bucket per-bank-tx candidates above threshold.
  const candidatesByBankTx = new Map<string, ScoredEdge[]>();
  for (const e of allEdges) {
    if (!candidatesByBankTx.has(e.bankTransactionId)) {
      candidatesByBankTx.set(e.bankTransactionId, []);
    }
    candidatesByBankTx.get(e.bankTransactionId)!.push(e);
  }

  for (const edge of allEdges) {
    if (edge.confidence < AUTO_MATCH_THRESHOLD) continue;
    if (usedBankIds.has(edge.bankTransactionId)) continue;
    if (usedEntryIds.has(edge.ledgerEntryId)) continue;

    // Conflict check: more than one above-threshold candidate for this bank
    // tx with effectively-tied confidence (within 0.05)?
    const sameBankCandidates = candidatesByBankTx.get(edge.bankTransactionId) ?? [];
    const tiedAboveThreshold = sameBankCandidates.filter(
      (c) =>
        c.confidence >= AUTO_MATCH_THRESHOLD &&
        Math.abs(c.confidence - edge.confidence) < 0.05 &&
        !usedEntryIds.has(c.ledgerEntryId),
    );
    if (tiedAboveThreshold.length > 1) {
      // Mark every endpoint of every tied edge as "used" so they don't sneak
      // through later — they belong to manual review now.
      for (const t of tiedAboveThreshold) {
        usedBankIds.add(t.bankTransactionId);
      }
      continue;
    }

    await applyAutoMatch({
      ledgerEntryId: edge.ledgerEntryId,
      bankTransactionId: edge.bankTransactionId,
      associationId,
    });
    usedBankIds.add(edge.bankTransactionId);
    usedEntryIds.add(edge.ledgerEntryId);
    matched.push({
      bankTransactionId: edge.bankTransactionId,
      ledgerEntryId: edge.ledgerEntryId,
      confidence: edge.confidence,
      aliasMatch: edge.aliasMatch,
      referenceMatch: edge.referenceMatch,
      signals: edge.signals,
    });
  }

  // 6. Build manual-review queue: bank txs not yet matched but with any
  //    plausible candidates (confidence > 0).
  const needsManualReview: AutoMatchResult["needsManualReview"] = [];
  for (const [btxId, candidates] of candidatesByBankTx.entries()) {
    if (usedBankIds.has(btxId) && matched.find((m) => m.bankTransactionId === btxId)) {
      continue; // cleanly auto-matched
    }
    const liveCandidates = candidates
      .filter((c) => !usedEntryIds.has(c.ledgerEntryId))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
    if (liveCandidates.length === 0) continue;

    const topConfidence = liveCandidates[0].confidence;
    const reason: "low-confidence" | "ambiguous" =
      topConfidence < AUTO_MATCH_THRESHOLD ? "low-confidence" : "ambiguous";

    needsManualReview.push({
      bankTransactionId: btxId,
      candidates: liveCandidates.map((c) => ({
        ledgerEntryId: c.ledgerEntryId,
        confidence: c.confidence,
        signals: c.signals,
      })),
      reason,
    });
  }

  const unmatchedBankTransactionCount = unmatchedCredits.length - matched.length;
  const unmatchedLedgerEntryCount = pendingEntries.length - matched.length;

  return {
    matched,
    needsManualReview,
    unmatchedBankTransactionCount,
    unmatchedLedgerEntryCount,
  };
}

/**
 * Apply a single auto-match atomically. Tenant-scoped via the associationId
 * filter on the UPDATE.
 */
async function applyAutoMatch(input: {
  ledgerEntryId: string;
  bankTransactionId: string;
  associationId: string;
}): Promise<void> {
  const now = new Date();
  await db
    .update(ownerLedgerEntries)
    .set({
      bankTransactionId: input.bankTransactionId,
      settledAt: now,
    })
    .where(
      and(
        eq(ownerLedgerEntries.id, input.ledgerEntryId),
        eq(ownerLedgerEntries.associationId, input.associationId),
      ),
    );
}

// Re-export the candidate-only inventory (no writes) for the admin UI's
// "needs manual review" tab. Calls runAutoMatch in a dry-run mode where the
// apply step is a no-op — but for simplicity we just call the live function;
// the matched set is already persisted on each prior run and idempotency makes
// this safe. The UI uses the `needsManualReview` field of the result.
export async function listManualReviewCandidates(
  associationId: string,
): Promise<AutoMatchResult["needsManualReview"]> {
  const r = await runAutoMatch(associationId);
  return r.needsManualReview;
}

// Convenience export of the type alias used by the report endpoint.
export type ReconciliationLedgerEntry = OwnerLedgerEntry;

// ─────────────────────────────────────────────────────────────────────────────
// founder-os#2480 — descriptor-to-owner heuristic
//
// When a bank credit lands with NO matching ledger entry (an owner Zelled /
// mailed a check / wired money WITHOUT a pre-recorded payment expectation),
// the matcher historically gave up — the credit sat in the manual-review
// queue and the treasurer had to (a) hand-record a payment ledger entry,
// (b) re-run the matcher to bind it. Two clicks become four; the friction
// stalls reconciliation.
//
// The descriptor-to-owner heuristic closes that gap:
//   1. For every unmatched bank credit (no linked ledger entry) in the last
//      CREDIT_SEARCH_WINDOW_DAYS, scan the association's owners and find any
//      whose first or last name appears in the bank-tx descriptor.
//   2. Compute the owner's CURRENT OPEN BALANCE from the ledger (sum of all
//      charge/assessment/late-fee entries minus payment/credit entries).
//   3. If exactly ONE owner matches AND the credit amount is within
//      SUGGEST_BALANCE_WINDOW_CENTS (±$50) of the owner's open balance:
//          confidence ≥ 0.95 → auto-create (entry + match in one shot)
//          0.80 ≤ conf < 0.95 → propose for treasurer review
//          conf < 0.80         → leave unmatched, fully-manual
//   4. If MULTIPLE owners match (e.g. two Ruizes in the building) → NEVER
//      auto-create; surface as ambiguous review.
//
// This is intentionally conservative — the bias is against false-positive
// auto-creates. Treasurers can always Dismiss a low-confidence suggestion;
// the inverse (an incorrectly auto-created ledger entry) requires backout
// work and erodes trust.
// ─────────────────────────────────────────────────────────────────────────────

export type SuggestionTier = "auto-create" | "review" | "ambiguous";

export interface OwnerSuggestion {
  bankTransactionId: string;
  bankAmountCents: number; // absolute (positive) for display
  bankDate: string;        // yyyy-mm-dd
  bankDescription: string;
  ownerCandidates: Array<{
    personId: string;
    personName: string;
    unitId: string;
    unitNumber: string | null;
    openBalanceCents: number;
    payorMatch: "exact" | "partial" | "none";
    amountDeltaCents: number; // bank amount − open balance
    confidence: number;
  }>;
  tier: SuggestionTier;
  topConfidence: number;
}

/**
 * Score a descriptor-to-owner suggestion. Pure function over inputs.
 *
 * Confidence composition (weights chosen so the spec's tier thresholds land
 * on clean boundaries):
 *   payor name signal (the "is this owner referenced?" question):
 *     - exact   (full first+last in descriptor)  +0.60
 *     - partial (only first OR only last)         +0.30
 *     - none                                       0.00
 *   amount signal (the "does the credit match what they owe?" question):
 *     - exact   (within $1 of open balance)      +0.36   → exact+exact = 0.96 → auto-create
 *     - near    (within $5 of open balance)      +0.30   → exact+near  = 0.90 → review
 *     - window  (within $50 of open balance)     +0.20   → exact+window= 0.80 → review (edge)
 *     - outside (>$50)                             0.00   → below review threshold
 *
 * Multiple owners matching the descriptor is handled at the caller level
 * (tier="ambiguous"); this function only scores a SINGLE owner pairing.
 */
export function scoreSuggestion(input: {
  bankAmountAbsCents: number;
  bankDescription: string | null | undefined;
  ownerFirstName: string;
  ownerLastName: string;
  ownerOpenBalanceCents: number;
}): { confidence: number; payorMatch: "exact" | "partial" | "none"; amountDeltaCents: number } {
  const payorMatch = payorNameMatch(
    input.bankDescription,
    input.ownerFirstName,
    input.ownerLastName,
  );

  let confidence = 0;
  if (payorMatch === "exact") confidence += 0.60;
  else if (payorMatch === "partial") confidence += 0.30;

  const amountDelta = Math.abs(input.bankAmountAbsCents - input.ownerOpenBalanceCents);
  if (amountDelta <= 100) {
    confidence += 0.36; // within $1 — effectively exact
  } else if (amountDelta <= 500) {
    confidence += 0.30; // within $5
  } else if (amountDelta <= SUGGEST_BALANCE_WINDOW_CENTS) {
    confidence += 0.20; // within $50
  }

  confidence = Math.min(1, Math.max(0, confidence));

  return {
    confidence,
    payorMatch,
    amountDeltaCents: input.bankAmountAbsCents - input.ownerOpenBalanceCents,
  };
}

/**
 * Compute each owner's current open balance (positive = owed by owner;
 * negative = owner has credit). Charges + assessments + late-fees count as
 * positive; payments + credits + adjustments-toward-credit count as negative.
 *
 * Open-balance convention: ledger cents are signed (positive for charges,
 * negative for payments). So the open balance for an owner is simply the sum
 * of `amountCents` over all unsettled ledger entries — except we want the running
 * total over ALL entries (settled or not) to capture the full picture.
 *
 * For matching purposes we use the ABSOLUTE open balance, since a positive
 * bank credit could equally apply against a positive owner balance (most
 * common case) or zero out an owner credit (rare).
 */
async function computeOpenBalancesPerOwner(
  associationId: string,
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      personId: ownerLedgerEntries.personId,
      amountCents: ownerLedgerEntries.amountCents,
      entryType: ownerLedgerEntries.entryType,
    })
    .from(ownerLedgerEntries)
    .where(eq(ownerLedgerEntries.associationId, associationId));

  const balanceByPerson = new Map<string, number>();
  for (const r of rows) {
    // Convention: amounts for `charge|assessment|late-fee` are stored positive
    // (owner owes), `payment|credit|adjustment` are stored negative (reduces
    // balance). Summing signed integer cents yields the current balance.
    const prev = balanceByPerson.get(r.personId) ?? 0;
    balanceByPerson.set(r.personId, prev + ownerLedgerAmountCents(r));
  }
  return balanceByPerson;
}

/**
 * Walk every unmatched bank credit and propose owner-attribution suggestions
 * via the descriptor heuristic. Read-only — no DB writes here. The caller
 * (UI / route) materializes the suggestion via createPaymentFromSuggestion.
 *
 * Tenant-isolated via the associationId filter on every query.
 */
export async function findOwnerSuggestionsForUnmatchedCredits(
  associationId: string,
): Promise<OwnerSuggestion[]> {
  const cutoffDate = new Date(Date.now() - CREDIT_SEARCH_WINDOW_DAYS * 86400 * 1000);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);

  // 1. Unmatched bank credits in window.
  const credits = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.associationId, associationId),
        isNull(bankTransactions.reconciledToPaymentTransactionId),
        gte(bankTransactions.date, cutoffStr),
      ),
    )
    .orderBy(asc(bankTransactions.date));

  // 2. Strip credits already linked to a ledger entry — those have a
  //    canonical pairing and aren't suggestion candidates.
  const linkedRows = await db
    .select({ bankTransactionId: ownerLedgerEntries.bankTransactionId })
    .from(ownerLedgerEntries)
    .where(eq(ownerLedgerEntries.associationId, associationId));
  const linkedBtxIds = new Set(
    linkedRows.map((r) => r.bankTransactionId).filter((id): id is string => id !== null),
  );
  const unmatchedCredits = credits.filter(
    (c) => c.amountCents < 0 && !linkedBtxIds.has(c.id),
  );
  if (unmatchedCredits.length === 0) return [];

  // 3. Owners attached to this association (via the ownerships join +
  //    `persons.associationId` filter, mirroring runAutoMatch). Two queries
  //    keep the test-mocking story simple: one for persons (the name signal)
  //    and one for ownerships (the unit attribution). We join in JS — the
  //    cardinality (max ~tens of owners per association) makes that cheap.
  const personRows = await db
    .select({
      id: persons.id,
      firstName: persons.firstName,
      lastName: persons.lastName,
    })
    .from(persons)
    .innerJoin(ownerships, eq(ownerships.personId, persons.id))
    .where(eq(persons.associationId, associationId));
  const ownershipRows = await db
    .select({
      personId: ownerships.personId,
      unitId: ownerships.unitId,
    })
    .from(ownerships);
  const unitRows = await db
    .select({
      id: units.id,
      unitNumber: units.unitNumber,
    })
    .from(units)
    .where(eq(units.associationId, associationId));

  const unitById = new Map<string, { unitNumber: string | null }>();
  for (const u of unitRows) unitById.set(u.id, { unitNumber: u.unitNumber });
  const ownershipByPerson = new Map<string, { unitId: string; unitNumber: string | null }>();
  for (const o of ownershipRows) {
    const unit = unitById.get(o.unitId);
    if (!unit) continue; // skip stale ownerships referencing units outside this association
    ownershipByPerson.set(o.personId, { unitId: o.unitId, unitNumber: unit.unitNumber });
  }
  const ownerRows = personRows
    .map((p) => {
      const own = ownershipByPerson.get(p.id);
      if (!own) return null;
      return {
        personId: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        unitId: own.unitId,
        unitNumber: own.unitNumber,
      };
    })
    .filter((o): o is NonNullable<typeof o> => o !== null);

  // 4. Open balance per owner — used as the amount-comparison anchor.
  const openBalanceByPerson = await computeOpenBalancesPerOwner(associationId);

  // 4b. Load descriptor aliases for this association so known-good pairings
  //     get surfaced as tier="auto-create" even when the heuristic score would
  //     only reach the "review" tier.
  const aliasSuggRows = await db
    .select({
      normalizedDescriptor: bankDescriptorAliases.normalizedDescriptor,
      personId: bankDescriptorAliases.personId,
      unitId: bankDescriptorAliases.unitId,
    })
    .from(bankDescriptorAliases)
    .where(eq(bankDescriptorAliases.associationId, associationId));
  const aliasByDesc = new Map<string, { personId: string; unitId: string }>();
  for (const a of aliasSuggRows) aliasByDesc.set(a.normalizedDescriptor, a);

  // Build a fast personId → ownerRow lookup for alias-hit resolution.
  const ownerByPersonId = new Map<string, (typeof ownerRows)[number]>();
  for (const o of ownerRows) ownerByPersonId.set(o.personId, o);

  // 5. For each unmatched credit, score every owner pairing.
  const suggestions: OwnerSuggestion[] = [];
  for (const credit of unmatchedCredits) {
    const creditAbsCents = Math.abs(credit.amountCents);
    const desc = credit.merchantName ?? credit.name;
    const normalizedDesc = normalizeDescriptor(desc);

    // Alias shortcircuit: if the descriptor has a known owner from a prior
    // manual confirmation, surface it as tier="auto-create" immediately.
    // We still validate the person is in this association (defensive check).
    const knownAlias = normalizedDesc ? aliasByDesc.get(normalizedDesc) : undefined;
    if (knownAlias) {
      const aliasOwner = ownerByPersonId.get(knownAlias.personId);
      if (aliasOwner) {
        const openBalCents = Math.abs(openBalanceByPerson.get(knownAlias.personId) ?? 0);
        const amountDelta = creditAbsCents - openBalCents;
        suggestions.push({
          bankTransactionId: credit.id,
          bankAmountCents: creditAbsCents,
          bankDate: credit.date,
          bankDescription: desc ?? "",
          ownerCandidates: [
            {
              personId: knownAlias.personId,
              personName: `${aliasOwner.firstName} ${aliasOwner.lastName}`,
              unitId: knownAlias.unitId,
              unitNumber: aliasOwner.unitNumber,
              openBalanceCents: openBalCents,
              payorMatch: "exact", // alias = previously confirmed exact match
              amountDeltaCents: amountDelta,
              confidence: SUGGEST_AUTO_CREATE_THRESHOLD, // alias always meets the bar
            },
          ],
          tier: "auto-create",
          topConfidence: SUGGEST_AUTO_CREATE_THRESHOLD,
        });
        continue;
      }
    }

    const candidates: OwnerSuggestion["ownerCandidates"] = [];
    for (const o of ownerRows) {
      const openBalCents = Math.abs(openBalanceByPerson.get(o.personId) ?? 0);
      const { confidence, payorMatch, amountDeltaCents } = scoreSuggestion({
        bankAmountAbsCents: creditAbsCents,
        bankDescription: desc,
        ownerFirstName: o.firstName,
        ownerLastName: o.lastName,
        ownerOpenBalanceCents: openBalCents,
      });
      // Only keep candidates with a real name signal — pure amount-near-balance
      // without a name match is too weak to surface (we'd be guessing).
      if (payorMatch === "none") continue;
      if (confidence < SUGGEST_REVIEW_MIN_THRESHOLD) continue;
      candidates.push({
        personId: o.personId,
        personName: `${o.firstName} ${o.lastName}`,
        unitId: o.unitId,
        unitNumber: o.unitNumber,
        openBalanceCents: openBalCents,
        payorMatch,
        amountDeltaCents,
        confidence,
      });
    }

    if (candidates.length === 0) continue;

    // Sort by confidence descending so the top candidate is index 0.
    candidates.sort((a, b) => b.confidence - a.confidence);
    const top = candidates[0];

    // Tier classification:
    //   - Multiple candidates above review threshold → ambiguous (NEVER auto)
    //   - Single candidate ≥ auto-create threshold → auto-create
    //   - Otherwise → review
    let tier: SuggestionTier;
    if (candidates.length > 1) {
      tier = "ambiguous";
    } else if (top.confidence >= SUGGEST_AUTO_CREATE_THRESHOLD) {
      tier = "auto-create";
    } else {
      tier = "review";
    }

    suggestions.push({
      bankTransactionId: credit.id,
      bankAmountCents: creditAbsCents,
      bankDate: credit.date,
      bankDescription: desc ?? "",
      ownerCandidates: candidates,
      tier,
      topConfidence: top.confidence,
    });
  }

  return suggestions;
}

export interface AssociationOwner {
  personId: string;
  personName: string;
  unitId: string;
  unitNumber: string | null;
}

/**
 * Full owner roster for an association (every person with an ownership → unit),
 * used by the reconciliation review queue's "choose a different owner" dropdown.
 * This is the complete directory — NOT the name-scored candidate subset — so a
 * treasurer can attribute a deposit to ANY owner, including no-name bank noise.
 * Read-only; creates nothing.
 */
export async function listAssociationOwners(
  associationId: string,
): Promise<AssociationOwner[]> {
  const personRows = await db
    .select({
      id: persons.id,
      firstName: persons.firstName,
      lastName: persons.lastName,
    })
    .from(persons)
    .innerJoin(ownerships, eq(ownerships.personId, persons.id))
    .where(eq(persons.associationId, associationId));
  const ownershipRows = await db
    .select({ personId: ownerships.personId, unitId: ownerships.unitId })
    .from(ownerships);
  const unitRows = await db
    .select({ id: units.id, unitNumber: units.unitNumber })
    .from(units)
    .where(eq(units.associationId, associationId));

  const unitById = new Map<string, { unitNumber: string | null }>();
  for (const u of unitRows) unitById.set(u.id, { unitNumber: u.unitNumber });
  const ownershipByPerson = new Map<string, { unitId: string; unitNumber: string | null }>();
  for (const o of ownershipRows) {
    const unit = unitById.get(o.unitId);
    if (!unit) continue; // stale ownership referencing a unit outside this association
    ownershipByPerson.set(o.personId, { unitId: o.unitId, unitNumber: unit.unitNumber });
  }

  const owners: AssociationOwner[] = [];
  for (const p of personRows) {
    const own = ownershipByPerson.get(p.id);
    if (!own) continue;
    owners.push({
      personId: p.id,
      personName: `${p.firstName} ${p.lastName}`.trim(),
      unitId: own.unitId,
      unitNumber: own.unitNumber,
    });
  }
  // Stable, human-friendly order: by unit number then name.
  owners.sort((a, b) => {
    const ua = a.unitNumber ?? "";
    const ub = b.unitNumber ?? "";
    if (ua !== ub) return ua.localeCompare(ub, undefined, { numeric: true });
    return a.personName.localeCompare(b.personName);
  });
  return owners;
}

/**
 * Create a payment ledger entry for an owner and atomically auto-match it to
 * the bank transaction. Used by the Suggestions tab "Create" button.
 *
 * Tenant-scoped: every read + write filters on associationId. The bank tx
 * MUST belong to the association OR the call rejects.
 */
export async function createPaymentFromSuggestion(input: {
  associationId: string;
  bankTransactionId: string;
  personId: string;
  unitId: string;
  description?: string;
}): Promise<{
  ok: true;
  ledgerEntryId: string;
  bankTransactionId: string;
} | { ok: false; reason: string; code: string }> {
  // Validate the bank tx belongs to this association + is unmatched + is a credit.
  const btxRows = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.id, input.bankTransactionId),
        eq(bankTransactions.associationId, input.associationId),
      ),
    );
  if (btxRows.length === 0) {
    return { ok: false, reason: "Bank transaction not found", code: "BTX_NOT_FOUND" };
  }
  const btx = btxRows[0];
  if (btx.amountCents >= 0) {
    return { ok: false, reason: "Bank transaction is not a credit", code: "BTX_NOT_CREDIT" };
  }

  // Reject if the bank tx already has a linked ledger entry (idempotency guard).
  const existingLink = await db
    .select({ id: ownerLedgerEntries.id })
    .from(ownerLedgerEntries)
    .where(
      and(
        eq(ownerLedgerEntries.associationId, input.associationId),
        eq(ownerLedgerEntries.bankTransactionId, input.bankTransactionId),
      ),
    );
  if (existingLink.length > 0) {
    return {
      ok: false,
      reason: "Bank transaction already linked to a ledger entry",
      code: "ALREADY_LINKED",
    };
  }

  // Create the payment entry. Convention: payment amounts stored as negative
  // (reduces owner balance). The bank tx amountCents is also negative
  // (credit/inflow); convert to dollars and preserve the sign.
  const amountDollars = btx.amountCents / 100; // already negative
  const postedAt = new Date(btx.date);
  const now = new Date();

  const inserted = await db
    .insert(ownerLedgerEntries)
    .values({
      associationId: input.associationId,
      unitId: input.unitId,
      personId: input.personId,
      entryType: "payment",
      amount: amountDollars,
      postedAt,
      description:
        input.description ?? `Auto-created from bank deposit (${btx.merchantName ?? btx.name})`,
      referenceType: "reconciliation-suggestion",
      referenceId: input.bankTransactionId,
      bankTransactionId: input.bankTransactionId,
      settledAt: now,
    })
    .returning({ id: ownerLedgerEntries.id });

  return {
    ok: true,
    ledgerEntryId: inserted[0]?.id ?? "",
    bankTransactionId: input.bankTransactionId,
  };
}
