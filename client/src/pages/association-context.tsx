import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Document, OnboardingInvite, OnboardingSubmission, ResidentialDatasetUnitDirectoryItem } from "@shared/schema";
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
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { useIsMobile } from "@/hooks/use-mobile";
import { useResidentialDataset } from "@/hooks/use-residential-dataset";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { AssociationScopeBanner } from "@/components/association-scope-banner";
import { AsyncStateBoundary } from "@/components/async-state-boundary";
import { RecommendedActionsPanel } from "@/components/recommended-actions-panel";

type AssociationOverview = {
  associationId: string;
  units: number;
  activeOwners: number;
  activeOccupants: number;
  ownerOccupiedUnits: number;
  rentalOccupiedUnits: number;
  vacantUnits: number;
  unassignedUnits: number;
  occupancyRatePercent: number;
  maintenanceOpen: number;
  maintenanceOverdue: number;
  paymentMethodsActive: number;
  onboardingState: "not-started" | "in-progress" | "blocked" | "complete";
  onboardingScorePercent: number;
  contactCoveragePercent: number;
};

function formatOccupancyStatus(status: ResidentialDatasetUnitDirectoryItem["occupancyStatus"] | null | undefined) {
  if (status === "OWNER_OCCUPIED") return "Owner Occupied";
  if (status === "RENTAL_OCCUPIED") return "Rental Occupied";
  if (status === "VACANT") return "Vacant";
  return "Unassigned";
}

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
  const isMobile = useIsMobile();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    unitId: "",
    residentType: "owner" as "owner" | "tenant",
    email: "",
    phone: "",
    expiresAt: "",
  });
  const [manualIntakeOpen, setManualIntakeOpen] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [rejectionDrafts, setRejectionDrafts] = useState<Record<string, string>>({});
  const [manualIntakeForm, setManualIntakeForm] = useState({
    unitId: "",
    occupancyType: "TENANT" as "OWNER_OCCUPIED" | "TENANT",
    startDate: "",
    ownershipPercentage: "100",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    mailingAddressLine1: "",
    mailingCity: "",
    mailingState: "",
    mailingPostalCode: "",
    contactPreference: "email",
  });
  const [reminderSweepHours, setReminderSweepHours] = useState("24");
  const { activeAssociationId, activeAssociation, activeAssociationName } = useActiveAssociation();
  const { data: residentialDataset } = useResidentialDataset(activeAssociationId || undefined);
  const { toast } = useToast();
  const { data: overview, isLoading: overviewLoading } = useQuery<AssociationOverview>({
    queryKey: [activeAssociationId ? `/api/associations/${activeAssociationId}/overview` : "/api/associations/none/overview"],
    enabled: Boolean(activeAssociationId),
  });
  const { data: documents = [], isLoading: documentsLoading } = useQuery<Document[]>({
    queryKey: [activeAssociationId ? `/api/documents?associationId=${activeAssociationId}` : "/api/documents"],
    enabled: Boolean(activeAssociationId),
  });
  const { data: onboardingState, isLoading: onboardingStateLoading } = useQuery<{
    associationId: string;
    state: "not-started" | "in-progress" | "blocked" | "complete";
    blockers: string[];
    remediationActions: string[];
    remediationItems: Array<{ label: string; href: string; summary: string }>;
    scorePercent: number;
    components: {
      unitsConfigured: { score: number; total: number; completed: number };
      ownerDataCollected: { score: number; total: number; completed: number };
      tenantDataCollected: { score: number; total: number; completed: number };
      boardMembersConfigured: { score: number; total: number; completed: number };
      paymentMethodsConfigured: { score: number; total: number; completed: number };
      communicationTemplatesConfigured: { score: number; total: number; completed: number };
    };
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

  const selectedSubmission = useMemo(
    () => onboardingSubmissions.find((submission) => submission.id === selectedSubmissionId) ?? null,
    [onboardingSubmissions, selectedSubmissionId],
  );

  const unitCoverageRows = useMemo(() => {
    return (residentialDataset?.unitDirectory ?? [])
      .map((entry) => {
        const latestSubmission = latestSubmissionByUnit.get(entry.unit.id);
        const inviteCount = unitInviteCount.get(entry.unit.id) ?? 0;
        const coverageStatus = entry.ownerCount > 0 || entry.occupantCount > 0
          ? "claimed"
          : latestSubmission?.status === "pending"
            ? "pending-review"
            : inviteCount > 0
              ? "invited"
              : "unclaimed";
        return {
          unitId: entry.unit.id,
          unitNumber: entry.unit.unitNumber,
          building: entry.unit.building?.trim() || "Unassigned Building",
          ownerCount: entry.ownerCount,
          occupantCount: entry.occupantCount,
          tenantCount: entry.tenantCount,
          occupancyStatus: entry.occupancyStatus,
          lastOccupancyUpdate: entry.lastOccupancyUpdate,
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

  const inviteQuickPickUnits = useMemo(() => unitCoverageRows.slice(0, 12), [unitCoverageRows]);

  const selectedInviteUnit = useMemo(
    () => unitCoverageRows.find((row) => row.unitId === inviteForm.unitId) ?? null,
    [inviteForm.unitId, unitCoverageRows],
  );

  const onboardingRecommendedActions = useMemo(() => {
    const actions: Array<{
      title: string;
      summary: string;
      href: string;
      cta: string;
      tone: "default" | "warning" | "neutral";
    }> = [];

    if ((overview?.contactCoveragePercent ?? 0) < 70) {
      actions.push({
        title: "Close resident contact coverage gaps",
        summary: `Coverage is at ${overview?.contactCoveragePercent ?? 0}%. Use invite links and manual intake to bring missing owners and tenants into scope.`,
        href: "/app/communications",
        cta: "Open communications",
        tone: "warning",
      });
    }

    if (onboardingMetrics.pending > 0) {
      actions.push({
        title: "Review pending resident submissions",
        summary: `${onboardingMetrics.pending} intake submissions are waiting for review before records are fully usable.`,
        href: "/app/association-context",
        cta: "Review onboarding console",
        tone: "default",
      });
    }

    if ((overview?.paymentMethodsActive ?? 0) === 0) {
      actions.push({
        title: "Configure payment methods",
        summary: "Residents do not yet have an active payment path. Turn this on before onboarding is considered complete.",
        href: "/app/communications",
        cta: "Review resident experience",
        tone: "warning",
      });
    }

    if (!actions.length) {
      actions.push({
        title: "Onboarding is stable",
        summary: "Core setup is in place. Use this console to review unit coverage and keep intake clean as records change.",
        href: "/app/association-context",
        cta: "Stay in this workspace",
        tone: "neutral",
      });
    }

    return actions;
  }, [onboardingMetrics.pending, overview?.contactCoveragePercent, overview?.paymentMethodsActive]);

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
    mutationFn: async (payload: { id: string; decision: "approved" | "rejected"; rejectionReason?: string }) => {
      const res = await apiRequest("PATCH", `/api/onboarding/submissions/${payload.id}/review`, {
        decision: payload.decision,
        rejectionReason: payload.rejectionReason || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activeAssociationId ? `/api/onboarding/submissions?associationId=${activeAssociationId}` : "/api/onboarding/submissions"] });
      queryClient.invalidateQueries({ queryKey: [activeAssociationId ? `/api/onboarding/invites?associationId=${activeAssociationId}` : "/api/onboarding/invites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ownerships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/occupancies"] });
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/residential/dataset"),
      });
      queryClient.invalidateQueries({ queryKey: [activeAssociationId ? `/api/associations/${activeAssociationId}/overview` : "/api/associations/none/overview"] });
      queryClient.invalidateQueries({ queryKey: [activeAssociationId ? `/api/onboarding/state?associationId=${activeAssociationId}` : "/api/onboarding/state"] });
      setRejectionDrafts({});
      toast({ title: "Submission reviewed" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const unitLinkMutation = useMutation({
    mutationFn: async (payload: { unitId: string; residentType: "owner" | "tenant"; regenerate?: boolean }) => {
      if (!activeAssociationId) throw new Error("Association is required");
      const endpoint = payload.regenerate ? "/api/onboarding/unit-links/regenerate" : "/api/onboarding/unit-links/ensure";
      const res = await apiRequest("POST", endpoint, {
        associationId: activeAssociationId,
        unitId: payload.unitId,
        residentType: payload.residentType,
      });
      return res.json() as Promise<OnboardingInvite & { inviteUrl: string; created?: boolean }>;
    },
    onSuccess: async (result, variables) => {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(result.inviteUrl);
      }
      queryClient.invalidateQueries({ queryKey: [activeAssociationId ? `/api/onboarding/invites?associationId=${activeAssociationId}` : "/api/onboarding/invites"] });
      toast({
        title: variables.regenerate ? "Unit link regenerated" : "Unit link ready",
        description: `${variables.residentType === "owner" ? "Owner" : "Tenant"} link copied to clipboard when supported.`,
      });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const manualIntakeMutation = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("Association is required");
      if (!manualIntakeForm.unitId) throw new Error("Unit is required");
      if (!manualIntakeForm.firstName.trim() || !manualIntakeForm.lastName.trim() || !manualIntakeForm.startDate) {
        throw new Error("Name and start date are required");
      }
      const res = await apiRequest("POST", "/api/onboarding/intake", {
        associationId: activeAssociationId,
        unitId: manualIntakeForm.unitId,
        occupancyType: manualIntakeForm.occupancyType,
        startDate: new Date(manualIntakeForm.startDate).toISOString(),
        ownershipPercentage: manualIntakeForm.occupancyType === "OWNER_OCCUPIED" ? Number(manualIntakeForm.ownershipPercentage || "100") : null,
        person: {
          firstName: manualIntakeForm.firstName.trim(),
          lastName: manualIntakeForm.lastName.trim(),
          email: manualIntakeForm.email.trim() || null,
          phone: manualIntakeForm.phone.trim() || null,
          mailingAddress: [
            manualIntakeForm.mailingAddressLine1.trim(),
            [manualIntakeForm.mailingCity.trim(), manualIntakeForm.mailingState.trim(), manualIntakeForm.mailingPostalCode.trim()].filter(Boolean).join(", "),
          ].filter(Boolean).join(", ") || null,
          contactPreference: manualIntakeForm.contactPreference || "email",
        },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ownerships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/occupancies"] });
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/residential/dataset"),
      });
      queryClient.invalidateQueries({ queryKey: [activeAssociationId ? `/api/associations/${activeAssociationId}/overview` : "/api/associations/none/overview"] });
      queryClient.invalidateQueries({ queryKey: [activeAssociationId ? `/api/onboarding/state?associationId=${activeAssociationId}` : "/api/onboarding/state"] });
      queryClient.invalidateQueries({ queryKey: [activeAssociationId ? `/api/onboarding/submissions?associationId=${activeAssociationId}` : "/api/onboarding/submissions"] });
      setManualIntakeOpen(false);
      setManualIntakeForm({
        unitId: "",
        occupancyType: "TENANT",
        startDate: "",
        ownershipPercentage: "100",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        mailingAddressLine1: "",
        mailingCity: "",
        mailingState: "",
        mailingPostalCode: "",
        contactPreference: "email",
      });
      toast({ title: "Manual onboarding intake created" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const openManualIntake = (payload: { unitId: string; ownerCount: number; occupantCount: number }) => {
    setManualIntakeForm((prev) => ({
      ...prev,
      unitId: payload.unitId,
      occupancyType: payload.ownerCount === 0 && payload.occupantCount === 0 ? "OWNER_OCCUPIED" : "TENANT",
      startDate: prev.startDate,
    }));
    setManualIntakeOpen(true);
  };

  const updateRejectionDraft = (submissionId: string, value: string) => {
    setRejectionDrafts((current) => ({
      ...current,
      [submissionId]: value,
    }));
  };

  const openSubmissionReview = (submissionId: string) => {
    setSelectedSubmissionId(submissionId);
  };

  if (!activeAssociationId) {
    return (
      <div className="p-6 space-y-6">
        <WorkspacePageHeader
          title="Association Context"
          summary="Move from portfolio oversight into a single association workspace with profile, documents, onboarding, and residential coverage in one place."
          eyebrow="Context"
          breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Association Context" }]}
          shortcuts={[
            { label: "Associations", href: "/app/associations" },
            { label: "Documents", href: "/app/documents" },
          ]}
        />
        <AssociationScopeBanner
          activeAssociationId=""
          activeAssociationName=""
          explanation="Select an association to unlock the in-context workspace for profile edits, onboarding, documents, and residential operations."
        />
      </div>
    );
  }

  return (
    <>
    <div className="p-6 space-y-6">
      <WorkspacePageHeader
        title={activeAssociationName || "Association Context"}
        summary="In-context workspace for this association, with profile, residential coverage, onboarding, documents, and next-step actions in one view."
        eyebrow="Context"
        breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Association Context" }]}
        shortcuts={[
          { label: "Documents", href: "/app/documents" },
          { label: "Communications", href: "/app/communications" },
          { label: "Units", href: "/app/units" },
          {
            label: "Owner Portal Link",
            onClick: () => {
              const url = `${window.location.origin}/portal`;
              navigator.clipboard.writeText(url).then(() => {
                toast({ title: "Link copied", description: url });
              });
            },
          },
        ]}
      />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AsyncStateBoundary
            isLoading={overviewLoading}
            error={overview === undefined && !overviewLoading ? new Error("Association overview is unavailable.") : undefined}
            emptyTitle="Association overview unavailable"
            emptyMessage="Refresh the page or confirm the active association still exists."
          >
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
                    <CompactMetric label="Occupancy Rate" value={overview?.occupancyRatePercent ?? 0} suffix="%" icon={Home} />
                    <CompactMetric label="Documents" value={documents.length} icon={FileText} />
                  </div>
                </div>
              </>
            )}
          </CardContent>
            </Card>
          </AsyncStateBoundary>
        </TabsContent>

        <TabsContent value="onboarding">
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

          <Accordion type="multiple" defaultValue={[]} className="w-full space-y-3">
            <AccordionItem value="progress-readiness" className="rounded-xl border bg-muted/10 px-4">
              <AccordionTrigger className="text-sm font-semibold">Progress & Readiness</AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
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
                {onboardingState?.components ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <MiniProgressCard
                      label="Units Created"
                      value={onboardingState.components.unitsConfigured.score}
                      detail={`${onboardingState.components.unitsConfigured.completed}/${onboardingState.components.unitsConfigured.total || 1}`}
                    />
                    <MiniProgressCard
                      label="Owner Data"
                      value={onboardingState.components.ownerDataCollected.score}
                      detail={`${onboardingState.components.ownerDataCollected.completed}/${onboardingState.components.ownerDataCollected.total}`}
                    />
                    <MiniProgressCard
                      label="Tenant Data"
                      value={onboardingState.components.tenantDataCollected.score}
                      detail={`${onboardingState.components.tenantDataCollected.completed}/${onboardingState.components.tenantDataCollected.total}`}
                    />
                    <MiniProgressCard
                      label="Board Setup"
                      value={onboardingState.components.boardMembersConfigured.score}
                      detail={onboardingState.components.boardMembersConfigured.completed > 0 ? "Configured" : "Missing"}
                    />
                    <MiniProgressCard
                      label="Payments"
                      value={onboardingState.components.paymentMethodsConfigured.score}
                      detail={onboardingState.components.paymentMethodsConfigured.completed > 0 ? "Configured" : "Missing"}
                    />
                    <MiniProgressCard
                      label="Comms Templates"
                      value={onboardingState.components.communicationTemplatesConfigured.score}
                      detail={onboardingState.components.communicationTemplatesConfigured.completed > 0 ? "Configured" : "Missing"}
                    />
                  </div>
                ) : null}
                {(onboardingState?.remediationItems?.length ?? 0) > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {onboardingState?.remediationItems.map((item) => (
                      <div key={`${item.href}:${item.label}`} className="rounded-lg border bg-background p-3">
                        <div className="text-sm font-medium">{item.label}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{item.summary}</div>
                        <Button asChild size="sm" variant="outline" className="mt-3">
                          <Link href={item.href}>Open</Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <RecommendedActionsPanel
                  title="Onboarding Next Actions"
                  description="Use the onboarding metrics and blockers above to decide the next resident-intake move."
                  actions={onboardingRecommendedActions}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="coverage-tools" className="rounded-xl border px-4">
              <AccordionTrigger className="text-sm font-semibold">Coverage & Invite Tools</AccordionTrigger>
              <AccordionContent className="pb-4">
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
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Unit</TableHead>
                            <TableHead>Coverage</TableHead>
                            <TableHead>Invites</TableHead>
                            <TableHead>Submission</TableHead>
                            <TableHead>Actions</TableHead>
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
                                  {formatOccupancyStatus(row.occupancyStatus)} · Owners {row.ownerCount} · Tenants {row.tenantCount}
                                  {row.lastOccupancyUpdate ? ` · Updated ${new Date(row.lastOccupancyUpdate).toLocaleDateString()}` : ""}
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
                              <TableCell>
                                <div className="flex flex-wrap gap-2">
                                  <Button size="sm" variant="outline" onClick={() => openManualIntake({ unitId: row.unitId, ownerCount: row.ownerCount, occupantCount: row.occupantCount })}>
                                    Manual Entry
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => unitLinkMutation.mutate({ unitId: row.unitId, residentType: "owner" })}
                                    disabled={unitLinkMutation.isPending}
                                  >
                                    Owner Link
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => unitLinkMutation.mutate({ unitId: row.unitId, residentType: "tenant" })}
                                    disabled={unitLinkMutation.isPending}
                                  >
                                    Tenant Link
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {unitCoverageRows.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-muted-foreground">No units available for onboarding coverage.</TableCell></TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="space-y-3 md:hidden">
                      {unitCoverageRows.slice(0, 25).map((row) => (
                        <div key={row.unitId} className="rounded-xl border p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium">Unit {row.unitNumber}</div>
                              <div className="mt-1 text-xs text-muted-foreground">{row.building}</div>
                            </div>
                            <Badge variant={row.coverageStatus === "claimed" ? "default" : row.coverageStatus === "pending-review" ? "secondary" : "outline"}>
                              {row.coverageStatus.replace("-", " ")}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatOccupancyStatus(row.occupancyStatus)} · Owners {row.ownerCount} · Tenants {row.tenantCount}
                            {row.lastOccupancyUpdate ? ` · Updated ${new Date(row.lastOccupancyUpdate).toLocaleDateString()}` : ""}
                          </div>
                          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span>{row.inviteCount} invite{row.inviteCount === 1 ? "" : "s"}</span>
                            <span>
                              {row.latestSubmission
                                ? `${row.latestSubmission.firstName} ${row.latestSubmission.lastName} · ${row.latestSubmission.status}`
                                : "No submission"}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <Button size="sm" variant="outline" onClick={() => openManualIntake({ unitId: row.unitId, ownerCount: row.ownerCount, occupantCount: row.occupantCount })}>
                              Manual Entry
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => unitLinkMutation.mutate({ unitId: row.unitId, residentType: "owner" })}
                              disabled={unitLinkMutation.isPending}
                            >
                              Owner Link
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => unitLinkMutation.mutate({ unitId: row.unitId, residentType: "tenant" })}
                              disabled={unitLinkMutation.isPending}
                            >
                              Tenant Link
                            </Button>
                          </div>
                        </div>
                      ))}
                      {unitCoverageRows.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No units available for onboarding coverage.</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-xl border p-4 space-y-4">
                    <div>
                      <div className="text-sm font-semibold">Create Invite</div>
                      <div className="text-xs text-muted-foreground">
                        Generate an owner or tenant intake link for a specific unit.
                      </div>
                    </div>
                    <div className="grid gap-3">
                      {inviteQuickPickUnits.length > 0 ? (
                        <div className="space-y-2">
                          <div className="text-xs text-muted-foreground">Quick pick a unit</div>
                          <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <div className="flex min-w-max gap-2">
                              {inviteQuickPickUnits.map((row) => (
                                <Button
                                  key={row.unitId}
                                  type="button"
                                  size="sm"
                                  variant={inviteForm.unitId === row.unitId ? "default" : "outline"}
                                  className="h-auto min-h-10 rounded-full px-3 py-2 text-left"
                                  onClick={() => setInviteForm((prev) => ({ ...prev, unitId: row.unitId }))}
                                >
                                  <span className="font-medium">Unit {row.unitNumber}</span>
                                  <span className="ml-1 text-xs opacity-80">{row.building}</span>
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {selectedInviteUnit ? (
                        <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                          <div className="font-medium">Selected unit: {selectedInviteUnit.building} · Unit {selectedInviteUnit.unitNumber}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatOccupancyStatus(selectedInviteUnit.occupancyStatus)} · Owners {selectedInviteUnit.ownerCount} · Tenants {selectedInviteUnit.tenantCount}
                          </div>
                        </div>
                      ) : null}
                      <Select value={inviteForm.unitId || "none"} onValueChange={(value) => setInviteForm((prev) => ({ ...prev, unitId: value === "none" ? "" : value }))}>
                        <SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue placeholder="Select unit" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">select unit</SelectItem>
                          {(residentialDataset?.units ?? []).map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>Unit {unit.unitNumber}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={inviteForm.residentType} onValueChange={(value) => setInviteForm((prev) => ({ ...prev, residentType: value as "owner" | "tenant" }))}>
                        <SelectTrigger className={isMobile ? "min-h-11" : undefined}><SelectValue placeholder="Resident type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">Owner</SelectItem>
                          <SelectItem value="tenant">Tenant</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input className={isMobile ? "min-h-11" : undefined} placeholder="Email (optional)" value={inviteForm.email} onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))} />
                      <Input className={isMobile ? "min-h-11" : undefined} placeholder="Phone (optional)" value={inviteForm.phone} onChange={(event) => setInviteForm((prev) => ({ ...prev, phone: event.target.value }))} />
                      <Input className={isMobile ? "min-h-11" : undefined} type="datetime-local" value={inviteForm.expiresAt} onChange={(event) => setInviteForm((prev) => ({ ...prev, expiresAt: event.target.value }))} />
                      <Button onClick={() => createInviteMutation.mutate()} disabled={createInviteMutation.isPending}>
                        Create Onboarding Invite
                      </Button>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button
                          variant="outline"
                          onClick={() => inviteForm.unitId && unitLinkMutation.mutate({ unitId: inviteForm.unitId, residentType: "owner" })}
                          disabled={unitLinkMutation.isPending || !inviteForm.unitId}
                        >
                          Copy Owner Link
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => inviteForm.unitId && unitLinkMutation.mutate({ unitId: inviteForm.unitId, residentType: "tenant" })}
                          disabled={unitLinkMutation.isPending || !inviteForm.unitId}
                        >
                          Copy Tenant Link
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button
                          variant="outline"
                          onClick={() => inviteForm.unitId && unitLinkMutation.mutate({ unitId: inviteForm.unitId, residentType: "owner", regenerate: true })}
                          disabled={unitLinkMutation.isPending || !inviteForm.unitId}
                        >
                          Regenerate Owner
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => inviteForm.unitId && unitLinkMutation.mutate({ unitId: inviteForm.unitId, residentType: "tenant", regenerate: true })}
                          disabled={unitLinkMutation.isPending || !inviteForm.unitId}
                        >
                          Regenerate Tenant
                        </Button>
                      </div>
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
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="invites" className="rounded-xl border px-4">
              <AccordionTrigger className="text-sm font-semibold">Invites</AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="rounded-xl border p-4 space-y-4">
                  <div className="text-sm font-semibold">Recent Invites</div>
                  <div className="hidden md:block">
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
                  <div className="space-y-3 md:hidden">
                    {onboardingInvites.slice(0, 12).map((invite) => (
                      <div key={invite.id} className="rounded-xl border p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium">Unit {invite.unitLabel || invite.unitId}</div>
                            <div className="mt-1 text-xs text-muted-foreground capitalize">{invite.residentType}</div>
                          </div>
                          <Badge variant={invite.status === "active" ? "secondary" : "outline"}>{invite.status}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {invite.email || invite.phone || "No delivery target set"}
                          {invite.lastSentAt ? ` · Last sent ${new Date(invite.lastSentAt).toLocaleString()}` : ""}
                        </div>
                        <Button
                          className="w-full"
                          size="sm"
                          variant="outline"
                          onClick={() => sendInviteMutation.mutate(invite.id)}
                          disabled={sendInviteMutation.isPending || !invite.email}
                        >
                          {invite.lastSentAt ? "Resend" : "Send"}
                        </Button>
                      </div>
                    ))}
                    {onboardingInvites.length === 0 ? (
                      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No onboarding invites yet.</div>
                    ) : null}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="review-queue" className="rounded-xl border px-4">
              <AccordionTrigger className="text-sm font-semibold">Review Queue</AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="rounded-xl border p-4 space-y-4">
                  <div className="text-sm font-semibold">Submission Review Queue</div>
                  <div className="hidden md:block">
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
                              {submission.rejectionReason ? (
                                <div className="mt-1 text-xs text-destructive">Last rejection: {submission.rejectionReason}</div>
                              ) : null}
                            </TableCell>
                            <TableCell><Badge variant={submission.status === "pending" ? "secondary" : "outline"}>{submission.status}</Badge></TableCell>
                            <TableCell className="space-x-2">
                              {submission.status === "pending" ? (
                                <div className="space-y-2">
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openSubmissionReview(submission.id)}
                                    >
                                      Open
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => reviewSubmissionMutation.mutate({ id: submission.id, decision: "approved" })}
                                      disabled={reviewSubmissionMutation.isPending}
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => reviewSubmissionMutation.mutate({
                                        id: submission.id,
                                        decision: "rejected",
                                        rejectionReason: rejectionDrafts[submission.id] || "Please update the submission and try again.",
                                      })}
                                      disabled={reviewSubmissionMutation.isPending}
                                    >
                                      Request Changes
                                    </Button>
                                  </div>
                                  <Textarea
                                    rows={2}
                                    placeholder="Reason for rejection / requested changes"
                                    value={rejectionDrafts[submission.id] || ""}
                                    onChange={(event) => updateRejectionDraft(submission.id, event.target.value)}
                                  />
                                </div>
                              ) : (
                                <div className="flex gap-2 items-center">
                                  <span className="text-xs text-muted-foreground">
                                    {submission.reviewedBy ? `Reviewed by ${submission.reviewedBy}` : "Reviewed"}
                                  </span>
                                  <Button size="sm" variant="outline" onClick={() => openSubmissionReview(submission.id)}>
                                    Open
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {onboardingSubmissions.length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="text-muted-foreground">No onboarding submissions yet.</TableCell></TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="space-y-3 md:hidden">
                    {onboardingSubmissions.slice(0, 12).map((submission) => (
                      <div key={submission.id} className="rounded-xl border p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium">Unit {submission.unitLabel || submission.unitId}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{submission.firstName} {submission.lastName}</div>
                          </div>
                          <Badge variant={submission.status === "pending" ? "secondary" : "outline"}>{submission.status}</Badge>
                        </div>
                        {submission.reviewNotes?.length ? (
                          <div className="text-xs text-muted-foreground">{submission.reviewNotes.join(" ")}</div>
                        ) : null}
                        {submission.rejectionReason ? (
                          <div className="text-xs text-destructive">Last rejection: {submission.rejectionReason}</div>
                        ) : null}
                        {submission.status === "pending" ? (
                          <>
                            <Textarea
                              rows={2}
                              placeholder="Reason for rejection / requested changes"
                              value={rejectionDrafts[submission.id] || ""}
                              onChange={(event) => updateRejectionDraft(submission.id, event.target.value)}
                            />
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                              <Button size="sm" variant="outline" onClick={() => openSubmissionReview(submission.id)}>
                                Open
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => reviewSubmissionMutation.mutate({ id: submission.id, decision: "approved" })}
                                disabled={reviewSubmissionMutation.isPending}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => reviewSubmissionMutation.mutate({
                                  id: submission.id,
                                  decision: "rejected",
                                  rejectionReason: rejectionDrafts[submission.id] || "Please update the submission and try again.",
                                })}
                                disabled={reviewSubmissionMutation.isPending}
                              >
                                Request Changes
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-muted-foreground">
                              {submission.reviewedBy ? `Reviewed by ${submission.reviewedBy}` : "Reviewed"}
                            </span>
                            <Button size="sm" variant="outline" onClick={() => openSubmissionReview(submission.id)}>
                              Open
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                    {onboardingSubmissions.length === 0 ? (
                      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No onboarding submissions yet.</div>
                    ) : null}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records">
          <Accordion type="multiple" defaultValue={[]} className="w-full">
            <AccordionItem value="association-documents">
              <AccordionTrigger>Association Documents</AccordionTrigger>
              <AccordionContent>
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="break-words font-medium">{document.title}</div>
                    <div className="text-xs text-muted-foreground">{document.documentType}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href={document.fileUrl} target="_blank" rel="noreferrer">Open</a>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={document.fileUrl} download>Download</a>
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>
      </Tabs>
    </div>
    <Dialog open={Boolean(selectedSubmission)} onOpenChange={(nextOpen) => { if (!nextOpen) setSelectedSubmissionId(""); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Submission Review</DialogTitle>
        </DialogHeader>
        {selectedSubmission ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border p-3 text-sm">
                <div className="font-medium">Person</div>
                <div className="mt-1">{selectedSubmission.firstName} {selectedSubmission.lastName}</div>
                <div className="text-muted-foreground">{selectedSubmission.email || "No email provided"}</div>
                <div className="text-muted-foreground">{selectedSubmission.phone || "No phone provided"}</div>
              </div>
              <div className="rounded-md border p-3 text-sm">
                <div className="font-medium">Unit and Submission</div>
                <div className="mt-1">Unit {selectedSubmission.unitLabel || selectedSubmission.unitId}</div>
                <div className="text-muted-foreground capitalize">{selectedSubmission.residentType} · {selectedSubmission.status}</div>
                <div className="text-muted-foreground">Submitted {new Date(selectedSubmission.submittedAt).toLocaleString()}</div>
              </div>
            </div>
            <div className="rounded-md border p-3 text-sm space-y-1">
              <div><span className="font-medium">Mailing Address:</span> {selectedSubmission.mailingAddress || "-"}</div>
              <div><span className="font-medium">Start Date:</span> {new Date(selectedSubmission.startDate).toLocaleDateString()}</div>
              <div><span className="font-medium">Ownership %:</span> {selectedSubmission.ownershipPercentage ?? "-"}</div>
              <div><span className="font-medium">Contact Preference:</span> {selectedSubmission.contactPreference || "-"}</div>
              {selectedSubmission.rejectionReason ? (
                <div className="text-destructive"><span className="font-medium">Last Rejection:</span> {selectedSubmission.rejectionReason}</div>
              ) : null}
            </div>
            {selectedSubmission.status === "pending" ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">Review Actions</div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      reviewSubmissionMutation.mutate({ id: selectedSubmission.id, decision: "approved" });
                      setSelectedSubmissionId("");
                    }}
                    disabled={reviewSubmissionMutation.isPending}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      reviewSubmissionMutation.mutate({
                        id: selectedSubmission.id,
                        decision: "rejected",
                        rejectionReason: rejectionDrafts[selectedSubmission.id] || "Please update the submission and try again.",
                      });
                      setSelectedSubmissionId("");
                    }}
                    disabled={reviewSubmissionMutation.isPending}
                  >
                    Request Changes
                  </Button>
                </div>
                <Textarea
                  rows={2}
                  placeholder="Reason for rejection / requested changes"
                  value={rejectionDrafts[selectedSubmission.id] || ""}
                  onChange={(event) => updateRejectionDraft(selectedSubmission.id, event.target.value)}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
    <Dialog open={manualIntakeOpen} onOpenChange={setManualIntakeOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manual Resident Entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select value={manualIntakeForm.unitId || "none"} onValueChange={(value) => setManualIntakeForm((prev) => ({ ...prev, unitId: value === "none" ? "" : value }))}>
              <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">select unit</SelectItem>
                {(residentialDataset?.units ?? []).map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>Unit {unit.unitNumber}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={manualIntakeForm.occupancyType} onValueChange={(value) => setManualIntakeForm((prev) => ({ ...prev, occupancyType: value as "OWNER_OCCUPIED" | "TENANT" }))}>
              <SelectTrigger><SelectValue placeholder="Resident type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="OWNER_OCCUPIED">Owner Occupied</SelectItem>
                <SelectItem value="TENANT">Tenant</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="First name" value={manualIntakeForm.firstName} onChange={(event) => setManualIntakeForm((prev) => ({ ...prev, firstName: event.target.value }))} />
            <Input placeholder="Last name" value={manualIntakeForm.lastName} onChange={(event) => setManualIntakeForm((prev) => ({ ...prev, lastName: event.target.value }))} />
            <Input placeholder="Email" value={manualIntakeForm.email} onChange={(event) => setManualIntakeForm((prev) => ({ ...prev, email: event.target.value }))} />
            <Input placeholder="Phone" value={manualIntakeForm.phone} onChange={(event) => setManualIntakeForm((prev) => ({ ...prev, phone: event.target.value }))} />
            <Input type="date" value={manualIntakeForm.startDate} onChange={(event) => setManualIntakeForm((prev) => ({ ...prev, startDate: event.target.value }))} />
            {manualIntakeForm.occupancyType === "OWNER_OCCUPIED" ? (
              <Input type="number" min="0" max="100" placeholder="Ownership %" value={manualIntakeForm.ownershipPercentage} onChange={(event) => setManualIntakeForm((prev) => ({ ...prev, ownershipPercentage: event.target.value }))} />
            ) : null}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input placeholder="Mailing street address" value={manualIntakeForm.mailingAddressLine1} onChange={(event) => setManualIntakeForm((prev) => ({ ...prev, mailingAddressLine1: event.target.value }))} />
            <Input placeholder="City" value={manualIntakeForm.mailingCity} onChange={(event) => setManualIntakeForm((prev) => ({ ...prev, mailingCity: event.target.value }))} />
            <Input placeholder="State" value={manualIntakeForm.mailingState} onChange={(event) => setManualIntakeForm((prev) => ({ ...prev, mailingState: event.target.value }))} />
            <Input placeholder="ZIP / Postal Code" value={manualIntakeForm.mailingPostalCode} onChange={(event) => setManualIntakeForm((prev) => ({ ...prev, mailingPostalCode: event.target.value }))} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select value={manualIntakeForm.contactPreference} onValueChange={(value) => setManualIntakeForm((prev) => ({ ...prev, contactPreference: value }))}>
              <SelectTrigger><SelectValue placeholder="Contact preference" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => manualIntakeMutation.mutate()} disabled={manualIntakeMutation.isPending}>
            Create Resident
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
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

function MiniProgressCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border bg-background px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}%</div>
      </div>
      <Progress value={value} className="mt-3" />
      <div className="mt-2 text-xs text-muted-foreground">{detail}</div>
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
