/**
 * useAiConversation — React hook that owns the AI chat conversation
 * lifecycle (founder-os#1318, Phase 0).
 *
 * Responsibilities:
 *   - Open a conversation handle (POST /api/ai/conversation)
 *   - Send a user turn (POST /api/ai/conversation/stream) and consume the
 *     SSE stream, appending deltas to the active assistant message
 *   - Track the full message history for the next turn's `history` payload
 *   - Expose `pending`, `error`, and `messages` for the UI
 *
 * The hook is adapter-agnostic — it speaks only HTTP/SSE to the server.
 * Whether the server is running the Phase 0 mock or the Phase 1 LLM
 * primitive is invisible from here.
 */

import { useCallback, useRef, useState } from "react";

export interface UiMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt: string;
}

export interface ConversationHandle {
  id: string;
  subMode: string;
  createdAt: string;
}

interface SSEDelta { type: "delta"; text: string }
interface SSEComplete { type: "complete"; finalMessage: UiMessage }
interface SSEError { type: "error"; reason: string; retriable: boolean }
type SSEEvent = SSEDelta | SSEComplete | SSEError;

function makeId(): string {
  // crypto.randomUUID is available in modern browsers + jsdom.
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useAiConversation() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<ConversationHandle | null>(null);

  const ensureHandle = useCallback(async (): Promise<ConversationHandle> => {
    if (handleRef.current) return handleRef.current;
    const res = await fetch("/api/ai/conversation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ subMode: "resident" }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Failed to open conversation (${res.status}): ${detail || res.statusText}`);
    }
    const handle = (await res.json()) as ConversationHandle;
    handleRef.current = handle;
    return handle;
  }, []);

  const sendTurn = useCallback(
    async (userText: string) => {
      const trimmed = userText.trim();
      if (!trimmed || pending) return;
      setPending(true);
      setError(null);

      const userMessage: UiMessage = {
        id: makeId(),
        role: "user",
        text: trimmed,
        createdAt: new Date().toISOString(),
      };
      // Append the user turn immediately so the UI feels responsive.
      setMessages((prev) => [...prev, userMessage]);

      try {
        const handle = await ensureHandle();
        const historySnapshot = [...messages, userMessage];

        const res = await fetch("/api/ai/conversation/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            conversation: handle,
            userMessage,
            history: historySnapshot.slice(0, -1), // exclude the message we're sending
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`Stream request failed (${res.status})`);
        }

        const assistantId = makeId();
        const placeholder: UiMessage = {
          id: assistantId,
          role: "assistant",
          text: "",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, placeholder]);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let accumulated = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          // SSE events are separated by `\n\n`. Each "data: …" line is JSON.
          let idx: number;
          while ((idx = buf.indexOf("\n\n")) !== -1) {
            const frame = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 2);
            if (!frame.startsWith("data:")) continue;
            const payload = frame.replace(/^data:\s*/, "");
            let event: SSEEvent;
            try {
              event = JSON.parse(payload) as SSEEvent;
            } catch {
              continue;
            }

            if (event.type === "delta") {
              accumulated += event.text;
              const snapshot = accumulated;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, text: snapshot } : m)),
              );
            } else if (event.type === "complete") {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? event.finalMessage : m)),
              );
              setPending(false);
              return;
            } else if (event.type === "error") {
              setError(event.reason);
              setMessages((prev) => prev.filter((m) => m.id !== assistantId));
              setPending(false);
              return;
            }
          }
        }

        // Stream ended without a terminal event — surface as an error.
        setError("Stream ended unexpectedly");
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setPending(false);
      }
    },
    [ensureHandle, messages, pending],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    handleRef.current = null;
  }, []);

  return { messages, pending, error, sendTurn, reset };
}
