// 4.2 Q3 addendum (3a): per-association amenities feature toggle.
//
// Rendered inside the Manager settings page. Manager (any scoped association)
// and self-managed Board Officer may toggle; the backend enforces the auth.
// When disabled, the owner portal sidebar entry is hidden and /portal/amenities
// returns a NotFound surface. Default state is enabled.
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type AmenitiesSettingsResponse = {
  amenitiesEnabled: boolean;
};

export function AmenitiesFeatureToggleCard({ associationId }: { associationId: string | null | undefined }) {
  const { toast } = useToast();
  const enabledKey = associationId
    ? ["/api/associations", associationId, "settings/amenities"] as const
    : null;

  const { data, isLoading, isError } = useQuery<AmenitiesSettingsResponse>({
    queryKey: enabledKey ?? ["amenities-feature-toggle", "noop"],
    enabled: !!associationId,
    queryFn: async () => {
      if (!associationId) return { amenitiesEnabled: true };
      const res = await fetch(`/api/associations/${associationId}/settings/amenities`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Failed to load amenities feature setting (${res.status})`);
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (nextValue: boolean) => {
      if (!associationId) throw new Error("No active association");
      const res = await apiRequest("PATCH", `/api/associations/${associationId}/settings/amenities`, {
        amenitiesEnabled: nextValue,
      });
      return res.json() as Promise<AmenitiesSettingsResponse>;
    },
    onSuccess: () => {
      if (enabledKey) queryClient.invalidateQueries({ queryKey: enabledKey });
      queryClient.invalidateQueries({ queryKey: ["/api/associations"] });
      toast({ title: "Amenities feature updated" });
    },
    onError: (err) => {
      toast({
        title: "Unable to update amenities feature",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const checked = data?.amenitiesEnabled ?? true;
  const disabled = !associationId || isLoading || isError || mutation.isPending;

  return (
    <Card data-testid="card-amenities-feature-toggle">
      <CardHeader>
        <CardTitle className="text-lg">Amenities feature</CardTitle>
        <CardDescription>
          Per-association control for the owner-portal Amenities surface.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Amenities feature</p>
            <p className="text-xs text-muted-foreground">
              Disable to hide the Amenities feature from the owner portal sidebar and return 404 from amenity pages.
            </p>
          </div>
          <Switch
            checked={checked}
            disabled={disabled}
            onCheckedChange={(v) => mutation.mutate(v)}
            data-testid="switch-amenities-feature"
            aria-label="Toggle amenities feature"
          />
        </div>
      </CardContent>
    </Card>
  );
}
