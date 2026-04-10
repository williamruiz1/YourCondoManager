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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
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
import { useIsMobile } from "@/hooks/use-mobile";

const formSchema = z.object({
  unitId: z.string().min(1, "Unit is required"),
  personId: z.string().min(1, "Person is required"),
  occupancyType: z.enum(["OWNER_OCCUPIED", "TENANT"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
});

const EMPTY_INTAKE_FORM = {
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
};

export default function OccupancyPage() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [intakeForm, setIntakeForm] = useState(EMPTY_INTAKE_FORM);

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
      setIntakeForm(EMPTY_INTAKE_FORM);
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
  const selectedIntakeUnit = units.find((unit) => unit.id === intakeForm.unitId);
  const activeOccupancies = occupancies.filter((occupancy) => !occupancy.endDate);
  const tenantOccupancies = activeOccupancies.filter((occupancy) => occupancy.occupancyType === "TENANT").length;
  const ownerOccupancies = activeOccupancies.filter((occupancy) => occupancy.occupancyType === "OWNER_OCCUPIED").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border bg-card p-5 md:flex-row md:items-start md:justify-between">
        <div className="space-y-4">
          <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface" data-testid="text-page-title">Occupancy</h1>
            <p className="text-sm text-on-surface/60 mt-1">Track occupancy for {activeAssociationName || "the current association"} and require tenant details for renter-occupied units.</p>
          </div>
          <div className="grid grid-cols-3 gap-3 md:max-w-xl">
            <div className="rounded-2xl border bg-muted/20 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Current</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">{activeOccupancies.length}</div>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tenants</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">{tenantOccupancies}</div>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Owners</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">{ownerOccupancies}</div>
            </div>
          </div>
        </div>
        <div className={`flex gap-2 ${isMobile ? "flex-col" : "flex-row"}`}>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) form.reset(); }}>
            <DialogTrigger asChild>
              <Button className={isMobile ? "w-full" : undefined} data-testid="button-add-occupancy"><Plus className="h-4 w-4 mr-2" />Add Occupancy</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-h-[85vh]">
              <DialogHeader>
                <DialogTitle>Record Occupancy</DialogTitle>
                <DialogDescription>
                  Choose the unit, resident, and live occupancy window. The mobile layout keeps the full flow in a single reading column.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-4 rounded-2xl border bg-muted/10 p-4">
                    <div>
                      <div className="text-sm font-semibold">Placement</div>
                      <p className="mt-1 text-xs text-muted-foreground">Tie the occupancy record to the right unit and resident before setting dates.</p>
                    </div>
                    <FormField control={form.control} name="unitId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger data-testid="select-occupancy-unit"><SelectValue placeholder="Select unit" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.unitNumber}</SelectItem>)}
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
                  </div>
                  <div className="space-y-4 rounded-2xl border bg-muted/10 p-4">
                    <div>
                      <div className="text-sm font-semibold">Dates</div>
                      <p className="mt-1 text-xs text-muted-foreground">Use an end date only when the occupancy should already be closed.</p>
                    </div>
                    <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
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
                  </div>
                  <DialogFooter className={`gap-2 ${isMobile ? "flex-col" : "sm:flex-row"}`}>
                    <Button type="button" variant="outline" className={isMobile ? "w-full" : undefined} onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className={isMobile ? "w-full" : undefined} disabled={createMutation.isPending} data-testid="button-submit-occupancy">
                      {createMutation.isPending ? "Saving..." : "Record Occupancy"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Dialog
            open={intakeOpen}
            onOpenChange={(nextOpen) => {
              setIntakeOpen(nextOpen);
              if (!nextOpen) {
                setIntakeForm(EMPTY_INTAKE_FORM);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className={isMobile ? "w-full" : undefined} variant="outline">Onboarding Intake</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto sm:max-h-[85vh]">
              <DialogHeader>
                <DialogTitle>Owner/Tenant Onboarding Intake</DialogTitle>
                <DialogDescription>
                  Capture the incoming resident details in a mobile-safe sequence without losing the unit or occupancy context.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-xl border bg-muted/30 px-3 py-3 text-sm">
                  Use this when a unit changes hands or becomes renter occupied. Tenant occupancy should include tenant contact data.
                </div>
                <div className="space-y-4 rounded-2xl border bg-muted/10 p-4">
                  <div>
                    <div className="text-sm font-semibold">Placement</div>
                    <p className="mt-1 text-xs text-muted-foreground">Anchor the intake to the unit first, then set the occupancy shape.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupancy-intake-unit">Unit</Label>
                    <Select value={intakeForm.unitId || "none"} onValueChange={(v) => setIntakeForm((p) => ({ ...p, unitId: v === "none" ? "" : v }))}>
                      <SelectTrigger id="occupancy-intake-unit"><SelectValue placeholder="Select unit" /></SelectTrigger>
                      <SelectContent><SelectItem value="none">select unit</SelectItem>{units.map((u) => <SelectItem key={u.id} value={u.id}>{u.unitNumber} {u.building ? `(${u.building})` : ""}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupancy-intake-type">Occupancy Type</Label>
                    <Select value={intakeForm.occupancyType} onValueChange={(v) => setIntakeForm((p) => ({ ...p, occupancyType: v as "OWNER_OCCUPIED" | "TENANT" }))}>
                      <SelectTrigger id="occupancy-intake-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TENANT">Tenant</SelectItem>
                        <SelectItem value="OWNER_OCCUPIED">Owner Occupied</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupancy-intake-start">Start Date</Label>
                    <Input id="occupancy-intake-start" type="date" value={intakeForm.startDate} onChange={(e) => setIntakeForm((p) => ({ ...p, startDate: e.target.value }))} />
                  </div>
                  {selectedIntakeUnit ? (
                    <div className="rounded-xl border bg-background px-3 py-3 text-sm">
                      <div className="font-medium">{selectedIntakeUnit.unitNumber}{selectedIntakeUnit.building ? ` · ${selectedIntakeUnit.building}` : ""}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Current ownership records on this unit: {ownershipByUnit.get(intakeForm.unitId) ?? 0}
                      </div>
                    </div>
                  ) : null}
                  {intakeForm.occupancyType === "OWNER_OCCUPIED" ? (
                    <div className="space-y-2">
                      <Label htmlFor="occupancy-intake-ownership">Ownership Percentage</Label>
                      <Input id="occupancy-intake-ownership" type="number" placeholder="Ownership %" value={intakeForm.ownershipPercentage} onChange={(e) => setIntakeForm((p) => ({ ...p, ownershipPercentage: e.target.value }))} />
                    </div>
                  ) : null}
                </div>
                <div className="space-y-4 rounded-2xl border bg-muted/10 p-4">
                  <div>
                    <div className="text-sm font-semibold">Resident Profile</div>
                    <p className="mt-1 text-xs text-muted-foreground">Collect the resident record in a clean, labeled single-column flow on mobile.</p>
                  </div>
                  <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
                    <div className="space-y-2">
                      <Label htmlFor="occupancy-intake-first-name">First Name</Label>
                      <Input id="occupancy-intake-first-name" placeholder="First name" value={intakeForm.firstName} onChange={(e) => setIntakeForm((p) => ({ ...p, firstName: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="occupancy-intake-last-name">Last Name</Label>
                      <Input id="occupancy-intake-last-name" placeholder="Last name" value={intakeForm.lastName} onChange={(e) => setIntakeForm((p) => ({ ...p, lastName: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupancy-intake-email">Email</Label>
                    <Input id="occupancy-intake-email" placeholder="Email" value={intakeForm.email} onChange={(e) => setIntakeForm((p) => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupancy-intake-phone">Phone</Label>
                    <Input id="occupancy-intake-phone" placeholder="Phone" value={intakeForm.phone} onChange={(e) => setIntakeForm((p) => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupancy-intake-mailing-address">Mailing Address</Label>
                    <Input id="occupancy-intake-mailing-address" placeholder="Mailing address" value={intakeForm.mailingAddress} onChange={(e) => setIntakeForm((p) => ({ ...p, mailingAddress: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-4 rounded-2xl border bg-muted/10 p-4">
                  <div>
                    <div className="text-sm font-semibold">Follow-Up</div>
                    <p className="mt-1 text-xs text-muted-foreground">Capture the emergency contact and preferred outreach path before submitting.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupancy-intake-emergency-name">Emergency Contact Name</Label>
                    <Input id="occupancy-intake-emergency-name" placeholder="Emergency contact name" value={intakeForm.emergencyContactName} onChange={(e) => setIntakeForm((p) => ({ ...p, emergencyContactName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupancy-intake-emergency-phone">Emergency Contact Phone</Label>
                    <Input id="occupancy-intake-emergency-phone" placeholder="Emergency contact phone" value={intakeForm.emergencyContactPhone} onChange={(e) => setIntakeForm((p) => ({ ...p, emergencyContactPhone: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupancy-intake-contact-preference">Contact Preference</Label>
                    <Input id="occupancy-intake-contact-preference" placeholder="Contact preference (email/phone/sms)" value={intakeForm.contactPreference} onChange={(e) => setIntakeForm((p) => ({ ...p, contactPreference: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter className={`gap-2 ${isMobile ? "flex-col" : "sm:flex-row"}`}>
                  <Button type="button" variant="outline" className={isMobile ? "w-full" : undefined} onClick={() => setIntakeOpen(false)}>
                    Cancel
                  </Button>
                  <Button className={isMobile ? "w-full" : undefined} onClick={() => intakeMutation.mutate()} disabled={intakeMutation.isPending}>
                    {intakeMutation.isPending ? "Submitting..." : "Submit Intake"}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </div>
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
                        <TableCell>{getUnitLabel(o.unitId)}</TableCell>
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
                        <div className="mt-1 text-xs text-muted-foreground">{getUnitLabel(o.unitId)}</div>
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
