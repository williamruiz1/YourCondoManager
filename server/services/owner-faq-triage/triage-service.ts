/**
 * triage-service.ts — owner-FAQ triage orchestration (founder-os#9476).
 *
 *   intake → classify → ground (real ledger/portal state) → draft → file an
 *   agent-action (L1 suggest / L2 send-reply) into the W1 Chief-of-Staff queue
 *   (founder-os#9474 foundation) → attempt the L2 execute gate → the gate (the
 *   per-association autonomy toggle) decides whether it actually sends now.
 *
 * Dependency-injected (classify / ground / fileAction / executeAction) so the
 * whole path is unit-testable end-to-end with fakes (no live DB), and wired to
 * the real classifier + storage grounder + the real agent-action-service in
 * production via the default deps below.
 *
 * Level mapping (the "#9476 files an L1->L2 action" requirement), reusing the
 * server-authoritative ACTION_TYPE_LEVELS map from the landed W1 foundation
 * (server/services/agent-action-service.ts):
 *   - a grounded, sendable reply -> actionType "reversible.send_owner_faq_reply"
 *     (L2): default QUEUE for review; the per-association L2 autonomy toggle
 *     (agent_action_toggles) may let it auto-send.
 *   - an "other" / needs-more-data inquiry -> actionType
 *     "suggest.owner_faq_reply" (L1): surfaced as an advisory suggestion for a
 *     human to handle. Never auto-executes.
 *
 * Safety note: `fileAction` in the landed foundation ALWAYS files with
 * status="queued" — it never auto-executes on its own. So "default is
 * queue-for-review, not auto-send" holds even before this module does
 * anything else. The L2 auto-send behavior (the per-toggle "may execute")
 * is realized here by attempting `executeAction` immediately after filing:
 * the gate executes now IF the toggle is on, and otherwise refuses
 * (APPROVAL_REQUIRED) and the action simply stays queued for human review —
 * that refusal is the CORRECT, expected default outcome, not an error.
 */
import { classifyInquiry, type InquiryCategory, type ClassificationResult } from "./classifier";
import { generateDraft, type GroundingSnapshot, type DraftResult } from "./draft-generator";
// TYPE-ONLY import of the landed foundation's file-action input shape + the
// action record it returns. Keep this module free of the DB at load time so
// the intake->classify->ground->draft->file path stays unit-testable with
// fakes; the real grounder + queue are pulled in lazily inside
// triageInquiryProd() below.
import type { FileActionInput } from "../agent-action-service";
import type { AgentAction } from "@shared/schema";

export interface TriageInput {
  associationId: string;
  personId: string;
  unitIds: string[];
  /** The raw owner inquiry text. */
  text: string;
  /** Optional: a channel/source tag for the audit trail. */
  channel?: string;
}

/** The action-type filed: L1 advisory suggestion, or L2 sendable reply. */
export type OwnerFaqActionType = "suggest.owner_faq_reply" | "reversible.send_owner_faq_reply";

export interface TriageResult {
  classification: ClassificationResult;
  draft: DraftResult;
  actionType: OwnerFaqActionType;
  /** The filed (and, for L2 with the toggle on, now-executed) agent action. */
  action: AgentAction;
  /** True only when the L2 execute gate actually fired now (toggle was on). */
  autoSent: boolean;
}

/** Injectable dependencies — defaulted to the real implementations. */
export interface TriageDeps {
  classify: (text: string) => ClassificationResult;
  ground: (input: TriageInput, category: InquiryCategory) => Promise<GroundingSnapshot>;
  fileAction: (input: FileActionInput) => Promise<AgentAction>;
  /**
   * Attempt to execute a filed action through the permission gate. Must throw
   * an error carrying `.code === "APPROVAL_REQUIRED"` (or any refusal code)
   * when the gate refuses — triageInquiry treats that refusal as the expected
   * "stays queued for review" outcome, not a failure.
   */
  executeAction: (
    actionId: string,
    associationId: string,
    actor: { actorType?: string; actorId?: string; actorEmail?: string },
  ) => Promise<AgentAction>;
}

/**
 * The action-type is L2 (sendable reply) when we produced a grounded reply,
 * and L1 (advisory suggestion) when the inquiry is "other" or we couldn't
 * ground it (needsData). This is the #9476 "L1 draft / L2 for send" split.
 */
function actionTypeFor(category: InquiryCategory, draft: DraftResult): OwnerFaqActionType {
  if (category === "other" || draft.needsData) return "suggest.owner_faq_reply";
  return "reversible.send_owner_faq_reply";
}

const AGENT_NAME = "agent:owner-faq-triage";

export async function triageInquiry(input: TriageInput, deps: TriageDeps): Promise<TriageResult> {
  const classification = deps.classify(input.text);
  const grounding = await deps.ground(input, classification.category);
  const draft = generateDraft(classification.category, grounding);
  const actionType = actionTypeFor(classification.category, draft);

  const reasoning = `${draft.reasoning} (inquiry classified "${classification.category}", confidence ${classification.confidence.toFixed(2)}, signals: ${classification.matchedSignals.join("; ") || "none"})`;

  const filed = await deps.fileAction({
    associationId: input.associationId,
    actionType,
    reasoning,
    createdByAgent: AGENT_NAME,
    targetEntityType: "person",
    targetEntityId: input.personId,
    payload: {
      inquiryText: input.text,
      channel: input.channel ?? "portal",
      category: classification.category,
      draftReply: draft.draftText,
      needsData: draft.needsData,
      // Explainability — the exact source data the draft was grounded in.
      sourceData: draft.sourceData,
    },
    severity: draft.needsData ? "medium" : "low",
  });

  let action = filed;
  let autoSent = false;

  // Only L2 (send-reply) ever attempts to auto-execute; L1 (suggest) is
  // advisory and NEVER sends regardless of any toggle.
  if (filed.level === "L2") {
    try {
      action = await deps.executeAction(filed.id, input.associationId, { actorType: "agent", actorId: AGENT_NAME });
      autoSent = action.status === "executed";
    } catch {
      // Refused (toggle off / no approval yet) — this IS the safe default:
      // the action stays "queued" for a human to review before it sends.
    }
  }

  return { classification, draft, actionType, action, autoSent };
}

/**
 * Production entrypoint: real classifier + storage grounder + the real
 * agent-action-service (the landed W1 queue foundation, founder-os#9474). The
 * DB-coupled deps are pulled in LAZILY here so importing this module never
 * touches the DB — the pure intake->classify->ground->draft path stays
 * unit-testable with fakes.
 */
export async function triageInquiryProd(input: TriageInput): Promise<TriageResult> {
  const [{ defaultGround }, { fileAction, executeAction }] = await Promise.all([
    import("./grounding-adapter"),
    import("../agent-action-service"),
  ]);
  return triageInquiry(input, {
    classify: classifyInquiry,
    ground: defaultGround,
    fileAction,
    executeAction,
  });
}
