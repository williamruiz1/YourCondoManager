/**
 * MessageBubble — renders a single chat turn (founder-os#1318, Phase 0).
 *
 * Per OP #19 (plain-English authoring): no clever abbreviations. Role
 * label is the visible identity ("You" / "Duho assistant" / "System").
 * The Phase 1 LLM swap doesn't touch this component.
 */

import { cn } from "@/lib/utils";

export interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  text: string;
}

const ROLE_LABEL: Record<MessageBubbleProps["role"], string> = {
  user: "You",
  assistant: "Assistant",
  system: "System",
};

export function MessageBubble({ role, text }: MessageBubbleProps) {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-1",
        isUser ? "items-end" : "items-start",
      )}
      data-testid={`ai-chat-message-${role}`}
    >
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {ROLE_LABEL[role]}
      </span>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-snug",
          isUser
            ? "bg-primary text-primary-foreground"
            : role === "system"
              ? "bg-muted text-muted-foreground italic"
              : "bg-muted text-foreground",
        )}
      >
        {text || (role === "assistant" ? "…" : "")}
      </div>
    </div>
  );
}
