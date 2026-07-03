/**
 * AiChatWidget — collapsed-FAB → expanded-panel for the owner portal
 * resident chat surface (founder-os#1318, Phase 0).
 *
 * Renders nothing unless the AI_ASSISTANT_ENABLED feature flag is ON for
 * the active community (default OFF; CHC opts in at go-live per
 * FEATURE_FLAG_AI_ASSISTANT_ENABLED_<association_id>).
 *
 * Phase 0 = scaffolding. The mock adapter behind the SSE endpoint quotes
 * real ledger data via the three tool stubs but cannot reason over it
 * yet — that lands with the Phase 1 wire-up (founder-os#1244).
 */

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { getFeatureFlagForAssociation } from "@shared/feature-flags";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConversationPanel } from "./ConversationPanel";

export interface AiChatWidgetProps {
  /** Active community / association id — the feature-flag scope. */
  associationId: string | null | undefined;
}

export function AiChatWidget({ associationId }: AiChatWidgetProps) {
  const [open, setOpen] = useState(false);

  // Feature-flag gate. The flag is read PER community so CHC can have it
  // on while everyone else stays off.
  const enabled = associationId
    ? getFeatureFlagForAssociation("AI_ASSISTANT_ENABLED", associationId)
    : false;

  if (!enabled) return null;

  if (!open) {
    return (
      <Button
        size="lg"
        className="fixed bottom-20 right-6 z-40 h-14 w-14 rounded-full shadow-lg md:bottom-6"
        onClick={() => setOpen(true)}
        aria-label="Open assistant"
        data-testid="ai-chat-launcher"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-20 right-6 z-40 flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl md:bottom-6",
        "h-[28rem] w-[22rem] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]",
      )}
      data-testid="ai-chat-widget"
      role="dialog"
      aria-label="Assistant"
    >
      <ConversationPanel onClose={() => setOpen(false)} />
    </div>
  );
}
