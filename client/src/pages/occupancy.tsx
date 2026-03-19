import { useMemo, useState } from "react";
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
import { Plus, Home } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useResidentialDataset } from "@/hooks/use-residential-dataset";
import { useActiveAssociation } from "@/hooks/use-active-association";

const formSchema = z.object({
  unitId: z.string().min(1, "Unit is required"),
  personId: z.string().min(1, "Person is required"),
  occupancyType: z.enum(["OWNER_OCCUPIED", "TENANT"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
});

export default function OccupancyPage() {
  const [open, setOpen] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [intakeForm, setIntakeForm] = useState({
    unitId: "",
    occupancyType: "TENANT" as "OWNER_OCCUPIED" | "TENANT",
    startDate: "",
    ownershipPercentage: "100",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    mailingAddress: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    contactPreference: "email",
  });

  const { data: residentialDataset, isLoading } = useResidentialDataset(activeAssociationId || undefined);
  const occupancies = residentialDataset?.occupancies ?? [];
  const persons = residentialDataset?.persons ?? [];
  const units = residentialDataset?.units ?? [];
  const ownerships = residentialDataset?.ownerships ?? [];
  const ownershipByUnit = useMemo(() => {
    const map = new Map<string, number>();
    for (const ownership of ownerships) {
      map.set(ownership.unitId, (map.get(ownership.unitId) ?? 0) + 1);
    }
    return map;
  }, [ownerships]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { unitId: "", personId: "", occupancyType: "OWNER_OCCUPIED", startDate: "", endDate: "" },
  });

  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) => {
      const payload = {
        ...data,
        startDate: new Date(data.startDate).toISOString(),
        endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
      };
      return apiRequest("POST", "/api/occupancies", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/occupancies"] });
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/residential/dataset"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Occupancy recorded successfully" });
      setOpen(false);
      form.reset();
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const intakeMutation = useMutation({
    mutationFn: async () => {
      const unit = units.find((row) => row.id === intakeForm.unitId);
      if (!unit) throw new Error("Unit is required");
      if (!intakeForm.firstName.trim() || !intakeForm.lastName.trim() || !intakeForm.startDate) {
        throw new Error("Name and start date are required");
      }

      const payload = {
        associationId: unit.associationId,
        unitId: intakeForm.unitId,
        occupancyType: intakeForm.occupancyType,
        startDate: new Date(intakeForm.startDate).toISOString(),
        ownershipPercentage: intakeForm.occupancyType === "OWNER_OCCUPIED" ? Number(intakeForm.ownershipPercentage || "100") : null,
        person: {
          firstName: intakeForm.firstName.trim(),
          lastName: intakeForm.lastName.trim(),
          email: intakeForm.email.trim() || null,
          phone: intakeForm.phone.trim() || null,
          mailingAddress: intakeForm.mailingAddress.trim() || null,
          emergencyContactName: intakeForm.emergencyContactName.trim() || null,
          emergencyContactPhone: intakeForm.emergencyContactPhone.trim() || null,
          contactPreference: intakeForm.contactPreference.trim() || "email",
        },
      };
      return apiRequest("POST", "/api/onboarding/intake", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/occupancies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ownerships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/residential/dataset"),
      });
      toast({ title: "Onboarding intake submitted" });
      setIntakeOpen(false);
      setIntakeForm({
        unitId: "",
        occupancyType: "TENANT",
        startDate: "",
        ownershipPercentage: "100",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        mailingAddress: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        contactPreference: "email",
      });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createMutation.mutate(values);
  }

  const getPersonName = (id: string) => {
    const p = persons.find((p) => p.id === id);
    return p ? `${p.firstName} ${p.lastName}` : "Unknown";
  };
  const getUnitLabel = (id: string) => units.find((u) => u.id === id)?.unitNumber ?? "Unknown";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Occupancy</h1>
          <p className="text-muted-foreground">Track occupancy for {activeAssociationName || "the current association"} and require tenant details for renter-occupied units.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) form.reset(); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-occupancy"><Plus className="h-4 w-4 mr-2" />Add Occupancy</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Occupancy</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="unitId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-occupancy-unit"><SelectValue placeholder="Select unit" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {units.map((u) => <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="personId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Person</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-occupancy-person"><SelectValue placeholder="Select person" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {persons.map((p) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="occupancyType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Occupancy Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-occupancy-type"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="OWNER_OCCUPIED">Owner Occupied</SelectItem>
                        <SelectItem value="TENANT">Tenant</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="startDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl><Input data-testid="input-occupancy-start" type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="endDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl><Input data-testid="input-occupancy-end" type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-occupancy">
                  {createMutation.isPending ? "Saving..." : "Record Occupancy"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        <Dialog open={intakeOpen} onOpenChange={setIntakeOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">Onboarding Intake</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Owner/Tenant Onboarding Intake</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                Use this when a unit changes hands or becomes renter occupied. Tenant occupancy should include tenant contact data.
              </div>
              <Select value={intakeForm.unitId || "none"} onValueChange={(v) => setIntakeForm((p) => ({ ...p, unitId: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent><SelectItem value="none">select unit</SelectItem>{units.map((u) => <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber} {u.building ? `(${u.building})` : ""}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={intakeForm.occupancyType} onValueChange={(v) => setIntakeForm((p) => ({ ...p, occupancyType: v as "OWNER_OCCUPIED" | "TENANT" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TENANT">Tenant</SelectItem>
                  <SelectItem value="OWNER_OCCUPIED">Owner Occupied</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={intakeForm.startDate} onChange={(e) => setIntakeForm((p) => ({ ...p, startDate: e.target.value }))} />
              {intakeForm.unitId ? (
                <div className="text-xs text-muted-foreground">
                  Current ownership records on this unit: {ownershipByUnit.get(intakeForm.unitId) ?? 0}
                </div>
              ) : null}
              {intakeForm.occupancyType === "OWNER_OCCUPIED" ? (
                <Input type="number" placeholder="Ownership %" value={intakeForm.ownershipPercentage} onChange={(e) => setIntakeForm((p) => ({ ...p, ownershipPercentage: e.target.value }))} />
              ) : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input placeholder="First name" value={intakeForm.firstName} onChange={(e) => setIntakeForm((p) => ({ ...p, firstName: e.target.value }))} />
                <Input placeholder="Last name" value={intakeForm.lastName} onChange={(e) => setIntakeForm((p) => ({ ...p, lastName: e.target.value }))} />
              </div>
              <Input placeholder="Email" value={intakeForm.email} onChange={(e) => setIntakeForm((p) => ({ ...p, email: e.target.value }))} />
              <Input placeholder="Phone" value={intakeForm.phone} onChange={(e) => setIntakeForm((p) => ({ ...p, phone: e.target.value }))} />
              <Input placeholder="Mailing address" value={intakeForm.mailingAddress} onChange={(e) => setIntakeForm((p) => ({ ...p, mailingAddress: e.target.value }))} />
              <Input placeholder="Emergency contact name" value={intakeForm.emergencyContactName} onChange={(e) => setIntakeForm((p) => ({ ...p, emergencyContactName: e.target.value }))} />
              <Input placeholder="Emergency contact phone" value={intakeForm.emergencyContactPhone} onChange={(e) => setIntakeForm((p) => ({ ...p, emergencyContactPhone: e.target.value }))} />
              <Input placeholder="Contact preference (email/phone/sms)" value={intakeForm.contactPreference} onChange={(e) => setIntakeForm((p) => ({ ...p, contactPreference: e.target.value }))} />
              <Button onClick={() => intakeMutation.mutate()} disabled={intakeMutation.isPending}>Submit Intake</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !occupancies.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Home className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium" data-testid="text-empty-state">No occupancy records</h3>
              <p className="text-sm text-muted-foreground mt-1">Track who occupies each unit.</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {occupancies.map((o) => (
                      <TableRow key={o.id} data-testid={`row-occupancy-${o.id}`}>
                        <TableCell className="font-medium">{getPersonName(o.personId)}</TableCell>
                        <TableCell>Unit {getUnitLabel(o.unitId)}</TableCell>
                        <TableCell>
                          <Badge variant={o.occupancyType === "OWNER_OCCUPIED" ? "default" : "secondary"}>
                            {o.occupancyType === "OWNER_OCCUPIED" ? "Owner" : "Tenant"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{new Date(o.startDate).toLocaleDateString()}</TableCell>
                        <TableCell className="text-muted-foreground">{o.endDate ? new Date(o.endDate).toLocaleDateString() : <Badge variant="outline">Current</Badge>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-3 p-4 md:hidden">
                {occupancies.map((o) => (
                  <div key={o.id} data-testid={`row-occupancy-${o.id}`} className="rounded-xl border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{getPersonName(o.personId)}</div>
                        <div className="mt-1 text-xs text-muted-foreground">Unit {getUnitLabel(o.unitId)}</div>
                      </div>
                      <Badge variant={o.occupancyType === "OWNER_OCCUPIED" ? "default" : "secondary"}>
                        {o.occupancyType === "OWNER_OCCUPIED" ? "Owner" : "Tenant"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                      <div>
                        <div>Start</div>
                        <div className="mt-1 text-foreground">{new Date(o.startDate).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <div>End</div>
                        <div className="mt-1 text-foreground">{o.endDate ? new Date(o.endDate).toLocaleDateString() : "Current"}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
