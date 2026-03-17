import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HelpTooltipProps {
  content: string;
  className?: string;
}

/**
 * Small inline help icon with a tooltip explaining a field or action.
 * Place next to form labels, column headers, or complex controls.
 */
export function HelpTooltip({ content, className }: HelpTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle
            className={cn("h-3.5 w-3.5 text-muted-foreground cursor-help inline-block ml-1 align-middle", className)}
          />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-sm leading-relaxed">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
