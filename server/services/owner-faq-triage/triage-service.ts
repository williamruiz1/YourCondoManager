/**
 * triage-service.ts — owner-FAQ triage orchestration (founder-os#9476).
 *
 *   intake → classify → ground (real ledger/portal state) → draft → file an
 *   agent-queue action (L1 suggest / L2 send) → the queue gates send.
 *
 * Dependency-injected (classify / ground / fileAction) so the whole path is
 * unit-testable end-to-end with fakes (no live DB), and wired to the real
 * classifier + storage grounder + agent-queue in production via the default
 * deps below.
 *
 * Level mapping (the "#9476 files an L1→L2 action" requirement):
 *   - a grounded, sendable reply → actionType "owner-faq.send-reply" (L2):
 *     default QUEUE for review; per-association auto-send toggle may execute.
 *   - an "other" / needs-more-data inquiry → actionType "owner-faq.suggest"
 *     (L1): surfaced as an advisory suggestion for a human to handle. Never sends.
 */
import { classifyInquiry, type InquiryCategory, type ClassificationResult } from "./classifier";
import { generateDraft, type GroundingSnapshot, type DraftResult } from "./draft-generator";
// TYPE-ONLY imports — keep this module free of the DB at load time so the
// intake→classify→ground→draft→queue path is unit-testable with fakes. The real
// queue + grounder are pulled in lazily inside triageInquiryProd().
import type { FileActionInput, FileActionResult } from "../agent-queue/agent-queue-service";

export interface TriageInput {
  associationId: string;
  personId: string;
  unitIds: string[];
  /** The raw owner inquiry text. */
  text: string;
  /** Optional: a channel/source tag for the audit trail. */
  channel?: string;
}

export interface TriageResult {
  classification: ClassificationResult;
  draft: DraftResult;
  /** The action-type filed (L1 owner-faq.suggest or L2 owner-faq.send-reply). */
  actionType: "owner-faq.suggest" | "owner-faq.send-reply";
  fileResult: FileActionResult;
}

/** Injectable dependencies — defaulted to the real implementations. */
export interface TriageDeps {
  classify: (text: string) => ClassificationResult;
  ground: (input: TriageInput, category: InquiryCategory) => Promise<GroundingSnapshot>;
  fileAction: (input: FileActionInput) => Promise<FileActionResult>;
}

/**
 * The action-type is L2 (sendable reply) when we produced a grounded reply, and
 * L1 (advisory suggestion) when the inquiry is "other" or we couldn't ground it
 * (needsData). This is the #9476 "L1 draft / L2 for send" split.
 */
function actionTypeFor(category: InquiryCategory, draft: DraftResult): TriageResult["actionType"] {
  if (category === "other" || draft.needsData) return "owner-faq.suggest";
  return "owner-faq.send-reply";
}

export async function triageInquiry(input: TriageInput, deps: TriageDeps): Promise<TriageResult> {
  const classification = deps.classify(input.text);
  const grounding = await deps.ground(input, classification.category);
  const draft = generateDraft(classification.category, grounding);
  const actionType = actionTypeFor(classification.category, draft);

  const fileResult = await deps.fileAction({
    associationId: input.associationId,
    actionType,
    payload: {
      inquiryText: input.text,
      channel: input.channel ?? "portal",
      category: classification.category,
      draftReply: draft.draftText,
      needsData: draft.needsData,
    },
    reasoning: `${draft.reasoning} (inquiry classified "${classification.category}", confidence ${classification.confidence.toFixed(2)}, signals: ${classification.matchedSignals.join("; ") || "none"})`,
    sourceData: draft.sourceData,
    createdByAgent: "agent:owner-faq-triage",
    targetEntity: input.personId,
  });

  return { classification, draft, actionType, fileResult };
}

/**
 * Production entrypoint: real classifier + storage grounder + real queue.
 * The DB-coupled deps (grounder → storage, fileAction → db) are pulled in
 * LAZILY here so importing this module never touches the DB — the pure
 * intake→classify→ground→draft→queue path stays unit-testable with fakes.
 */
export async function triageInquiryProd(input: TriageInput): Promise<TriageResult> {
  const [{ defaultGround }, { fileAction }] = await Promise.all([
    import("./grounding-adapter"),
    import("../agent-queue/agent-queue-service"),
  ]);
  return triageInquiry(input, {
    classify: classifyInquiry,
    ground: defaultGround,
    fileAction,
  });
}
