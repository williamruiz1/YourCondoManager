import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Person, Unit, BoardRole } from "@shared/schema";
import { formatPhoneNumber, getPhoneDigits } from "@/lib/phone-formatter";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Mail, Phone, Search, MapPin, Home, FileUp, Pencil, Shield, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { CsvImportDialog, type ImportResult } from "@/components/csv-import-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Association } from "@shared/schema";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { useResidentialDataset } from "@/hooks/use-residential-dataset";
import type { ResidentialDatasetPersonDirectoryItem } from "@shared/schema";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const formSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  residentRole: z.enum(["none", "owner", "tenant"]).default("none"),
  unitId: z.string().optional().default(""),
  mailingAddress: z.string().optional(),
});

type AddressSearchResult = {
  source: "openstreetmap";
  displayName: string;
  address: string;
  city: string;
  state: string;
  country: string;
};

type RoleFilter = "all" | "owner" | "tenant" | "board";

function getStreetAddressLine(address: string | null | undefined) {
  return (address || "").split(",")[0]?.trim() || "";
}

export default function PersonsPage() {
  useDocumentTitle("People");
  const isMobile = useIsMobile();
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState<AddressSearchResult[]>([]);
  const [boardRoleOpen, setBoardRoleOpen] = useState(false);
  const [boardRolePersonId, setBoardRolePersonId] = useState<string>("");
  const [boardRoleAssociationId, setBoardRoleAssociationId] = useState<string>("");
  const [boardRoleName, setBoardRoleName] = useState<string>("Board Member");
  const [boardRoleStartDate, setBoardRoleStartDate] = useState<string>("");
  const [boardRoleEndDate, setBoardRoleEndDate] = useState<string>("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [selectedOwnerUnitIds, setSelectedOwnerUnitIds] = useState<string[]>([]);
  const { activeAssociationId } = useActiveAssociation();
  const { toast } = useToast();

  const { data: persons, isLoading } = useQuery<Person[]>({ queryKey: ["/api/persons"] });
  const { data: associations = [] } = useQuery<Association[]>({ queryKey: ["/api/associations"] });
  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: [activeAssociationId ? `/api/units?associationId=${activeAssociationId}` : "/api/units"],
  });
  const { data: boardRoles = [] } = useQuery<BoardRole[]>({ queryKey: ["/api/board-roles"] });
  const { data: residentialDataset } = useResidentialDataset(activeAssociationId || undefined);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { firstName: "", lastName: "", email: "", phone: "", residentRole: "none", unitId: "", mailingAddress: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const payload = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        phone: getPhoneDigits(data.phone || ""),
        mailingAddress: data.mailingAddress || null,
        associationId: activeAssociationId || null,
      };
      const personResponse = await apiRequest("POST", "/api/persons", payload);
      const person = await personResponse.json() as Person;

      const startDate = new Date().toISOString();
      if (data.residentRole === "owner" && selectedOwnerUnitIds.length > 0) {
        await Promise.all(selectedOwnerUnitIds.map((unitId) =>
          apiRequest("POST", "/api/ownerships", { unitId, personId: person.id, ownershipPercentage: 100, startDate }),
        ));
      } else if (data.residentRole === "tenant" && data.unitId) {
        await apiRequest("POST", "/api/occupancies", {
          unitId: data.unitId,
          personId: person.id,
          occupancyType: "TENANT",
          startDate,
        });
      }

      return person;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ownerships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/occupancies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/residential/dataset"] });
      toast({ title: "Person created successfully" });
      setOpen(false);
      form.reset();
      setAddressQuery("");
      setAddressResults([]);
      setSelectedOwnerUnitIds([]);
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema> & { id: string }) => {
      const payload = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        phone: getPhoneDigits(data.phone || ""),
        mailingAddress: data.mailingAddress || null,
      };
      return apiRequest("PATCH", `/api/persons/${data.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/residential/dataset"] });
      toast({ title: "Person updated successfully" });
      setOpen(false);
      setEditingId(null);
      form.reset();
      setAddressQuery("");
      setAddressResults([]);
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const addressSearchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest("GET", `/api/addresses/search?query=${encodeURIComponent(query)}`);
      const payload = await response.json() as { results?: AddressSearchResult[] };
      return payload.results ?? [];
    },
    onSuccess: (results) => setAddressResults(results),
    onError: () => {
      setAddressResults([]);
    },
  });

  const createBoardRoleMutation = useMutation({
    mutationFn: async () => {
      if (!boardRolePersonId || !boardRoleAssociationId || !boardRoleStartDate) {
        throw new Error("Person, association, role, and start date are required.");
      }
      const res = await apiRequest("POST", "/api/board-roles", {
        personId: boardRolePersonId,
        associationId: boardRoleAssociationId,
        role: boardRoleName,
        startDate: new Date(boardRoleStartDate).toISOString(),
        endDate: boardRoleEndDate ? new Date(boardRoleEndDate).toISOString() : null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/board-roles"] });
      toast({ title: "Board role assigned" });
      setBoardRoleOpen(false);
      setBoardRolePersonId("");
      setBoardRoleAssociationId("");
      setBoardRoleName("Board Member");
      setBoardRoleStartDate("");
      setBoardRoleEndDate("");
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  function openEdit(p: Person) {
    setEditingId(p.id);
    form.reset({
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email ?? "",
      phone: formatPhoneNumber(p.phone ?? ""),
      residentRole: "none",
      unitId: "",
      mailingAddress: p.mailingAddress ?? "",
    });
    setAddressQuery(p.mailingAddress ?? "");
    setAddressResults([]);
    setOpen(true);
  }

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!editingId && values.residentRole === "owner" && selectedOwnerUnitIds.length === 0) {
      toast({ title: "Select at least one unit for the owner", variant: "destructive" });
      return;
    }
    if (!editingId && values.residentRole === "tenant" && !values.unitId) {
      toast({ title: "Select a unit for the tenant", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ ...values, id: editingId });
    } else {
      createMutation.mutate(values);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setEditingId(null);
      form.reset();
      setAddressQuery("");
      setAddressResults([]);
      if (location.includes("personId=")) {
        navigate("/app/persons");
      }
    }
  }

  function applyAddressResult(result: AddressSearchResult) {
    const formatted = [result.address, result.city, result.state, result.country].filter(Boolean).join(", ");
    form.setValue("mailingAddress", formatted, { shouldDirty: true, shouldValidate: true });
    setAddressQuery(formatted);
    setAddressResults([]);
    toast({ title: "Mailing address autofilled" });
  }

  async function copyFieldValue(value: string, label: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
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

  function openBoardRoleAssignment(person: Person) {
    const directoryEntry = personDirectoryMap.get(person.id);
    const linkedAssociationIds = Array.from(
      new Set(
        [...(directoryEntry?.ownedUnitIds ?? []), ...(directoryEntry?.occupiedUnitIds ?? [])]
          .map((unitId) => residentialDataset?.units.find((unit) => unit.id === unitId)?.associationId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    setBoardRolePersonId(person.id);
    setBoardRoleAssociationId(activeAssociationId || person.associationId || linkedAssociationIds[0] || associations[0]?.id || "");
    setBoardRoleName("Board Member");
    setBoardRoleStartDate(new Date().toISOString().slice(0, 10));
    setBoardRoleEndDate("");
    setBoardRoleOpen(true);
  }

  useEffect(() => {
    if (!persons?.length) return;
    const query = location.includes("?") ? location.slice(location.indexOf("?")) : "";
    const params = new URLSearchParams(query);
    const personId = params.get("personId");
    if (!personId) return;
    if (open && editingId === personId) return;
    const target = persons.find((person) => person.id === personId);
    if (!target) return;
    openEdit(target);
  }, [editingId, location, open, persons]);

  useEffect(() => {
    if (!open) return;
    const query = addressQuery.trim();
    if (query.length < 3) {
      setAddressResults([]);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      addressSearchMutation.mutate(query);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [addressQuery, open]);

  // Build lookup maps for enriched display
  const personDirectoryMap = useMemo(() => {
    const map = new Map<string, ResidentialDatasetPersonDirectoryItem>();
    for (const item of residentialDataset?.personDirectory ?? []) {
      map.set(item.person.id, item);
    }
    return map;
  }, [residentialDataset]);

  const unitMap = useMemo(() => {
    const map = new Map<string, { unitNumber: string; building: string | null }>();
    for (const unit of residentialDataset?.units ?? []) {
      map.set(unit.id, { unitNumber: unit.unitNumber, building: unit.building });
    }
    return map;
  }, [residentialDataset]);

  const boardRolesByPerson = useMemo(() => {
    const map = new Map<string, BoardRole[]>();
    for (const role of boardRoles) {
      if (!role.endDate) {
        const existing = map.get(role.personId) ?? [];
        map.set(role.personId, [...existing, role]);
      }
    }
    return map;
  }, [boardRoles]);

  const roleCounts = useMemo(() => {
    let owners = 0;
    let tenants = 0;
    let board = 0;
    for (const p of persons ?? []) {
      const dir = personDirectoryMap.get(p.id);
      if (dir?.isOwner) owners++;
      if (dir?.isTenant) tenants++;
      if (boardRolesByPerson.has(p.id)) board++;
    }
    return { owners, tenants, board };
  }, [persons, personDirectoryMap, boardRolesByPerson]);

  const filteredPersons = useMemo(() => {
    if (!persons) return [];
    const q = search.trim().toLowerCase();
    return persons.filter((p) => {
      if (q) {
        const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
        const matchesSearch = fullName.includes(q) || (p.email ?? "").toLowerCase().includes(q) || (p.phone ?? "").includes(q);
        if (!matchesSearch) return false;
      }
      if (roleFilter === "owner") {
        return personDirectoryMap.get(p.id)?.isOwner ?? false;
      }
      if (roleFilter === "tenant") {
        return personDirectoryMap.get(p.id)?.isTenant ?? false;
      }
      if (roleFilter === "board") {
        return boardRolesByPerson.has(p.id);
      }
      return true;
    });
  }, [persons, search, roleFilter, personDirectoryMap, boardRolesByPerson]);

  const roleFilterOptions: { value: RoleFilter; label: string; count?: number }[] = [
    { value: "all", label: "All", count: persons?.length ?? 0 },
    { value: "owner", label: "Owners", count: roleCounts.owners },
    { value: "tenant", label: "Tenants", count: roleCounts.tenants },
    { value: "board", label: "Board", count: roleCounts.board },
  ];

  async function handlePersonsImport(rows: Record<string, string>[]): Promise<ImportResult> {
    const mapped = rows.map((row) => ({
      firstName: row.firstName ?? "",
      lastName: row.lastName ?? "",
      email: row.email || null,
      phone: row.phone || null,
      mailingAddress: row.mailingAddress || null,
    }));
    const res = await apiRequest("POST", "/api/persons/import", { rows: mapped });
    const data = await res.json() as ImportResult;
    queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
    return data;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface" data-testid="text-page-title">People</h1>
          <p className="text-sm text-on-surface/60 mt-1">Owners, tenants, and board members across your associations.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            data-testid="button-import-persons"
          >
            <FileUp className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-person"><Plus className="h-4 w-4 mr-2" />Add Person</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-h-[85vh]">
            <DialogHeader><DialogTitle>{editingId ? "Edit Person" : "New Person"}</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                  <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl><Input data-testid="input-person-firstname" placeholder="John" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl><Input data-testid="input-person-lastname" placeholder="Doe" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input data-testid="input-person-email" type="email" placeholder="john@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input data-testid="input-person-phone" placeholder="(XXX) XXX-XXXX" {...field} onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                {!editingId ? (
                  <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                    <FormField control={form.control} name="residentRole" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select value={field.value} onValueChange={(v) => { field.onChange(v); if (v !== "owner") setSelectedOwnerUnitIds([]); }}>
                          <FormControl>
                            <SelectTrigger data-testid="select-person-role">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No role yet</SelectItem>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="tenant">Tenant</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {form.watch("residentRole") === "owner" ? (
                      <div className="space-y-1.5">
                        <div className="text-sm font-medium">Units</div>
                        {selectedOwnerUnitIds.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1">
                            {selectedOwnerUnitIds.map((id) => {
                              const u = units.find((u) => u.id === id);
                              if (!u) return null;
                              return (
                                <span key={id} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
                                  {u.building ? `${u.building}-` : ""}{u.unitNumber}
                                  <button type="button" onClick={() => setSelectedOwnerUnitIds((prev) => prev.filter((x) => x !== id))}>
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                        <div className="rounded-md border max-h-36 overflow-y-auto divide-y">
                          {units.map((unit) => (
                            <label key={unit.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                              <Checkbox
                                checked={selectedOwnerUnitIds.includes(unit.id)}
                                onCheckedChange={(checked) =>
                                  setSelectedOwnerUnitIds((prev) =>
                                    checked ? [...prev, unit.id] : prev.filter((x) => x !== unit.id),
                                  )
                                }
                              />
                              {unit.unitNumber}{unit.building ? ` · ${unit.building}` : ""}
                            </label>
                          ))}
                          {units.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No units available</div>}
                        </div>
                      </div>
                    ) : (
                      <FormField control={form.control} name="unitId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit</FormLabel>
                          <Select value={field.value || "none"} onValueChange={(value) => field.onChange(value === "none" ? "" : value)}>
                            <FormControl>
                              <SelectTrigger data-testid="select-person-unit">
                                <SelectValue placeholder="Select unit" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No unit</SelectItem>
                              {units.map((unit) => (
                                <SelectItem key={unit.id} value={unit.id}>
                                  {unit.unitNumber}{unit.building ? ` · ${unit.building}` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                  </div>
                ) : null}
                <FormField control={form.control} name="mailingAddress" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mailing Address</FormLabel>
                    <div className="space-y-2">
                      <Input
                        value={addressQuery}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setAddressQuery(nextValue);
                          field.onChange(nextValue);
                        }}
                        placeholder="Search real address"
                        data-testid="input-person-address-search"
                      />
                      {addressResults.length > 0 ? (
                        <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
                          {addressResults.map((result, index) => (
                            <button
                              key={`${result.displayName}-${index}`}
                              type="button"
                              className="w-full rounded-md border px-2 py-1 text-left hover:bg-muted"
                              onClick={() => applyAddressResult(result)}
                              data-testid={`button-person-address-result-${index}`}
                            >
                              <p className="text-xs font-medium">{result.displayName}</p>
                              <p className="text-xs text-muted-foreground">{result.address}, {result.city}, {result.state}</p>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-person">
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingId ? "Update" : "Create"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        <Dialog open={boardRoleOpen} onOpenChange={setBoardRoleOpen}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-h-[85vh]">
            <DialogHeader><DialogTitle>Assign Board Role</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Select value={boardRolePersonId || "none"} onValueChange={(value) => setBoardRolePersonId(value === "none" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">select person</SelectItem>
                  {persons?.map((person) => (
                    <SelectItem key={person.id} value={person.id}>{person.firstName} {person.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={boardRoleAssociationId || "none"} onValueChange={(value) => setBoardRoleAssociationId(value === "none" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="Select association" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">select association</SelectItem>
                  {associations.map((association) => (
                    <SelectItem key={association.id} value={association.id}>{association.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={boardRoleName} onValueChange={setBoardRoleName}>
                <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="President">President</SelectItem>
                  <SelectItem value="Vice President">Vice President</SelectItem>
                  <SelectItem value="Treasurer">Treasurer</SelectItem>
                  <SelectItem value="Secretary">Secretary</SelectItem>
                  <SelectItem value="Board Member">Board Member</SelectItem>
                </SelectContent>
              </Select>
              <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                <Input type="date" value={boardRoleStartDate} onChange={(event) => setBoardRoleStartDate(event.target.value)} />
                <Input type="date" value={boardRoleEndDate} onChange={(event) => setBoardRoleEndDate(event.target.value)} />
              </div>
              <Button className={isMobile ? "w-full" : undefined} onClick={() => createBoardRoleMutation.mutate()} disabled={createBoardRoleMutation.isPending}>
                {createBoardRoleMutation.isPending ? "Saving..." : "Assign Role"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Search and role filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Search by name, email, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {roleFilterOptions.map((opt) => (
            <Button
              key={opt.value}
              variant={roleFilter === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter(opt.value)}
              className="h-9"
            >
              {opt.label}
              {opt.count !== undefined ? (
                <span className={`ml-1.5 text-xs ${roleFilter === opt.value ? "opacity-80" : "text-muted-foreground"}`}>
                  {opt.count}
                </span>
              ) : null}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !persons?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium" data-testid="text-empty-state">No people yet</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">People are the owners, tenants, and board members in your community. Click "Add Person" to create the first profile — then link them to units via the Ownership section.</p>
            </div>
          ) : filteredPersons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="h-10 w-10 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No matches</h3>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filter.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[170px]">Roles</TableHead>
                  <TableHead className="w-[190px]">Units</TableHead>
                  <TableHead className="w-[220px]">Contact</TableHead>
                  <TableHead className="w-[170px]">Street Address</TableHead>
                  <TableHead className="w-[96px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPersons.map((p) => {
                  const dir = personDirectoryMap.get(p.id);
                  const activeBoardRoles = boardRolesByPerson.get(p.id) ?? [];
                  const streetAddress = getStreetAddressLine(p.mailingAddress);

                  const ownedUnits = (dir?.ownedUnitIds ?? []).map((id) => unitMap.get(id)).filter(Boolean);
                  const tenantUnits = (dir?.occupiedUnitIds ?? [])
                    .filter((id) => !dir?.ownedUnitIds.includes(id))
                    .map((id) => unitMap.get(id))
                    .filter(Boolean);

                  const allUnits = [...ownedUnits, ...tenantUnits];

                  return (
                    <TableRow key={p.id} data-testid={`row-person-${p.id}`}>
                      <TableCell className="font-medium">
                        <CopyableCell
                          label="Name"
                          value={`${p.firstName} ${p.lastName}`}
                          fallback=""
                          onCopy={copyFieldValue}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-1">
                          {dir?.isOwnerOccupant ? (
                            <Badge variant="default" className="text-xs">Owner-Occupant</Badge>
                          ) : (
                            <>
                              {dir?.isOwner ? <Badge variant="default" className="text-xs">Owner</Badge> : null}
                              {dir?.isTenant ? <Badge variant="secondary" className="text-xs">Tenant</Badge> : null}
                            </>
                          )}
                          {activeBoardRoles.map((br) => (
                            <Badge key={br.id} variant="outline" className="text-xs border-amber-500 text-amber-700 dark:text-amber-400">
                              {br.role}
                            </Badge>
                          ))}
                          {!dir?.isOwner && !dir?.isTenant && activeBoardRoles.length === 0 ? (
                            <span className="text-xs text-muted-foreground">No role</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        {allUnits.length > 0 ? (
                          <div className="space-y-1">
                            {allUnits.slice(0, 3).map((unit, i) => (
                              <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Home className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  {unit!.building ? `${unit!.building} · ` : ""}{unit!.unitNumber}
                                </span>
                              </div>
                            ))}
                            {allUnits.length > 3 ? (
                              <span className="text-xs text-muted-foreground">+{allUnits.length - 3} more</span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          {p.email ? (
                            <CopyableItem
                              icon={<Mail className="h-3 w-3 shrink-0" />}
                              value={p.email}
                              label="Email"
                              onCopy={copyFieldValue}
                            />
                          ) : null}
                          {p.phone ? (
                            <CopyableItem
                              icon={<Phone className="h-3 w-3 shrink-0" />}
                              value={p.phone}
                              label="Phone"
                              onCopy={copyFieldValue}
                            />
                          ) : null}
                          {!p.email && !p.phone ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[170px] align-top">
                        <CopyableItem
                          icon={<MapPin className="h-3 w-3 mt-0.5 shrink-0" />}
                          value={p.mailingAddress ?? ""}
                          displayValue={streetAddress}
                          label="Mailing address"
                          onCopy={copyFieldValue}
                          textClassName="text-xs leading-snug"
                          emptyFallback="—"
                        />
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <div className="flex justify-end gap-2">
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEdit(p)}
                                  data-testid={`button-edit-person-${p.id}`}
                                  aria-label={`Edit ${p.firstName} ${p.lastName}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit person</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openBoardRoleAssignment(p)}
                                  aria-label={`Assign board role for ${p.firstName} ${p.lastName}`}
                                >
                                  <Shield className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Assign board role</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import People from CSV"
        description="Upload a CSV file to bulk-create people. Each row creates a new person record. Existing people are not deduplicated automatically — review before importing."
        columns={[
          { key: "firstName", label: "First Name", required: true },
          { key: "lastName", label: "Last Name", required: true },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "mailingAddress", label: "Mailing Address" },
        ]}
        sampleRows={[
          ["Jane", "Smith", "jane@example.com", "555-0101", "123 Oak St"],
          ["Bob", "Jones", "bob@example.com", "", ""],
        ]}
        onImport={handlePersonsImport}
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
      className={`min-w-0 w-full rounded-md px-0 py-0 text-left ${hasValue ? "cursor-copy" : "cursor-default"}`}
      onClick={() => {
        if (!hasValue) return;
        void onCopy(value, label);
      }}
      data-testid={`field-copy-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="truncate text-sm font-medium">{hasValue ? value : fallback}</div>
    </button>
  );
}

function CopyableItem({
  icon,
  value,
  displayValue,
  label,
  onCopy,
  textClassName = "text-sm",
  emptyFallback,
}: {
  icon: React.ReactNode;
  value: string;
  displayValue?: string;
  label: string;
  onCopy: (value: string, label: string) => Promise<void>;
  textClassName?: string;
  emptyFallback?: string;
}) {
  const hasValue = Boolean(value.trim());
  const renderedValue = displayValue?.trim() || value.trim();
  if (!hasValue && !emptyFallback) return null;
  if (!hasValue && emptyFallback) {
    return <span className="text-muted-foreground text-xs">{emptyFallback}</span>;
  }
  return (
    <button
      type="button"
      className="flex items-center gap-1 text-muted-foreground cursor-copy w-full text-left"
      onClick={() => void onCopy(value, label)}
      data-testid={`field-copy-${label.toLowerCase().replace(/\s+/g, "-")}`}
      title={renderedValue !== value.trim() ? value.trim() : undefined}
    >
      {icon}
      <span className={textClassName}>{renderedValue}</span>
    </button>
  );
}
