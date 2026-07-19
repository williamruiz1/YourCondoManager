/**
 * Bank-reconciliation suggestion agent ability (founder-os#9480, W2).
 *
 * The agent-suggested pairing layer ON TOP of the existing reconciliation
 * pipeline — it does NOT re-implement matching:
 *
 *   READ    — consumes the EXISTING multi-signal auto-matcher's review output
 *             (`listManualReviewCandidates` in reconciliation/auto-matcher.ts):
 *             the scored candidate pairings (amount + date + payor-name
 *             signals) that the deterministic matcher declined to auto-commit
 *             (below AUTO_MATCH_THRESHOLD, or ambiguous).
 *   PROPOSE — picks the best COMMIT-ELIGIBLE candidate per bank credit
 *             (within the manual-match $1 tolerance + a 7-day window), with a
 *             confidence band + human-readable reasoning per pairing.
 *   QUEUE   — files each proposal as a `financial.reconcile_bank_match` (L3)
 *             action onto the W1 chief-of-staff queue (founder-os#9474).
 *             NOTHING commits on its own.
 *   COMMIT  — only through `executeApprovedReconMatch`, which refuses via the
 *             real W1 permission gate unless a human approval is recorded,
 *             then commits via the EXISTING `manualMatchBankTransaction`
 *             lever (same validations + A-RECON-004 double-settle guards as
 *             the admin manual match). Financial → mandatory human gate
 *             (research founder-os#833 [472] §5.2).
 *
 * Double-settle safety vs the auto-matcher: both consume the same eligibility
 * set (a settled entry / consumed credit drops out of the matcher's inputs),
 * and the commit lever re-validates availability at execute time — so a
 * proposal approved after the record settled elsewhere refuses cleanly.
 *
 * Test seams mirror meeting-prep-service.ts / the AP-suggestion sibling: pure
 * functions exported directly; DB-composing entrypoints take injectable deps
 * defaulting to the real implementations.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { agentActions, type AgentAction } from "@shared/schema";
import {
  AgentActionError,
  evaluateGate,
  executeAction,
  fileAction,
  type FileActionInput,
} from "./agent-action-service";
import {
  AUTO_MATCH_THRESHOLD,
  listManualReviewCandidates,
  type AutoMatchResult,
} from "./reconciliation/auto-matcher";
import {
  manualMatchBankTransaction,
  type ReconciliationOutcome,
} from "./plaid-reconciliation";

export const RECON_MATCH_ACTION_TYPE = "financial.reconcile_bank_match";
export const RECON_SUGGESTION_AGENT = "recon-suggestion-agent";

/** Commit-eligibility window — a proposal must be committable by the
 *  manual-match lever it actuates through (±$1), inside a sane date window. */
export const SUGGEST_AMOUNT_TOLERANCE_CENTS = 100;
export const SUGGEST_DATE_WINDOW_DAYS = 7;
/** Per-run cap so one sweep can never flood the chief-of-staff queue. */
export const DEFAULT_MAX_PROPOSALS = 25;

/** Confidence bands over the auto-matcher's 0..1 score (same thresholds as
 *  the AP-suggestion sibling): high ≥ 0.85, medium ≥ 0.6, else low. */
export const CONFIDENCE_BAND_THRESHOLDS = { high: AUTO_MATCH_THRESHOLD, medium: 0.6 } as const;

export type ConfidenceBand = "high" | "medium" | "low";

export type ReviewRow = AutoMatchResult["needsManualReview"][number];
export type CandidateSignals = ReviewRow["candidates"][number]["signals"];

export interface ReconProposal {
  bankTransactionId: string;
  ledgerEntryId: string;
  confidence: number;
  band: ConfidenceBand;
  amountDeltaCents: number;
  dateDeltaDays: number;
  payorMatch: "exact" | "partial" | "none";
  reviewReason: ReviewRow["reason"];
  signals: string[];
  reasoning: string;
}

// ── pure scoring / explanation ────────────────────────────────────────────────

export function bandForConfidence(confidence: number): ConfidenceBand {
  if (confidence >= CONFIDENCE_BAND_THRESHOLDS.high) return "high";
  if (confidence >= CONFIDENCE_BAND_THRESHOLDS.medium) return "medium";
  return "low";
}

/** Human-readable signal list from the auto-matcher's structured signals. */
export function describeSignals(signals: CandidateSignals): string[] {
  const out: string[] = [];
  out.push(
    signals.amountDeltaCents === 0
      ? "amount exact to the cent"
      : `amount within $1 (off by $${(signals.amountDeltaCents / 100).toFixed(2)})`,
  );
  out.push(
    signals.dateDeltaDays === 0
      ? "same-day"
      : `dates ${signals.dateDeltaDays} day${signals.dateDeltaDays === 1 ? "" : "s"} apart`,
  );
  if (signals.payorMatch === "exact") out.push("payor name appears exactly in the bank descriptor");
  else if (signals.payorMatch === "partial") out.push("payor name partially matches the bank descriptor");
  return out;
}

export function buildPairReasoning(input: {
  confidence: number;
  band: ConfidenceBand;
  reviewReason: ReviewRow["reason"];
  signals: string[];
}): string {
  const why =
    input.reviewReason === "ambiguous"
      ? "the auto-matcher found more than one plausible pairing, so a human must pick"
      : "the score is below the auto-commit threshold, so a human must confirm";
  return (
    `Proposed bank-credit ↔ ledger-entry pairing. Match signals: ${input.signals.join("; ")}. ` +
    `Auto-matcher confidence ${input.confidence.toFixed(2)} (${input.band}); not auto-committed because ${why}. ` +
    `Approving commits the pairing through the standard manual-match validations; nothing settles without this approval.`
  );
}

/** Is this candidate actually committable by the manual-match lever? */
export function isCommitEligible(signals: CandidateSignals): boolean {
  return (
    signals.amountDeltaCents <= SUGGEST_AMOUNT_TOLERANCE_CENTS &&
    signals.dateDeltaDays <= SUGGEST_DATE_WINDOW_DAYS
  );
}

/**
 * PURE selection over the auto-matcher's review rows: best commit-eligible
 * candidate per bank credit, highest-confidence rows first, one proposal per
 * credit AND per ledger entry, skipping any credit/entry that already carries
 * an open (queued|approved) proposal. Capped.
 */
export function selectProposals(
  reviewRows: ReviewRow[],
  openRefs: { bankTransactionIds: Set<string>; ledgerEntryIds: Set<string> },
  maxProposals: number = DEFAULT_MAX_PROPOSALS,
): ReconProposal[] {
  type Pick = { row: ReviewRow; candidate: ReviewRow["candidates"][number] };
  const picks: Pick[] = [];

  for (const row of reviewRows) {
    if (openRefs.bankTransactionIds.has(row.bankTransactionId)) continue;
    const eligible = row.candidates
      .filter((c) => !openRefs.ledgerEntryIds.has(c.ledgerEntryId) && isCommitEligible(c.signals))
      .sort((a, b) => b.confidence - a.confidence);
    if (eligible.length === 0) continue;
    picks.push({ row, candidate: eligible[0] });
  }

  picks.sort((a, b) => b.candidate.confidence - a.candidate.confidence);

  const usedCredits = new Set<string>();
  const usedEntries = new Set<string>();
  const selected: ReconProposal[] = [];
  for (const { row, candidate } of picks) {
    if (selected.length >= maxProposals) break;
    if (usedCredits.has(row.bankTransactionId) || usedEntries.has(candidate.ledgerEntryId)) continue;
    usedCredits.add(row.bankTransactionId);
    usedEntries.add(candidate.ledgerEntryId);
    const band = bandForConfidence(candidate.confidence);
    const signals = describeSignals(candidate.signals);
    selected.push({
      bankTransactionId: row.bankTransactionId,
      ledgerEntryId: candidate.ledgerEntryId,
      confidence: candidate.confidence,
      band,
      amountDeltaCents: candidate.signals.amountDeltaCents,
      dateDeltaDays: candidate.signals.dateDeltaDays,
      payorMatch: candidate.signals.payorMatch,
      reviewReason: row.reason,
      signals,
      reasoning: buildPairReasoning({ confidence: candidate.confidence, band, reviewReason: row.reason, signals }),
    });
  }
  return selected;
}

/** Queue severity from confidence band: strong matches surface higher. */
export function severityForBand(band: ConfidenceBand): string {
  return band === "high" ? "medium" : "low";
}

// ── data deps (injectable seam, defaults = real implementations) ─────────────

export interface ReconSuggestionDataDeps {
  /** The existing auto-matcher's needs-manual-review output (scored candidates
   *  the deterministic pipeline declined to auto-commit). */
  listReviewCandidates: (associationId: string) => Promise<ReviewRow[]>;
  /** Credits/entries already referenced by an OPEN (queued|approved) proposal —
   *  so a re-run never files a duplicate pairing for the same records. */
  listOpenProposalRefs: (associationId: string) => Promise<{ bankTransactionIds: Set<string>; ledgerEntryIds: Set<string> }>;
}

async function defaultListOpenProposalRefs(associationId: string): Promise<{ bankTransactionIds: Set<string>; ledgerEntryIds: Set<string> }> {
  const rows = await db
    .select()
    .from(agentActions)
    .where(
      and(
        eq(agentActions.associationId, associationId),
        eq(agentActions.actionType, RECON_MATCH_ACTION_TYPE),
        inArray(agentActions.status, ["queued", "approved"]),
      ),
    );
  const bankTransactionIds = new Set<string>();
  const ledgerEntryIds = new Set<string>();
  for (const row of rows) {
    const payload = (row.payload ?? {}) as Partial<ReconProposal>;
    if (typeof payload.bankTransactionId === "string") bankTransactionIds.add(payload.bankTransactionId);
    if (typeof payload.ledgerEntryId === "string") ledgerEntryIds.add(payload.ledgerEntryId);
  }
  return { bankTransactionIds, ledgerEntryIds };
}

export const defaultReconSuggestionDataDeps: ReconSuggestionDataDeps = {
  listReviewCandidates: (associationId) => listManualReviewCandidates(associationId),
  listOpenProposalRefs: defaultListOpenProposalRefs,
};

// ── entrypoints ───────────────────────────────────────────────────────────────

export interface ReconSuggestionRunResult {
  proposals: ReconProposal[];
  reviewRowCount: number;
  skippedOpenProposals: number;
}

/** Dry-run: read → select. Files NOTHING. */
export async function previewReconSuggestions(
  associationId: string,
  deps: ReconSuggestionDataDeps = defaultReconSuggestionDataDeps,
  maxProposals: number = DEFAULT_MAX_PROPOSALS,
): Promise<ReconSuggestionRunResult> {
  const [reviewRows, openRefs] = await Promise.all([
    deps.listReviewCandidates(associationId),
    deps.listOpenProposalRefs(associationId),
  ]);
  const proposals = selectProposals(reviewRows, openRefs, maxProposals);
  const skippedOpenProposals = reviewRows.filter((r) => openRefs.bankTransactionIds.has(r.bankTransactionId)).length;
  return { proposals, reviewRowCount: reviewRows.length, skippedOpenProposals };
}

export interface FileReconSuggestionsInput {
  associationId: string;
  createdByAgent?: string;
  maxProposals?: number;
}

export interface ReconSuggestionDeps {
  data: ReconSuggestionDataDeps;
  file: (input: FileActionInput) => Promise<AgentAction>;
}

export const defaultReconSuggestionDeps: ReconSuggestionDeps = {
  data: defaultReconSuggestionDataDeps,
  file: fileAction,
};

/**
 * The agent run: read → propose → FILE each pairing as an L3 action on the W1
 * queue. The level is assigned server-side from the action-type map; nothing
 * here (or anywhere) commits a pairing — that requires the recorded human
 * approval + the execute leg below.
 */
export async function fileReconSuggestions(
  input: FileReconSuggestionsInput,
  deps: ReconSuggestionDeps = defaultReconSuggestionDeps,
): Promise<ReconSuggestionRunResult & { actions: AgentAction[] }> {
  if (!input.associationId) throw new AgentActionError("associationId required", "VALIDATION");
  const run = await previewReconSuggestions(input.associationId, deps.data, input.maxProposals ?? DEFAULT_MAX_PROPOSALS);
  const actions: AgentAction[] = [];
  for (const proposal of run.proposals) {
    const action = await deps.file({
      associationId: input.associationId,
      actionType: RECON_MATCH_ACTION_TYPE,
      reasoning: proposal.reasoning,
      createdByAgent: input.createdByAgent ?? RECON_SUGGESTION_AGENT,
      targetEntityType: "bank_transaction",
      targetEntityId: proposal.bankTransactionId,
      payload: proposal,
      severity: severityForBand(proposal.band),
    });
    actions.push(action);
  }
  return { ...run, actions };
}

// ── execute (the ONLY commit path — through the real W1 gate) ────────────────

export interface ReconExecuteDeps {
  loadAction: (actionId: string, associationId: string) => Promise<AgentAction | undefined>;
  commit: typeof manualMatchBankTransaction;
  execute: typeof executeAction;
}

async function defaultLoadAction(actionId: string, associationId: string): Promise<AgentAction | undefined> {
  const [row] = await db
    .select()
    .from(agentActions)
    .where(and(eq(agentActions.id, actionId), eq(agentActions.associationId, associationId)));
  return row;
}

export const defaultReconExecuteDeps: ReconExecuteDeps = {
  loadAction: defaultLoadAction,
  commit: manualMatchBankTransaction,
  execute: executeAction,
};

export interface ExecuteReconMatchInput {
  actionId: string;
  associationId: string;
  actor: { actorType?: string; actorId?: string; actorEmail?: string };
}

/**
 * Actuate ONE approved reconciliation proposal:
 *   1. load the action (tenant-scoped) + assert it is OURS (action-type check);
 *   2. peek the REAL permission gate — L3 refuses without a recorded approval;
 *   3. commit through the existing manual-match lever (re-validates
 *      availability, signs, tolerance, A-RECON-004 double-settle guards);
 *   4. only THEN mark executed through the W1 gate (audit-logged).
 * A commit failure leaves the action approved-but-unexecuted with the precise
 * refusal code surfaced — nothing is half-applied.
 */
export async function executeApprovedReconMatch(
  input: ExecuteReconMatchInput,
  deps: ReconExecuteDeps = defaultReconExecuteDeps,
): Promise<{ action: AgentAction; outcome: ReconciliationOutcome }> {
  const action = await deps.loadAction(input.actionId, input.associationId);
  if (!action) throw new AgentActionError("agent action not found", "NOT_FOUND", 404);
  if (action.actionType !== RECON_MATCH_ACTION_TYPE) {
    throw new AgentActionError(
      `action ${input.actionId} is not a ${RECON_MATCH_ACTION_TYPE} action`,
      "WRONG_ACTION_TYPE",
      409,
    );
  }

  // Peek the real gate BEFORE any side effect. L3 + not-approved → refuse here,
  // so the commit lever is never even attempted without the recorded approval.
  const gate = evaluateGate({ level: action.level, status: action.status, autoApprove: false });
  if (!gate.executable) {
    throw new AgentActionError(gate.reason ?? "action not executable", gate.code ?? "NOT_EXECUTABLE", 409);
  }

  const payload = (action.payload ?? {}) as Partial<ReconProposal>;
  if (typeof payload.bankTransactionId !== "string" || typeof payload.ledgerEntryId !== "string") {
    throw new AgentActionError("action payload is missing the bankTransactionId/ledgerEntryId pairing", "INVALID_PAYLOAD", 409);
  }

  const result = await deps.commit({
    associationId: input.associationId,
    bankTransactionId: payload.bankTransactionId,
    ledgerEntryId: payload.ledgerEntryId,
  });
  if (!result.ok) {
    throw new AgentActionError(result.reason, result.code, 409);
  }

  const executed = await deps.execute(input.actionId, input.associationId, input.actor);
  return { action: executed, outcome: result.outcome };
}
