// zone: Operations
// persona: Manager, Board Officer, Assisted Board, PM Assistant
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Unit, Building, Person, Ownership, Occupancy } from "@shared/schema";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useResidentialDataset } from "@/hooks/use-residential-dataset";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

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
  useDocumentTitle("Buildings & Units");
  const isMobile = useIsMobile();
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
  const [inlineNewPersonOpen, setInlineNewPersonOpen] = useState(false);
  const [inlineFirstName, setInlineFirstName] = useState("");
  const [inlineLastName, setInlineLastName] = useState("");
  const [inlineEmail, setInlineEmail] = useState("");
  const [inlinePhone, setInlinePhone] = useState("");
  const [currentOccupancy, setCurrentOccupancy] = useState<{ occupancy: Occupancy; personName: string } | null>(null);
  const [removeCurrentOccupancy, setRemoveCurrentOccupancy] = useState(false);
  const [pendingNewOccupantId, setPendingNewOccupantId] = useState("");
  const [occupancyTypeOverride, setOccupancyTypeOverride] = useState<"OWNER_OCCUPIED" | "TENANT">("TENANT");
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const { data: residentialDataset } = useResidentialDataset(activeAssociationId || undefined);

  const { data: units, isLoading } = useQuery<Unit[]>({ queryKey: ["/api/units"] });
  const { data: buildings = [], isLoading: buildingsLoading } = useQuery<Building[]>({ queryKey: ["/api/buildings"] });
  const personsQueryKey = activeAssociationId ? `/api/persons?associationId=${activeAssociationId}` : "/api/persons";
  const { data: availablePeople = [], refetch: refetchPeople } = useQuery<Person[]>({
    queryKey: [personsQueryKey],
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

  function resetUnitDialogState() {
    setOpen(false);
    setEditingId(null);
    setEditingLegacyBuilding(null);
    setOwnerEntries([]);
    setRemovedOwnershipIds(new Set());
    setPendingNewOwners([]);
    setAddOwnerPersonId("");
    setAddOwnerPercentage("100");
    setCurrentOccupancy(null);
    setRemoveCurrentOccupancy(false);
    setPendingNewOccupantId("");
    setOccupancyTypeOverride("TENANT");
    unitForm.reset({ associationId: activeAssociationId, buildingId: "", unitNumber: "", squareFootage: undefined });
    buildingForm.reset({ associationId: activeAssociationId, name: "", address: "", totalUnits: undefined, notes: "" });
  }

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

  const createPersonInlineMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; email: string; phone: string }) => {
      const res = await apiRequest("POST", "/api/persons", {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        phone: data.phone || null,
        associationId: activeAssociationId || null,
      });
      return res.json() as Promise<{ id: string; firstName: string; lastName: string }>;
    },
    onSuccess: (person) => {
      queryClient.invalidateQueries({ queryKey: [personsQueryKey] });
      const pct = Math.max(1, Math.min(100, Number.parseInt(addOwnerPercentage) || 100));
      setPendingNewOwners((prev) => [
        ...prev,
        {
          personId: person.id,
          personName: `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim(),
          percentage: pct,
        },
      ]);
      setInlineFirstName("");
      setInlineLastName("");
      setInlineEmail("");
      setInlinePhone("");
      setInlineNewPersonOpen(false);
      setAddOwnerPercentage("100");
    },
    onError: (error: Error) => toast({ title: "Error creating person", description: error.message, variant: "destructive" }),
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
    void refetchPeople();
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

    const activeOcc = unitDir?.activeOccupancy ?? null;
    setCurrentOccupancy(
      activeOcc
        ? {
            occupancy: activeOcc.occupancy,
            personName: activeOcc.person ? `${activeOcc.person.firstName ?? ""} ${activeOcc.person.lastName ?? ""}`.trim() : "Unknown",
          }
        : null,
    );
    const defaultOccType = activeOcc
      ? (activeOcc.occupancy.occupancyType as "OWNER_OCCUPIED" | "TENANT")
      : activeOwners.length > 0 ? "OWNER_OCCUPIED" : "TENANT";
    setOccupancyTypeOverride(defaultOccType);
    setRemoveCurrentOccupancy(false);
    setPendingNewOccupantId("");
    setOpen(true);
  }

  async function applyOwnershipChanges(unitId: string) {
    const effectiveAt = new Date().toISOString();
    let changed = false;

    // If the user selected someone in the dropdown but didn't click "Add", include them automatically
    const allPendingNewOwners = [...pendingNewOwners];
    if (addOwnerPersonId) {
      const person = sortedPeopleOptions.find((p) => p.id === addOwnerPersonId);
      if (person && !allPendingNewOwners.some((e) => e.personId === addOwnerPersonId)) {
        const pct = Math.max(1, Math.min(100, Number.parseInt(addOwnerPercentage) || 100));
        allPendingNewOwners.push({
          personId: addOwnerPersonId,
          personName: `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim(),
          percentage: pct,
        });
      }
    }

    for (const entry of ownerEntries) {
      if (removedOwnershipIds.has(entry.ownership.id)) {
        await apiRequest("PATCH", `/api/ownerships/${entry.ownership.id}`, { endDate: effectiveAt });
        changed = true;
      }
    }

    for (const entry of allPendingNewOwners) {
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
      queryClient.invalidateQueries({ queryKey: [personsQueryKey] });
    }
  }

  async function applyOccupancyChanges(unitId: string) {
    const effectiveAt = new Date().toISOString();

    // Determine target occupant based on occupancy type
    const targetType = occupancyTypeOverride;
    let targetPersonId: string | null = null;

    if (targetType === "OWNER_OCCUPIED") {
      // Derive occupant from the first active owner
      const firstActiveOwner = ownerEntries.find((e) => !removedOwnershipIds.has(e.ownership.id));
      const firstPendingOwner = pendingNewOwners[0];
      targetPersonId = firstActiveOwner?.ownership.personId ?? firstPendingOwner?.personId ?? null;
    } else {
      // TENANT: use selected tenant or keep existing if unchanged
      if (pendingNewOccupantId) {
        targetPersonId = pendingNewOccupantId;
      } else if (!removeCurrentOccupancy && currentOccupancy?.occupancy.occupancyType === "TENANT") {
        targetPersonId = currentOccupancy.occupancy.personId;
      }
    }

    const currentPersonId = currentOccupancy?.occupancy.personId ?? null;
    const currentType = currentOccupancy?.occupancy.occupancyType ?? null;

    const needsChange = currentPersonId !== targetPersonId || currentType !== targetType;
    if (!needsChange) return;

    // End existing occupancy
    if (currentOccupancy) {
      await apiRequest("PATCH", `/api/occupancies/${currentOccupancy.occupancy.id}`, { endDate: effectiveAt });
    }

    // Create new occupancy with target person
    if (targetPersonId) {
      await apiRequest("POST", "/api/occupancies", {
        unitId,
        personId: targetPersonId,
        occupancyType: targetType,
        startDate: effectiveAt,
      });
    }

    queryClient.invalidateQueries({ queryKey: ["/api/occupancies"] });
    queryClient.invalidateQueries({
      predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/residential/dataset"),
    });
  }

  async function onSubmitUnit(values: z.infer<typeof unitFormSchema>) {
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
      try {
        await updateMutation.mutateAsync({ ...payload, id: editingId });
        await applyOwnershipChanges(editingId);
        await applyOccupancyChanges(editingId);
        await queryClient.invalidateQueries({ queryKey: ["/api/units"] });
        await queryClient.invalidateQueries({
          predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/residential/dataset"),
        });
        await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        toast({ title: "Unit updated successfully" });
        resetUnitDialogState();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update unit";
        toast({ title: "Update failed", description: message, variant: "destructive" });
      }
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
      setInlineNewPersonOpen(false);
      setInlineFirstName("");
      setInlineLastName("");
      setInlineEmail("");
      setInlinePhone("");
      setCurrentOccupancy(null);
      setRemoveCurrentOccupancy(false);
      setPendingNewOccupantId("");
      setOccupancyTypeOverride("TENANT");
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
    const unitDirectoryByUnitId = new Map((residentialDataset?.unitDirectory ?? []).map((entry) => [entry.unit.id, entry]));
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
            const ownerCount = unitDirectory?.ownerCount ?? 0;
            const allOwnerPersons = (unitDirectory?.owners ?? [])
              .filter((owner) => owner.person)
              .map((owner) => owner.person!);
            const primaryOwner = allOwnerPersons[0] ?? null;
            const additionalOwners = allOwnerPersons.slice(1).map((p) => ({
              personId: p.id,
              personName: `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim(),
              email: p.email?.trim() ?? "",
              phone: p.phone?.trim() ?? "",
            }));
            const ownerName = primaryOwner
              ? `${primaryOwner.firstName ?? ""} ${primaryOwner.lastName ?? ""}`.trim()
              : ownerCount > 0
                ? "Owner linked"
                : "Unassigned";
            const ownerEmail = primaryOwner?.email?.trim() ?? "";
            const ownerPhone = primaryOwner?.phone?.trim() ?? "";
            const occupancyType = unitDirectory?.activeOccupancy?.occupancy.occupancyType;
            const occupancyLabel = occupancyType === "OWNER_OCCUPIED"
              ? "Owner"
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
              additionalOwners,
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
        occupiedCount: group.units.filter((unit) => unitDirectoryByUnitId.get(unit.id)?.activeOccupancy).length,
        ownerLinkedCount: group.units.filter((unit) => (unitDirectoryByUnitId.get(unit.id)?.ownerCount ?? 0) > 0).length,
      }))
      .sort((left, right) => left.building.localeCompare(right.building));
  }, [buildings, residentialDataset, units]);

  const summaryCounts = useMemo(() => {
    const allUnitRows = buildingGroups.flatMap((g) => g.unitRows);
    const totalUnits = allUnitRows.length;
    const ownerOccupied = allUnitRows.filter((r) => r.occupancyType === "OWNER_OCCUPIED").length;
    const tenants = allUnitRows.filter((r) => r.occupancyType === "TENANT").length;
    const uniqueOwnerIds = new Set<string>();
    for (const row of allUnitRows) {
      if (row.ownerPersonId) uniqueOwnerIds.add(row.ownerPersonId);
      for (const additional of row.additionalOwners) uniqueOwnerIds.add(additional.personId);
    }
    const ownerOccupiedPct = totalUnits > 0 ? Math.round((ownerOccupied / totalUnits) * 100) : 0;
    return {
      buildings: buildingGroups.filter((g) => !g.isLegacyGroup).length || buildings.length,
      units: totalUnits,
      owners: uniqueOwnerIds.size,
      tenants,
      ownerOccupiedPct,
    };
  }, [buildingGroups, buildings]);

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(145deg,hsl(217_84%_26%)_0%,hsl(219_64%_20%)_55%,hsl(221_48%_12%)_100%)] p-6 text-primary-foreground md:rounded-[24px] md:border md:border-outline-variant/30 md:bg-surface-container-lowest md:text-on-surface">
        <div className="absolute inset-0 md:hidden">
          <div className="absolute -right-10 top-0 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -left-12 bottom-0 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white md:hidden">
              <DoorOpen className="h-3.5 w-3.5" />
              Lease Workspace
            </div>
            <h1
              className="mt-4 font-headline text-4xl font-bold italic leading-tight text-white md:mt-0 md:text-3xl md:not-italic md:text-on-surface"
              data-testid="text-page-title"
            >
              Buildings &amp; Units
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/95 md:text-on-surface/60">
              Manage buildings, unit records, owners, and live occupancy for {activeAssociationName || "the current association"} without leaving the workspace.
            </p>

            <div className="mt-5 rounded-[22px] border border-white/25 bg-white/15 p-4 backdrop-blur-sm md:hidden">
              <div className="label-caps text-white/90">Current Snapshot</div>
              <p className="mt-2 text-sm leading-relaxed text-white">
                {summaryCounts.units > 0
                  ? `${summaryCounts.units} units across ${summaryCounts.buildings} buildings, with ${summaryCounts.tenants} active tenant records and ${summaryCounts.ownerOccupiedPct}% owner occupancy.`
                  : "Start by creating a building shell, then add units and assign owners or tenants as leases change."}
              </p>
            </div>
          </div>

          <div className="hidden gap-2 md:flex">
            <Button type="button" onClick={openBuildingDialog} data-testid="button-add-building" disabled={!activeAssociationId}>
              <Building2 className="mr-2 h-4 w-4" />
              Add Building
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => openUnitDialog()}
              data-testid="button-add-unit"
              disabled={!activeAssociationId || !buildings.length}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Unit
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setImportOpen(true)}
              data-testid="button-import-units"
              disabled={!activeAssociationId}
            >
              <FileUp className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
          </div>
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-h-[85vh]">
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

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField control={buildingForm.control} name="totalUnits" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of Units</FormLabel>
                          <FormControl><Input className={isMobile ? "min-h-11" : undefined} data-testid="input-building-total-units" type="number" placeholder="24" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={buildingForm.control} name="notes" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl><Textarea data-testid="input-building-notes" className={isMobile ? "min-h-24" : "min-h-[40px]"} placeholder="Optional details" {...field} /></FormControl>
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
                          <SelectTrigger className={isMobile ? "min-h-11" : undefined} data-testid="select-unit-building">
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

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField control={unitForm.control} name="unitNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Number</FormLabel>
                        <FormControl><Input className={isMobile ? "min-h-11" : undefined} data-testid="input-unit-number" placeholder="101" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={unitForm.control} name="squareFootage" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Square Footage</FormLabel>
                        <FormControl><Input className={isMobile ? "min-h-11" : undefined} data-testid="input-unit-sqft" type="number" placeholder="1200" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  {editingId ? (
                    <>
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

                      <div className={`gap-2 pt-1 ${isMobile ? "grid grid-cols-1" : "flex"}`}>
                        <Select value={addOwnerPersonId} onValueChange={setAddOwnerPersonId}>
                          <SelectTrigger className={isMobile ? "min-h-11 text-sm" : "flex-1 h-8 text-sm"} data-testid="select-add-owner-person">
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
                          className={isMobile ? "min-h-11 text-sm" : "w-16 h-8 text-sm"}
                          placeholder="%"
                          value={addOwnerPercentage}
                          onChange={(e) => setAddOwnerPercentage(e.target.value)}
                          data-testid="input-add-owner-percentage"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={isMobile ? "min-h-11" : "h-8"}
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
                      {!inlineNewPersonOpen ? (
                        <button
                          type="button"
                          className="text-xs text-primary underline-offset-2 hover:underline w-fit"
                          onClick={() => setInlineNewPersonOpen(true)}
                        >
                          + New person not in list
                        </button>
                      ) : (
                        <div className="rounded-md border border-dashed p-3 space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">New person</div>
                          <div className={`gap-2 ${isMobile ? "grid grid-cols-1" : "flex"}`}>
                            <Input
                              className={isMobile ? "min-h-10 text-sm" : "h-7 text-xs"}
                              placeholder="First name"
                              value={inlineFirstName}
                              onChange={(e) => setInlineFirstName(e.target.value)}
                            />
                            <Input
                              className={isMobile ? "min-h-10 text-sm" : "h-7 text-xs"}
                              placeholder="Last name"
                              value={inlineLastName}
                              onChange={(e) => setInlineLastName(e.target.value)}
                            />
                          </div>
                          <div className={`gap-2 ${isMobile ? "grid grid-cols-1" : "flex"}`}>
                            <Input
                              className={isMobile ? "min-h-10 text-sm" : "h-7 text-xs"}
                              placeholder="Email (optional)"
                              value={inlineEmail}
                              onChange={(e) => setInlineEmail(e.target.value)}
                            />
                            <Input
                              className={isMobile ? "min-h-10 text-sm" : "h-7 text-xs"}
                              placeholder="Phone (optional)"
                              value={inlinePhone}
                              onChange={(e) => setInlinePhone(e.target.value)}
                            />
                          </div>
                          <div className={`gap-2 ${isMobile ? "grid grid-cols-1" : "flex"}`}>
                            <Button
                              type="button"
                              size="sm"
                              className={isMobile ? "min-h-10 text-sm" : "h-7 text-xs"}
                              disabled={!inlineFirstName.trim() || !inlineLastName.trim() || createPersonInlineMutation.isPending}
                              onClick={() => createPersonInlineMutation.mutate({ firstName: inlineFirstName.trim(), lastName: inlineLastName.trim(), email: inlineEmail.trim(), phone: inlinePhone.trim() })}
                            >
                              Create & add
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className={isMobile ? "min-h-10 text-sm" : "h-7 text-xs"}
                              onClick={() => { setInlineNewPersonOpen(false); setInlineFirstName(""); setInlineLastName(""); setInlineEmail(""); setInlinePhone(""); }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Ownership changes are saved when you click Update.
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Occupancy
                      </div>

                      {/* Occupancy type is the primary choice */}
                      <div className={`rounded-md border overflow-hidden text-xs ${isMobile ? "grid grid-cols-2 w-full" : "flex w-fit"}`}>
                        <button
                          type="button"
                          onClick={() => { setOccupancyTypeOverride("OWNER_OCCUPIED"); setPendingNewOccupantId(""); setRemoveCurrentOccupancy(false); }}
                          className={`px-3 py-2 font-medium transition-colors ${occupancyTypeOverride === "OWNER_OCCUPIED" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                        >
                          Owner-occupied
                        </button>
                        <button
                          type="button"
                          onClick={() => setOccupancyTypeOverride("TENANT")}
                          className={`px-3 py-2 font-medium transition-colors border-l ${occupancyTypeOverride === "TENANT" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                        >
                          Tenant
                        </button>
                      </div>

                      {/* Owner-occupied: occupant is derived from the owner — no separate selection */}
                      {occupancyTypeOverride === "OWNER_OCCUPIED" && (() => {
                        const activeOwner = ownerEntries.find((e) => !removedOwnershipIds.has(e.ownership.id));
                        const pendingOwner = pendingNewOwners[0];
                        const ownerName = activeOwner?.personName ?? pendingOwner?.personName ?? null;
                        return (
                          <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                            {ownerName
                              ? <span>Occupant: <span className="font-medium text-foreground">{ownerName}</span></span>
                              : "Add an owner above — they will be set as the occupant."}
                          </div>
                        );
                      })()}

                      {/* Tenant: must assign a separate person */}
                      {occupancyTypeOverride === "TENANT" && (
                        <>
                          {/* Current tenant (from existing occupancy, if tenant type) */}
                          {currentOccupancy && currentOccupancy.occupancy.occupancyType === "TENANT" && !pendingNewOccupantId && !removeCurrentOccupancy ? (
                            <div className={`rounded-md border bg-muted/20 px-3 py-2 text-sm ${isMobile ? "space-y-2" : "flex items-center justify-between"}`}>
                              <span>{currentOccupancy.personName}</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => setRemoveCurrentOccupancy(true)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : null}

                          {/* Pending new tenant selected */}
                          {pendingNewOccupantId ? (
                            <div className={`rounded-md border border-dashed bg-muted/20 px-3 py-2 text-sm ${isMobile ? "space-y-2" : "flex items-center justify-between"}`}>
                              <span>
                                {(() => {
                                  const p = sortedPeopleOptions.find((p) => p.id === pendingNewOccupantId);
                                  return p ? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() : "—";
                                })()}
                                <span className="text-xs text-muted-foreground ml-1">(pending)</span>
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => setPendingNewOccupantId("")}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : null}

                          {/* Tenant selector: shown when no pending tenant */}
                          {!pendingNewOccupantId ? (
                            <Select
                              value=""
                              onValueChange={(val) => { setPendingNewOccupantId(val); setRemoveCurrentOccupancy(true); }}
                            >
                              <SelectTrigger className={isMobile ? "min-h-11 text-sm" : "h-8 text-sm"}>
                                <SelectValue placeholder={
                                  currentOccupancy?.occupancy.occupancyType === "TENANT" && !removeCurrentOccupancy
                                    ? "Change tenant…"
                                    : "Assign tenant…"
                                } />
                              </SelectTrigger>
                              <SelectContent>
                                {sortedPeopleOptions
                                  .filter((p) => !currentOccupancy || p.id !== currentOccupancy.occupancy.personId)
                                  .map((person) => (
                                    <SelectItem key={person.id} value={person.id}>
                                      {`${person.firstName ?? ""} ${person.lastName ?? ""}`.trim()}
                                      {person.email ? ` · ${person.email}` : ""}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          ) : null}
                        </>
                      )}

                      <div className="text-xs text-muted-foreground">
                        Occupancy changes are saved when you click Update.
                      </div>
                    </div>
                    </>
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
      </section>

      <section className="space-y-4 md:hidden">
        <div className="flex items-baseline gap-4">
          <h2 className="font-headline text-2xl font-bold text-on-surface">Quick Actions</h2>
          <div className="h-px flex-1 bg-outline-variant/30" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={openBuildingDialog}
            disabled={!activeAssociationId}
            className="group flex min-h-[156px] flex-col justify-between rounded-[22px] border border-outline-variant/20 bg-surface-container-lowest p-5 text-left editorial-shadow transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-active:scale-95">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-on-surface">Add Building</div>
              <div className="mt-1 text-xs leading-relaxed text-on-surface/55">Create the property shell first.</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => openUnitDialog()}
            disabled={!activeAssociationId || !buildings.length}
            className="group flex min-h-[156px] flex-col justify-between rounded-[22px] border border-outline-variant/20 bg-surface-container-lowest p-5 text-left editorial-shadow transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-active:scale-95">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-on-surface">Add Unit</div>
              <div className="mt-1 text-xs leading-relaxed text-on-surface/55">Place a new residence in an existing building.</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setImportOpen(true)}
            disabled={!activeAssociationId}
            className="group flex min-h-[132px] flex-col justify-between rounded-[22px] border border-outline-variant/20 bg-surface-container-lowest p-5 text-left editorial-shadow transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-active:scale-95">
              <FileUp className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-on-surface">Import CSV</div>
              <div className="mt-1 text-xs leading-relaxed text-on-surface/55">Bulk-load unit records in one pass.</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => document.getElementById("units-directory")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="group flex min-h-[132px] flex-col justify-between rounded-[22px] border border-outline-variant/20 bg-surface-container-lowest p-5 text-left editorial-shadow transition-all active:scale-[0.98]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-active:scale-95">
              <DoorOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-on-surface">Browse Directory</div>
              <div className="mt-1 text-xs leading-relaxed text-on-surface/55">Jump into buildings, owners, and active leases.</div>
            </div>
          </button>
        </div>
      </section>

      {activeAssociationId && (units?.length ?? 0) > 0 && (
        <section className="space-y-4">
          <div className="flex items-baseline gap-4">
            <h2 className="font-headline text-2xl font-bold text-on-surface">Lease Snapshot</h2>
            <div className="h-px flex-1 bg-outline-variant/30" />
          </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Buildings", value: summaryCounts.buildings, sub: "registered" },
            { label: "Units", value: summaryCounts.units, sub: "total" },
            { label: "Owners", value: summaryCounts.owners, sub: "on record" },
            { label: "Tenants", value: summaryCounts.tenants, sub: "active" },
            { label: "Owner Occupied", value: `${summaryCounts.ownerOccupiedPct}%`, sub: "of units" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest editorial-shadow px-4 py-3">
              <p className="text-[10px] font-label font-semibold uppercase tracking-[0.18em] text-on-surface/50">{label}</p>
              <p className="font-headline text-2xl font-bold text-on-surface mt-0.5">{value}</p>
              <p className="text-xs text-on-surface/40 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
        </section>
      )}

      <section id="units-directory" className="space-y-4">
        <div className="flex items-baseline gap-4">
          <h2 className="font-headline text-2xl font-bold text-on-surface">Building Directory</h2>
          <div className="h-px flex-1 bg-outline-variant/30" />
        </div>
      <Card className="border-outline-variant/30 bg-transparent shadow-none">
        <CardContent className="p-0">
          {!!buildingGroups.length ? (
            <div className="p-4 md:p-6">
              <div className="grid gap-4 grid-cols-1">
                {buildingGroups.map((group) => (
                  <div key={group.groupKey} className="overflow-hidden rounded-[24px] border border-outline-variant/20 bg-surface-container-lowest editorial-shadow">
                    <div className="border-b border-outline-variant/20 px-4 py-4 md:px-4 md:py-3">
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => toggleBuildingCollapse(group.groupKey)}
                          className="min-w-0 text-left"
                          data-testid={`button-toggle-building-${group.groupKey}`}
                        >
                          <div className="flex items-center gap-2">
                            {collapsedBuildings[group.groupKey] ? (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div className="font-headline text-xl font-semibold text-on-surface">{group.building}</div>
                            {group.isLegacyGroup ? <Badge variant="outline">Legacy</Badge> : null}
                          </div>
                          <div className="ml-6 mt-1 text-xs text-muted-foreground">Manage ownership, occupancy, and contact actions for this building.</div>
                        </button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0 rounded-full"
                          onClick={() => openUnitDialog(group.buildingId ?? undefined, group.isLegacyGroup ? group.building : undefined)}
                          data-testid={`button-add-unit-for-building-${group.buildingId ?? group.building}`}
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          Add Unit
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline">{group.unitCount} units</Badge>
                        <Badge variant="outline">{group.ownerLinkedCount} owned</Badge>
                        <Badge variant="secondary">{group.occupiedCount} occupied</Badge>
                      </div>
                    </div>
                    {collapsedBuildings[group.groupKey] ? null : (
                    <div className="p-4">
                      {group.unitRows.length === 0 ? (
                        <div className="rounded-md bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                          No units yet in this building.
                        </div>
                      ) : null}
                      {!isMobile && group.unitRows.length > 0 ? (
                        <div className="hidden lg:grid grid-cols-[80px_110px_minmax(0,1fr)_minmax(0,1fr)_140px_104px] gap-3 rounded-t-md border bg-muted/10 px-3 py-2 text-xs font-medium text-muted-foreground">
                          <div>Unit</div>
                          <div>Occupancy</div>
                          <div>Owner Name</div>
                          <div>Email</div>
                          <div>Phone Number</div>
                          <div>Actions</div>
                        </div>
                      ) : null}
                      {isMobile ? (
                        <div className="space-y-4">
                          {group.unitRows.map((row) => (
                            <div key={row.unit.id} className="rounded-[22px] border border-outline-variant/20 bg-background p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="label-caps text-on-surface/45">Unit</div>
                                  <div className="mt-1 font-headline text-3xl font-bold text-primary">{row.unit.unitNumber}</div>
                                </div>
                                <Badge
                                  variant={
                                    row.occupancyType === "OWNER_OCCUPIED" ? "default"
                                    : row.occupancyType === "TENANT" ? "secondary"
                                    : "outline"
                                  }
                                  className="mt-1"
                                >
                                  {row.occupancyLabel}
                                </Badge>
                              </div>

                              <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="rounded-2xl bg-surface-container p-3">
                                  <div className="label-caps text-on-surface/45">Owners</div>
                                  <div className="mt-1 text-lg font-semibold text-on-surface">{row.ownerCount}</div>
                                </div>
                                <div className="rounded-2xl bg-surface-container p-3">
                                  <div className="label-caps text-on-surface/45">Sq Ft</div>
                                  <div className="mt-1 text-lg font-semibold text-on-surface">{row.unit.squareFootage ?? "—"}</div>
                                </div>
                              </div>

                              <div className="mt-4 rounded-[20px] bg-surface-container p-4">
                                <div className="label-caps text-on-surface/45">Owner Of Record</div>
                                <div className="mt-2 font-headline text-xl font-semibold text-on-surface">
                                  {row.ownerName === "Unassigned" || !row.ownerName ? "Unassigned" : row.ownerName}
                                </div>
                                <div className="mt-3 grid gap-2">
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
                                </div>
                                {row.additionalOwners.length > 0 ? (
                                  <div className="mt-3 text-xs text-on-surface/55">
                                    {row.additionalOwners.length} additional owner{row.additionalOwners.length === 1 ? "" : "s"} on file.
                                  </div>
                                ) : null}
                              </div>

                              {row.tenantPerson ? (
                                <div className="mt-4 rounded-[20px] border border-dashed border-outline-variant/40 bg-surface-container p-4">
                                  <div className="label-caps text-on-surface/45">Current Tenant</div>
                                  <div className="mt-2 font-headline text-xl font-semibold text-on-surface">{row.tenantName || "No name"}</div>
                                  <div className="mt-3 grid gap-2">
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
                                  </div>
                                  <Button
                                    asChild
                                    size="sm"
                                    variant="ghost"
                                    className="mt-3 h-10 rounded-full px-4 text-primary"
                                  >
                                    <Link href={`/app/communications?targetType=selected-units&selectedUnitAudience=tenants&unitId=${row.unit.id}${row.tenantPersonId ? `&personId=${row.tenantPersonId}` : ""}`}>
                                      <MessageSquare className="mr-2 h-4 w-4" />
                                      Message Tenant
                                    </Link>
                                  </Button>
                                </div>
                              ) : null}

                              <div className="mt-4 grid grid-cols-3 gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-11 rounded-full"
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
                                  className="h-11 rounded-full"
                                  data-testid={`button-send-communication-unit-${row.unit.id}`}
                                >
                                  <Link href={`/app/communications?targetType=selected-units&selectedUnitAudience=owners&unitId=${row.unit.id}${row.ownerPersonId ? `&personId=${row.ownerPersonId}` : ""}`}>
                                    <MessageSquare className="h-4 w-4" />
                                  </Link>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-11 rounded-full"
                                  onClick={() => openEdit(row.unit)}
                                  data-testid={`button-edit-unit-${row.unit.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                      <div className="md:rounded-b-md md:border md:border-t-0 md:divide-y">
                        {group.unitRows.map((row) => (
                          <div key={row.unit.id} className="border mb-2 rounded-md p-3 text-sm md:mb-0 md:rounded-none md:border-0 md:p-3">
                            <div className="grid gap-3 lg:grid-cols-[80px_110px_minmax(0,1fr)_minmax(0,1fr)_140px_104px] lg:items-center">
                              <div className="font-medium">{row.unit.unitNumber}</div>

                              <div className="min-w-0">
                                <Badge
                                  variant={
                                    row.occupancyType === "OWNER_OCCUPIED" ? "default"
                                    : row.occupancyType === "TENANT" ? "secondary"
                                    : "outline"
                                  }
                                >
                                  {row.occupancyLabel}
                                </Badge>
                              </div>

                              <div className="min-w-0 w-full rounded-md border bg-background px-2 py-2 text-left lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
                                <div className="truncate text-sm">{row.ownerName === "Unassigned" || !row.ownerName ? "Unassigned" : row.ownerName}</div>
                              </div>
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

                            {row.additionalOwners.map((additionalOwner) => (
                              <div key={additionalOwner.personId} className="mt-2 rounded-md border bg-muted/20 px-3 py-2">
                                <div className="grid gap-3 lg:grid-cols-[80px_110px_minmax(0,1fr)_minmax(0,1fr)_140px_104px] lg:items-center">
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <User className="h-3 w-3 shrink-0" />
                                    <span>Co-owner</span>
                                  </div>
                                  <div />
                                  <div className="min-w-0 w-full rounded-md border bg-background px-2 py-2 text-left lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
                                    <div className="truncate text-sm">{additionalOwner.personName || "No name"}</div>
                                  </div>
                                  <CopyableCell
                                    label="Owner email"
                                    value={additionalOwner.email}
                                    fallback="No email"
                                    onCopy={copyFieldValue}
                                  />
                                  <CopyableCell
                                    label="Owner phone"
                                    value={additionalOwner.phone}
                                    fallback="No phone"
                                    onCopy={copyFieldValue}
                                  />
                                  <div />
                                </div>
                              </div>
                            ))}

                            {row.tenantPerson ? (
                              <div className="mt-2 rounded-md border border-dashed bg-muted/20 px-3 py-2">
                                <div className="grid gap-3 lg:grid-cols-[80px_110px_minmax(0,1fr)_minmax(0,1fr)_140px_104px] lg:items-center">
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <User className="h-3 w-3 shrink-0" />
                                    <span>Tenant</span>
                                  </div>
                                  <div />
                                  <div className="min-w-0 w-full rounded-md border bg-background px-2 py-2 text-left lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
                                    <div className="truncate text-sm">{row.tenantName || "No name"}</div>
                                  </div>
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
                      )}
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
      </section>

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
