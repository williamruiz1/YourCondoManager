/**
 * LLMConversationAdapter — Phase 1 implementation (founder-os#1256).
 *
 * Backs the ConversationAdapter contract with:
 *   - Claude 3.5 Sonnet via the Anthropic Messages API (server/services/rag/
 *     llm-client.ts)
 *   - pgvector RAG retrieval (server/services/rag/retriever.ts)
 *   - Pressing-items context injection on the first turn of a conversation
 *
 * Swap-in point: server/services/ai-assistant/index.ts. Selection is
 * environment-driven so deploys can fall back to the Phase 0 mock if the
 * Anthropic key is missing or the rollout is paused.
 *
 * Audit logging: writes the same `ai_assistant_interactions` row shape the
 * Phase 0 mock writes, with real token + cost numbers. The cost-economics
 * dashboard (founder-os#1261) consumes that table.
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
import { retrieve, renderRetrievedChunks } from "../rag/retriever";
import { streamMessages, estimateCost, isAnthropicConfigured } from "../rag/llm-client";
import { getRoleLensedPressingItems } from "../pressing-items/scanner";

const MODEL = "claude-3-5-sonnet-latest";

function buildSystemPrompt(retrievedContext: string, pressingItemsContext: string): string {
  const base =
    "You are the YourCondoManager (YCM) resident AI assistant. " +
    "You help condo owners + board members with finances, documents, and community questions. " +
    "Be concise, accurate, and clear. " +
    "When you reference policy or numbers, cite the source document by its [doc-N] tag. " +
    "If you don't know or the retrieved context doesn't answer the question, say so plainly. " +
    "Never invent ledger amounts, due dates, or document content. " +
    // Terminology (founder-os#14743, William 2026-07-14): condo associations
    // charge HOA DUES and SPECIAL ASSESSMENTS — NEVER call an owner's charges,
    // balance, or payments "rent". "Rent" applies only to a landlord-tenant
    // lease between an owner and their tenant, which YCM does not manage
    // (that is PlinthKeep's domain). Legitimate uses of the word are limited
    // to occupancy status (rental-occupied), leasing-rule violations, and
    // Amenity Rental Income.
    "Terminology: owners pay HOA dues and special assessments — never describe an owner's charges, balance, or payments as \"rent\". " +
    "Rent exists only between an owner (landlord) and their tenant, outside YCM.";

  const parts = [base];

  if (pressingItemsContext) {
    parts.push(
      "Pressing items currently visible to this caller (do NOT mention if not asked):\n" +
        pressingItemsContext,
    );
  }

  if (retrievedContext) {
    parts.push("Relevant document excerpts retrieved for this query:\n\n" + retrievedContext);
  }

  return parts.join("\n\n");
}

function formatPressingItemsForContext(
  items: Array<{ itemClass: string; title: string; severity: string }>,
): string {
  if (items.length === 0) return "";
  return items
    .slice(0, 5)
    .map((it) => `  - [${it.severity}] ${it.title} (${it.itemClass})`)
    .join("\n");
}

export interface LLMAdapterConfig {
  /** Override the model. Defaults to claude-3-5-sonnet-latest. */
  model?: string;
  /** Top-K RAG chunks retrieved per turn. Default 5. */
  topK?: number;
  /** Max cosine distance for chunk inclusion. Default 1.0 (effectively unbounded for cosine). */
  maxDistance?: number;
}

export class LLMConversationAdapter implements ConversationAdapter {
  private readonly config: Required<LLMAdapterConfig>;
  private readonly spendLog: AssistantSpendRecord[] = [];

  constructor(config: LLMAdapterConfig = {}) {
    this.config = {
      model: config.model ?? MODEL,
      topK: config.topK ?? 5,
      maxDistance: config.maxDistance ?? 1.0,
    };
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
    const startedAt = Date.now();

    // ── 1. RAG retrieval ────────────────────────────────────────────────
    let retrievedContext = "";
    let chunksUsed: Array<{ documentId: string; chunkIndex: number; distance: number }> = [];
    try {
      const chunks = await retrieve({
        associationId: caller.associationId,
        query: userMessage.text,
        topK: this.config.topK,
        maxDistance: this.config.maxDistance,
      });
      retrievedContext = renderRetrievedChunks(chunks);
      chunksUsed = chunks.map((c) => ({
        documentId: c.documentId,
        chunkIndex: c.chunkIndex,
        distance: c.distance,
      }));
    } catch (err) {
      // Non-fatal — degrade to LLM-only. Logged for observability.
      console.warn("[llm-adapter] RAG retrieval failed; degrading to LLM-only:", err);
    }

    // ── 2. Pressing-items context (first turn only) ─────────────────────
    let pressingItemsContext = "";
    if (history.length === 0) {
      try {
        const items = await getRoleLensedPressingItems({
          associationId: caller.associationId,
          actorRole: "board",
          limit: 5,
        });
        pressingItemsContext = formatPressingItemsForContext(items);
      } catch (err) {
        console.warn("[llm-adapter] Pressing-items lookup failed:", err);
      }
    }

    const systemPrompt = buildSystemPrompt(retrievedContext, pressingItemsContext);

    // ── 3. Build message history for Anthropic ──────────────────────────
    const anthropicMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (const m of history) {
      if (m.role === "user" || m.role === "assistant") {
        anthropicMessages.push({ role: m.role, content: m.text });
      }
    }
    anthropicMessages.push({ role: "user", content: userMessage.text });

    // ── 4. Stream the reply ────────────────────────────────────────────
    let accumulated = "";
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      for await (const event of streamMessages({
        systemPrompt,
        messages: anthropicMessages,
        model: this.config.model,
      })) {
        if (event.type === "text_delta") {
          accumulated += event.text;
          yield { type: "delta", text: event.text };
        } else if (event.type === "message_complete") {
          inputTokens = event.inputTokens;
          outputTokens = event.outputTokens;
        }
      }
    } catch (err) {
      yield {
        type: "error",
        reason: err instanceof Error ? err.message : "LLM call failed",
        retriable: true,
      };
      return;
    }

    const finalMessage: AssistantMessage = {
      id: randomUUID(),
      role: "assistant",
      text: accumulated,
      createdAt: new Date().toISOString(),
    };

    // ── 5. Audit + spend ───────────────────────────────────────────────
    const cost = estimateCost(this.config.model, inputTokens, outputTokens);
    const spendRecord: AssistantSpendRecord = {
      conversationId: conversation.id,
      turnIndex: history.length,
      inputTokens,
      outputTokens,
      cachedInputTokens: 0,
      estimatedCostUSD: cost,
      model: this.config.model,
      recordedAt: new Date().toISOString(),
    };
    this.spendLog.push(spendRecord);

    try {
      await db.insert(aiAssistantInteractions).values({
        conversationId: conversation.id,
        associationId: caller.associationId,
        personId: caller.personId,
        turnIndex: history.length,
        prompt: userMessage.text,
        response: accumulated,
        toolCalls: chunksUsed.map((c) => ({
          tool: "rag.retrieve",
          documentId: c.documentId,
          chunkIndex: c.chunkIndex,
          distance: c.distance,
        })),
        tokensIn: inputTokens,
        tokensOut: outputTokens,
        latencyMs: Date.now() - startedAt,
        costEstimate: cost,
        model: this.config.model,
      });
    } catch (err) {
      console.warn("[llm-adapter] audit log insert failed:", err);
    }

    yield { type: "complete", finalMessage };
  }

  async applyTrustGate(action: string): Promise<TrustGateResult> {
    let tier: TrustTier;
    if (action.startsWith("write.system.")) tier = 3;
    else if (action.startsWith("write.")) tier = 2;
    else tier = 1;
    return { action, allowedMaxTier: tier, reason: "phase-1-llm-adapter" };
  }

  async trackSpend(record: AssistantSpendRecord): Promise<void> {
    this.spendLog.push(record);
  }

  recordedSpend(): AssistantSpendRecord[] {
    return [...this.spendLog];
  }
}

/** Whether the LLM adapter has the env vars it needs. */
export function isLLMAdapterReady(): boolean {
  return isAnthropicConfigured();
}
