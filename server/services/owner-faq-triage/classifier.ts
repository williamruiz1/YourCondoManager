/**
 * classifier.ts — owner-inquiry categorizer (pure, DB-free).
 *
 * founder-os#9476 (W1 owner-FAQ triage). Categorizes a routine owner inquiry so
 * the draft generator can ground the right reply.
 *
 * Deterministic keyword/signal scoring (NOT an LLM) so the core triage path is
 * fully testable, offline, and free — the LLM adapter (server/services/
 * ai-assistant) is a later enhancement layered on top, never the base path.
 *
 * Categories (research #833 [472] §1.4 — the highest-volume routine work):
 *   balance          — "what's my balance / how much do I owe"
 *   payment-status   — "did my payment post / go through"
 *   document-request — "can I get the bylaws / financials / minutes"
 *   meeting-schedule — "when's the next meeting"
 *   other            — anything the signals don't confidently match
 */

export type InquiryCategory =
  | "balance"
  | "payment-status"
  | "document-request"
  | "meeting-schedule"
  | "other";

export interface ClassificationResult {
  category: InquiryCategory;
  /** 0..1 — the winning category's normalized signal strength. */
  confidence: number;
  /** The exact phrases/keywords that fired, for explainability. */
  matchedSignals: string[];
}

interface CategoryRule {
  category: Exclude<InquiryCategory, "other">;
  /** Regexes; each match contributes 1 to the category score. */
  signals: RegExp[];
}

// Ordered rules. Regexes are case-insensitive; word-ish boundaries where useful.
const RULES: CategoryRule[] = [
  {
    category: "payment-status",
    // Check payment-status BEFORE balance: "did my payment post" mentions
    // "payment" but is a status question, not a balance question.
    signals: [
      /\bpayment (post|posted|go through|went through|clear|cleared|process|processed|show up|received)\b/i,
      /\bdid (my|the) (payment|check|ach|autopay|transfer)\b/i,
      /\b(is|was) my payment\b/i,
      /\breceipt\b/i,
      /\bpayment (status|confirmation)\b/i,
      /\b(has|have) (you|the association) (gotten|received) my\b/i,
    ],
  },
  {
    category: "balance",
    signals: [
      /\b(my )?balance\b/i,
      /\bhow much (do|does) (i|my unit|we) owe\b/i,
      /\bamount (due|owed|outstanding)\b/i,
      /\bwhat do i owe\b/i,
      /\b(current|outstanding|account) balance\b/i,
      /\bam i (paid up|current|behind|delinquent)\b/i,
      /\bhow much is (due|left)\b/i,
    ],
  },
  {
    category: "document-request",
    signals: [
      /\b(by-?laws|cc&?rs|declaration|covenants|rules|regulations)\b/i,
      /\b(financial|budget|reserve) (statement|report|study)?s?\b/i,
      /\b(meeting )?minutes\b/i,
      /\b(copy of|send me|can i get|where (can i|do i) (find|get)) .*(document|statement|report|policy|insurance|certificate)\b/i,
      /\b(insurance|resale) certificate\b/i,
      /\bgoverning documents?\b/i,
    ],
  },
  {
    category: "meeting-schedule",
    signals: [
      /\bnext (board |annual |hoa )?meeting\b/i,
      /\bwhen('?s| is| are)? (the )?(next )?(board |annual |hoa )?meeting\b/i,
      /\bmeeting (date|time|schedule|when)\b/i,
      /\bwhen (do|does) (the board|we) meet\b/i,
      /\bupcoming meeting\b/i,
    ],
  },
];

/**
 * Classify an owner inquiry. Deterministic: scores each category by matched
 * signals, picks the max; ties resolve by RULES order (payment-status wins over
 * balance on genuine ambiguity, since a mis-routed balance reply to a
 * payment-status question is more confusing than the reverse). Below the
 * confidence floor → "other".
 */
export function classifyInquiry(rawText: string): ClassificationResult {
  const text = (rawText ?? "").trim();
  if (text.length === 0) {
    return { category: "other", confidence: 0, matchedSignals: [] };
  }

  let best: { category: Exclude<InquiryCategory, "other">; hits: string[] } | null = null;
  for (const rule of RULES) {
    const hits: string[] = [];
    for (const rx of rule.signals) {
      const m = text.match(rx);
      if (m) hits.push(m[0]);
    }
    if (hits.length > 0 && (best === null || hits.length > best.hits.length)) {
      best = { category: rule.category, hits };
    }
  }

  if (best === null) {
    return { category: "other", confidence: 0, matchedSignals: [] };
  }

  // Confidence: normalized against a 3-signal saturation (>=3 hits = full
  // confidence). A single clear keyword already clears the routing floor.
  const confidence = Math.min(1, best.hits.length / 3);
  return { category: best.category, confidence, matchedSignals: best.hits };
}
