import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { BoardRole, Person, Association } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, UserCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useActiveAssociation } from "@/hooks/use-active-association";

const boardRoleOptions = ["President", "Vice President", "Treasurer", "Secretary", "Board Member"];

const formSchema = z.object({
  personId: z.string().min(1, "Person is required"),
  associationId: z.string().min(1, "Association is required"),
  role: z.string().min(1, "Role is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  inviteToWorkspace: z.boolean().default(false),
  inviteEmail: z.string().optional(),
});

export default function BoardPage() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();

  const { data: boardRoles, isLoading } = useQuery<BoardRole[]>({ queryKey: ["/api/board-roles"] });
  const { data: persons } = useQuery<Person[]>({ queryKey: ["/api/persons"] });
  const { data: associations } = useQuery<Association[]>({ queryKey: ["/api/associations"] });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { personId: "", associationId: "", role: "", startDate: "", endDate: "", inviteToWorkspace: false, inviteEmail: "" },
  });

  useEffect(() => {
    form.setValue("associationId", activeAssociationId, { shouldValidate: true });
  }, [activeAssociationId, form]);

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const payload = {
        ...data,
        startDate: new Date(data.startDate).toISOString(),
        endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
      };
      const createResponse = await apiRequest("POST", "/api/board-roles", payload);
      const createdRole = await createResponse.json();
      if (data.inviteToWorkspace) {
        const inviteResponse = await apiRequest("POST", `/api/board-roles/${createdRole.id}/invite-access`, {
          email: data.inviteEmail || undefined,
        });
        await inviteResponse.json();
      }
      return createdRole;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/board-roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portal/access"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Board role assigned successfully" });
      setOpen(false);
      form.reset({ personId: "", associationId: activeAssociationId, role: "", startDate: "", endDate: "", inviteToWorkspace: false, inviteEmail: "" });
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
  const getAssocName = (id: string) => associations?.find((a) => a.id === id)?.name ?? "Unknown";

  const getRoleBadgeVariant = (role: string) => {
    if (role === "President") return "default" as const;
    return "secondary" as const;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Board Members</h1>
          <p className="text-muted-foreground">Manage board positions for the current association context.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) form.reset(); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-board-role" disabled={!activeAssociationId}><Plus className="h-4 w-4 mr-2" />Assign Role</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Assign Board Role</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  Association Context: <span className="font-medium">{activeAssociationName || "None selected"}</span>
                </div>
                <FormField control={form.control} name="personId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Person</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-board-person"><SelectValue placeholder="Select person" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {persons?.map((p) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-board-role"><SelectValue placeholder="Select role" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {boardRoleOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="startDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl><Input data-testid="input-board-start" type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="endDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl><Input data-testid="input-board-end" type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="inviteToWorkspace" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                    <div className="space-y-1">
                      <FormLabel>Invite to board workspace</FormLabel>
                      <div className="text-xs text-muted-foreground">Creates or updates association-scoped portal access for this board member.</div>
                    </div>
                    <FormControl><Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(Boolean(checked))} /></FormControl>
                  </FormItem>
                )} />
                {form.watch("inviteToWorkspace") ? (
                  <FormField control={form.control} name="inviteEmail" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invite Email</FormLabel>
                      <FormControl><Input data-testid="input-board-invite-email" type="email" placeholder="Uses person's email if blank" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                ) : null}
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-board-role">
                  {createMutation.isPending ? "Saving..." : "Assign Role"}
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
          ) : !boardRoles?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <UserCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium" data-testid="text-empty-state">No board members yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Assign board roles to people.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Association</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boardRoles.map((br) => (
                  <TableRow key={br.id} data-testid={`row-board-${br.id}`}>
                    <TableCell className="font-medium">{getPersonName(br.personId)}</TableCell>
                    <TableCell className="text-muted-foreground">{getAssocName(br.associationId)}</TableCell>
                    <TableCell><Badge variant={getRoleBadgeVariant(br.role)}>{br.role}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{new Date(br.startDate).toLocaleDateString()}</TableCell>
                    <TableCell>{br.endDate ? <Badge variant="outline">Past</Badge> : <Badge variant="default">Active</Badge>}</TableCell>
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
