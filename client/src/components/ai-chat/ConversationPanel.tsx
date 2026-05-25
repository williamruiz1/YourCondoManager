/**
 * ConversationPanel — streaming message list + input (founder-os#1318, Phase 0).
 *
 * Hosts the in-conversation UI: scroll area of past messages, an input
 * + send button, and surfacing of streaming partials as they arrive.
 * Uses `useAiConversation()` so the Phase 1 LLM swap is invisible here.
 */

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./MessageBubble";
import { SuggestedQuestions } from "./SuggestedQuestions";
import { useAiConversation } from "./useAiConversation";

interface ChatOpenerResponse {
  opener: string;
  items: Array<{ id: string; title: string }>;
}

export function ConversationPanel({ onClose }: { onClose?: () => void }) {
  const { messages, pending, error, sendTurn, reset } = useAiConversation();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // founder-os#1256 Phase 1 — load the pressing-items-primed chat opener.
  // Quietly degrades to the legacy SuggestedQuestions block if the endpoint
  // errors (older Phase-0 deployment, feature flag off, etc.).
  const { data: openerData } = useQuery<ChatOpenerResponse>({
    queryKey: ["ai-chat-opener"],
    queryFn: async () => {
      const res = await fetch("/api/ai/chat-opener", { credentials: "include" });
      if (!res.ok) throw new Error(`chat-opener ${res.status}`);
      return res.json();
    },
    enabled: messages.length === 0,
    retry: false,
    staleTime: 60_000,
  });

  // Auto-scroll to bottom on new messages / streaming.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSubmit = (text: string) => {
    if (!text.trim() || pending) return;
    void sendTurn(text);
    setDraft("");
  };

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      data-testid="ai-chat-conversation-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2">
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">Assistant</span>
          <span className="text-[10px] text-muted-foreground">
            Phase 0 mock · real LLM lands with founder-os#1244
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={reset}
            disabled={pending || messages.length === 0}
            aria-label="Reset conversation"
            data-testid="ai-chat-reset"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} data-testid="ai-chat-close">
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Messages or suggestions */}
      <ScrollArea className="flex-1 px-3 py-3" data-testid="ai-chat-scroll">
        <div ref={scrollRef} className="flex flex-col gap-3">
          {messages.length === 0 ? (
            <>
              {openerData?.opener ? (
                <div
                  className="rounded-lg border border-border bg-muted/40 p-3 text-sm"
                  data-testid="ai-chat-opener"
                >
                  {openerData.opener}
                </div>
              ) : null}
              <SuggestedQuestions onPick={handleSubmit} disabled={pending} />
            </>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} role={m.role} text={m.text} />)
          )}
        </div>
      </ScrollArea>

      {error && (
        <div className="border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive" data-testid="ai-chat-error">
          {error}
        </div>
      )}

      {/* Composer */}
      <form
        className="flex items-center gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(draft);
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={pending ? "Assistant is replying…" : "Ask about your account…"}
          disabled={pending}
          data-testid="ai-chat-input"
          aria-label="Message the assistant"
        />
        <Button
          type="submit"
          size="icon"
          disabled={pending || !draft.trim()}
          aria-label="Send message"
          data-testid="ai-chat-send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
