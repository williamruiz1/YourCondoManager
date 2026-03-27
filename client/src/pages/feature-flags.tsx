import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { platformSubPages } from "@/lib/sub-page-nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Flag, Plus, Globe, Layers, ToggleLeft } from "lucide-react";
import type { FeatureFlag, AssociationFeatureFlag, Association } from "@shared/schema";

const ROLLOUT_STATUS_LABELS: Record<string, string> = {
  global_off: "Global Off",
  staged: "Staged",
  global_on: "Global On",
};

export default function FeatureFlagsPage() {
  const { toast } = useToast();

  const [newFlagDialogOpen, setNewFlagDialogOpen] = useState(false);
  const [overrideDialogFlag, setOverrideDialogFlag] = useState<FeatureFlag | null>(null);
  const [newFlagForm, setNewFlagForm] = useState({ key: "", name: "", description: "", defaultEnabled: false, rolloutStatus: "staged" as "global_off" | "staged" | "global_on" });
  const [overrideAssocId, setOverrideAssocId] = useState("");
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overridePercent, setOverridePercent] = useState("100");
  const [overrideNotes, setOverrideNotes] = useState("");

  const { data: flags = [], refetch: refetchFlags } = useQuery<FeatureFlag[]>({
    queryKey: ["/api/admin/feature-flags"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/feature-flags");
      return res.json();
    },
  });

  const { data: associations = [] } = useQuery<Association[]>({
    queryKey: ["/api/associations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/associations");
      return res.json();
    },
  });

  const { data: overrides = [], refetch: refetchOverrides } = useQuery<AssociationFeatureFlag[]>({
    queryKey: ["/api/admin/feature-flags/associations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/feature-flags/associations");
      return res.json();
    },
  });

  const createFlag = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/feature-flags", {
        key: newFlagForm.key,
        name: newFlagForm.name,
        description: newFlagForm.description || null,
        defaultEnabled: newFlagForm.defaultEnabled ? 1 : 0,
        rolloutStatus: newFlagForm.rolloutStatus,
      });
      return res.json();
    },
    onSuccess: async () => {
      await refetchFlags();
      setNewFlagDialogOpen(false);
      setNewFlagForm({ key: "", name: "", description: "", defaultEnabled: false, rolloutStatus: "staged" });
      toast({ title: "Feature flag created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateFlagStatus = useMutation({
    mutationFn: async ({ id, rolloutStatus }: { id: string; rolloutStatus: "global_off" | "staged" | "global_on" }) => {
      const res = await apiRequest("PATCH", `/api/admin/feature-flags/${id}`, { rolloutStatus });
      return res.json();
    },
    onSuccess: () => refetchFlags(),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const upsertOverride = useMutation({
    mutationFn: async () => {
      if (!overrideDialogFlag || !overrideAssocId) throw new Error("Select an association");
      const res = await apiRequest("PUT", `/api/admin/feature-flags/${overrideDialogFlag.id}/associations/${overrideAssocId}`, {
        enabled: overrideEnabled ? 1 : 0,
        rolloutPercent: parseInt(overridePercent, 10),
        notes: overrideNotes || null,
      });
      return res.json();
    },
    onSuccess: async () => {
      await refetchOverrides();
      setOverrideDialogFlag(null);
      setOverrideAssocId("");
      setOverrideEnabled(false);
      setOverridePercent("100");
      setOverrideNotes("");
      toast({ title: "Override saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Build override index: flagId -> associationId -> override
  const overrideIndex = new Map<string, Map<string, AssociationFeatureFlag>>();
  for (const o of overrides) {
    if (!overrideIndex.has(o.flagId)) overrideIndex.set(o.flagId, new Map());
    overrideIndex.get(o.flagId)!.set(o.associationId, o);
  }

  const assocName = new Map<string, string>(associations.map(a => [a.id, a.name]));

  return (
    <div className="p-6 space-y-6">
      <WorkspacePageHeader
        title="Feature Flags"
        summary="Define platform-wide feature flags and configure per-association staged rollout controls."
        eyebrow="Admin"
        breadcrumbs={[{ label: "Admin", href: "/app/admin" }, { label: "Feature Flags" }]}
        subPages={platformSubPages}
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Flags", value: flags.length, icon: Flag },
          { label: "Staged Rollout", value: flags.filter(f => f.rolloutStatus === "staged").length, icon: Layers },
          { label: "Global On", value: flags.filter(f => f.rolloutStatus === "global_on").length, icon: Globe },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <s.icon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <div className="text-xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Flags table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Flag className="h-4 w-4 text-blue-500" /> Platform Feature Flags
              </CardTitle>
              <CardDescription>Define global flags and set their default rollout mode</CardDescription>
            </div>
            <Button size="sm" onClick={() => setNewFlagDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Flag
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {flags.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No feature flags defined.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Rollout Status</TableHead>
                  <TableHead>Association Overrides</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flags.map(flag => {
                  const flagOverrides = Array.from(overrideIndex.get(flag.id)?.values() ?? []);
                  return (
                    <TableRow key={flag.id}>
                      <TableCell className="font-mono text-xs">{flag.key}</TableCell>
                      <TableCell className="font-medium">
                        {flag.name}
                        {flag.description && <div className="text-xs text-muted-foreground">{flag.description}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={flag.defaultEnabled ? "default" : "secondary"}>
                          {flag.defaultEnabled ? "On" : "Off"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={flag.rolloutStatus}
                          onValueChange={(v) => updateFlagStatus.mutate({ id: flag.id, rolloutStatus: v as "global_off" | "staged" | "global_on" })}
                        >
                          <SelectTrigger className="w-36 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="global_off">Global Off</SelectItem>
                            <SelectItem value="staged">Staged</SelectItem>
                            <SelectItem value="global_on">Global On</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {flagOverrides.slice(0, 3).map(o => (
                            <Badge key={o.id} variant={o.enabled ? "default" : "secondary"} className="text-xs">
                              {assocName.get(o.associationId) ?? o.associationId.slice(0, 8)} — {o.rolloutPercent}%
                            </Badge>
                          ))}
                          {flagOverrides.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{flagOverrides.length - 3} more</Badge>
                          )}
                          {flagOverrides.length === 0 && <span className="text-xs text-muted-foreground">none</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setOverrideDialogFlag(flag);
                            setOverrideAssocId("");
                            setOverrideEnabled(false);
                            setOverridePercent("100");
                            setOverrideNotes("");
                          }}
                        >
                          <ToggleLeft className="h-3.5 w-3.5 mr-1" /> Set Override
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Association override matrix */}
      {overrides.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-purple-500" /> Association Rollout Overrides
            </CardTitle>
            <CardDescription>Per-association flag states override the global rollout mode when set</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Association</TableHead>
                  <TableHead>Flag</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Rollout %</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Updated By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrides.map(o => {
                  const flag = flags.find(f => f.id === o.flagId);
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{assocName.get(o.associationId) ?? o.associationId.slice(0, 8)}</TableCell>
                      <TableCell className="font-mono text-xs">{flag?.key ?? o.flagId.slice(0, 8)}</TableCell>
                      <TableCell><Badge variant={o.enabled ? "default" : "secondary"}>{o.enabled ? "On" : "Off"}</Badge></TableCell>
                      <TableCell className="text-sm">{o.rolloutPercent}%</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{o.notes ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{o.updatedBy ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* New flag dialog */}
      <Dialog open={newFlagDialogOpen} onOpenChange={setNewFlagDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Feature Flag</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Flag key (e.g. online_payments)"
              value={newFlagForm.key}
              onChange={e => setNewFlagForm(f => ({ ...f, key: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
            />
            <Input
              placeholder="Display name"
              value={newFlagForm.name}
              onChange={e => setNewFlagForm(f => ({ ...f, name: e.target.value }))}
            />
            <Textarea
              placeholder="Description (optional)"
              value={newFlagForm.description}
              onChange={e => setNewFlagForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Rollout Status</label>
                <Select value={newFlagForm.rolloutStatus} onValueChange={(v) => setNewFlagForm(f => ({ ...f, rolloutStatus: v as typeof newFlagForm.rolloutStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global_off">Global Off</SelectItem>
                    <SelectItem value="staged">Staged</SelectItem>
                    <SelectItem value="global_on">Global On</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={newFlagForm.defaultEnabled} onCheckedChange={v => setNewFlagForm(f => ({ ...f, defaultEnabled: v }))} />
                <label className="text-sm">Default On</label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewFlagDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => createFlag.mutate()} disabled={!newFlagForm.key || !newFlagForm.name || createFlag.isPending}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Override dialog */}
      <Dialog open={Boolean(overrideDialogFlag)} onOpenChange={(o) => { if (!o) setOverrideDialogFlag(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Association Override — {overrideDialogFlag?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Association</label>
              <Select value={overrideAssocId} onValueChange={setOverrideAssocId}>
                <SelectTrigger><SelectValue placeholder="Select association" /></SelectTrigger>
                <SelectContent>
                  {associations.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={overrideEnabled} onCheckedChange={setOverrideEnabled} />
              <label className="text-sm font-medium">{overrideEnabled ? "Enabled" : "Disabled"} for this association</label>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Rollout % (0–100)</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={overridePercent}
                onChange={e => setOverridePercent(e.target.value)}
              />
            </div>
            <Textarea
              placeholder="Notes (optional)"
              value={overrideNotes}
              onChange={e => setOverrideNotes(e.target.value)}
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOverrideDialogFlag(null)}>Cancel</Button>
              <Button onClick={() => upsertOverride.mutate()} disabled={!overrideAssocId || upsertOverride.isPending}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
