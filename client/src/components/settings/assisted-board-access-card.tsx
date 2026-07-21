import { useMutation } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAssistedBoardAccess } from "@/hooks/use-assisted-board-access";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ASSISTED_BOARD_FEATURES,
  delegatedToggleKey,
  type AssistedBoardFeatureId,
  type DelegatedPermission,
  type DelegatedTargetRole,
} from "@shared/delegated-feature-access";

interface AssistedBoardAccessCardProps {
  associationId: string | null;
  targetRole?: DelegatedTargetRole;
}

export function AssistedBoardAccessCard({
  associationId,
  targetRole = "assisted-board",
}: AssistedBoardAccessCardProps) {
  const { toast } = useToast();
  const { access, isLoading, isError } = useAssistedBoardAccess(
    associationId,
    targetRole,
  );
  const updateAccess = useMutation({
    mutationFn: async (input: {
      featureId: AssistedBoardFeatureId;
      permission: DelegatedPermission;
      enabled: boolean;
    }) => {
      if (!associationId) throw new Error("Select an association first.");
      const toggleKey = delegatedToggleKey(input.featureId, input.permission);
      const response = await apiRequest(
        "PUT",
        `/api/associations/${encodeURIComponent(associationId)}/pm-toggles/${encodeURIComponent(toggleKey)}`,
        { enabled: input.enabled, targetRole },
      );
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["pm-toggles", associationId, targetRole],
      });
      toast({
        title: "Delegated access updated",
        description: `The ${targetRole === "pm-assistant" ? "PM Assistant" : "Assisted Board"} envelope now applies to this association.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Delegated access was not updated",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const grouped = ASSISTED_BOARD_FEATURES.reduce((result, feature) => {
    const existing = result.get(feature.zone) ?? [];
    result.set(feature.zone, [...existing, feature]);
    return result;
  }, new Map<string, Array<(typeof ASSISTED_BOARD_FEATURES)[number]>>());

  return (
    <Card data-testid="assisted-board-access-card">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">
            {targetRole === "pm-assistant" ? "Property Manager Assistant access" : "Assisted Board access"}
          </CardTitle>
          <Badge variant="secondary">Manager controlled</Badge>
        </div>
        <CardDescription>
          Configure View and Write separately for {targetRole === "pm-assistant"
            ? "all Property Manager Assistants assigned to"
            : "board members in"} the active PM-managed association. Platform
          administration, AI controls, and commercial billing are never delegable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!associationId ? (
          <p className="text-sm text-muted-foreground">
            Select an association to configure delegated access.
          </p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Loading delegated access…</p>
        ) : isError ? (
          <p className="text-sm text-destructive">
            Delegated access could not be loaded for this association.
          </p>
        ) : (
          Array.from(grouped.entries()).map(([zone, features], zoneIndex) => (
            <div key={zone} className="space-y-3">
              {zoneIndex > 0 ? <Separator /> : null}
              <div>
                <h3 className="text-sm font-semibold">{zone}</h3>
                <p className="text-xs text-muted-foreground">
                  These permissions apply only inside the selected association.
                </p>
              </div>
              <div className="space-y-3">
                {features.map((feature) => {
                  const permissions = access[feature.id];
                  const pending = updateAccess.isPending;
                  return (
                    <div
                      key={feature.id}
                      className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                    >
                      <div>
                        <p className="text-sm font-medium">{feature.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                      <label className="flex items-center justify-between gap-2 text-xs">
                        <span>View</span>
                        <Switch
                          aria-label={`${feature.label} view access`}
                          checked={permissions.view}
                          disabled={pending}
                          onCheckedChange={(enabled) =>
                            updateAccess.mutate({
                              featureId: feature.id,
                              permission: "view",
                              enabled,
                            })
                          }
                        />
                      </label>
                      <label className="flex items-center justify-between gap-2 text-xs">
                        <span>Write</span>
                        <Switch
                          aria-label={`${feature.label} write access`}
                          checked={permissions.write}
                          disabled={pending || !permissions.view}
                          onCheckedChange={(enabled) =>
                            updateAccess.mutate({
                              featureId: feature.id,
                              permission: "write",
                              enabled,
                            })
                          }
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
