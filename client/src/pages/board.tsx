// zone: Governance
// persona: Manager, Board Officer, Assisted Board, PM Assistant
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
import { Plus, UserCheck, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { useIsMobile } from "@/hooks/use-mobile";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { boardGovernanceSubPages } from "@/lib/sub-page-nav";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { t } from "@/i18n/use-strings";

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
  useDocumentTitle(t("board.title"));
  const isMobile = useIsMobile();
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

  const today = new Date(); today.setHours(0,0,0,0);
  const in90Days = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
  const expiringRoles = (boardRoles ?? []).filter((br) => {
    if (!br.endDate) return false;
    const end = new Date(br.endDate);
    return end >= today && end <= in90Days;
  });
  const expiredRoles = (boardRoles ?? []).filter((br) => {
    if (!br.endDate) return false;
    return new Date(br.endDate) < today;
  });

  return (
    // Wave 31 a11y: section landmark + aria-labelledby (heading id below).
    <section className="p-6 space-y-6" aria-labelledby="board-heading">
      {expiredRoles.length > 0 && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span><strong>{expiredRoles.length} board role{expiredRoles.length !== 1 ? "s" : ""}</strong> have expired and may indicate a vacancy: {expiredRoles.map((br) => getPersonName(br.personId)).join(", ")}</span>
        </div>
      )}
      {expiringRoles.length > 0 && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span><strong>{expiringRoles.length} board term{expiringRoles.length !== 1 ? "s" : ""}</strong> expiring within 90 days: {expiringRoles.map((br) => `${getPersonName(br.personId)} (${new Date(br.endDate!).toLocaleDateString()})`).join(", ")}</span>
        </div>
      )}
      <WorkspacePageHeader
        title={t("board.title")}
        headingId="board-heading"
        summary={t("board.summary")}
        eyebrow={t("board.eyebrow")}
        breadcrumbs={[{ label: t("board.crumb") }]}
        subPages={boardGovernanceSubPages}
      />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div />
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) form.reset(); }}>
          <DialogTrigger asChild>
            <Button className={isMobile ? "w-full min-h-11" : undefined} data-testid="button-add-board-role" disabled={!activeAssociationId}><Plus className="h-4 w-4 mr-2" aria-hidden="true" />{t("board.action.assignRole")}</Button>
          </DialogTrigger>
          {/* Wave 31 mobile: viewport clamp keeps dialog within 360-px screens. */}
          <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-h-[85vh] sm:max-w-lg">
            <DialogHeader><DialogTitle>{t("board.dialog.title")}</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  {t("board.dialog.contextLabel")} <span className="font-medium">{activeAssociationName || t("board.dialog.contextNone")}</span>
                </div>
                <FormField control={form.control} name="personId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("board.field.person")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-board-person" aria-label={t("board.field.person")}><SelectValue placeholder={t("board.field.personPlaceholder")} /></SelectTrigger></FormControl>
                      <SelectContent>
                        {persons?.map((p) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("board.field.role")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-board-role" aria-label={t("board.field.role")}><SelectValue placeholder={t("board.field.rolePlaceholder")} /></SelectTrigger></FormControl>
                      <SelectContent>
                        {boardRoleOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                {/* Wave 31 mobile: responsive grid (single column on mobile, 2 on sm+). */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="startDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("board.field.startDate")}</FormLabel>
                      <FormControl><Input data-testid="input-board-start" type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="endDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("board.field.endDate")}</FormLabel>
                      <FormControl><Input data-testid="input-board-end" type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="inviteToWorkspace" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                    <div className="space-y-1">
                      <FormLabel>{t("board.field.inviteToWorkspace")}</FormLabel>
                      <div className="text-xs text-muted-foreground">{t("board.field.inviteToWorkspaceHint")}</div>
                    </div>
                    <FormControl><Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(Boolean(checked))} /></FormControl>
                  </FormItem>
                )} />
                {form.watch("inviteToWorkspace") ? (
                  <FormField control={form.control} name="inviteEmail" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("board.field.inviteEmail")}</FormLabel>
                      <FormControl><Input data-testid="input-board-invite-email" type="email" placeholder={t("board.field.inviteEmailPlaceholder")} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                ) : null}
                {/* Wave 31 mobile: responsive button row (stacked on mobile, end-aligned on sm+). */}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="submit" className="w-full sm:w-auto" disabled={createMutation.isPending} data-testid="button-submit-board-role">
                    {createMutation.isPending ? t("common.saving") : t("board.action.assignRole")}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3" role="status" aria-label={t("common.loading")}>{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !boardRoles?.length ? (
            <div role="status" className="flex flex-col items-center justify-center py-16 text-center">
              <UserCheck className="h-12 w-12 text-muted-foreground/50 mb-4" aria-hidden="true" />
              <h3 className="text-lg font-medium" data-testid="text-empty-state">{t("board.empty.title")}</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">{t("board.empty.body")}</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                {/* Wave 31 a11y: aria-label names this board roles table for screen-reader table mode. */}
                <Table aria-label={t("board.tableLabel")}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("board.col.member")}</TableHead>
                      <TableHead>{t("board.col.association")}</TableHead>
                      <TableHead>{t("board.col.role")}</TableHead>
                      <TableHead>{t("board.col.termStart")}</TableHead>
                      <TableHead>{t("board.col.termEnd")}</TableHead>
                      <TableHead>{t("board.col.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {boardRoles.map((br) => {
                      const endDate = br.endDate ? new Date(br.endDate) : null;
                      const isExpired = endDate && endDate < today;
                      const isExpiring = endDate && endDate >= today && endDate <= in90Days;
                      const daysUntilEnd = endDate ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
                      return (
                      <TableRow key={br.id} data-testid={`row-board-${br.id}`} className={isExpired ? "bg-red-50/40" : isExpiring ? "bg-amber-50/40" : ""}>
                        <TableCell className="font-medium">{getPersonName(br.personId)}</TableCell>
                        <TableCell className="text-muted-foreground">{getAssocName(br.associationId)}</TableCell>
                        <TableCell><Badge variant={getRoleBadgeVariant(br.role)}>{br.role}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{new Date(br.startDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {endDate ? (
                            <div className="space-y-0.5">
                              <div className={isExpired ? "text-red-600 font-medium" : isExpiring ? "text-amber-700 font-medium" : "text-muted-foreground"}>
                                {endDate.toLocaleDateString()}
                              </div>
                              {isExpired && <Badge variant="destructive" className="text-xs">Expired</Badge>}
                              {isExpiring && daysUntilEnd !== null && <Badge variant="secondary" className="text-xs text-amber-700 border-amber-300 bg-amber-100">Expires in {daysUntilEnd}d</Badge>}
                            </div>
                          ) : <span className="text-muted-foreground text-sm">No end date</span>}
                        </TableCell>
                        <TableCell>
                          {isExpired ? <Badge variant="destructive">Expired</Badge> : endDate ? <Badge variant="outline">Active</Badge> : <Badge variant="default">Active</Badge>}
                        </TableCell>
                      </TableRow>
                    );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-3 p-4 md:hidden">
                {boardRoles.map((br) => {
                  const endDate = br.endDate ? new Date(br.endDate) : null;
                  const isExpired = endDate && endDate < today;
                  const isExpiring = endDate && endDate >= today && endDate <= in90Days;
                  const daysUntilEnd = endDate ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
                  return (
                    <div key={br.id} data-testid={`row-board-${br.id}`} className={`rounded-xl border p-4 space-y-3 ${isExpired ? "bg-red-50/40" : isExpiring ? "bg-amber-50/40" : ""}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{getPersonName(br.personId)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{getAssocName(br.associationId)}</div>
                        </div>
                        <Badge variant={getRoleBadgeVariant(br.role)}>{br.role}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-muted-foreground">Term start</div>
                          <div className="mt-1">{new Date(br.startDate).toLocaleDateString()}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Term end</div>
                          <div className={`mt-1 ${isExpired ? "text-red-600 font-medium" : isExpiring ? "text-amber-700 font-medium" : ""}`}>
                            {endDate ? endDate.toLocaleDateString() : "No end date"}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {isExpired ? <Badge variant="destructive">Expired</Badge> : endDate ? <Badge variant="outline">Active</Badge> : <Badge variant="default">Active</Badge>}
                        {isExpiring && daysUntilEnd !== null ? (
                          <Badge variant="secondary" className="text-xs text-amber-700 border-amber-300 bg-amber-100">Expires in {daysUntilEnd}d</Badge>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
