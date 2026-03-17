import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Unit, Building, Person, Ownership } from "@shared/schema";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Plus, Building2, DoorOpen, MessageSquare, Pencil, ChevronDown, ChevronRight, Link2, User, X, UserPlus, FileUp } from "lucide-react";
import { CsvImportDialog, type ImportResult } from "@/components/csv-import-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { useResidentialDataset } from "@/hooks/use-residential-dataset";

const unitFormSchema = z.object({
  associationId: z.string().min(1, "Association is required"),
  buildingId: z.string().optional().transform((value) => value?.trim() || ""),
  unitNumber: z.string().trim().min(1, "Unit number is required"),
  squareFootage: z.union([z.coerce.number().positive(), z.nan()]).optional(),
});

type OwnerEntry = {
  ownership: Ownership;
  personName: string;
};

type PendingOwnerEntry = {
  personId: string;
  personName: string;
  percentage: number;
};

const buildingFormSchema = z.object({
  associationId: z.string().min(1, "Association is required"),
  name: z.string().trim().min(1, "Building name is required"),
  address: z.string().trim().min(1, "Building address is required"),
  totalUnits: z.union([z.coerce.number().int().positive(), z.nan()]).optional(),
  notes: z.string().optional().transform((value) => value?.trim() || ""),
});

export default function UnitsPage() {
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"building" | "unit">("building");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLegacyBuilding, setEditingLegacyBuilding] = useState<string | null>(null);
  const [collapsedBuildings, setCollapsedBuildings] = useState<Record<string, boolean>>({});
  const [ownerEntries, setOwnerEntries] = useState<OwnerEntry[]>([]);
  const [removedOwnershipIds, setRemovedOwnershipIds] = useState<Set<string>>(new Set());
  const [pendingNewOwners, setPendingNewOwners] = useState<PendingOwnerEntry[]>([]);
  const [addOwnerPersonId, setAddOwnerPersonId] = useState("");
  const [addOwnerPercentage, setAddOwnerPercentage] = useState("100");
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const { data: residentialDataset } = useResidentialDataset(activeAssociationId || undefined);

  const { data: units, isLoading } = useQuery<Unit[]>({ queryKey: ["/api/units"] });
  const { data: buildings = [], isLoading: buildingsLoading } = useQuery<Building[]>({ queryKey: ["/api/buildings"] });
  const { data: availablePeople = [] } = useQuery<Person[]>({
    queryKey: [activeAssociationId ? `/api/persons?associationId=${activeAssociationId}` : "/api/persons"],
    enabled: Boolean(activeAssociationId),
  });

  const unitForm = useForm<z.infer<typeof unitFormSchema>>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: { associationId: "", buildingId: "", unitNumber: "", squareFootage: undefined },
  });

  const buildingForm = useForm<z.infer<typeof buildingFormSchema>>({
    resolver: zodResolver(buildingFormSchema),
    defaultValues: { associationId: "", name: "", address: "", totalUnits: undefined, notes: "" },
  });

  useEffect(() => {
    if (!activeAssociationId || editingId) return;
    unitForm.setValue("associationId", activeAssociationId, { shouldValidate: true });
    buildingForm.setValue("associationId", activeAssociationId, { shouldValidate: true });
  }, [activeAssociationId, editingId, buildingForm, unitForm]);

  useEffect(() => {
    if (editingId || dialogMode !== "unit" || unitForm.getValues("buildingId") || !buildings.length) return;
    unitForm.setValue("buildingId", buildings[0].id, { shouldValidate: true });
  }, [buildings, dialogMode, editingId, unitForm]);

  type UnitMutationPayload = {
    associationId: string;
    buildingId?: string | null;
    unitNumber: string;
    building?: string | null;
    squareFootage?: number | null;
  };

  const createMutation = useMutation({
    mutationFn: (data: UnitMutationPayload) => apiRequest("POST", "/api/units", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/units"] });
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/residential/dataset"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Unit created successfully" });
      setOpen(false);
      unitForm.reset({ associationId: activeAssociationId, buildingId: "", unitNumber: "", squareFootage: undefined });
      buildingForm.reset({ associationId: activeAssociationId, name: "", address: "", totalUnits: undefined, notes: "" });
      setEditingLegacyBuilding(null);
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UnitMutationPayload & { id: string }) =>
      apiRequest("PATCH", `/api/units/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/units"] });
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/residential/dataset"),
      });
      toast({ title: "Unit updated successfully" });
      setOpen(false);
      setEditingId(null);
      setEditingLegacyBuilding(null);
      unitForm.reset({ associationId: activeAssociationId, buildingId: "", unitNumber: "", squareFootage: undefined });
      buildingForm.reset({ associationId: activeAssociationId, name: "", address: "", totalUnits: undefined, notes: "" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const createBuildingMutation = useMutation({
    mutationFn: (data: z.infer<typeof buildingFormSchema>) => apiRequest("POST", "/api/buildings", {
      associationId: data.associationId,
      name: data.name,
      address: data.address,
      totalUnits: typeof data.totalUnits === "number" && !Number.isNaN(data.totalUnits) ? data.totalUnits : null,
      notes: data.notes || null,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/buildings"] });
      buildingForm.reset({ associationId: activeAssociationId, name: "", address: "", totalUnits: undefined, notes: "" });
      setDialogMode("unit");
      toast({ title: "Building added. You can now add units." });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const contactFormLinkMutation = useMutation({
    mutationFn: async (payload: { unitId: string }) => {
      if (!activeAssociationId) throw new Error("Select an association context first");
      const response = await apiRequest("POST", "/api/onboarding/unit-links/ensure", {
        associationId: activeAssociationId,
        unitId: payload.unitId,
        residentType: "owner",
      });
      const result = await response.json() as { inviteUrl: string };
      return { ...result, ...payload };
    },
    onSuccess: async (result) => {
      let shareableInviteUrl = result.inviteUrl;
      try {
        const parsed = new URL(result.inviteUrl, window.location.origin);
        shareableInviteUrl = `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
      } catch {
        shareableInviteUrl = result.inviteUrl;
      }

      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareableInviteUrl);
      }
      toast({ title: "Unit intake link copied" });
    },
    onError: (error: Error) => toast({ title: "Link action failed", description: error.message, variant: "destructive" }),
  });

  async function handleUnitsImport(rows: Record<string, string>[]): Promise<ImportResult> {
    if (!activeAssociationId) throw new Error("Select an association context first");
    const buildingByName = new Map(buildings.map((b) => [b.name.toLowerCase().trim(), b.id]));
    const mapped = rows.map((row) => ({
      associationId: activeAssociationId,
      buildingId: buildingByName.get((row.buildingName ?? "").toLowerCase().trim()) ?? null,
      unitNumber: row.unitNumber ?? "",
      squareFootage: row.squareFootage ? Number(row.squareFootage) : undefined,
    }));
    const res = await apiRequest("POST", "/api/units/import", { rows: mapped });
    const data = await res.json() as ImportResult;
    queryClient.invalidateQueries({ queryKey: ["/api/units"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith("/api/residential/dataset") });
    return data;
  }

  const buildingById = useMemo(() => new Map(buildings.map((building) => [building.id, building])), [buildings]);
  const sortedPeopleOptions = useMemo(() => {
    return [...availablePeople].sort((left, right) => {
      const leftName = `${left.firstName ?? ""} ${left.lastName ?? ""}`.trim();
      const rightName = `${right.firstName ?? ""} ${right.lastName ?? ""}`.trim();
      return leftName.localeCompare(rightName);
    });
  }, [availablePeople]);

  function openEdit(unit: Unit) {
    setDialogMode("unit");
    setEditingId(unit.id);
    setEditingLegacyBuilding(unit.building ?? null);
    unitForm.reset({
      associationId: unit.associationId,
      buildingId: unit.buildingId ?? "",
      unitNumber: unit.unitNumber,
      squareFootage: unit.squareFootage ?? undefined,
    });
    buildingForm.reset({ associationId: unit.associationId, name: "", address: "", totalUnits: undefined, notes: "" });

    const now = Date.now();
    const unitDir = residentialDataset?.unitDirectory.find((d) => d.unit.id === unit.id);
    const activeOwners: OwnerEntry[] = (unitDir?.owners ?? [])
      .filter((o) => {
        const startMs = o.ownership.startDate ? new Date(o.ownership.startDate).getTime() : Number.NaN;
        const endMs = o.ownership.endDate ? new Date(o.ownership.endDate).getTime() : Number.NaN;
        return (Number.isNaN(startMs) || startMs <= now) && (Number.isNaN(endMs) || endMs >= now);
      })
      .map((o) => ({
        ownership: o.ownership,
        personName: o.person ? `${o.person.firstName ?? ""} ${o.person.lastName ?? ""}`.trim() : "Unknown",
      }));
    setOwnerEntries(activeOwners);
    setRemovedOwnershipIds(new Set());
    setPendingNewOwners([]);
    setAddOwnerPersonId("");
    setAddOwnerPercentage("100");
    setOpen(true);
  }

  async function applyOwnershipChanges(unitId: string) {
    const effectiveAt = new Date().toISOString();
    let changed = false;

    for (const entry of ownerEntries) {
      if (removedOwnershipIds.has(entry.ownership.id)) {
        await apiRequest("PATCH", `/api/ownerships/${entry.ownership.id}`, { endDate: effectiveAt });
        changed = true;
      }
    }

    for (const entry of pendingNewOwners) {
      await apiRequest("POST", "/api/ownerships", {
        unitId,
        personId: entry.personId,
        ownershipPercentage: entry.percentage,
        startDate: effectiveAt,
      });
      changed = true;
    }

    if (changed) {
      queryClient.invalidateQueries({ queryKey: ["/api/ownerships"] });
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/residential/dataset"),
      });
      queryClient.invalidateQueries({
        queryKey: [activeAssociationId ? `/api/persons?associationId=${activeAssociationId}` : "/api/persons"],
      });
    }
  }

  function onSubmitUnit(values: z.infer<typeof unitFormSchema>) {
    const selectedBuilding = values.buildingId ? buildingById.get(values.buildingId) : undefined;

    if (!editingId && !values.buildingId && !editingLegacyBuilding) {
      toast({ title: "Select or create a building first", variant: "destructive" });
      return;
    }

    const payload: UnitMutationPayload = {
      associationId: values.associationId,
      buildingId: values.buildingId || null,
      unitNumber: values.unitNumber.trim(),
      building: selectedBuilding?.name ?? editingLegacyBuilding ?? null,
      squareFootage:
        typeof values.squareFootage === "number" && !Number.isNaN(values.squareFootage)
          ? values.squareFootage
          : null,
    };

    if (editingId) {
      updateMutation.mutate(
        { ...payload, id: editingId },
        {
          onSuccess: async () => {
            try {
              await applyOwnershipChanges(editingId);
            } catch (error) {
              const message = error instanceof Error ? error.message : "Failed to update owners";
              toast({ title: "Ownership update failed", description: message, variant: "destructive" });
            }
          },
        },
      );
      return;
    }

    if (!activeAssociationId) {
      toast({ title: "Select an association context first", variant: "destructive" });
      return;
    }

    createMutation.mutate(payload);
  }

  function onSubmitBuilding(values: z.infer<typeof buildingFormSchema>) {
    if (!activeAssociationId) {
      toast({ title: "Select an association context first", variant: "destructive" });
      return;
    }
    createBuildingMutation.mutate(values);
  }

  function openBuildingDialog() {
    setDialogMode("building");
    setEditingId(null);
    setEditingLegacyBuilding(null);
    unitForm.reset({ associationId: activeAssociationId, buildingId: "", unitNumber: "", squareFootage: undefined });
    buildingForm.reset({ associationId: activeAssociationId, name: "", address: "", totalUnits: undefined, notes: "" });
    setOwnerEntries([]);
    setRemovedOwnershipIds(new Set());
    setPendingNewOwners([]);
    setOpen(true);
  }

  function openUnitDialog(buildingId?: string, legacyBuildingName?: string) {
    if (!buildings.length && !legacyBuildingName) {
      toast({ title: "Add a building first", description: "Create the building before adding units to it.", variant: "destructive" });
      return;
    }
    const selectedBuildingId = buildingId && buildingById.has(buildingId) ? buildingId : (buildings[0]?.id ?? "");
    setDialogMode("unit");
    setEditingId(null);
    setEditingLegacyBuilding(legacyBuildingName ?? null);
    unitForm.reset({
      associationId: activeAssociationId,
      buildingId: legacyBuildingName ? "" : selectedBuildingId,
      unitNumber: "",
      squareFootage: undefined,
    });
    buildingForm.reset({ associationId: activeAssociationId, name: "", address: "", totalUnits: undefined, notes: "" });
    setOwnerEntries([]);
    setRemovedOwnershipIds(new Set());
    setPendingNewOwners([]);
    setOpen(true);
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setEditingId(null);
      setEditingLegacyBuilding(null);
      unitForm.reset({ associationId: activeAssociationId, buildingId: "", unitNumber: "", squareFootage: undefined });
      buildingForm.reset({ associationId: activeAssociationId, name: "", address: "", totalUnits: undefined, notes: "" });
      setOwnerEntries([]);
      setRemovedOwnershipIds(new Set());
      setPendingNewOwners([]);
      setAddOwnerPersonId("");
      setAddOwnerPercentage("100");
    }
  }

  async function copyFieldValue(value: string, label: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(trimmed);
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: "Copy failed", description: `Unable to copy ${label.toLowerCase()}.`, variant: "destructive" });
    }
  }

  function toggleBuildingCollapse(groupKey: string) {
    setCollapsedBuildings((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  }

  const buildingGroups = useMemo(() => {
    const ownerships = residentialDataset?.ownerships ?? [];
    const occupancies = residentialDataset?.occupancies ?? [];
    const unitDirectoryByUnitId = new Map((residentialDataset?.unitDirectory ?? []).map((entry) => [entry.unit.id, entry]));
    const ownershipCountByUnit = new Map<string, number>();
    for (const ownership of ownerships) {
      ownershipCountByUnit.set(ownership.unitId, (ownershipCountByUnit.get(ownership.unitId) ?? 0) + 1);
    }
    const occupancyByUnit = new Map(occupancies.map((occupancy) => [occupancy.unitId, occupancy.occupancyType]));
    const groups = new Map<string, { buildingId: string | null; building: string; units: Unit[] }>();
    for (const building of buildings) {
      groups.set(building.id, {
        buildingId: building.id,
        building: building.name,
        units: [],
      });
    }
    for (const unit of units ?? []) {
      const key = unit.buildingId ?? `legacy:${unit.building?.trim() || "unassigned"}`;
      const existing = groups.get(key);
      if (existing) {
        existing.units.push(unit);
        continue;
      }
      groups.set(key, {
        buildingId: unit.buildingId ?? null,
        building: unit.building?.trim() || "Unassigned Building",
        units: [unit],
      });
    }

    return Array.from(groups.values())
      .map((group) => ({
        groupKey: group.buildingId ?? `legacy:${group.building}`,
        buildingId: group.buildingId,
        building: group.building,
        isLegacyGroup: !group.buildingId,
        unitRows: group.units
          .sort((left, right) => left.unitNumber.localeCompare(right.unitNumber))
          .map((unit) => {
            const unitDirectory = unitDirectoryByUnitId.get(unit.id);
            const primaryOwner = unitDirectory?.owners.find((owner) => owner.person)?.person ?? null;
            const ownerCount = ownershipCountByUnit.get(unit.id) ?? 0;
            const additionalOwnerCount = Math.max(ownerCount - (primaryOwner ? 1 : 0), 0);
            const ownerNameBase = primaryOwner
              ? `${primaryOwner.firstName ?? ""} ${primaryOwner.lastName ?? ""}`.trim()
              : ownerCount > 0
                ? "Owner linked"
                : "Unassigned";
            const ownerName = additionalOwnerCount > 0 ? `${ownerNameBase} +${additionalOwnerCount}` : ownerNameBase;
            const ownerEmail = primaryOwner?.email?.trim() ?? "";
            const ownerPhone = primaryOwner?.phone?.trim() ?? "";
            const occupancyType = occupancyByUnit.get(unit.id);
            const occupancyLabel = occupancyType === "OWNER_OCCUPIED"
              ? "Owner Occupied"
              : occupancyType === "TENANT"
                ? "Tenant"
                : "Vacant";

            const tenantPerson =
              unitDirectory?.activeOccupancy?.occupancy.occupancyType === "TENANT"
                ? (unitDirectory.activeOccupancy.person ?? null)
                : null;
            const tenantName = tenantPerson
              ? `${tenantPerson.firstName ?? ""} ${tenantPerson.lastName ?? ""}`.trim()
              : "";
            const tenantEmail = tenantPerson?.email?.trim() ?? "";
            const tenantPhone = tenantPerson?.phone?.trim() ?? "";
            const tenantPersonId = tenantPerson?.id ?? null;

            return {
              unit,
              ownerCount,
              ownerName,
              ownerEmail,
              ownerPhone,
              ownerPersonId: primaryOwner?.id ?? null,
              occupancyType,
              occupancyLabel,
              tenantPerson,
              tenantName,
              tenantEmail,
              tenantPhone,
              tenantPersonId,
            };
          }),
        unitCount: group.units.length,
        occupiedCount: group.units.filter((unit) => occupancyByUnit.has(unit.id)).length,
        ownerLinkedCount: group.units.filter((unit) => (ownershipCountByUnit.get(unit.id) ?? 0) > 0).length,
      }))
      .sort((left, right) => left.building.localeCompare(right.building));
  }, [buildings, residentialDataset, units]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Buildings &amp; Units</h1>
          <p className="text-muted-foreground">Start by adding buildings, then add units within each building.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={openBuildingDialog} data-testid="button-add-building" disabled={!activeAssociationId}>
            <Building2 className="h-4 w-4 mr-2" />
            Add Building
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => openUnitDialog()}
            data-testid="button-add-unit"
            disabled={!activeAssociationId || !buildings.length}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Unit
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setImportOpen(true)}
            data-testid="button-import-units"
            disabled={!activeAssociationId}
          >
            <FileUp className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Unit" : dialogMode === "building" ? "New Building" : "New Unit"}
              </DialogTitle>
            </DialogHeader>

            {!editingId && dialogMode === "building" ? (
              <div className="rounded-lg border p-4 space-y-4" data-testid="building-first-step-card">
                <div className="flex items-center gap-2 font-medium">
                  <Building2 className="h-4 w-4" />
                  Building Details
                </div>
                <Form {...buildingForm}>
                  <form onSubmit={buildingForm.handleSubmit(onSubmitBuilding)} className="space-y-4">
                    <FormField control={buildingForm.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Building Name</FormLabel>
                        <FormControl><Input data-testid="input-building-name" placeholder="Building A" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={buildingForm.control} name="address" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl><Input data-testid="input-building-address" placeholder="123 Main St, City, ST 00000" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={buildingForm.control} name="totalUnits" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of Units</FormLabel>
                          <FormControl><Input data-testid="input-building-total-units" type="number" placeholder="24" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={buildingForm.control} name="notes" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl><Textarea data-testid="input-building-notes" className="min-h-[40px]" placeholder="Optional details" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <Button type="submit" variant="outline" className="w-full" disabled={createBuildingMutation.isPending} data-testid="button-submit-building">
                      {createBuildingMutation.isPending ? "Adding building..." : "Save Building"}
                    </Button>
                  </form>
                </Form>
              </div>
            ) : null}

            {(editingId || dialogMode === "unit") ? (
            <Form {...unitForm}>
              <form onSubmit={unitForm.handleSubmit(onSubmitUnit)} className="space-y-4">
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
                </div>

                <div className="rounded-lg border p-4 space-y-4">
                  <div className="font-medium">{editingId ? "Unit Details" : "Step 2: Add Unit"}</div>
                  <FormField control={unitForm.control} name="buildingId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Building</FormLabel>
                      {editingLegacyBuilding && !field.value ? (
                        <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-sm">
                          Adding to legacy building group: <span className="font-medium">{editingLegacyBuilding}</span>
                        </div>
                      ) : null}
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-unit-building">
                            <SelectValue placeholder={buildingsLoading ? "Loading buildings..." : "Select a building"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {buildings.map((building) => (
                            <SelectItem key={building.id} value={building.id}>{building.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!editingId && !buildings.length ? (
                        <div className="text-xs text-muted-foreground">Add a building in Step 1 to continue.</div>
                      ) : editingLegacyBuilding && !field.value ? (
                        <div className="text-xs text-muted-foreground">
                          You can keep this legacy building group or switch to a saved building record.
                        </div>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={unitForm.control} name="unitNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Number</FormLabel>
                        <FormControl><Input data-testid="input-unit-number" placeholder="101" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={unitForm.control} name="squareFootage" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Square Footage</FormLabel>
                        <FormControl><Input data-testid="input-unit-sqft" type="number" placeholder="1200" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  {editingId ? (
                    <div className="space-y-2">
                      <div className="text-sm font-medium flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        Owners
                      </div>

                      {ownerEntries.filter((e) => !removedOwnershipIds.has(e.ownership.id)).length === 0 && pendingNewOwners.length === 0 ? (
                        <div className="text-sm text-muted-foreground rounded-md border border-dashed px-3 py-2">
                          No owners assigned to this unit.
                        </div>
                      ) : null}

                      {ownerEntries
                        .filter((e) => !removedOwnershipIds.has(e.ownership.id))
                        .map((entry) => (
                          <div key={entry.ownership.id} className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm">
                            <span>{entry.personName} · {entry.ownership.ownershipPercentage}%</span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => setRemovedOwnershipIds((prev) => new Set(Array.from(prev).concat(entry.ownership.id)))}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}

                      {pendingNewOwners.map((entry, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                          <span>{entry.personName} · {entry.percentage}% <span className="text-xs">(pending)</span></span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => setPendingNewOwners((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}

                      <div className="flex gap-2 pt-1">
                        <Select value={addOwnerPersonId} onValueChange={setAddOwnerPersonId}>
                          <SelectTrigger className="flex-1 h-8 text-sm" data-testid="select-add-owner-person">
                            <SelectValue placeholder="Add owner…" />
                          </SelectTrigger>
                          <SelectContent>
                            {sortedPeopleOptions
                              .filter((p) =>
                                !ownerEntries.some((e) => !removedOwnershipIds.has(e.ownership.id) && e.ownership.personId === p.id)
                                && !pendingNewOwners.some((e) => e.personId === p.id),
                              )
                              .map((person) => (
                                <SelectItem key={person.id} value={person.id}>
                                  {`${person.firstName ?? ""} ${person.lastName ?? ""}`.trim()}
                                  {person.email ? ` · ${person.email}` : ""}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          className="w-16 h-8 text-sm"
                          placeholder="%"
                          value={addOwnerPercentage}
                          onChange={(e) => setAddOwnerPercentage(e.target.value)}
                          data-testid="input-add-owner-percentage"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          disabled={!addOwnerPersonId}
                          data-testid="button-add-owner"
                          onClick={() => {
                            const person = sortedPeopleOptions.find((p) => p.id === addOwnerPersonId);
                            if (!person) return;
                            const pct = Math.max(1, Math.min(100, Number.parseInt(addOwnerPercentage) || 100));
                            setPendingNewOwners((prev) => [
                              ...prev,
                              {
                                personId: addOwnerPersonId,
                                personName: `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim(),
                                percentage: pct,
                              },
                            ]);
                            setAddOwnerPersonId("");
                            setAddOwnerPercentage("100");
                          }}
                        >
                          Add
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Ownership changes are saved when you click Update.
                      </div>
                    </div>
                  ) : null}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending || updateMutation.isPending || (!editingId && !buildings.length)}
                  data-testid="button-submit-unit"
                >
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingId ? "Update" : "Create"}
                </Button>
              </form>
            </Form>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {!!buildingGroups.length ? (
            <div className="p-6">
              <div className="grid gap-4 grid-cols-1">
                {buildingGroups.map((group) => (
                  <div key={group.groupKey} className="rounded-lg border bg-card">
                    <div className="flex items-center justify-between border-b px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleBuildingCollapse(group.groupKey)}
                        className="text-left"
                        data-testid={`button-toggle-building-${group.groupKey}`}
                      >
                        <div className="flex items-center gap-2">
                          {collapsedBuildings[group.groupKey] ? (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div className="font-medium">{group.building}</div>
                          {group.isLegacyGroup ? <Badge variant="outline">Legacy</Badge> : null}
                        </div>
                        <div className="ml-6 text-xs text-muted-foreground">{group.unitCount} total units</div>
                      </button>
                      <div className="flex flex-wrap gap-2 items-center">
                        <Badge variant="outline">{group.ownerLinkedCount} owned</Badge>
                        <Badge variant="secondary">{group.occupiedCount} occupied</Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openUnitDialog(group.buildingId ?? undefined, group.isLegacyGroup ? group.building : undefined)}
                          data-testid={`button-add-unit-for-building-${group.buildingId ?? group.building}`}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Unit
                        </Button>
                      </div>
                    </div>
                    {collapsedBuildings[group.groupKey] ? null : (
                    <div className="p-4">
                      {group.unitRows.length === 0 ? (
                        <div className="rounded-md bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                          No units yet in this building.
                        </div>
                      ) : null}
                      {group.unitRows.length > 0 ? (
                        <div className="hidden lg:grid grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)_140px_104px] gap-3 rounded-t-md border bg-muted/10 px-3 py-2 text-xs font-medium text-muted-foreground">
                          <div>Unit</div>
                          <div>Owner Name</div>
                          <div>Email</div>
                          <div>Phone Number</div>
                          <div>Actions</div>
                        </div>
                      ) : null}
                      <div className="md:rounded-b-md md:border md:border-t-0 md:divide-y">
                        {group.unitRows.map((row) => (
                          <div key={row.unit.id} className="border mb-2 rounded-md p-3 text-sm md:mb-0 md:rounded-none md:border-0 md:p-3">
                            <div className="grid gap-3 lg:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)_140px_104px] lg:items-center">
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className="font-medium">Unit {row.unit.unitNumber}</div>
                                  <Badge variant={row.occupancyType === "TENANT" ? "secondary" : "default"}>
                                    {row.occupancyLabel}
                                  </Badge>
                                </div>
                              </div>

                              <CopyableCell
                                label="Owner name"
                                value={row.ownerName === "Unassigned" ? "" : row.ownerName}
                                fallback="Unassigned"
                                onCopy={copyFieldValue}
                              />
                              <CopyableCell
                                label="Owner email"
                                value={row.ownerEmail}
                                fallback="No email"
                                onCopy={copyFieldValue}
                              />
                              <CopyableCell
                                label="Owner phone"
                                value={row.ownerPhone}
                                fallback="No phone"
                                onCopy={copyFieldValue}
                              />

                              <div className="min-w-0 flex flex-wrap items-center gap-1 lg:flex-nowrap lg:justify-end">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  title="Open Unit Intake Form"
                                  aria-label="Open Unit Intake Form"
                                  className="h-8 w-8 shrink-0 p-0"
                                  data-testid={`button-contact-form-link-unit-${row.unit.id}`}
                                  disabled={contactFormLinkMutation.isPending}
                                  onClick={() => contactFormLinkMutation.mutate({ unitId: row.unit.id })}
                                >
                                  <Link2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  asChild
                                  size="sm"
                                  variant="outline"
                                  title="Send Communication"
                                  aria-label="Send Communication"
                                  className="h-8 w-8 shrink-0 p-0"
                                  data-testid={`button-send-communication-unit-${row.unit.id}`}
                                >
                                  <Link href={`/app/communications?targetType=selected-units&selectedUnitAudience=owners&unitId=${row.unit.id}${row.ownerPersonId ? `&personId=${row.ownerPersonId}` : ""}`}>
                                    <MessageSquare className="h-4 w-4" />
                                  </Link>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  title="Edit Unit"
                                  aria-label="Edit Unit"
                                  className="h-8 w-8 shrink-0 p-0"
                                  onClick={() => openEdit(row.unit)}
                                  data-testid={`button-edit-unit-${row.unit.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {row.tenantPerson ? (
                              <div className="mt-2 rounded-md border border-dashed bg-muted/20 px-3 py-2">
                                <div className="grid gap-3 lg:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)_140px_104px] lg:items-center">
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <User className="h-3 w-3 shrink-0" />
                                    <span>Tenant</span>
                                  </div>
                                  <CopyableCell
                                    label="Tenant name"
                                    value={row.tenantName}
                                    fallback="No name"
                                    onCopy={copyFieldValue}
                                  />
                                  <CopyableCell
                                    label="Tenant email"
                                    value={row.tenantEmail}
                                    fallback="No email"
                                    onCopy={copyFieldValue}
                                  />
                                  <CopyableCell
                                    label="Tenant phone"
                                    value={row.tenantPhone}
                                    fallback="No phone"
                                    onCopy={copyFieldValue}
                                  />
                                  <div className="min-w-0 flex justify-end">
                                    <Button
                                      asChild
                                      size="sm"
                                      variant="ghost"
                                      title="Message Tenant"
                                      aria-label="Message Tenant"
                                      className="h-8 w-8 shrink-0 p-0"
                                    >
                                      <Link href={`/app/communications?targetType=selected-units&selectedUnitAudience=tenants&unitId=${row.unit.id}${row.tenantPersonId ? `&personId=${row.tenantPersonId}` : ""}`}>
                                        <MessageSquare className="h-4 w-4" />
                                      </Link>
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {isLoading || buildingsLoading ? (
            <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !buildingGroups.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <DoorOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium" data-testid="text-empty-state">No units yet</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">Units are the core of your association. Start by creating a building above, then add individual unit numbers inside it. Every owner, tenant, and ledger entry ties back to a unit.</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import Units from CSV"
        description="Upload a CSV file to bulk-create units. The buildingName column must match an existing building name exactly. Duplicate unit numbers within the same building will be skipped."
        columns={[
          { key: "unitNumber", label: "Unit Number", required: true },
          { key: "buildingName", label: "Building Name" },
          { key: "squareFootage", label: "Sq Ft" },
        ]}
        sampleRows={[
          ["101", "Building A", "850"],
          ["102", "Building A", "900"],
          ["201", "Building B", ""],
        ]}
        onImport={handleUnitsImport}
      />
    </div>
  );
}

function CopyableCell({
  label,
  value,
  fallback,
  onCopy,
}: {
  label: string;
  value: string;
  fallback: string;
  onCopy: (value: string, label: string) => Promise<void>;
}) {
  const hasValue = Boolean(value.trim());
  return (
    <button
      type="button"
      className={`min-w-0 w-full rounded-md border bg-background px-2 py-2 text-left lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 ${hasValue ? "cursor-copy" : "cursor-default"}`}
      onClick={() => {
        if (!hasValue) return;
        void onCopy(value, label);
      }}
      data-testid={`field-copy-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="truncate text-sm">{hasValue ? value : fallback}</div>
    </button>
  );
}
