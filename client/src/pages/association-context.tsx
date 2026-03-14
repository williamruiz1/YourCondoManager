import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Document, OnboardingInvite, OnboardingSubmission } from "@shared/schema";
import { Link } from "wouter";
import { Building2, DoorOpen, FileText, Home, Mail, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const [inviteForm, setInviteForm] = useState({
    unitId: "",
    residentType: "owner" as "owner" | "tenant",
    email: "",
    phone: "",
    expiresAt: "",
  });
  const [reminderSweepHours, setReminderSweepHours] = useState("24");
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
  const { data: onboardingState, isLoading: onboardingStateLoading } = useQuery<{
    associationId: string;
    state: "not-started" | "in-progress" | "blocked" | "complete";
    blockers: string[];
    remediationActions: string[];
    scorePercent: number;
  }>({
    queryKey: [activeAssociationId ? `/api/onboarding/state?associationId=${activeAssociationId}` : "/api/onboarding/state"],
    enabled: Boolean(activeAssociationId),
  });
  const { data: onboardingInvites = [] } = useQuery<Array<OnboardingInvite & { unitLabel?: string; associationName?: string }>>({
    queryKey: [activeAssociationId ? `/api/onboarding/invites?associationId=${activeAssociationId}` : "/api/onboarding/invites"],
    enabled: Boolean(activeAssociationId),
  });
  const { data: onboardingSubmissions = [] } = useQuery<Array<OnboardingSubmission & {
    unitLabel?: string;
    associationName?: string;
    inviteEmail?: string | null;
    matchedPersonId?: string | null;
    matchBasis?: "email" | "name" | "none";
    reviewNotes?: string[];
  }>>({
    queryKey: [activeAssociationId ? `/api/onboarding/submissions?associationId=${activeAssociationId}` : "/api/onboarding/submissions"],
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

  const unitInviteCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const invite of onboardingInvites) {
      map.set(invite.unitId, (map.get(invite.unitId) ?? 0) + 1);
    }
    return map;
  }, [onboardingInvites]);

  const latestSubmissionByUnit = useMemo(() => {
    const map = new Map<string, OnboardingSubmission>();
    for (const submission of onboardingSubmissions) {
      const current = map.get(submission.unitId);
      if (!current || new Date(submission.submittedAt).getTime() > new Date(current.submittedAt).getTime()) {
        map.set(submission.unitId, submission);
      }
    }
    return map;
  }, [onboardingSubmissions]);

  const onboardingMetrics = useMemo(() => {
    const pending = onboardingSubmissions.filter((row) => row.status === "pending").length;
    const approved = onboardingSubmissions.filter((row) => row.status === "approved").length;
    const rejected = onboardingSubmissions.filter((row) => row.status === "rejected").length;
    const activeInvites = onboardingInvites.filter((row) => row.status === "active").length;
    const sentInvites = onboardingInvites.filter((row) => Boolean(row.lastSentAt)).length;
    return {
      totalUnits: residentialDataset?.units?.length ?? 0,
      activeInvites,
      sentInvites,
      pending,
      approved,
      rejected,
    };
  }, [onboardingInvites, onboardingSubmissions, residentialDataset]);

  const unitCoverageRows = useMemo(() => {
    const ownerships = residentialDataset?.ownerships ?? [];
    const occupancies = residentialDataset?.occupancies ?? [];
    const units = residentialDataset?.units ?? [];
    const activeOwnershipCountByUnit = new Map<string, number>();
    const activeOccupancyCountByUnit = new Map<string, number>();
    const now = Date.now();
    for (const ownership of ownerships) {
      const start = new Date(ownership.startDate).getTime();
      const end = ownership.endDate ? new Date(ownership.endDate).getTime() : null;
      if (start <= now && (end == null || end >= now)) {
        activeOwnershipCountByUnit.set(ownership.unitId, (activeOwnershipCountByUnit.get(ownership.unitId) ?? 0) + 1);
      }
    }
    for (const occupancy of occupancies) {
      const start = new Date(occupancy.startDate).getTime();
      const end = occupancy.endDate ? new Date(occupancy.endDate).getTime() : null;
      if (start <= now && (end == null || end >= now)) {
        activeOccupancyCountByUnit.set(occupancy.unitId, (activeOccupancyCountByUnit.get(occupancy.unitId) ?? 0) + 1);
      }
    }

    return units
      .map((unit) => {
        const ownerCount = activeOwnershipCountByUnit.get(unit.id) ?? 0;
        const occupantCount = activeOccupancyCountByUnit.get(unit.id) ?? 0;
        const latestSubmission = latestSubmissionByUnit.get(unit.id);
        const inviteCount = unitInviteCount.get(unit.id) ?? 0;
        const coverageStatus = ownerCount > 0 || occupantCount > 0
          ? "claimed"
          : latestSubmission?.status === "pending"
            ? "pending-review"
            : inviteCount > 0
              ? "invited"
              : "unclaimed";
        return {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          building: unit.building?.trim() || "Unassigned Building",
          ownerCount,
          occupantCount,
          inviteCount,
          latestSubmission,
          coverageStatus,
        };
      })
      .sort((left, right) => {
        if (left.building !== right.building) return left.building.localeCompare(right.building);
        return left.unitNumber.localeCompare(right.unitNumber);
      });
  }, [residentialDataset, latestSubmissionByUnit, unitInviteCount]);

  const createInviteMutation = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("Association is required");
      if (!inviteForm.unitId) throw new Error("Unit is required");
      const res = await apiRequest("POST", "/api/onboarding/invites", {
        associationId: activeAssociationId,
        unitId: inviteForm.unitId,
        residentType: inviteForm.residentType,
        email: inviteForm.email.trim() || null,
        phone: inviteForm.phone.trim() || null,
        deliveryChannel: "link",
        expiresAt: inviteForm.expiresAt ? new Date(inviteForm.expiresAt).toISOString() : null,
      });
      return res.json() as Promise<OnboardingInvite & { inviteUrl: string }>;
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: [activeAssociationId ? `/api/onboarding/invites?associationId=${activeAssociationId}` : "/api/onboarding/invites"] });
      setInviteForm({
        unitId: "",
        residentType: "owner",
        email: "",
        phone: "",
        expiresAt: "",
      });
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(result.inviteUrl);
      }
      toast({ title: "Onboarding invite created", description: "Invite URL copied to clipboard when supported." });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const sendInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await apiRequest("POST", `/api/onboarding/invites/${inviteId}/send`, {});
      return res.json() as Promise<{ delivery: { status: "sent" | "failed"; errorMessage?: string | null } }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [activeAssociationId ? `/api/onboarding/invites?associationId=${activeAssociationId}` : "/api/onboarding/invites"] });
      toast({
        title: result.delivery.status === "sent" ? "Invite sent" : "Invite failed",
        description: result.delivery.errorMessage || undefined,
        variant: result.delivery.status === "sent" ? "default" : "destructive",
      });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const reminderSweepMutation = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("Association is required");
      const res = await apiRequest("POST", "/api/onboarding/invites/reminders/run", {
        associationId: activeAssociationId,
        olderThanHours: Number(reminderSweepHours || "24"),
      });
      return res.json() as Promise<{ processed: number; sent: number; failed: number }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [activeAssociationId ? `/api/onboarding/invites?associationId=${activeAssociationId}` : "/api/onboarding/invites"] });
      toast({ title: "Reminder sweep complete", description: `Processed ${result.processed}, sent ${result.sent}, failed ${result.failed}.` });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const reviewSubmissionMutation = useMutation({
    mutationFn: async (payload: { id: string; decision: "approved" | "rejected" }) => {
      const res = await apiRequest("PATCH", `/api/onboarding/submissions/${payload.id}/review`, {
        decision: payload.decision,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activeAssociationId ? `/api/onboarding/submissions?associationId=${activeAssociationId}` : "/api/onboarding/submissions"] });
      queryClient.invalidateQueries({ queryKey: [activeAssociationId ? `/api/onboarding/invites?associationId=${activeAssociationId}` : "/api/onboarding/invites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/residential/dataset"] });
      queryClient.invalidateQueries({ queryKey: [activeAssociationId ? `/api/associations/${activeAssociationId}/overview` : "/api/associations/none/overview"] });
      queryClient.invalidateQueries({ queryKey: [activeAssociationId ? `/api/onboarding/state?associationId=${activeAssociationId}` : "/api/onboarding/state"] });
      toast({ title: "Submission reviewed" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

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
            <Link href="/app/units">Manage Units</Link>
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
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Onboarding Console</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary">State: {formatOnboardingState(onboardingState?.state || overview?.onboardingState)}</Badge>
            <Badge variant={overview?.contactCoveragePercent && overview.contactCoveragePercent >= 70 ? "default" : "destructive"}>
              Contact Coverage: {overview?.contactCoveragePercent ?? 0}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <CompactMetric label="Units In Scope" value={onboardingMetrics.totalUnits} icon={DoorOpen} />
            <CompactMetric label="Invites Sent" value={onboardingMetrics.sentInvites} icon={Mail} />
            <CompactMetric label="Pending Review" value={onboardingMetrics.pending} icon={Users} />
            <CompactMetric label="Approved Intake" value={onboardingMetrics.approved} icon={Home} />
          </div>

          <div className="rounded-xl border bg-muted/10 p-4 space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold">Onboarding Progress</div>
                <div className="text-xs text-muted-foreground">
                  Track blockers, progress, and next actions for resident contact intake.
                </div>
              </div>
              <div className="min-w-[220px]">
                <div className="mb-2 text-xs text-muted-foreground">{onboardingState?.scorePercent ?? overview?.onboardingScorePercent ?? 0}% complete</div>
                <Progress value={onboardingState?.scorePercent ?? overview?.onboardingScorePercent ?? 0} />
              </div>
            </div>
            {onboardingStateLoading ? <Skeleton className="h-16 w-full" /> : null}
            {(onboardingState?.blockers?.length ?? 0) > 0 ? (
              <div className="text-sm text-destructive">
                {onboardingState?.blockers.join(" ")}
              </div>
            ) : null}
            {(onboardingState?.remediationActions?.length ?? 0) > 0 ? (
              <div className="text-sm text-muted-foreground">
                Next actions: {onboardingState?.remediationActions.join(" · ")}
              </div>
            ) : null}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-xl border p-4 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold">Unit Coverage</div>
                  <div className="text-xs text-muted-foreground">
                    Identify unclaimed units, invite status, and intake review status at the unit level.
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href="/app/communications">Open Communications</Link>
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead>Coverage</TableHead>
                    <TableHead>Invites</TableHead>
                    <TableHead>Submission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unitCoverageRows.slice(0, 25).map((row) => (
                    <TableRow key={row.unitId}>
                      <TableCell>
                        <div className="font-medium">Unit {row.unitNumber}</div>
                        <div className="text-xs text-muted-foreground">{row.building}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.coverageStatus === "claimed" ? "default" : row.coverageStatus === "pending-review" ? "secondary" : "outline"}>
                          {row.coverageStatus.replace("-", " ")}
                        </Badge>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Owners {row.ownerCount} · Occupants {row.occupantCount}
                        </div>
                      </TableCell>
                      <TableCell>{row.inviteCount}</TableCell>
                      <TableCell>
                        {row.latestSubmission ? (
                          <div className="text-xs">
                            <div>{row.latestSubmission.firstName} {row.latestSubmission.lastName}</div>
                            <div className="text-muted-foreground">{row.latestSubmission.status}</div>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">No submission</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {unitCoverageRows.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-muted-foreground">No units available for onboarding coverage.</TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-xl border p-4 space-y-4">
              <div>
                <div className="text-sm font-semibold">Create Invite</div>
                <div className="text-xs text-muted-foreground">
                  Generate an owner or tenant intake link for a specific unit.
                </div>
              </div>
              <div className="grid gap-3">
                <Select value={inviteForm.unitId || "none"} onValueChange={(value) => setInviteForm((prev) => ({ ...prev, unitId: value === "none" ? "" : value }))}>
                  <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">select unit</SelectItem>
                    {(residentialDataset?.units ?? []).map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>Unit {unit.unitNumber}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={inviteForm.residentType} onValueChange={(value) => setInviteForm((prev) => ({ ...prev, residentType: value as "owner" | "tenant" }))}>
                  <SelectTrigger><SelectValue placeholder="Resident type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="tenant">Tenant</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Email (optional)" value={inviteForm.email} onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))} />
                <Input placeholder="Phone (optional)" value={inviteForm.phone} onChange={(event) => setInviteForm((prev) => ({ ...prev, phone: event.target.value }))} />
                <Input type="datetime-local" value={inviteForm.expiresAt} onChange={(event) => setInviteForm((prev) => ({ ...prev, expiresAt: event.target.value }))} />
                <Button onClick={() => createInviteMutation.mutate()} disabled={createInviteMutation.isPending}>
                  Create Onboarding Invite
                </Button>
              </div>
              <div className="border-t pt-4 space-y-3">
                <div className="text-sm font-semibold">Reminder Sweep</div>
                <div className="flex gap-2">
                  <Input type="number" min="0" value={reminderSweepHours} onChange={(event) => setReminderSweepHours(event.target.value)} />
                  <Button variant="outline" onClick={() => reminderSweepMutation.mutate()} disabled={reminderSweepMutation.isPending}>
                    Run Sweep
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-xl border p-4 space-y-4">
              <div className="text-sm font-semibold">Recent Invites</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead>Resident</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onboardingInvites.slice(0, 12).map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell>Unit {invite.unitLabel || invite.unitId}</TableCell>
                      <TableCell className="capitalize">{invite.residentType}</TableCell>
                      <TableCell><Badge variant={invite.status === "active" ? "secondary" : "outline"}>{invite.status}</Badge></TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendInviteMutation.mutate(invite.id)}
                          disabled={sendInviteMutation.isPending || !invite.email}
                        >
                          {invite.lastSentAt ? "Resend" : "Send"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {onboardingInvites.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-muted-foreground">No onboarding invites yet.</TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-xl border p-4 space-y-4">
              <div className="text-sm font-semibold">Submission Review Queue</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead>Person</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onboardingSubmissions.slice(0, 12).map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell>Unit {submission.unitLabel || submission.unitId}</TableCell>
                      <TableCell>
                        <div>{submission.firstName} {submission.lastName}</div>
                        {submission.reviewNotes?.length ? (
                          <div className="mt-1 text-xs text-muted-foreground">{submission.reviewNotes.join(" ")}</div>
                        ) : null}
                      </TableCell>
                      <TableCell><Badge variant={submission.status === "pending" ? "secondary" : "outline"}>{submission.status}</Badge></TableCell>
                      <TableCell className="space-x-2">
                        <Button
                          size="sm"
                          onClick={() => reviewSubmissionMutation.mutate({ id: submission.id, decision: "approved" })}
                          disabled={reviewSubmissionMutation.isPending || submission.status !== "pending"}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => reviewSubmissionMutation.mutate({ id: submission.id, decision: "rejected" })}
                          disabled={reviewSubmissionMutation.isPending || submission.status !== "pending"}
                        >
                          Reject
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {onboardingSubmissions.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-muted-foreground">No onboarding submissions yet.</TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Association Documents</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link href="/app/documents">Open Documents</Link>
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
