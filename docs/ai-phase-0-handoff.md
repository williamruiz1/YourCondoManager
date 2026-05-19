# AI Assistant Phase 0 — handoff to Phase 1

**Per:** founder-os Issue #1318 — Phase 0 BUILD (scaffold + mock + plug-replace setup).
**Sister:** Meridian Phase 0 ([founder-os#1296](https://github.com/williamruiz1/founder-os/issues/1296), PR meridian#9). Same pattern, different language.

This doc is the explicit recipe for replacing `MockConversationAdapter` with the real `LLMConversationalAdapter` when founder-os#1244 (shared LLM-conversational primitive) ships. The Phase 0 design goal is that this swap is a one-line edit in one file — that's the leverage Phase 0 captures.

---

## What Phase 0 shipped

| File | Role |
|---|---|
| `server/services/ai-assistant/types.ts` | Value types matching #1244 public API (`AssistantMessage`, `ConversationHandle`, `AssistantStreamEvent`, `TrustGateResult`, `AssistantSpendRecord`, `CallerContext`). |
| `server/services/ai-assistant/adapter.ts` | `ConversationAdapter` interface — the protocol Phase 1 will conform to. |
| `server/services/ai-assistant/mock-adapter.ts` | `MockConversationAdapter` — Phase 0 implementation. Canned per-intent replies; simulated streaming; trust-gate stub; writes to `ai_assistant_interactions`. |
| `server/services/ai-assistant/tools.ts` | Three real read-only tools (`get_owner_balance`, `get_payment_history`, `get_next_payment_due`) with isolation enforcement at the tool layer. |
| `server/services/ai-assistant/index.ts` | DI seam — `boundAdapter` is the live instance. **Swap point for Phase 1.** |
| `server/routes/ai-assistant.ts` | Owner-portal SSE endpoint (`POST /api/ai/conversation`, `POST /api/ai/conversation/stream`). |
| `server/routes.ts` | Wires `registerAiAssistantRoutes`. |
| `shared/schema.ts` + `migrations/0030_ai_assistant_interactions.sql` | Audit-log table for every turn. Phase 0 writes mock cost/tokens; Phase 1 writes real values. |
| `shared/feature-flags.ts` | Adds `AI_ASSISTANT_ENABLED` (default OFF; per-association opt-in). |
| `client/src/components/ai-chat/AiChatWidget.tsx` | Collapsed FAB → expanded panel. Renders nothing unless the flag is ON for the active community. |
| `client/src/components/ai-chat/ConversationPanel.tsx` | Header + messages + composer. |
| `client/src/components/ai-chat/MessageBubble.tsx` | Single-turn bubble. |
| `client/src/components/ai-chat/SuggestedQuestions.tsx` | Three static starters that exercise each of the three tools. |
| `client/src/components/ai-chat/useAiConversation.ts` | Hook owning the SSE lifecycle. |
| `client/src/pages/portal/portal-shell.tsx` | Mounts `<AiChatWidget>` once globally for the portal. |
| `server/services/ai-assistant/__tests__/isolation.test.ts` | Cross-owner / cross-community isolation. 8 tests. |
| `server/services/ai-assistant/__tests__/adapter-contract.test.ts` | Protocol-contract sentinel any future adapter must pass. 9 tests. |

---

## How to swap to Phase 1 (when #1244 ships)

### Step 1 — add the dependency

Pull `@founder-os/llm-conversational` (or whatever package name #1244 lands at) via `pnpm add` (or whatever package manager the published library targets).

### Step 2 — implement `LLMConversationalAdapter`

Create `server/services/ai-assistant/llm-adapter.ts` that conforms to `ConversationAdapter`:

```ts
import type { ConversationAdapter } from "./adapter";
// import { LLMConversational } from "@founder-os/llm-conversational"; // when #1244 ships

export class LLMConversationalAdapter implements ConversationAdapter {
  createConversation(subMode) { /* delegate to #1244 */ }
  sendTurn(input) { /* delegate to #1244, pass tool registry */ }
  applyTrustGate(action) { /* delegate to #1244 trust model */ }
  trackSpend(record) { /* delegate to #1244 + write to ai_assistant_interactions */ }
}
```

Pass the existing `tools` registry from `tools.ts` to the LLM adapter so it can invoke `get_owner_balance` / `get_payment_history` / `get_next_payment_due` via the LLM's tool-use API. Isolation enforcement stays in `tools.ts` — the LLM adapter doesn't need to re-implement it.

### Step 3 — rebind the DI seam (the one-line swap)

In `server/services/ai-assistant/index.ts`:

```diff
- import { MockConversationAdapter } from "./mock-adapter";
- export const boundAdapter: ConversationAdapter = new MockConversationAdapter();
+ import { LLMConversationalAdapter } from "./llm-adapter";
+ export const boundAdapter: ConversationAdapter = new LLMConversationalAdapter({ /* config */ });
```

That's it. The route layer (`server/routes/ai-assistant.ts`), the React surface (`client/src/components/ai-chat/`), the audit-log table, the feature flag, the isolation guards — all unchanged.

### Step 4 — verify

```bash
# Type-check
pnpm exec tsc --noEmit

# Existing tests (266 pass on Phase 0; should still pass)
pnpm exec vitest run server/

# New: real adapter contract tests
pnpm exec vitest run server/services/ai-assistant/__tests__/
```

The contract tests in `adapter-contract.test.ts` apply equally to `LLMConversationalAdapter` — same `describe` block, swap the `new MockConversationAdapter(...)` for `new LLMConversationalAdapter(...)`.

### Step 5 — strip Phase 0 mock callouts in copy

User-facing copy referencing "Phase 0 mock" lives in:
- `client/src/components/ai-chat/ConversationPanel.tsx` (header subtitle)
- `server/services/ai-assistant/mock-adapter.ts` (canned reply prefixes — only fires if MockConversationAdapter is still bound)

Once the LLM adapter is bound, the mock copy never renders. Optional cleanup: change the header subtitle from "Phase 0 mock · real LLM lands with founder-os#1244" to something like "Powered by Anthropic Claude" — but this is a UX call, not a functional one.

---

## What stays mocked vs what's real in Phase 0

| Concern | Phase 0 reality |
|---|---|
| LLM reasoning | **Mocked** — keyword classifier picks a canned reply. |
| Streaming protocol (`delta` / `complete` / `error`) | **Real** — SSE frames match the #1244 spec. |
| Tool calls (`get_owner_balance`, `get_payment_history`, `get_next_payment_due`) | **Real** — wraps the existing ledger / payment-service. |
| Isolation enforcement | **Real** — `IsolationViolationError` fires on cross-owner / cross-community access. |
| Trust-gate (`tier1` / `tier2` / `tier3`) | **Stubbed** — prefix-based classifier. Phase 1 uses the #1244 trust model. |
| Audit-log table writes (`ai_assistant_interactions`) | **Real** — every turn persists; Phase 0 writes $0 cost + rough tokens. |
| Token / cost telemetry | **Mocked** — `cost_estimate=0`, `tokens_in/out` are ceil(chars/4). |
| Feature-flag gate (`AI_ASSISTANT_ENABLED` per-community) | **Real** — community-scoped opt-in via `getFeatureFlagForAssociation`. |
| Sentry capture on adapter errors | **Real** — observability wiring inherited from founder-os#1030. |

---

## Cherry Hill Court go-live

To turn on the assistant for CHC (per founder-os#971 + #1276):

```bash
fly secrets set FEATURE_FLAG_AI_ASSISTANT_ENABLED_<CHC_ASSOCIATION_ID_UNDERSCORED>=true -a ycm
```

Replace `<CHC_ASSOCIATION_ID_UNDERSCORED>` with the CHC association id with hyphens converted to underscores (per the `getFeatureFlagForAssociation` convention).

The widget appears in the CHC owner portal; other communities continue to see nothing. Phase 0 mock will quote real balance data via `get_owner_balance` against the CHC ledger.

---

## Cost-economics dashboard (#1261)

`ai_assistant_interactions` is the canonical surface the cost-economics dashboard reads against. In Phase 0 every row writes `cost_estimate=0` so the dashboard renders zero spend until Phase 1 ships. The dashboard's schema doesn't change between phases.

---

## Sibling tracking

- Strategist spec: founder-os#1153
- BUILD dispatch (this PR closes): founder-os#1318
- Shared primitive structural: founder-os#1244 (still OPEN — Phase 1 wiring waits on this)
- Phase 1 wiring dispatch: file after #1244 ships
- Meridian Phase 0: founder-os#1296 / PR meridian#9 (shipped 2026-05-17)
- Phase 1 board-facing: founder-os#1256 (spec; extends same architecture)
- Cost economics: founder-os#1261 (reads `ai_assistant_interactions`)
- Observability: founder-os#1030 (Sentry/GA4 — already merged YCM PR #125)
- Subscription gate: founder-os#1147 (Phase 1 will gate on active subscription)

---

## Lineage

- **2026-05-17** — Issue #1318 filed by YCM Strategist Round 9 (spec-to-build conversion per Meridian R8 pattern).
- **2026-05-17** — PARKED per fleet-capacity-block.
- **2026-05-20** — Phase 0 build authored; this handoff doc lands with the PR.
