import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Unit, Association, Building } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Building2, DoorOpen } from "lucide-react";
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

const buildingFormSchema = z.object({
  associationId: z.string().min(1, "Association is required"),
  name: z.string().trim().min(1, "Building name is required"),
  address: z.string().trim().min(1, "Building address is required"),
  totalUnits: z.union([z.coerce.number().int().positive(), z.nan()]).optional(),
  notes: z.string().optional().transform((value) => value?.trim() || ""),
});

export default function UnitsPage() {
  const [open, setOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"building" | "unit">("building");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLegacyBuilding, setEditingLegacyBuilding] = useState<string | null>(null);
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const { data: residentialDataset } = useResidentialDataset();

  const { data: units, isLoading } = useQuery<Unit[]>({ queryKey: ["/api/units"] });
  const { data: associations } = useQuery<Association[]>({ queryKey: ["/api/associations"] });
  const { data: buildings = [], isLoading: buildingsLoading } = useQuery<Building[]>({ queryKey: ["/api/buildings"] });

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
      queryClient.invalidateQueries({ queryKey: ["/api/residential/dataset"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/residential/dataset"] });
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

  const buildingById = useMemo(() => new Map(buildings.map((building) => [building.id, building])), [buildings]);

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
    setOpen(true);
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
      updateMutation.mutate({ ...payload, id: editingId });
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
    setOpen(true);
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setEditingId(null);
      setEditingLegacyBuilding(null);
      unitForm.reset({ associationId: activeAssociationId, buildingId: "", unitNumber: "", squareFootage: undefined });
      buildingForm.reset({ associationId: activeAssociationId, name: "", address: "", totalUnits: undefined, notes: "" });
    }
  }

  const getAssociationName = (id: string) => associations?.find((a) => a.id === id)?.name ?? "Unknown";

  const buildingGroups = useMemo(() => {
    const ownerships = residentialDataset?.ownerships ?? [];
    const occupancies = residentialDataset?.occupancies ?? [];
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
        buildingId: group.buildingId,
        building: group.building,
        isLegacyGroup: !group.buildingId,
        units: group.units.sort((left, right) => left.unitNumber.localeCompare(right.unitNumber)),
        unitCount: group.units.length,
        occupiedCount: group.units.filter((unit) => occupancyByUnit.has(unit.id)).length,
        ownerLinkedCount: group.units.filter((unit) => (ownershipCountByUnit.get(unit.id) ?? 0) > 0).length,
        occupancyByUnit,
        ownershipCountByUnit,
      }))
      .sort((left, right) => left.building.localeCompare(right.building));
  }, [buildingById, buildings, residentialDataset, units]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Units</h1>
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
            <div className="border-b p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Building Hierarchy</h2>
                <p className="text-sm text-muted-foreground">Define buildings first, then fill units with ownership and occupancy records.</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {buildingGroups.map((group) => (
                  <div key={group.building} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{group.building}</div>
                          {group.isLegacyGroup ? <Badge variant="outline">Legacy</Badge> : null}
                        </div>
                        <div className="text-xs text-muted-foreground">{group.unitCount} total units</div>
                      </div>
                      <div className="flex gap-2 items-center">
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
                    <div className="space-y-2">
                      {group.units.length === 0 ? (
                        <div className="rounded-md bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                          No units yet in this building.
                        </div>
                      ) : null}
                      {group.units.map((unit) => (
                        <div key={unit.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-sm">
                          <span>Unit {unit.unitNumber}</span>
                          <div className="flex gap-2">
                            <Badge variant="outline">{group.ownershipCountByUnit.get(unit.id) ?? 0} owners</Badge>
                            <Badge variant={group.occupancyByUnit.get(unit.id) === "TENANT" ? "secondary" : "default"}>
                              {group.occupancyByUnit.get(unit.id) === "OWNER_OCCUPIED"
                                ? "Owner Occupied"
                                : group.occupancyByUnit.get(unit.id) === "TENANT"
                                  ? "Tenant"
                                  : "Vacant"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !units?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <DoorOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium" data-testid="text-empty-state">No units yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Add buildings first, then add units.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Association</TableHead>
                  <TableHead>Building</TableHead>
                  <TableHead>Sq Ft</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((u) => (
                  <TableRow key={u.id} data-testid={`row-unit-${u.id}`}>
                    <TableCell className="font-medium">{u.unitNumber}</TableCell>
                    <TableCell><Badge variant="secondary">{getAssociationName(u.associationId)}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{(u.buildingId ? buildingById.get(u.buildingId)?.name : null) || u.building || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.squareFootage ? `${u.squareFootage.toLocaleString()} ft` : "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openEdit(u)} data-testid={`button-edit-unit-${u.id}`}>Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
