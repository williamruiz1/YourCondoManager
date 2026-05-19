/**
 * AI Assistant — DI seam (founder-os#1318, Phase 0).
 *
 * One file, one line. This module exports `boundAdapter` — the concrete
 * `ConversationAdapter` implementation the route layer consumes. At Phase 1
 * (when founder-os#1244 ships) the rebind is a single edit here:
 *
 *   import { LLMConversationalAdapter } from "@founder-os/llm-conversational";
 *   export const boundAdapter: ConversationAdapter = new LLMConversationalAdapter({ ... });
 *
 * Everything else — types, route handlers, components, tests — stays the
 * same. That's the leverage Phase 0 is designed to capture.
 */

import type { ConversationAdapter } from "./adapter";
import { MockConversationAdapter } from "./mock-adapter";

export const boundAdapter: ConversationAdapter = new MockConversationAdapter();

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
export { tools, TOOL_NAMES, IsolationViolationError } from "./tools";
export type { ToolName } from "./tools";
