import { Link } from "wouter";
import { Building2, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function AssociationScopeBanner({
  activeAssociationId,
  activeAssociationName,
  explanation,
  compact = false,
}: {
  activeAssociationId?: string | null;
  activeAssociationName?: string | null;
  explanation: string;
  compact?: boolean;
}) {
  const hasAssociation = Boolean(activeAssociationId);

  return (
    <div className={`rounded-xl border ${hasAssociation ? "bg-muted/30" : "border-dashed bg-amber-50/60"} px-4 py-3`}>
      <div className={`flex ${compact ? "items-center" : "items-start"} justify-between gap-4 flex-wrap`}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-background p-2 border">
            {hasAssociation ? <Building2 className="h-4 w-4" /> : <ArrowRightLeft className="h-4 w-4" />}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm font-medium">
                {hasAssociation ? (activeAssociationName || "Current association") : "Association context required"}
              </div>
              {hasAssociation ? <Badge variant="secondary">Scoped workspace</Badge> : <Badge variant="outline">No active scope</Badge>}
            </div>
            <div className="text-sm text-muted-foreground">{explanation}</div>
          </div>
        </div>
        <Button asChild size="sm" variant={hasAssociation ? "outline" : "default"}>
          <Link href="/app/association-context">{hasAssociation ? "Open Context" : "Set Context"}</Link>
        </Button>
      </div>
    </div>
  );
}
