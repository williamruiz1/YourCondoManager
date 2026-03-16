import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Person, Unit } from "@shared/schema";
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
import { Plus, Users, Mail, Phone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Association } from "@shared/schema";
import { useActiveAssociation } from "@/hooks/use-active-association";

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

export default function PersonsPage() {
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState<AddressSearchResult[]>([]);
  const [boardRoleOpen, setBoardRoleOpen] = useState(false);
  const [boardRolePersonId, setBoardRolePersonId] = useState<string>("");
  const [boardRoleAssociationId, setBoardRoleAssociationId] = useState<string>("");
  const [boardRoleName, setBoardRoleName] = useState<string>("Board Member");
  const [boardRoleStartDate, setBoardRoleStartDate] = useState<string>("");
  const [boardRoleEndDate, setBoardRoleEndDate] = useState<string>("");
  const { activeAssociationId } = useActiveAssociation();
  const { toast } = useToast();

  const { data: persons, isLoading } = useQuery<Person[]>({ queryKey: ["/api/persons"] });
  const { data: associations = [] } = useQuery<Association[]>({ queryKey: ["/api/associations"] });
  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: [activeAssociationId ? `/api/units?associationId=${activeAssociationId}` : "/api/units"],
  });

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
        phone: data.phone || null,
        mailingAddress: data.mailingAddress || null,
      };
      const personResponse = await apiRequest("POST", "/api/persons", payload);
      const person = await personResponse.json() as Person;

      if (data.residentRole !== "none" && data.unitId) {
        const startDate = new Date().toISOString();
        if (data.residentRole === "owner") {
          await apiRequest("POST", "/api/ownerships", {
            unitId: data.unitId,
            personId: person.id,
            ownershipPercentage: 100,
            startDate,
          });
        } else {
          await apiRequest("POST", "/api/occupancies", {
            unitId: data.unitId,
            personId: person.id,
            occupancyType: "TENANT",
            startDate,
          });
        }
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
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema> & { id: string }) => {
      const payload = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        phone: data.phone || null,
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
      phone: p.phone ?? "",
      residentRole: "none",
      unitId: "",
      mailingAddress: p.mailingAddress ?? "",
    });
    setAddressQuery(p.mailingAddress ?? "");
    setAddressResults([]);
    setOpen(true);
  }

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!editingId && values.residentRole !== "none" && !values.unitId) {
      toast({ title: "Select a unit for owner/tenant role", variant: "destructive" });
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

  function openBoardRoleAssignment(personId: string) {
    setBoardRolePersonId(personId);
    setBoardRoleAssociationId(associations[0]?.id || "");
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">People</h1>
          <p className="text-muted-foreground">Manage all persons in the system - owners, tenants, and contacts.</p>
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-person"><Plus className="h-4 w-4 mr-2" />Add Person</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Edit Person" : "New Person"}</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                    <FormControl><Input data-testid="input-person-phone" placeholder="(555) 123-4567" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                {!editingId ? (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="residentRole" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
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
                                Unit {unit.unitNumber}{unit.building ? ` · ${unit.building}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
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
          <DialogContent>
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
              <div className="grid grid-cols-2 gap-3">
                <Input type="date" value={boardRoleStartDate} onChange={(event) => setBoardRoleStartDate(event.target.value)} />
                <Input type="date" value={boardRoleEndDate} onChange={(event) => setBoardRoleEndDate(event.target.value)} />
              </div>
              <Button onClick={() => createBoardRoleMutation.mutate()} disabled={createBoardRoleMutation.isPending}>
                {createBoardRoleMutation.isPending ? "Saving..." : "Assign Role"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !persons?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium" data-testid="text-empty-state">No people yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Add people to assign them as owners, tenants, or board members.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {persons.map((p) => (
                  <TableRow key={p.id} data-testid={`row-person-${p.id}`}>
                    <TableCell className="font-medium">{p.firstName} {p.lastName}</TableCell>
                    <TableCell>
                      {p.email ? (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Mail className="h-3 w-3" /><span className="text-sm">{p.email}</span>
                        </div>
                      ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {p.phone ? (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" /><span className="text-sm">{p.phone}</span>
                        </div>
                      ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(p)} data-testid={`button-edit-person-${p.id}`}>Edit</Button>
                        <Button variant="outline" size="sm" onClick={() => openBoardRoleAssignment(p.id)}>
                          Assign Board Role
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
    </div>
  );
}
