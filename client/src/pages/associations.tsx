import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Association } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Building2, MapPin, Search, Archive, ArchiveRestore } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAssociationContext } from "@/context/association-context";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  associationType: z.string().optional(),
  dateFormed: z.string().optional(),
  ein: z.string().trim().regex(/^\d{2}-\d{7}$/, "Use EIN format XX-XXXXXXX").optional().or(z.literal("")),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  country: z.string().min(1, "Country is required"),
});

type AssociationSearchResult = {
  source: "openstreetmap";
  displayName: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
};

function isAssociationArchived(association: Association): boolean {
  return Number((association as Association & { isArchived?: unknown }).isArchived ?? 0) === 1;
}

export default function AssociationsPage() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchivedSection, setShowArchivedSection] = useState(false);
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryResults, setDirectoryResults] = useState<AssociationSearchResult[]>([]);
  const { toast } = useToast();
  const { activeAssociationId, setActiveAssociationId } = useAssociationContext();

  const { data: associations, isLoading } = useQuery<Association[]>({
    queryKey: ["/api/associations?includeArchived=1"],
  });
  const { data: selectedOverview } = useQuery<{
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
  }>({
    queryKey: [activeAssociationId ? `/api/associations/${activeAssociationId}/overview` : "/api/associations/none/overview"],
    enabled: Boolean(activeAssociationId),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", associationType: "", dateFormed: "", ein: "", address: "", city: "", state: "", country: "USA" },
  });

  function invalidateAssociationQueries() {
    queryClient.invalidateQueries({
      predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/associations"),
    });
  }

  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) =>
      apiRequest("POST", "/api/associations", data),
    onSuccess: () => {
      invalidateAssociationQueries();
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Association created successfully" });
      setOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema> & { id: string }) =>
      apiRequest("PATCH", `/api/associations/${data.id}`, data),
    onSuccess: () => {
      invalidateAssociationQueries();
      toast({ title: "Association updated successfully" });
      setOpen(false);
      setEditingId(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (data: { id: string; isArchived: number }) =>
      apiRequest("POST", `/api/associations/${data.id}/${data.isArchived === 1 ? "archive" : "restore"}`),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/associations"),
      });

      const previousAll = queryClient.getQueryData<Association[] | undefined>(["/api/associations?includeArchived=1"]);
      const previousActive = queryClient.getQueryData<Association[] | undefined>(["/api/associations"]);

      queryClient.setQueryData<Association[] | undefined>(["/api/associations?includeArchived=1"], (current) => {
        if (!current) return current;
        return current.map((association) => {
          if (association.id !== variables.id) return association;
          return {
            ...association,
            isArchived: variables.isArchived,
            archivedAt: variables.isArchived === 1 ? new Date() : null,
          };
        });
      });

      queryClient.setQueryData<Association[] | undefined>(["/api/associations"], (current) => {
        if (!current) return current;
        return current
          .map((association) => {
            if (association.id !== variables.id) return association;
            return {
              ...association,
              isArchived: variables.isArchived,
              archivedAt: variables.isArchived === 1 ? new Date() : null,
            };
          })
          .filter((association) => !isAssociationArchived(association));
      });

      return { previousAll, previousActive };
    },
    onSuccess: (_result, variables) => {
      const actionLabel = variables.isArchived ? "archived" : "restored";
      toast({ title: `Association ${actionLabel}` });
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousAll) {
        queryClient.setQueryData(["/api/associations?includeArchived=1"], context.previousAll);
      }
      if (context?.previousActive) {
        queryClient.setQueryData(["/api/associations"], context.previousActive);
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      invalidateAssociationQueries();
    },
  });

  const directorySearchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest("GET", `/api/associations/search?query=${encodeURIComponent(query)}`);
      const payload = await response.json() as { results?: AssociationSearchResult[] };
      return payload.results ?? [];
    },
    onSuccess: (results) => setDirectoryResults(results),
    onError: (error: Error) => {
      toast({ title: "Search failed", description: error.message, variant: "destructive" });
      setDirectoryResults([]);
    },
  });

  function openEdit(a: Association) {
    setEditingId(a.id);
    form.reset({
      name: a.name,
      associationType: a.associationType ?? "",
      dateFormed: a.dateFormed ?? "",
      ein: a.ein ?? "",
      address: a.address,
      city: a.city,
      state: a.state,
      country: a.country,
    });
    setDirectoryResults([]);
    setOpen(true);
  }

  function onSubmit(values: z.infer<typeof formSchema>) {
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
      setDirectoryQuery("");
      setDirectoryResults([]);
      form.reset({ name: "", associationType: "", dateFormed: "", ein: "", address: "", city: "", state: "", country: "USA" });
    }
  }

  function runDirectorySearch() {
    const trimmed = directoryQuery.trim();
    if (trimmed.length < 3) {
      toast({ title: "Enter at least 3 characters to search" });
      return;
    }
    directorySearchMutation.mutate(trimmed);
  }

  function applyDirectoryResult(result: AssociationSearchResult) {
    form.reset({
      name: result.name,
      address: result.address,
      city: result.city,
      state: result.state,
      country: result.country,
    });
    toast({ title: "Association details autofilled from directory result" });
  }

  const activeAssociations = (associations ?? []).filter((association) => !isAssociationArchived(association));
  const archivedAssociations = (associations ?? []).filter((association) => isAssociationArchived(association));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Associations</h1>
          <p className="text-muted-foreground">Manage condo associations and complexes.</p>
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-association">
              <Plus className="h-4 w-4 mr-2" />
              Add Association
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Association" : "New Association"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {!editingId ? (
                  <div className="space-y-2 rounded-md border p-3">
                    <p className="text-xs font-medium text-muted-foreground">Find condo complex online and autofill</p>
                    <div className="flex gap-2">
                      <Input
                        value={directoryQuery}
                        onChange={(event) => setDirectoryQuery(event.target.value)}
                        placeholder="Search condo name, city, or address"
                        data-testid="input-association-directory-search"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={runDirectorySearch}
                        disabled={directorySearchMutation.isPending}
                        data-testid="button-search-association-directory"
                      >
                        <Search className="h-4 w-4 mr-1" />
                        {directorySearchMutation.isPending ? "Searching..." : "Find"}
                      </Button>
                    </div>
                    {directoryResults.length > 0 ? (
                      <div className="max-h-40 space-y-2 overflow-y-auto">
                        {directoryResults.map((result, index) => (
                          <button
                            key={`${result.displayName}-${index}`}
                            type="button"
                            onClick={() => applyDirectoryResult(result)}
                            className="w-full rounded-md border px-2 py-1 text-left hover:bg-muted"
                            data-testid={`button-directory-result-${index}`}
                          >
                            <p className="text-sm font-medium">{result.name}</p>
                            <p className="text-xs text-muted-foreground">{result.displayName}</p>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl><Input data-testid="input-association-name" placeholder="Sunset Towers" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="rounded-md border p-3 space-y-4">
                  <div className="text-sm font-medium">Association Information</div>
                  <FormField control={form.control} name="associationType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type of Association</FormLabel>
                      <FormControl><Input placeholder="Condominium Management Association" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="dateFormed" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date Association Formed</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="rounded-md border p-3 space-y-4">
                  <div className="text-sm font-medium">Tax Identification</div>
                  <FormField control={form.control} name="ein" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employer Identification Number (EIN)</FormLabel>
                      <FormControl><Input placeholder="06-1513429" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl><Input data-testid="input-association-address" placeholder="123 Main St" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl><Input data-testid="input-association-city" placeholder="Miami" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="state" render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl><Input data-testid="input-association-state" placeholder="FL" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="country" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl><Input data-testid="input-association-country" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-association">
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingId ? "Update" : "Create"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {selectedOverview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Association Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-md border bg-muted/20 p-3"><div className="text-muted-foreground">Association Footprint</div><div className="font-semibold">{selectedOverview.units} units</div></div>
              <div className="rounded-md border bg-muted/20 p-3"><div className="text-muted-foreground">Resident Coverage</div><div className="font-semibold">{selectedOverview.activeOwners + selectedOverview.activeOccupants} residents</div></div>
              <div className="rounded-md border bg-muted/20 p-3"><div className="text-muted-foreground">Contact Readiness</div><div className="font-semibold">{selectedOverview.contactCoveragePercent}%</div></div>
              <div className="rounded-md border bg-muted/20 p-3"><div className="text-muted-foreground">Onboarding Progress</div><div className="font-semibold">{selectedOverview.onboardingScorePercent}%</div></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-md border bg-muted/20 p-3"><div className="text-muted-foreground">Maintenance Open</div><div className="font-semibold">{selectedOverview.maintenanceOpen}</div></div>
              <div className="rounded-md border bg-muted/20 p-3"><div className="text-muted-foreground">Maintenance Overdue</div><div className="font-semibold">{selectedOverview.maintenanceOverdue}</div></div>
              <div className="rounded-md border bg-muted/20 p-3"><div className="text-muted-foreground">Payment Methods Ready</div><div className="font-semibold">{selectedOverview.paymentMethodsActive}</div></div>
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="text-muted-foreground">Onboarding State</div>
                <Badge variant={selectedOverview.onboardingState === "complete" ? "default" : selectedOverview.onboardingState === "blocked" ? "destructive" : "secondary"}>
                  {selectedOverview.onboardingState}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Associations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !activeAssociations.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium" data-testid="text-empty-state">No active associations</h3>
              <p className="text-sm text-muted-foreground mt-1">Create a new association to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeAssociations.map((a) => (
                  <TableRow key={a.id} data-testid={`row-association-${a.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{a.name}</div>
                          {a.associationType ? <div className="text-xs text-muted-foreground">{a.associationType}</div> : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="text-sm">{a.address}, {a.city}, {a.state}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{a.country}</Badge>
                        {a.ein ? <Badge variant="outline">EIN {a.ein}</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant={a.id === activeAssociationId ? "default" : "outline"}
                          onClick={() => setActiveAssociationId(a.id)}
                          data-testid={`button-set-association-context-${a.id}`}
                        >
                          {a.id === activeAssociationId ? "In Context" : "Use Context"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => archiveMutation.mutate({ id: a.id, isArchived: 1 })}
                          disabled={archiveMutation.isPending}
                          data-testid={`button-archive-association-${a.id}`}
                        >
                          <Archive className="h-4 w-4 mr-1" />
                          Archive
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEdit(a)} data-testid={`button-edit-association-${a.id}`}>
                          Edit
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Archived Associations</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowArchivedSection((current) => !current)}
            data-testid="button-toggle-archived-association-section"
          >
            {showArchivedSection ? "Hide Archived" : `Show Archived (${archivedAssociations.length})`}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {!showArchivedSection ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Archived associations keep all HOA history and are hidden from normal workflows.
            </div>
          ) : !archivedAssociations.length ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              No archived associations.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archivedAssociations.map((a) => (
                  <TableRow key={a.id} data-testid={`row-archived-association-${a.id}`}>
                    <TableCell>
                      <div className="font-medium">{a.name}</div>
                      {a.associationType ? <div className="text-xs text-muted-foreground">{a.associationType}</div> : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{a.address}, {a.city}, {a.state}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{a.country}</Badge>
                        {a.ein ? <Badge variant="outline">EIN {a.ein}</Badge> : null}
                        <Badge variant="outline">Archived</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => archiveMutation.mutate({ id: a.id, isArchived: 0 })}
                        disabled={archiveMutation.isPending}
                        data-testid={`button-restore-association-${a.id}`}
                      >
                        <ArchiveRestore className="h-4 w-4 mr-1" />
                        Restore
                      </Button>
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
