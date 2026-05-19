/**
 * AI Assistant — public value types (founder-os#1318, Phase 0).
 *
 * These types flow across the ConversationAdapter boundary. Their shape
 * MATCHES the public API that the founder-os#1244 shared "LLM-conversational
 * primitive" will export, so the Phase 1 wiring (when #1244 ships) is a
 * plug-replace at the DI seam, not a re-design across the resident chat
 * surface.
 *
 * Cross-product alignment:
 *   - Meridian Phase 0 reference (founder-os#1296, PR meridian#9) ships the
 *     analogous Swift types: `AssistantMessage`, `ConversationHandle`,
 *     `AssistantStreamEvent`, `TrustGateResult`, `AssistantSpendRecord`.
 *   - YCM mirrors those shapes in TypeScript here. The Anthropic Messages
 *     API role labels (`user` / `assistant` / `system`) are the canonical
 *     vocabulary so the Phase 1 adapter doesn't need a remapping layer.
 */

/**
 * The persona slice the resident chat surface exposes. Phase 0 ships
 * `resident` only — board / portfolio modes follow in Phase 1 (founder-os#1256).
 */
export type AssistantSubMode = "resident";

/**
 * A single message in the conversation. Role mirrors the Anthropic Messages
 * API shape so the Phase 1 adapter doesn't need to remap.
 */
export interface AssistantMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt: string; // ISO 8601
}

/**
 * Identifies a multi-turn conversation. Conversations are stateless at the
 * adapter layer in Phase 0 (and per #1244 v1 spec) — each turn re-sends the
 * prior message context as `history`. v2 will move session state to the
 * adapter / server side.
 */
export interface ConversationHandle {
  id: string;
  subMode: AssistantSubMode;
  createdAt: string; // ISO 8601
}

/**
 * Streaming events emitted by `sendTurn`. Mirrors Anthropic's streaming
 * shape so the #1244 published protocol drops in without reshape.
 *
 *  - `delta`    — append `text` to the current assistant message body.
 *  - `complete` — terminal; `finalMessage` is the full assembled assistant turn.
 *  - `error`    — terminal; `retriable` indicates whether the caller should retry.
 */
export type AssistantStreamEvent =
  | { type: "delta"; text: string }
  | { type: "complete"; finalMessage: AssistantMessage }
  | { type: "error"; reason: string; retriable: boolean };

/**
 * Trust tiers (mirrors Meridian's existing trust model + the #1244 spec):
 *
 *   - `tier1` — read-only, no side-effects
 *   - `tier2` — write to YCM-owned state (capture, reminders, ledger…)
 *   - `tier3` — write to user-owned external state (Calendar, payment rail…)
 *
 * `applyTrustGate` returns the MAXIMUM allowed tier for a given action;
 * callers MUST refuse to invoke actions above that tier.
 */
export type TrustTier = 1 | 2 | 3;

export interface TrustGateResult {
  action: string;
  allowedMaxTier: TrustTier;
  /** Reason returned for telemetry / audit. Phase 0 returns `phase-0-stub`. */
  reason: string;
}

/**
 * Spend-tracking record emitted per turn. #1244 specifies this as the
 * shared cost-accounting record across all four consumer products
 * (Meridian + YCM + VibeDispatcher + Duho).
 */
export interface AssistantSpendRecord {
  conversationId: string;
  turnIndex: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  estimatedCostUSD: number;
  model: string;
  recordedAt: string; // ISO 8601
}

/**
 * Caller identity for tool-layer isolation enforcement. Tools MUST use
 * these IDs as the only authoritative scope — never the LLM-supplied
 * arguments — to prevent cross-owner / cross-community data leaks.
 *
 * This is the same isolation pattern the existing `payment-portal.ts`
 * routes use: `req.portalAssociationId` + `req.portalPersonId` are the
 * source of truth; any `owner_id` argument in the request body is checked
 * against them and rejected on mismatch.
 */
export interface CallerContext {
  associationId: string;
  personId: string;
  unitIds: string[];
}
