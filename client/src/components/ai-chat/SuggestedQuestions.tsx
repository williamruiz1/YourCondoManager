/**
 * SuggestedQuestions — three context-aware starter prompts (founder-os#1318,
 * Phase 0).
 *
 * Surfaced when the conversation has zero turns. The Phase 1 adapter may
 * regenerate these dynamically against the owner's actual state; Phase 0
 * uses static prompts that exercise each of the three real tools so the
 * mock-to-real swap is invisible to the user.
 */

import { Button } from "@/components/ui/button";

const QUESTIONS = [
  "What's my balance?",
  "Show my recent payments.",
  "When is my next payment due?",
];

export interface SuggestedQuestionsProps {
  onPick: (text: string) => void;
  disabled?: boolean;
}

export function SuggestedQuestions({ onPick, disabled }: SuggestedQuestionsProps) {
  return (
    <div className="flex flex-col gap-2" data-testid="ai-chat-suggested-questions">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Suggested
      </span>
      {QUESTIONS.map((q) => (
        <Button
          key={q}
          variant="outline"
          size="sm"
          className="justify-start text-left"
          disabled={disabled}
          onClick={() => onPick(q)}
          data-testid={`ai-chat-suggested-${q.slice(0, 12).replace(/\W+/g, "-")}`}
        >
          {q}
        </Button>
      ))}
    </div>
  );
}
