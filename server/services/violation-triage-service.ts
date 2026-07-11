/**
 * Violation-intake triage service (founder-os#9479, W2).
 *
 * An owner submits a violation report (description + photos); the agent
 * CATEGORIZES it against the applicable rule, DRAFTS the violation notice grounded
 * in the triggered rule + the evidence, and files a `reversible.draft_notice`
 * (L2) action onto the W1 Chief-of-Staff queue routed to the PM/board. It DRAFTS +
 * ROUTES only — the notice can never ISSUE from here: sending is a separate
 * `irreversible.send_owner_notice` (L3) action a human always approves + signs
 * (research #833 [472] §4.1 domain 5, §5.2 — draft+route is the whole scope).
 *
 * Design (mirrors the W1 agent-action-service + AP-suggestion split): the TRIAGE
 * LOGIC is a set of PURE, exported, DB-free functions (categorize → ground in the
 * rule → draft the notice → summarize the evidence), deterministic and unit-tested
 * with no database. The DB-composing entrypoint (`triageAndQueueViolation`) runs
 * the pure engine and files the result through the W1 permission gate as
 * `reversible.draft_notice` (L2). It NEVER issues a notice — it only queues the
 * DRAFT; actuation (send) is a separate human-approved L3 step out of this scope.
 *
 * Rule grounding: "the applicable rule" is sourced from the association's OWN
 * governing-doc rule set when supplied (the `rules` input — category-keyed), else
 * a canonical standard-category rule fallback, ALWAYS stated honestly in the
 * reasoning (which rule, and whether it was the association's or the standard
 * fallback). This keeps the ability self-contained + testable while leaving a
 * clean seam for governing-document (documents/documentEmbeddings) grounding.
 */
import { type AgentAction } from "@shared/schema";
import { fileAction, AgentActionError, type FileActionInput } from "./agent-action-service";

// The L2 action-type the notice DRAFT files under. Kept in sync with the
// server-authoritative ladder in agent-action-service.ts (which maps it to L2).
export const DRAFT_NOTICE_ACTION_TYPE = "reversible.draft_notice";
// The L3 action-type that would ISSUE the notice — explicitly OUT of this scope.
// Named here so the boundary is legible + assertable: this service NEVER files it.
export const SEND_NOTICE_ACTION_TYPE = "irreversible.send_owner_notice";

// ── Violation category taxonomy (pure, deterministic) ────────────────────────
// The canonical common-HOA violation categories. Each carries the keyword signals
// that trigger it and a standard-category rule used to GROUND the notice when the
// association has not supplied its own governing-doc rule for that category.
export type ViolationCategory =
  | "architectural"
  | "landscaping"
  | "parking_vehicle"
  | "pets"
  | "trash_bins"
  | "noise_nuisance"
  | "exterior_maintenance"
  | "signage"
  | "rental_occupancy"
  | "general";

export interface CategorySignal {
  category: ViolationCategory;
  keywords: string[];
  defaultRule: ApplicableRule;
  severity: "low" | "medium" | "high";
}

/** A rule the notice is grounded in. `source` states WHERE it came from (honesty). */
export interface ApplicableRule {
  ruleId: string;
  citation: string; // e.g. "CC&R Art. IV §4.2" or a standard-category label
  text: string; // the rule statement the notice cites
  source: "association" | "standard";
}

// Standard-category rules (the fallback grounding when the association supplies none).
export const CATEGORY_SIGNALS: CategorySignal[] = [
  {
    category: "architectural",
    keywords: ["paint", "fence", "shed", "addition", "deck", "roof", "window", "door color", "solar", "antenna", "modification", "unapproved", "arc "],
    severity: "medium",
    defaultRule: { ruleId: "std.architectural", citation: "Architectural Standards (standard)", text: "Exterior modifications require prior written Architectural Review Committee approval.", source: "standard" },
  },
  {
    category: "landscaping",
    keywords: ["lawn", "grass", "weeds", "overgrown", "landscap", "hedge", "tree", "yard", "dead plant", "brown"],
    severity: "low",
    defaultRule: { ruleId: "std.landscaping", citation: "Landscaping Standards (standard)", text: "Owners must maintain lawns and landscaping in a neat, healthy, and orderly condition.", source: "standard" },
  },
  {
    category: "parking_vehicle",
    keywords: ["park", "vehicle", "car", "truck", "trailer", "boat", "rv", "driveway", "street", "inoperable", "commercial vehicle", "blocked"],
    severity: "medium",
    defaultRule: { ruleId: "std.parking", citation: "Parking & Vehicle Rules (standard)", text: "Vehicles must be parked in designated areas; inoperable, oversized, or commercial vehicles are prohibited in common areas.", source: "standard" },
  },
  {
    category: "pets",
    keywords: ["dog", "cat", "pet", "leash", "waste", "barking", "animal", "poop", "off-leash"],
    severity: "low",
    defaultRule: { ruleId: "std.pets", citation: "Pet Rules (standard)", text: "Pets must be leashed in common areas and owners must promptly remove pet waste.", source: "standard" },
  },
  {
    category: "trash_bins",
    keywords: ["trash", "garbage", "bin", "can", "recycl", "dumpster", "refuse", "left out"],
    severity: "low",
    defaultRule: { ruleId: "std.trash", citation: "Trash & Refuse Rules (standard)", text: "Trash and recycling containers must be stored out of view except on collection days.", source: "standard" },
  },
  {
    category: "noise_nuisance",
    keywords: ["noise", "loud", "music", "party", "nuisance", "disturbance", "yelling", "late night"],
    severity: "medium",
    defaultRule: { ruleId: "std.nuisance", citation: "Nuisance Rules (standard)", text: "Owners and residents must not create noise or nuisances that disturb the quiet enjoyment of others.", source: "standard" },
  },
  {
    category: "exterior_maintenance",
    keywords: ["gutter", "siding", "peeling", "broken", "disrepair", "mold", "mildew", "dirty", "damaged", "rust", "sagging"],
    severity: "medium",
    defaultRule: { ruleId: "std.maintenance", citation: "Maintenance Standards (standard)", text: "Owners must keep the exterior of their unit in good repair and appearance.", source: "standard" },
  },
  {
    category: "signage",
    keywords: ["sign", "banner", "flag", "poster", "advertisement", "for sale sign", "political sign"],
    severity: "low",
    defaultRule: { ruleId: "std.signage", citation: "Signage Rules (standard)", text: "Signs are restricted to those expressly permitted by the governing documents and applicable law.", source: "standard" },
  },
  {
    category: "rental_occupancy",
    keywords: ["rent", "airbnb", "short-term", "short term", "sublet", "lease", "tenant", "occupancy", "vrbo", "str "],
    severity: "high",
    defaultRule: { ruleId: "std.rental", citation: "Leasing & Occupancy Rules (standard)", text: "Rentals must comply with the association's leasing restrictions and minimum-term requirements.", source: "standard" },
  },
];

const GENERAL_RULE: ApplicableRule = {
  ruleId: "std.general",
  citation: "Governing Documents (standard)",
  text: "Owners must comply with the association's Declaration, Bylaws, and Rules & Regulations.",
  source: "standard",
};

/** An association-supplied governing-doc rule, keyed to a category. When present
 *  for the matched category, it GROUNDS the notice instead of the standard rule. */
export interface AssociationRule {
  category: ViolationCategory;
  ruleId: string;
  citation: string;
  text: string;
}

export interface ViolationReport {
  /** The owner's free-text description of what they observed. */
  description: string;
  /** Photo evidence references (URLs / storage ids / filenames) — evidence only. */
  photos?: string[];
  /** Optional: who/where the violation concerns (grounds the notice addressee). */
  unitLabel?: string | null;
  ownerName?: string | null;
  reportedBy?: string | null;
  /** Optional association-specific governing-doc rules (category-keyed). */
  rules?: AssociationRule[];
}

export interface CategorizationResult {
  category: ViolationCategory;
  rule: ApplicableRule;
  severity: "low" | "medium" | "high";
  /** 0..1 keyword-match confidence (how strongly the text matched the category). */
  confidence: number;
  /** The keyword hits that drove the classification (transparency). */
  matchedKeywords: string[];
}

/**
 * PURE categorizer. Scores the report text against each category's keyword
 * signals, picks the best match, and grounds it in the applicable rule —
 * preferring an association-supplied governing-doc rule for the matched category,
 * else the standard-category rule. No match → `general` + the general rule.
 */
export function categorizeViolation(report: ViolationReport): CategorizationResult {
  const text = (report.description ?? "").toLowerCase();
  let best: { signal: CategorySignal; hits: string[] } | null = null;
  for (const signal of CATEGORY_SIGNALS) {
    const hits = signal.keywords.filter((k) => text.includes(k));
    if (hits.length && (!best || hits.length > best.hits.length)) {
      best = { signal, hits };
    }
  }

  if (!best) {
    return { category: "general", rule: GENERAL_RULE, severity: "low", confidence: 0, matchedKeywords: [] };
  }

  const category = best.signal.category;
  // Prefer the association's OWN governing-doc rule for this category (grounding).
  const assocRule = (report.rules ?? []).find((r) => r.category === category);
  const rule: ApplicableRule = assocRule
    ? { ruleId: assocRule.ruleId, citation: assocRule.citation, text: assocRule.text, source: "association" }
    : best.signal.defaultRule;

  // Confidence: saturating with the number of distinct keyword hits.
  const confidence = Math.min(1, best.hits.length / 3);
  return { category, rule, severity: best.signal.severity, confidence, matchedKeywords: best.hits };
}

// ── Evidence summary (pure) ──────────────────────────────────────────────────
export interface EvidenceSummary {
  descriptionExcerpt: string;
  photoCount: number;
  photoRefs: string[];
}

/** Summarize the evidence used to ground the notice (report text + photo refs). */
export function summarizeEvidence(report: ViolationReport): EvidenceSummary {
  const photos = (report.photos ?? []).filter((p) => typeof p === "string" && p.trim());
  const desc = (report.description ?? "").trim();
  return {
    descriptionExcerpt: desc.length > 280 ? `${desc.slice(0, 277)}…` : desc,
    photoCount: photos.length,
    photoRefs: photos,
  };
}

// ── Notice draft (pure) ──────────────────────────────────────────────────────
export interface NoticeDraft {
  subject: string;
  body: string;
  category: ViolationCategory;
  ruleCitation: string;
  /** Days the owner is given to cure before escalation (advisory default). */
  cureByDays: number;
}

const DEFAULT_CURE_BY_DAYS = 14;

/**
 * PURE notice draft. Produces a courtesy violation notice grounded in the
 * triggered rule + the evidence. It is a DRAFT for a human to review + sign — it
 * asserts nothing final (no fine, no hearing) and explicitly states a person will
 * review before any notice is issued.
 */
export function draftNotice(
  categorization: CategorizationResult,
  evidence: EvidenceSummary,
  report: ViolationReport,
  opts: { cureByDays?: number; associationName?: string | null } = {},
): NoticeDraft {
  const cureByDays = opts.cureByDays ?? DEFAULT_CURE_BY_DAYS;
  const addressee = report.ownerName?.trim() || (report.unitLabel ? `Owner of ${report.unitLabel}` : "Owner");
  const unitLine = report.unitLabel ? `Unit/Address: ${report.unitLabel}\n` : "";
  const assoc = opts.associationName?.trim() || "the Association";
  const category = categorization.category.replace(/_/g, " ");
  const evidenceLine = evidence.photoCount > 0
    ? `${evidence.photoCount} photo${evidence.photoCount === 1 ? "" : "s"} submitted as evidence.`
    : "A written report was submitted as evidence.";

  const subject = `Courtesy Violation Notice (DRAFT) — ${category}`;
  const body = [
    `Dear ${addressee},`,
    "",
    unitLine.trimEnd(),
    `This is a courtesy notice from ${assoc} regarding a possible rule violation observed at your property.`,
    "",
    `Category: ${category}`,
    `Applicable rule: ${categorization.rule.citation}`,
    `  "${categorization.rule.text}"`,
    "",
    `What was reported: ${evidence.descriptionExcerpt || "(see attached report)"}`,
    `Evidence: ${evidenceLine}`,
    "",
    `We ask that this be addressed within ${cureByDays} days of the date this notice is issued. If the matter is already resolved, please disregard this notice.`,
    "",
    `This is a DRAFT prepared for review. A board member or manager will review and sign before any notice is issued.`,
    "",
    `Sincerely,`,
    `${assoc}`,
  ]
    .filter((l) => l !== unitLine.trimEnd() || unitLine.trim())
    .join("\n");

  return { subject, body, category: categorization.category, ruleCitation: categorization.rule.citation, cureByDays };
}

// ── Reasoning (pure) — the "why", showing the rule + evidence (AC4) ──────────
/** The queue-visible reasoning: the triggered rule + the evidence used. */
export function buildReasoning(categorization: CategorizationResult, evidence: EvidenceSummary): string {
  const src = categorization.rule.source === "association" ? "association governing-doc rule" : "standard-category rule (no association-specific rule matched)";
  const kw = categorization.matchedKeywords.length ? ` (matched: ${categorization.matchedKeywords.join(", ")})` : " (no keyword match — defaulted to general)";
  return [
    `Categorized as "${categorization.category}"${kw}.`,
    `Triggered rule: ${categorization.rule.citation} — "${categorization.rule.text}" [${src}].`,
    `Evidence used: ${evidence.photoCount} photo(s) + report text: "${evidence.descriptionExcerpt || "(none)"}".`,
    `Drafted a courtesy notice for human review; the notice cannot issue without a signature (this is an L2 draft+route, not a send).`,
  ].join(" ");
}

// ── DB-composing entrypoint ──────────────────────────────────────────────────
export interface TriageInput {
  associationId: string;
  report: ViolationReport;
  createdByAgent?: string;
  /** Optional link to a stored violation report entity. */
  reportEntityId?: string | null;
  associationName?: string | null;
  cureByDays?: number;
}

/** Injectable deps (default = the real W1 gate) so the whole path is unit-testable. */
export interface ViolationTriageDeps {
  file: (input: FileActionInput) => Promise<AgentAction>;
}
export const defaultViolationTriageDeps: ViolationTriageDeps = { file: fileAction };

export interface TriageResult {
  action: AgentAction;
  categorization: CategorizationResult;
  notice: NoticeDraft;
  evidence: EvidenceSummary;
}

/**
 * Intake → categorize → draft → route. Files a `reversible.draft_notice` (L2)
 * action onto the W1 queue with the reasoning (rule + evidence) + the notice draft
 * as payload. NEVER issues a notice: the action is queued at L2 and requires the
 * human approval path before it can execute; sending is a separate L3 step.
 */
export async function triageAndQueueViolation(
  input: TriageInput,
  deps: ViolationTriageDeps = defaultViolationTriageDeps,
): Promise<TriageResult> {
  if (!input.associationId) throw new AgentActionError("associationId required", "VALIDATION");
  if (!input.report || !input.report.description || !input.report.description.trim()) {
    throw new AgentActionError("a violation report description is required", "VALIDATION");
  }

  const categorization = categorizeViolation(input.report);
  const evidence = summarizeEvidence(input.report);
  const notice = draftNotice(categorization, evidence, input.report, {
    cureByDays: input.cureByDays,
    associationName: input.associationName,
  });
  const reasoning = buildReasoning(categorization, evidence);

  const action = await deps.file({
    associationId: input.associationId,
    actionType: DRAFT_NOTICE_ACTION_TYPE, // → L2, server-authoritative (draft+route)
    reasoning,
    createdByAgent: input.createdByAgent ?? "violation-triage",
    targetEntityType: "violation_report",
    targetEntityId: input.reportEntityId ?? null,
    payload: {
      kind: "violation_notice_draft",
      category: categorization.category,
      rule: categorization.rule,
      severity: categorization.severity,
      confidence: categorization.confidence,
      evidence,
      notice, // the drafted notice a human reviews + signs
      report: {
        unitLabel: input.report.unitLabel ?? null,
        ownerName: input.report.ownerName ?? null,
        reportedBy: input.report.reportedBy ?? null,
      },
    },
    severity: categorization.severity,
  });

  return { action, categorization, notice, evidence };
}
