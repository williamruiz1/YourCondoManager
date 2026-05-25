/**
 * AI Assistant — DI seam (founder-os#1318 Phase 0; founder-os#1256 Phase 1).
 *
 * Phase 0 bound the `MockConversationAdapter`. Phase 1 (this rev) selects
 * the `LLMConversationAdapter` when `ANTHROPIC_API_KEY` is set, falling
 * back to the mock when it isn't. The fallback keeps local dev + CI
 * working without a key while production gets the real Claude 3.5 Sonnet
 * adapter.
 */

import type { ConversationAdapter } from "./adapter";
import { MockConversationAdapter } from "./mock-adapter";
import { LLMConversationAdapter, isLLMAdapterReady } from "./llm-adapter";

function selectAdapter(): ConversationAdapter {
  if (isLLMAdapterReady()) {
    return new LLMConversationAdapter();
  }
  return new MockConversationAdapter();
}

export const boundAdapter: ConversationAdapter = selectAdapter();

// Re-exports so consumers import from one place.
export type { ConversationAdapter } from "./adapter";
export type {
  AssistantMessage,
  AssistantSpendRecord,
  AssistantStreamEvent,
  AssistantSubMode,
  CallerContext,
  ConversationHandle,
  TrustGateResult,
  TrustTier,
} from "./types";
export { MockConversationAdapter } from "./mock-adapter";
export { LLMConversationAdapter, isLLMAdapterReady } from "./llm-adapter";
export { tools, TOOL_NAMES, IsolationViolationError } from "./tools";
export type { ToolName } from "./tools";
