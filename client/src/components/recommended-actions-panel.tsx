import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type RecommendedAction = {
  title: string;
  summary: string;
  href: string;
  cta: string;
  tone?: "default" | "warning" | "neutral";
};

export function RecommendedActionsPanel({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions: RecommendedAction[];
}) {
  return (
    <div className="rounded-xl border bg-muted/10 p-4 space-y-4">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <div className="space-y-3">
        {actions.map((action) => (
          <div key={`${action.href}:${action.title}`} className="rounded-lg border bg-background p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{action.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{action.summary}</div>
              </div>
              <Badge variant={action.tone === "warning" ? "destructive" : action.tone === "neutral" ? "secondary" : "default"}>
                {action.tone === "warning" ? "Attention" : action.tone === "neutral" ? "Queued" : "Ready"}
              </Badge>
            </div>
            <Button asChild size="sm" variant="outline" className="mt-3 min-h-11 w-full sm:w-auto">
              <Link href={action.href}>{action.cta}</Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
