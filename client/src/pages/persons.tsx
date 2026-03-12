import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Person } from "@shared/schema";
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

const formSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  mailingAddress: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  contactPreference: z.string().optional(),
});

export default function PersonsPage() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: persons, isLoading } = useQuery<Person[]>({ queryKey: ["/api/persons"] });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { firstName: "", lastName: "", email: "", phone: "", mailingAddress: "", emergencyContactName: "", emergencyContactPhone: "", contactPreference: "email" },
  });

  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) => {
      const payload = {
        ...data,
        email: data.email || null,
        phone: data.phone || null,
        mailingAddress: data.mailingAddress || null,
        emergencyContactName: data.emergencyContactName || null,
        emergencyContactPhone: data.emergencyContactPhone || null,
        contactPreference: data.contactPreference || "email",
      };
      return apiRequest("POST", "/api/persons", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/residential/dataset"] });
      toast({ title: "Person created successfully" });
      setOpen(false);
      form.reset();
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema> & { id: string }) => {
      const payload = {
        ...data,
        email: data.email || null,
        phone: data.phone || null,
        mailingAddress: data.mailingAddress || null,
        emergencyContactName: data.emergencyContactName || null,
        emergencyContactPhone: data.emergencyContactPhone || null,
        contactPreference: data.contactPreference || "email",
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
      mailingAddress: p.mailingAddress ?? "",
      emergencyContactName: p.emergencyContactName ?? "",
      emergencyContactPhone: p.emergencyContactPhone ?? "",
      contactPreference: p.contactPreference ?? "email",
    });
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
    if (!isOpen) { setEditingId(null); form.reset(); }
  }

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
                <FormField control={form.control} name="mailingAddress" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mailing Address</FormLabel>
                    <FormControl><Input data-testid="input-person-address" placeholder="123 Main St, Miami, FL" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="emergencyContactName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Name</FormLabel>
                    <FormControl><Input placeholder="Emergency contact name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="emergencyContactPhone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Phone</FormLabel>
                    <FormControl><Input placeholder="Emergency contact phone" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="contactPreference" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Preference</FormLabel>
                    <FormControl><Input placeholder="email / phone / sms" {...field} /></FormControl>
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
                      <Button variant="outline" size="sm" onClick={() => openEdit(p)} data-testid={`button-edit-person-${p.id}`}>Edit</Button>
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
