// zone: Operations
// persona: Manager, Board Officer, Assisted Board, PM Assistant
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Association, AssociationInsurancePolicy } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { AssociationScopeBanner } from "@/components/association-scope-banner";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { AlertTriangle, Plus, Shield, Trash2 } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const POLICY_TYPES = [
  { value: "master", label: "Master Policy" },
  { value: "d-and-o", label: "D&O (Directors & Officers)" },
  { value: "fidelity-bond", label: "Fidelity Bond" },
  { value: "umbrella", label: "Umbrella / Excess" },
  { value: "liability", label: "General Liability" },
  { value: "flood", label: "Flood" },
  { value: "earthquake", label: "Earthquake" },
  { value: "other", label: "Other" },
] as const;

const formSchema = z.object({
  policyType: z.enum(["master", "d-and-o", "fidelity-bond", "umbrella", "liability", "flood", "earthquake", "other"]),
  carrier: z.string().min(1, "Carrier is required"),
  policyNumber: z.string().optional(),
  effectiveDate: z.string().optional(),
  expirationDate: z.string().optional(),
  premiumAmount: z.union([z.coerce.number().positive(), z.nan()]).optional(),
  coverageAmount: z.union([z.coerce.number().positive(), z.nan()]).optional(),
  notes: z.string().optional(),
});

function slaStatus(policy: AssociationInsurancePolicy) {
  if (!policy.expirationDate) return null;
  const exp = new Date(policy.expirationDate);
  const now = new Date();
  const daysUntil = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil < 0) return { label: "Expired", variant: "destructive" as const };
  if (daysUntil <= 30) return { label: `Expires in ${daysUntil}d`, variant: "destructive" as const };
  if (daysUntil <= 90) return { label: `Expires in ${daysUntil}d`, variant: "outline" as const };
  return { label: `Exp ${exp.toLocaleDateString()}`, variant: "secondary" as const };
}

export default function InsurancePage() {
  useDocumentTitle("Insurance");
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { activeAssociationId, activeAssociationName } = useActiveAssociation();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: associations = [] } = useQuery<Association[]>({ queryKey: ["/api/associations"] });

  const policiesQuery = useQuery<AssociationInsurancePolicy[]>({
    queryKey: ["/api/associations", activeAssociationId, "insurance"],
    queryFn: async () => {
      if (!activeAssociationId) return [];
      const res = await apiRequest("GET", `/api/associations/${activeAssociationId}/insurance`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      policyType: "master",
      carrier: "",
      policyNumber: "",
      effectiveDate: "",
      expirationDate: "",
      premiumAmount: undefined,
      coverageAmount: undefined,
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      if (!activeAssociationId) throw new Error("Select an association first");
      const payload = {
        ...data,
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate).toISOString() : null,
        expirationDate: data.expirationDate ? new Date(data.expirationDate).toISOString() : null,
        premiumAmount: typeof data.premiumAmount === "number" && !isNaN(data.premiumAmount) ? data.premiumAmount : null,
        coverageAmount: typeof data.coverageAmount === "number" && !isNaN(data.coverageAmount) ? data.coverageAmount : null,
        notes: data.notes || null,
        policyNumber: data.policyNumber || null,
      };
      const url = editingId
        ? `/api/associations/${activeAssociationId}/insurance/${editingId}`
        : `/api/associations/${activeAssociationId}/insurance`;
      const res = await apiRequest(editingId ? "PATCH" : "POST", url, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/associations", activeAssociationId, "insurance"] });
      toast({ title: editingId ? "Policy updated" : "Policy added" });
      setOpen(false);
      setEditingId(null);
      form.reset();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (policyId: string) => {
      await apiRequest("DELETE", `/api/associations/${activeAssociationId}/insurance/${policyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/associations", activeAssociationId, "insurance"] });
      toast({ title: "Policy removed" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function openEdit(policy: AssociationInsurancePolicy) {
    setEditingId(policy.id);
    form.reset({
      policyType: policy.policyType,
      carrier: policy.carrier,
      policyNumber: policy.policyNumber ?? "",
      effectiveDate: policy.effectiveDate ? new Date(policy.effectiveDate).toISOString().split("T")[0] : "",
      expirationDate: policy.expirationDate ? new Date(policy.expirationDate).toISOString().split("T")[0] : "",
      premiumAmount: policy.premiumAmount ?? undefined,
      coverageAmount: policy.coverageAmount ?? undefined,
      notes: policy.notes ?? "",
    });
    setOpen(true);
  }

  const expiringSoon = (policiesQuery.data ?? []).filter((p) => {
    if (!p.expirationDate) return false;
    const exp = new Date(p.expirationDate);
    const daysUntil = (exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntil <= 90;
  });

  return (
    <div className="p-6 space-y-6">
      <WorkspacePageHeader
        title="Insurance Policies"
        summary="Track association-level D&O, fidelity bond, master policy, and other insurance coverage with expiration alerts."
        eyebrow="Compliance"
        breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "Insurance Policies" }]}
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); form.reset(); } }}>
            <DialogTrigger asChild>
              <Button disabled={!activeAssociationId}>
                <Plus className="h-4 w-4 mr-2" />
                Add Policy
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto sm:max-h-[85vh]">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Policy" : "New Insurance Policy"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form className="space-y-4" onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
                  <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                    <FormField control={form.control} name="policyType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Policy Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {POLICY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="carrier" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Carrier</FormLabel>
                        <FormControl><Input placeholder="State Farm, AIG…" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="policyNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Policy Number</FormLabel>
                      <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                    <FormField control={form.control} name="effectiveDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Effective Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="expirationDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiration Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                    <FormField control={form.control} name="premiumAmount" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Annual Premium ($)</FormLabel>
                        <FormControl><Input type="number" step="0.01" placeholder="Optional" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="coverageAmount" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coverage Limit ($)</FormLabel>
                        <FormControl><Input type="number" step="0.01" placeholder="Optional" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl><Textarea placeholder="Broker contact, agent, special conditions…" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button className="w-full" type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Saving…" : editingId ? "Update Policy" : "Add Policy"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      <AssociationScopeBanner
        activeAssociationId={activeAssociationId}
        activeAssociationName={activeAssociationName}
        explanation={
          activeAssociationId
            ? "Showing insurance policies for the active association."
            : "Select an association to view or manage its insurance policies."
        }
      />

      {expiringSoon.length > 0 && (
        <Card className="border-orange-300 bg-orange-50/50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium text-sm">
                {expiringSoon.length} polic{expiringSoon.length === 1 ? "y" : "ies"} expiring within 90 days
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                {expiringSoon.map((p) => POLICY_TYPES.find((t) => t.value === p.policyType)?.label ?? p.policyType).join(", ")}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-2 px-6 pt-5 pb-3">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">Policies</h2>
        </div>
        <CardContent className="p-0">
          {!activeAssociationId ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              Select an association to view insurance policies.
            </div>
          ) : policiesQuery.isLoading ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (policiesQuery.data ?? []).length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No insurance policies recorded yet. Add your first policy above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Policy #</TableHead>
                  <TableHead>Coverage</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(policiesQuery.data ?? []).map((policy) => {
                  const status = slaStatus(policy);
                  const typeLabel = POLICY_TYPES.find((t) => t.value === policy.policyType)?.label ?? policy.policyType;
                  return (
                    <TableRow key={policy.id}>
                      <TableCell className="font-medium">{typeLabel}</TableCell>
                      <TableCell>{policy.carrier}</TableCell>
                      <TableCell className="text-muted-foreground">{policy.policyNumber || "—"}</TableCell>
                      <TableCell>
                        {policy.coverageAmount != null
                          ? `$${policy.coverageAmount.toLocaleString()}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {status ? (
                          <Badge variant={status.variant}>{status.label}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={`gap-2 ${isMobile ? "grid grid-cols-1" : "flex justify-end"}`}>
                          <Button size="sm" variant="outline" onClick={() => openEdit(policy)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteMutation.mutate(policy.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
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
    </div>
  );
}
