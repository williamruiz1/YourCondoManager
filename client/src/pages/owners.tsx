import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useResidentialDataset } from "@/hooks/use-residential-dataset";
import { useLocation } from "wouter";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { useIsMobile } from "@/hooks/use-mobile";

const formSchema = z.object({
  unitId: z.string().min(1, "Unit is required"),
  personId: z.string().min(1, "Person is required"),
  ownershipPercentage: z.coerce.number().min(0).max(100).default(100),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
});

type OwnerDraft = {
  ownershipId: string;
  personId: string;
  ownerName: string;
  unitLabel: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mailingAddress: string;
  ownershipPercentage: string;
  startDate: string;
  endDate: string;
};

function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function isCurrentOwnership(endDate: string | Date | null | undefined): boolean {
  return !endDate;
}

function validateOwnershipTotals(
  ownerships: Array<{ id: string; unitId: string; ownershipPercentage: number; endDate: string | Date | null }>,
  units: Array<{ id: string; unitNumber: string; building: string | null }>,
  pending: Array<{ ownershipId?: string; unitId: string; ownershipPercentage: number; endDate?: string | null }>,
) {
  const activeTotals = new Map<string, number>();

  for (const ownership of ownerships) {
    if (!isCurrentOwnership(ownership.endDate)) continue;
    activeTotals.set(ownership.unitId, (activeTotals.get(ownership.unitId) ?? 0) + ownership.ownershipPercentage);
  }

  for (const row of pending) {
    const nextPercentage = row.ownershipPercentage;
    if (!Number.isFinite(nextPercentage) || nextPercentage < 0) {
      return { valid: false, message: "Ownership percentage must be a valid number." };
    }

    const existing = row.ownershipId
      ? ownerships.find((ownership) => ownership.id === row.ownershipId)
      : undefined;
    const existingUnitId = existing?.unitId;

    if (existing && isCurrentOwnership(existing.endDate)) {
      activeTotals.set(existing.unitId, (activeTotals.get(existing.unitId) ?? 0) - existing.ownershipPercentage);
    }

    if (!row.endDate) {
      activeTotals.set(row.unitId, (activeTotals.get(row.unitId) ?? 0) + nextPercentage);
    }

    const affectedUnitId = row.endDate && existingUnitId ? existingUnitId : row.unitId;
    const total = activeTotals.get(affectedUnitId) ?? 0;
    if (total > 100.0001) {
      const unit = units.find((entry) => entry.id === affectedUnitId);
      const unitLabel = unit ? `Unit ${unit.unitNumber}${unit.building ? ` (${unit.building})` : ""}` : "Selected unit";
      return {
        valid: false,
        message: `${unitLabel} would exceed 100% total ownership.`,
      };
    }
  }

  return { valid: true as const };
}

export default function OwnersPage() {
  const isMobile = useIsMobile();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, OwnerDraft>>({});
  const { toast } = useToast();
  const { activeAssociationId } = useActiveAssociation();

  const { data: residentialDataset, isLoading } = useResidentialDataset(activeAssociationId || undefined);
  const ownerships = residentialDataset?.ownerships ?? [];
  const persons = residentialDataset?.persons ?? [];
  const units = residentialDataset?.units ?? [];
  const associations = residentialDataset?.associations ?? [];

  const ownerRows = useMemo(() => {
    const personMap = new Map(persons.map((person) => [person.id, person]));
    const unitMap = new Map(units.map((unit) => [unit.id, unit]));
    const associationMap = new Map(associations.map((association) => [association.id, association]));

    return ownerships.map((ownership) => {
      const person = personMap.get(ownership.personId);
      const unit = unitMap.get(ownership.unitId);
      const association = unit ? associationMap.get(unit.associationId) : undefined;
      return {
        ownership,
        person,
        unit,
        association,
      };
    });
  }, [associations, ownerships, persons, units]);

  useEffect(() => {
    const nextDrafts: Record<string, OwnerDraft> = {};
    for (const row of ownerRows) {
      const personName = row.person ? `${row.person.firstName} ${row.person.lastName}` : "Unknown";
      const unitLabel = row.unit
        ? `Unit ${row.unit.unitNumber}${row.association ? ` - ${row.association.name}` : ""}`
        : "Unknown";
      nextDrafts[row.ownership.id] = {
        ownershipId: row.ownership.id,
        personId: row.ownership.personId,
        ownerName: personName,
        unitLabel,
        firstName: row.person?.firstName ?? "",
        lastName: row.person?.lastName ?? "",
        email: row.person?.email ?? "",
        phone: row.person?.phone ?? "",
        mailingAddress: row.person?.mailingAddress ?? "",
        ownershipPercentage: String(row.ownership.ownershipPercentage ?? 100),
        startDate: toDateInput(row.ownership.startDate),
        endDate: toDateInput(row.ownership.endDate),
      };
    }
    setDrafts(nextDrafts);
  }, [ownerRows]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { unitId: "", personId: "", ownershipPercentage: 100, startDate: "", endDate: "" },
  });

  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) => {
      const payload = {
        ...data,
        startDate: new Date(data.startDate).toISOString(),
        endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
      };
      return apiRequest("POST", "/api/ownerships", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ownerships"] });
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/residential/dataset"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Ownership assigned successfully" });
      setOpen(false);
      form.reset();
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (rows: OwnerDraft[]) => {
      const payload = {
        rows: rows.map((row) => ({
          ownershipId: row.ownershipId,
          personId: row.personId,
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          email: row.email.trim() || null,
          phone: row.phone.trim() || null,
          mailingAddress: row.mailingAddress.trim() || null,
          ownershipPercentage: Number(row.ownershipPercentage),
          startDate: row.startDate ? new Date(row.startDate).toISOString() : null,
          endDate: row.endDate ? new Date(row.endDate).toISOString() : null,
        })),
      };
      const res = await apiRequest("POST", "/api/owners/bulk-update", payload);
      return res.json();
    },
    onSuccess: (result: { updatedCount: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ownerships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/residential/dataset"),
      });
      toast({ title: "Owners updated", description: `${result.updatedCount} owner rows saved.` });
      setIsBulkEditing(false);
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const totalsCheck = validateOwnershipTotals(ownerships, units, [{
      unitId: values.unitId,
      ownershipPercentage: values.ownershipPercentage,
      endDate: values.endDate || null,
    }]);
    if (!totalsCheck.valid) {
      toast({ title: "Ownership total exceeded", description: totalsCheck.message, variant: "destructive" });
      return;
    }
    createMutation.mutate(values);
  }

  function updateDraft(ownershipId: string, patch: Partial<OwnerDraft>) {
    setDrafts((current) => ({
      ...current,
      [ownershipId]: {
        ...current[ownershipId],
        ...patch,
      },
    }));
  }

  const changedDrafts = useMemo(() => {
    return ownerRows.flatMap((row) => {
      const current = drafts[row.ownership.id];
      if (!current || !row.person) return [];

      const changed =
        current.firstName !== (row.person.firstName ?? "") ||
        current.lastName !== (row.person.lastName ?? "") ||
        current.email !== (row.person.email ?? "") ||
        current.phone !== (row.person.phone ?? "") ||
        current.mailingAddress !== (row.person.mailingAddress ?? "") ||
        current.ownershipPercentage !== String(row.ownership.ownershipPercentage ?? 100) ||
        current.startDate !== toDateInput(row.ownership.startDate) ||
        current.endDate !== toDateInput(row.ownership.endDate);

      return changed ? [current] : [];
    });
  }, [drafts, ownerRows]);

  function saveBulkEdits() {
    if (changedDrafts.length === 0) {
      toast({ title: "No changes to save" });
      setIsBulkEditing(false);
      return;
    }

    const totalsCheck = validateOwnershipTotals(
      ownerships,
      units,
      changedDrafts.map((row) => ({
        ownershipId: row.ownershipId,
        unitId: ownerRows.find((entry) => entry.ownership.id === row.ownershipId)?.ownership.unitId || "",
        ownershipPercentage: Number(row.ownershipPercentage),
        endDate: row.endDate || null,
      })),
    );
    if (!totalsCheck.valid) {
      toast({ title: "Ownership total exceeded", description: totalsCheck.message, variant: "destructive" });
      return;
    }

    bulkUpdateMutation.mutate(changedDrafts);
  }

  function cancelBulkEdits() {
    const resetDrafts: Record<string, OwnerDraft> = {};
    for (const row of ownerRows) {
      const personName = row.person ? `${row.person.firstName} ${row.person.lastName}` : "Unknown";
      const unitLabel = row.unit
        ? `Unit ${row.unit.unitNumber}${row.association ? ` - ${row.association.name}` : ""}`
        : "Unknown";
      resetDrafts[row.ownership.id] = {
        ownershipId: row.ownership.id,
        personId: row.ownership.personId,
        ownerName: personName,
        unitLabel,
        firstName: row.person?.firstName ?? "",
        lastName: row.person?.lastName ?? "",
        email: row.person?.email ?? "",
        phone: row.person?.phone ?? "",
        mailingAddress: row.person?.mailingAddress ?? "",
        ownershipPercentage: String(row.ownership.ownershipPercentage ?? 100),
        startDate: toDateInput(row.ownership.startDate),
        endDate: toDateInput(row.ownership.endDate),
      };
    }
    setDrafts(resetDrafts);
    setIsBulkEditing(false);
  }

  function openOwnerDetail(personId: string) {
    navigate(`/app/persons?personId=${encodeURIComponent(personId)}`);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Owners</h1>
          <p className="text-muted-foreground">Track unit ownership records and repair imported owner data.</p>
        </div>
        <div className="flex gap-2">
          {isBulkEditing ? (
            <>
              <Button
                variant="outline"
                onClick={cancelBulkEdits}
                disabled={bulkUpdateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={saveBulkEdits}
                disabled={bulkUpdateMutation.isPending}
              >
                {bulkUpdateMutation.isPending ? "Saving..." : `Save ${changedDrafts.length} Changes`}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setIsBulkEditing(true)}>
              Bulk Edit Owners
            </Button>
          )}
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) form.reset(); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-ownership"><Plus className="h-4 w-4 mr-2" />Assign Owner</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-h-[85vh]">
              <DialogHeader><DialogTitle>Assign Owner to Unit</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="unitId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-ownership-unit"><SelectValue placeholder="Select unit" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {units.map((u) => <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber} {u.building ? `(${u.building})` : ""}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="personId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Owner (Person)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-ownership-person"><SelectValue placeholder="Select person" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {persons.map((p) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="ownershipPercentage" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ownership %</FormLabel>
                      <FormControl><Input data-testid="input-ownership-percentage" type="number" min="0" max="100" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
                    <FormField control={form.control} name="startDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl><Input data-testid="input-ownership-start" type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="endDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl><Input data-testid="input-ownership-end" type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-ownership">
                    {createMutation.isPending ? "Saving..." : "Assign Owner"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isBulkEditing ? (
        <div className="text-sm text-muted-foreground">
          Edit imported owner contact details, ownership percentages, and dates directly in the table, then save all changes at once.
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !ownerships.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium" data-testid="text-empty-state">No ownership records</h3>
              <p className="text-sm text-muted-foreground mt-1">Assign owners to units to track ownership.</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Owner</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Mailing Address</TableHead>
                      <TableHead>Ownership</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ownerRows.map((row) => {
                      const draft = drafts[row.ownership.id];
                      const personId = row.person?.id ?? "";
                      return (
                        <TableRow
                          key={row.ownership.id}
                          data-testid={`row-ownership-${row.ownership.id}`}
                          className={!isBulkEditing && row.person ? "cursor-pointer" : ""}
                          onClick={() => {
                            if (isBulkEditing || !personId) return;
                            openOwnerDetail(personId);
                          }}
                        >
                          <TableCell className="font-medium min-w-[200px]">
                            {isBulkEditing && draft ? (
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  value={draft.firstName}
                                  onChange={(e) => updateDraft(row.ownership.id, { firstName: e.target.value })}
                                  placeholder="First name"
                                />
                                <Input
                                  value={draft.lastName}
                                  onChange={(e) => updateDraft(row.ownership.id, { lastName: e.target.value })}
                                  placeholder="Last name"
                                />
                              </div>
                            ) : (
                              row.person ? `${row.person.firstName} ${row.person.lastName}` : "Unknown"
                            )}
                          </TableCell>
                          <TableCell>{draft?.unitLabel ?? "Unknown"}</TableCell>
                          <TableCell className="min-w-[220px]">
                            {isBulkEditing && draft ? (
                              <Input
                                value={draft.email}
                                onChange={(e) => updateDraft(row.ownership.id, { email: e.target.value })}
                                placeholder="owner@example.com"
                              />
                            ) : (
                              row.person?.email || <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="min-w-[160px]">
                            {isBulkEditing && draft ? (
                              <Input
                                value={draft.phone}
                                onChange={(e) => updateDraft(row.ownership.id, { phone: e.target.value })}
                                placeholder="(555) 123-4567"
                              />
                            ) : (
                              row.person?.phone || <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="min-w-[240px]">
                            {isBulkEditing && draft ? (
                              <Input
                                value={draft.mailingAddress}
                                onChange={(e) => updateDraft(row.ownership.id, { mailingAddress: e.target.value })}
                                placeholder="Mailing address"
                              />
                            ) : (
                              row.person?.mailingAddress || <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="min-w-[120px]">
                            {isBulkEditing && draft ? (
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={draft.ownershipPercentage}
                                onChange={(e) => updateDraft(row.ownership.id, { ownershipPercentage: e.target.value })}
                              />
                            ) : (
                              <Badge variant="secondary">{row.ownership.ownershipPercentage}%</Badge>
                            )}
                          </TableCell>
                          <TableCell className="min-w-[140px]">
                            {isBulkEditing && draft ? (
                              <Input
                                type="date"
                                value={draft.startDate}
                                onChange={(e) => updateDraft(row.ownership.id, { startDate: e.target.value })}
                              />
                            ) : (
                              <span className="text-muted-foreground">{toDateInput(row.ownership.startDate)}</span>
                            )}
                          </TableCell>
                          <TableCell className="min-w-[140px]">
                            {isBulkEditing && draft ? (
                              <Input
                                type="date"
                                value={draft.endDate}
                                onChange={(e) => updateDraft(row.ownership.id, { endDate: e.target.value })}
                              />
                            ) : (
                              row.ownership.endDate ? <span className="text-muted-foreground">{toDateInput(row.ownership.endDate)}</span> : <Badge variant="outline">Current</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {personId ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openOwnerDetail(personId);
                                }}
                              >
                                Open Detail
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-3 p-4 md:hidden">
                {ownerRows.map((row) => {
                  const draft = drafts[row.ownership.id];
                  const personId = row.person?.id ?? "";
                  return (
                    <div key={row.ownership.id} data-testid={`row-ownership-${row.ownership.id}`} className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {isBulkEditing && draft ? (
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <Input
                                value={draft.firstName}
                                onChange={(e) => updateDraft(row.ownership.id, { firstName: e.target.value })}
                                placeholder="First name"
                              />
                              <Input
                                value={draft.lastName}
                                onChange={(e) => updateDraft(row.ownership.id, { lastName: e.target.value })}
                                placeholder="Last name"
                              />
                            </div>
                          ) : (
                            <>
                              <div className="text-sm font-medium">{row.person ? `${row.person.firstName} ${row.person.lastName}` : "Unknown"}</div>
                              <div className="mt-1 text-xs text-muted-foreground">{draft?.unitLabel ?? "Unknown"}</div>
                            </>
                          )}
                        </div>
                        {!isBulkEditing ? <Badge variant="secondary">{row.ownership.ownershipPercentage}%</Badge> : null}
                      </div>
                      {isBulkEditing && draft ? (
                        <div className="space-y-3">
                          <Input
                            value={draft.email}
                            onChange={(e) => updateDraft(row.ownership.id, { email: e.target.value })}
                            placeholder="owner@example.com"
                          />
                          <Input
                            value={draft.phone}
                            onChange={(e) => updateDraft(row.ownership.id, { phone: e.target.value })}
                            placeholder="(555) 123-4567"
                          />
                          <Input
                            value={draft.mailingAddress}
                            onChange={(e) => updateDraft(row.ownership.id, { mailingAddress: e.target.value })}
                            placeholder="Mailing address"
                          />
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={draft.ownershipPercentage}
                              onChange={(e) => updateDraft(row.ownership.id, { ownershipPercentage: e.target.value })}
                            />
                            <Input
                              type="date"
                              value={draft.startDate}
                              onChange={(e) => updateDraft(row.ownership.id, { startDate: e.target.value })}
                            />
                            <Input
                              type="date"
                              value={draft.endDate}
                              onChange={(e) => updateDraft(row.ownership.id, { endDate: e.target.value })}
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div>{row.person?.email || "-"}</div>
                            <div>{row.person?.phone || "-"}</div>
                            <div>{row.person?.mailingAddress || "-"}</div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                            <div>
                              <div>Start</div>
                              <div className="mt-1 text-foreground">{toDateInput(row.ownership.startDate)}</div>
                            </div>
                            <div>
                              <div>End</div>
                              <div className="mt-1 text-foreground">{row.ownership.endDate ? toDateInput(row.ownership.endDate) : "Current"}</div>
                            </div>
                          </div>
                          {personId ? (
                            <Button
                              className="w-full"
                              variant="outline"
                              size="sm"
                              onClick={() => openOwnerDetail(personId)}
                            >
                              Open Detail
                            </Button>
                          ) : null}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
