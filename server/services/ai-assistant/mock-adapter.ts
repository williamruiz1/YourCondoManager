/**
 * AI Assistant — MockConversationAdapter (founder-os#1318, Phase 0).
 *
 * The v1 adapter implementation. Emits canned responses with simulated
 * streaming latency so the React surface can be developed + tested
 * without a live LLM backend or production cost. Replaced wholesale at
 * Phase 1 by the founder-os#1244-backed `LLMConversationalAdapter` when
 * that ships — the swap is a single DI bind change in `index.ts`, not a
 * code rewrite.
 *
 * Sister reference: Meridian's `MockConversationAdapter.swift` (PR
 * meridian#9). Streaming cadence + canned reply shape mirror that
 * implementation; trust-gate stub logic is identical.
 *
 * Tool calls are REAL — the canned LLM reply pattern triggers the real
 * `tools.*` functions (which hit the ledger / payment-service); only the
 * "reasoning over the tool result" step is mocked.
 */

import { randomUUID } from "crypto";
import type { ConversationAdapter } from "./adapter";
import type {
  AssistantMessage,
  AssistantSpendRecord,
  AssistantStreamEvent,
  AssistantSubMode,
  CallerContext,
  ConversationHandle,
  TrustGateResult,
  TrustTier,
} from "./types";
import { db } from "../../db";
import { aiAssistantInteractions } from "@shared/schema";
import { tools, IsolationViolationError } from "./tools";

// ── Config ───────────────────────────────────────────────────────────────────

export interface MockAdapterConfig {
  /** Per-chunk streaming delay. Configurable for tests (set to 0). */
  chunkDelayMs: number;
  /** Number of chunks the canned reply is split into. */
  chunksPerReply: number;
  /** Default trust tier for unrecognized actions. */
  trustGateDefault: TrustTier;
}

const DEFAULT_CONFIG: MockAdapterConfig = {
  chunkDelayMs: 80,
  chunksPerReply: 6,
  trustGateDefault: 1,
};

// ── Intent classification ────────────────────────────────────────────────────

/**
 * The mock adapter doesn't have an LLM — but it inspects the user message
 * for a few keyword patterns so the canned reply can call the appropriate
 * REAL tool and quote the result. This is the "Phase 0 mock" approximation
 * of LLM tool-use; the Phase 1 adapter replaces this with real tool-use.
 */
type Intent = "balance" | "history" | "next_due" | "greet" | "other";

function classifyIntent(text: string): Intent {
  const lower = text.toLowerCase();
  if (/\b(balance|owe|how much|what.*owe|account.*balance)\b/.test(lower)) return "balance";
  if (/\b(history|previous|past payment|recent payment|paid before)\b/.test(lower)) return "history";
  if (/\b(next.*payment|when.*due|upcoming|due date|due soon)\b/.test(lower)) return "next_due";
  if (/^\s*(hi|hello|hey|good morning|good afternoon)/.test(lower)) return "greet";
  return "other";
}

// ── Canned reply generation ──────────────────────────────────────────────────

interface RealizedReply {
  text: string;
  toolUsed: string | null;
  toolResultSummary: string | null;
}

async function realizeReply(
  intent: Intent,
  userText: string,
  caller: CallerContext,
): Promise<RealizedReply> {
  const preview = userText.length > 60 ? userText.slice(0, 57) + "…" : userText;

  switch (intent) {
    case "balance": {
      const result = await tools.get_owner_balance({}, caller);
      return {
        text: `(Phase 0 mock) ${result.summary} The Phase 1 wiring via founder-os#1244 will reason over this; for now I'm quoting the ledger directly.`,
        toolUsed: "get_owner_balance",
        toolResultSummary: result.summary,
      };
    }
    case "history": {
      const result = await tools.get_payment_history({ limit: 5 }, caller);
      return {
        text: `(Phase 0 mock) ${result.summary} Phase 1 will summarize trends across these; for now the most recent is shown verbatim.`,
        toolUsed: "get_payment_history",
        toolResultSummary: result.summary,
      };
    }
    case "next_due": {
      const result = await tools.get_next_payment_due({}, caller);
      return {
        text: `(Phase 0 mock) ${result.summary} The Phase 1 adapter will plan reminders + autopay against this; this is the canonical next charge for now.`,
        toolUsed: "get_next_payment_due",
        toolResultSummary: result.summary,
      };
    }
    case "greet":
      return {
        text:
          "(Phase 0 mock) Hi! I can answer questions about your balance, recent payments, and what's next on your account. " +
          "Phase 1 of this assistant (founder-os#1244) brings real language understanding; today I match a few keyword patterns.",
        toolUsed: null,
        toolResultSummary: null,
      };
    case "other":
    default:
      return {
        text:
          `(Phase 0 mock) I'd help you with "${preview}" once Phase 1 wires the real LLM. ` +
          'Try: "What\'s my balance?" / "Show my recent payments." / "When is my next payment due?"',
        toolUsed: null,
        toolResultSummary: null,
      };
  }
}

// ── Streaming utilities ──────────────────────────────────────────────────────

function chunkText(text: string, count: number): string[] {
  if (text.length === 0) return [];
  const size = Math.max(1, Math.ceil(text.length / Math.max(1, count)));
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

function estimateTokens(text: string): number {
  // Rough 4-chars-per-token approximation; matches the Meridian mock.
  return Math.max(1, Math.ceil(text.length / 4));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Adapter implementation ───────────────────────────────────────────────────

export class MockConversationAdapter implements ConversationAdapter {
  private readonly config: MockAdapterConfig;
  /** In-memory spend log; mirrors Meridian's mock for tests. */
  private readonly spendLog: AssistantSpendRecord[] = [];

  constructor(config: Partial<MockAdapterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async createConversation(subMode: AssistantSubMode): Promise<ConversationHandle> {
    return {
      id: randomUUID(),
      subMode,
      createdAt: new Date().toISOString(),
    };
  }

  async *sendTurn(input: {
    conversation: ConversationHandle;
    userMessage: AssistantMessage;
    history: AssistantMessage[];
    caller: CallerContext;
  }): AsyncIterable<AssistantStreamEvent> {
    const { conversation, userMessage, history, caller } = input;
    const intent = classifyIntent(userMessage.text);

    let reply: RealizedReply;
    try {
      reply = await realizeReply(intent, userMessage.text, caller);
    } catch (err: unknown) {
      const isolationViolation = err instanceof IsolationViolationError;
      yield {
        type: "error",
        reason: isolationViolation
          ? "Isolation guard refused tool call (cross-owner access attempted)"
          : (err instanceof Error ? err.message : "Tool execution failed"),
        retriable: !isolationViolation,
      };
      return;
    }

    const chunks = chunkText(reply.text, this.config.chunksPerReply);
    let accumulated = "";

    for (const chunk of chunks) {
      if (this.config.chunkDelayMs > 0) {
        await sleep(this.config.chunkDelayMs);
      }
      accumulated += chunk;
      yield { type: "delta", text: chunk };
    }

    const finalMessage: AssistantMessage = {
      id: randomUUID(),
      role: "assistant",
      text: accumulated,
      createdAt: new Date().toISOString(),
    };

    // Persist the interaction to the audit-log table. Real cost stays $0
    // in Phase 0 (mock); token counts are rough estimates.
    const inputTokens = estimateTokens(userMessage.text);
    const outputTokens = estimateTokens(accumulated);
    const spendRecord: AssistantSpendRecord = {
      conversationId: conversation.id,
      turnIndex: history.length,
      inputTokens,
      outputTokens,
      cachedInputTokens: 0,
      estimatedCostUSD: 0,
      model: "mock-phase-0",
      recordedAt: new Date().toISOString(),
    };
    this.spendLog.push(spendRecord);

    await db.insert(aiAssistantInteractions).values({
      conversationId: conversation.id,
      associationId: caller.associationId,
      personId: caller.personId,
      turnIndex: history.length,
      prompt: userMessage.text,
      response: accumulated,
      toolCalls: reply.toolUsed
        ? [{ tool: reply.toolUsed, summary: reply.toolResultSummary ?? "" }]
        : [],
      tokensIn: inputTokens,
      tokensOut: outputTokens,
      latencyMs: this.config.chunkDelayMs * chunks.length,
      costEstimate: 0,
      model: "mock-phase-0",
    });

    yield { type: "complete", finalMessage };
  }

  async applyTrustGate(action: string): Promise<TrustGateResult> {
    // Phase 0 stub: read-only actions → tier1; write-prefixed → tier2;
    // system-write → tier3. Real enforcement lands with #1244.
    let tier: TrustTier;
    if (action.startsWith("write.system.")) tier = 3;
    else if (action.startsWith("write.")) tier = 2;
    else tier = 1;
    return { action, allowedMaxTier: tier, reason: "phase-0-stub" };
  }

  async trackSpend(record: AssistantSpendRecord): Promise<void> {
    this.spendLog.push(record);
  }

  /** Test-only inspector for the in-memory spend log. */
  recordedSpend(): AssistantSpendRecord[] {
    return [...this.spendLog];
  }
}
