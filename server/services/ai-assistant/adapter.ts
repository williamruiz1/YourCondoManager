/**
 * AI Assistant — ConversationAdapter contract (founder-os#1318, Phase 0).
 *
 * The protocol that bridges YCM's owner-portal AI chat surface to a
 * conversational LLM backend. MATCHES the public API shape that the
 * founder-os#1244 three-pillar primitive will export, so swapping
 * `MockConversationAdapter` for the #1244-backed adapter at Phase 1 time
 * is a plug-replace at the DI seam (one line in `index.ts`), not a
 * reshape across the codebase.
 *
 * Sister reference: Meridian's `ConversationAdapter.swift` (PR meridian#9).
 * The TypeScript signature here is the direct translation; method names,
 * argument order, and stream-event shape match 1:1.
 *
 * Any conforming implementation MUST pass the contract tests at
 * `server/services/ai-assistant/__tests__/adapter-contract.test.ts`.
 */

import type {
  AssistantMessage,
  AssistantSpendRecord,
  AssistantStreamEvent,
  AssistantSubMode,
  CallerContext,
  ConversationHandle,
  TrustGateResult,
} from "./types";

/**
 * Conversational-LLM backend contract. Implementations may be:
 *  - `MockConversationAdapter` (Phase 0; canned responses, no LLM cost)
 *  - `LLMConversationalAdapter` (Phase 1; backed by founder-os#1244)
 *  - Future product-specific subclasses
 *
 * All methods are async. `sendTurn` returns an `AsyncIterable<AssistantStreamEvent>`
 * so the SSE endpoint can drive a streaming response without buffering the
 * full reply.
 */
export interface ConversationAdapter {
  /**
   * Open a new conversation under the given sub-mode. Returns a stable
   * handle that subsequent `sendTurn` calls reference. The implementation
   * MAY persist or MAY be stateless per-turn — callers should not assume
   * server-side state beyond the handle.
   */
  createConversation(subMode: AssistantSubMode): Promise<ConversationHandle>;

  /**
   * Send a new user turn into the conversation. Returns a streaming
   * sequence of `AssistantStreamEvent` values. The stream emits zero or
   * more `delta` events (the streaming text), then exactly one terminal
   * event — either `complete` (with the assembled assistant message) or
   * `error` (with retriable flag).
   *
   * `history` is the prior turns IN ORDER, oldest first. Phase 0 / v1
   * re-sends the full history each turn (stateless server side); v2 will
   * move to server-side memory.
   *
   * `caller` is the authoritative isolation scope — tools invoked via this
   * adapter MUST use `caller.associationId` + `caller.personId` for every
   * database query and reject any LLM-supplied arguments that don't match.
   */
  sendTurn(input: {
    conversation: ConversationHandle;
    userMessage: AssistantMessage;
    history: AssistantMessage[];
    caller: CallerContext;
  }): AsyncIterable<AssistantStreamEvent>;

  /**
   * Apply the trust-tier policy to a proposed action and return the
   * MAXIMUM tier allowed. The caller MUST refuse to invoke actions above
   * the returned tier. Phase 0 returns canned tier values; #1244's real
   * adapter consults the published trust model.
   *
   * Examples of `action` strings:
   *   - `"read.owner_balance"` (tier 1)
   *   - `"write.ycm.reminder"` (tier 2)
   *   - `"write.system.payment"` (tier 3)
   */
  applyTrustGate(action: string): Promise<TrustGateResult>;

  /**
   * Record the spend for a completed turn. Adapters may persist locally
   * (Phase 0 — write to `aiAssistantInteractions` table) or to a shared
   * service (Phase 1 via #1244 + #1183 cost-ceiling integration).
   */
  trackSpend(record: AssistantSpendRecord): Promise<void>;
}
