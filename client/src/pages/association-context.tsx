import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Document } from "@shared/schema";
import { Link } from "wouter";
import { Building2, DoorOpen, FileText, Home, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { useResidentialDataset } from "@/hooks/use-residential-dataset";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AssociationOverview = {
  associationId: string;
  units: number;
  activeOwners: number;
  activeOccupants: number;
  maintenanceOpen: number;
  maintenanceOverdue: number;
  paymentMethodsActive: number;
  onboardingState: "not-started" | "in-progress" | "blocked" | "complete";
  onboardingScorePercent: number;
  contactCoveragePercent: number;
};

const profileFormSchema = z.object({
  name: z.string().min(1, "Association name is required"),
  associationType: z.string().optional(),
  dateFormed: z.string().optional(),
  ein: z.string().trim().regex(/^\d{2}-\d{7}$/, "Use EIN format XX-XXXXXXX").optional().or(z.literal("")),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  country: z.string().min(1, "Country is required"),
});

export default function AssociationContextPage() {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const { activeAssociationId, activeAssociation, activeAssociationName } = useActiveAssociation();
  const { data: residentialDataset, isLoading: residentialLoading } = useResidentialDataset();
  const { toast } = useToast();
  const { data: overview, isLoading: overviewLoading } = useQuery<AssociationOverview>({
    queryKey: [activeAssociationId ? `/api/associations/${activeAssociationId}/overview` : "/api/associations/none/overview"],
    enabled: Boolean(activeAssociationId),
  });
  const { data: documents = [], isLoading: documentsLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
    enabled: Boolean(activeAssociationId),
  });
  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      associationType: "",
      dateFormed: "",
      ein: "",
      address: "",
      city: "",
      state: "",
      country: "USA",
    },
  });

  useEffect(() => {
    profileForm.reset({
      name: activeAssociation?.name ?? "",
      associationType: activeAssociation?.associationType ?? "",
      dateFormed: activeAssociation?.dateFormed ?? "",
      ein: activeAssociation?.ein ?? "",
      address: activeAssociation?.address ?? "",
      city: activeAssociation?.city ?? "",
      state: activeAssociation?.state ?? "",
      country: activeAssociation?.country ?? "USA",
    });
  }, [activeAssociation, profileForm]);

  const updateProfileMutation = useMutation({
    mutationFn: async (values: z.infer<typeof profileFormSchema>) => {
      if (!activeAssociationId) throw new Error("No association selected");
      await apiRequest("PATCH", `/api/associations/${activeAssociationId}`, values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/associations"),
      });
      setIsEditingProfile(false);
      toast({ title: "Association profile updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const buildingGroups = useMemo(() => {
    const units = residentialDataset?.units ?? [];
    const occupancies = residentialDataset?.occupancies ?? [];
    const ownerships = residentialDataset?.ownerships ?? [];
    const activeOccupancyByUnit = new Map(
      occupancies.map((occupancy) => [occupancy.unitId, occupancy]),
    );
    const ownershipCountByUnit = new Map<string, number>();
    for (const ownership of ownerships) {
      ownershipCountByUnit.set(ownership.unitId, (ownershipCountByUnit.get(ownership.unitId) ?? 0) + 1);
    }

    const groups = new Map<string, Array<{
      id: string;
      unitNumber: string;
      ownershipCount: number;
      occupancyType: string | null;
    }>>();

    for (const unit of units) {
      const buildingKey = unit.building?.trim() || "Unassigned Building";
      const rows = groups.get(buildingKey) ?? [];
      rows.push({
        id: unit.id,
        unitNumber: unit.unitNumber,
        ownershipCount: ownershipCountByUnit.get(unit.id) ?? 0,
        occupancyType: activeOccupancyByUnit.get(unit.id)?.occupancyType ?? null,
      });
      groups.set(buildingKey, rows);
    }

    return Array.from(groups.entries())
      .map(([building, units]) => ({
        building,
        unitCount: units.length,
        units: units.sort((left, right) => left.unitNumber.localeCompare(right.unitNumber)),
      }))
      .sort((left, right) => left.building.localeCompare(right.building));
  }, [residentialDataset]);

  if (!activeAssociationId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Select an association context from the header to open the in-context association workspace.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{activeAssociationName || "Association Context"}</h1>
        <p className="text-muted-foreground">
          In-context workspace for this association: overview, documents, and building hierarchy.
        </p>
      </div>

      <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Association Profile</CardTitle>
            <div className="flex gap-2">
              {isEditingProfile ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      profileForm.reset({
                        name: activeAssociation?.name ?? "",
                        associationType: activeAssociation?.associationType ?? "",
                        dateFormed: activeAssociation?.dateFormed ?? "",
                        ein: activeAssociation?.ein ?? "",
                        address: activeAssociation?.address ?? "",
                        city: activeAssociation?.city ?? "",
                        state: activeAssociation?.state ?? "",
                        country: activeAssociation?.country ?? "USA",
                      });
                      setIsEditingProfile(false);
                    }}
                    disabled={updateProfileMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={profileForm.handleSubmit((values) => updateProfileMutation.mutate(values))}
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </>
              ) : (
                <Button type="button" size="sm" onClick={() => setIsEditingProfile(true)}>
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            {overviewLoading ? <Skeleton className="h-32 w-full" /> : (
              <>
                {isEditingProfile ? (
                  <Form {...profileForm}>
                    <form className="space-y-4" onSubmit={profileForm.handleSubmit((values) => updateProfileMutation.mutate(values))}>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <FormField control={profileForm.control} name="name" render={({ field }) => (
                          <FormItem className="xl:col-span-2">
                            <FormLabel>Association Name</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={profileForm.control} name="associationType" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <FormControl><Input placeholder="Condominium Management Association" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={profileForm.control} name="dateFormed" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date Formed</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={profileForm.control} name="ein" render={({ field }) => (
                          <FormItem>
                            <FormLabel>EIN</FormLabel>
                            <FormControl><Input placeholder="06-1513429" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={profileForm.control} name="address" render={({ field }) => (
                          <FormItem className="xl:col-span-3">
                            <FormLabel>Address</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={profileForm.control} name="city" render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={profileForm.control} name="state" render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={profileForm.control} name="country" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </form>
                  </Form>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <ReadOnlyField label="Association Name" value={activeAssociation?.name} className="xl:col-span-2" />
                    <ReadOnlyField label="Type" value={activeAssociation?.associationType} />
                    <ReadOnlyField label="Date Formed" value={activeAssociation?.dateFormed} />
                    <ReadOnlyField label="EIN" value={activeAssociation?.ein} />
                    <ReadOnlyField label="Address" value={activeAssociation?.address} className="xl:col-span-3" />
                    <ReadOnlyField label="City" value={activeAssociation?.city} />
                    <ReadOnlyField label="State" value={activeAssociation?.state} />
                    <ReadOnlyField label="Country" value={activeAssociation?.country} />
                  </div>
                )}
                <div className="rounded-xl border bg-muted/10 p-4 space-y-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold">Portfolio Snapshot</div>
                      <div className="text-xs text-muted-foreground">
                        Key health indicators for setup, resident coverage, and daily operations.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">State: {formatOnboardingState(overview?.onboardingState)}</Badge>
                      <Badge variant={overview?.contactCoveragePercent && overview.contactCoveragePercent >= 70 ? "default" : "destructive"}>
                        Contact Coverage: {overview?.contactCoveragePercent ?? 0}%
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <KpiCard
                      title="Onboarding Progress"
                      value={`${overview?.onboardingScorePercent ?? 0}%`}
                      tone={(overview?.onboardingScorePercent ?? 0) >= 80 ? "positive" : (overview?.onboardingScorePercent ?? 0) >= 50 ? "neutral" : "warning"}
                      description="Completion of core setup required to operate the association smoothly."
                      icon={Building2}
                    />
                    <KpiCard
                      title="Payment Methods"
                      value={String(overview?.paymentMethodsActive ?? 0)}
                      tone={(overview?.paymentMethodsActive ?? 0) > 0 ? "positive" : "warning"}
                      description="Active resident payment options currently available for this association."
                      icon={Building2}
                    />
                    <KpiCard
                      title="Maintenance Backlog"
                      value={String(overview?.maintenanceOpen ?? 0)}
                      secondaryValue={`${overview?.maintenanceOverdue ?? 0} overdue`}
                      tone={(overview?.maintenanceOverdue ?? 0) > 0 ? "warning" : "positive"}
                      description="Open requests that still need attention, with overdue work called out."
                      icon={Building2}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <CompactMetric label="Units" value={overview?.units ?? 0} icon={DoorOpen} />
                    <CompactMetric label="Owners" value={overview?.activeOwners ?? 0} icon={Users} />
                    <CompactMetric label="Occupants" value={overview?.activeOccupants ?? 0} icon={Home} />
                    <CompactMetric label="Documents" value={documents.length} icon={FileText} />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Buildings and Units</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link href="/units">Manage Units</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {residentialLoading ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : buildingGroups.length === 0 ? (
            <div className="text-sm text-muted-foreground">No buildings or units are configured for this association.</div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {buildingGroups.map((group) => (
                <div key={group.building} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{group.building}</div>
                      <div className="text-xs text-muted-foreground">{group.unitCount} units</div>
                    </div>
                    <Badge variant="secondary">{group.unitCount}</Badge>
                  </div>
                  <div className="space-y-2">
                    {group.units.map((unit) => (
                      <div key={unit.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-sm">
                        <span>Unit {unit.unitNumber}</span>
                        <div className="flex gap-2">
                          <Badge variant="outline">{unit.ownershipCount} owners</Badge>
                          <Badge variant={unit.occupancyType === "TENANT" ? "secondary" : "default"}>
                            {unit.occupancyType === "OWNER_OCCUPIED" ? "Owner Occupied" : unit.occupancyType === "TENANT" ? "Tenant" : "No Occupancy"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Association Documents</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link href="/documents">Open Documents</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {documentsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-sm text-muted-foreground">No documents uploaded for this association yet.</div>
          ) : (
            documents.slice(0, 8).map((document) => (
              <div key={document.id} className="rounded-md border p-3">
                <div className="font-medium">{document.title}</div>
                <div className="text-xs text-muted-foreground">{document.documentType}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CompactMetric({
  label,
  value,
  icon: Icon,
  suffix = "",
}: {
  label: string;
  value: number;
  icon: typeof Building2;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-3">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-xl font-semibold">{value}{suffix}</div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
  secondaryValue,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Building2;
  tone: "positive" | "neutral" | "warning";
  secondaryValue?: string;
}) {
  const toneClassName = tone === "positive"
    ? "border-emerald-200 bg-emerald-50/70"
    : tone === "warning"
      ? "border-amber-200 bg-amber-50/70"
      : "border-border bg-background";

  return (
    <div className={`rounded-xl border px-4 py-4 ${toneClassName}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
          <div className="mt-2 text-2xl font-semibold">{value}</div>
          {secondaryValue ? <div className="mt-1 text-sm text-muted-foreground">{secondaryValue}</div> : null}
        </div>
        <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 text-xs leading-5 text-muted-foreground">{description}</div>
    </div>
  );
}

function formatOnboardingState(state?: AssociationOverview["onboardingState"]) {
  if (!state) return "Unknown";
  return state
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function ReadOnlyField({ label, value, className = "" }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={`rounded-lg border px-3 py-3 ${className}`.trim()}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value?.trim() ? value : "-"}</div>
    </div>
  );
}
