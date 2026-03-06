import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Occupancy, Person, Unit } from "@shared/schema";
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

const formSchema = z.object({
  unitId: z.string().min(1, "Unit is required"),
  personId: z.string().min(1, "Person is required"),
  occupancyType: z.enum(["OWNER_OCCUPIED", "TENANT"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
});

export default function OccupancyPage() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: occupancies, isLoading } = useQuery<Occupancy[]>({ queryKey: ["/api/occupancies"] });
  const { data: persons } = useQuery<Person[]>({ queryKey: ["/api/persons"] });
  const { data: units } = useQuery<Unit[]>({ queryKey: ["/api/units"] });

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
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Occupancy recorded successfully" });
      setOpen(false);
      form.reset();
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createMutation.mutate(values);
  }

  const getPersonName = (id: string) => {
    const p = persons?.find((p) => p.id === id);
    return p ? `${p.firstName} ${p.lastName}` : "Unknown";
  };
  const getUnitLabel = (id: string) => units?.find((u) => u.id === id)?.unitNumber ?? "Unknown";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Occupancy</h1>
          <p className="text-muted-foreground">Track unit occupancy by owners and tenants.</p>
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
                        {units?.map((u) => <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber}</SelectItem>)}
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
                        {persons?.map((p) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}
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
                <div className="grid grid-cols-2 gap-4">
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
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !occupancies?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Home className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium" data-testid="text-empty-state">No occupancy records</h3>
              <p className="text-sm text-muted-foreground mt-1">Track who occupies each unit.</p>
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
