import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
  AdminAssociationScope,
  AdminUser,
  Association,
  AssociationMembership,
  ContactUpdateRequest,
  Document,
  EmailThread,
  PermissionEnvelope,
  Person,
  PortalAccess,
  TenantConfig,
  Unit,
} from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function PlatformControlsPage() {
  const { toast } = useToast();
  const [envelopeForm, setEnvelopeForm] = useState({ associationId: "", name: "", audience: "owner-self-service", permissionsJson: "{\n  \"documents\": true,\n  \"notices\": true,\n  \"contactUpdate\": true\n}" });
  const [scopeForm, setScopeForm] = useState({ adminUserId: "", associationId: "", scope: "read-write" });
  const [tenantForm, setTenantForm] = useState({ associationId: "", portalName: "Owner Portal", supportEmail: "", allowContactUpdates: 1, ownerDocumentVisibility: "owner-safe", gmailIntegrationStatus: "not-configured", defaultNoticeFooter: "" });
  const [emailTestForm, setEmailTestForm] = useState({ associationId: "", to: "", subject: "Platform Email Integration Test", body: "This is a test email from the platform." });
  const [portalAccessForm, setPortalAccessForm] = useState({ associationId: "", personId: "", unitId: "", email: "", role: "owner", status: "active" });
  const [membershipForm, setMembershipForm] = useState({ associationId: "", personId: "", unitId: "", membershipType: "owner", status: "active", isPrimary: 1 });

  const [qaPreviewDone, setQaPreviewDone] = useState(false);
  const [qaPurgeConfirm, setQaPurgeConfirm] = useState(false);

  const { data: qaPreview, refetch: refetchQaPreview } = useQuery<{ count: number; associations: { id: string; name: string }[] }>({
    queryKey: ["/api/admin/qa-seed/preview"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/qa-seed/preview");
      return res.json();
    },
    enabled: qaPreviewDone,
  });

  const purgeMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const res = await apiRequest("POST", "/api/admin/qa-seed/purge", { confirm: !dryRun, dryRun });
      return res.json() as Promise<{ identified: number; associationIds?: string[]; associations?: { id: string; name: string }[]; wouldDelete?: number; message?: string }>;
    },
    onSuccess: async (data) => {
      toast({ title: data.message || `Identified ${data.identified ?? data.wouldDelete} QA associations`, description: "Review the list and delete individually if needed." });
      await refetchQaPreview();
      setQaPurgeConfirm(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const { data: associations } = useQuery<Association[]>({ queryKey: ["/api/associations"] });
  const { data: adminUsers } = useQuery<AdminUser[]>({ queryKey: ["/api/admin/users"] });
  const { data: persons } = useQuery<Person[]>({ queryKey: ["/api/persons"] });
  const { data: units } = useQuery<Unit[]>({ queryKey: ["/api/units"] });
  const { data: documents } = useQuery<Document[]>({ queryKey: ["/api/documents"] });
  const { data: envelopes } = useQuery<PermissionEnvelope[]>({ queryKey: ["/api/platform/permission-envelopes"] });
  const { data: scopes } = useQuery<AdminAssociationScope[]>({ queryKey: ["/api/platform/admin-association-scopes"] });
  const { data: tenantConfig } = useQuery<TenantConfig | null>({
    queryKey: ["/api/platform/tenant-config", tenantForm.associationId || "none"],
    queryFn: async () => {
      if (!tenantForm.associationId) return null;
      const res = await apiRequest("GET", `/api/platform/tenant-config?associationId=${tenantForm.associationId}`);
      return res.json();
    },
  });
  const { data: portalAccesses } = useQuery<PortalAccess[]>({ queryKey: ["/api/portal/access"] });
  const { data: memberships } = useQuery<AssociationMembership[]>({ queryKey: ["/api/portal/memberships"] });
  const { data: contactUpdateRequests } = useQuery<ContactUpdateRequest[]>({ queryKey: ["/api/portal/contact-updates/admin"] });
  const { data: emailThreads } = useQuery<EmailThread[]>({ queryKey: ["/api/platform/email-threads"] });
  const { data: emailProviderStatus } = useQuery<{
    preferredProvider: string;
    smtpConfigured: boolean;
    activeProvider: string;
    sender: string | null;
    trackingEnabled: boolean;
  }>({ queryKey: ["/api/platform/email/provider-status"] });
  const { data: googleAuthStatus } = useQuery<{
    enabled: boolean;
    clientConfigured: boolean;
    callbackPath: string;
    configuredCallbackUrl: string | null;
    callbackUrlStrict: boolean;
    requestOrigin: string | null;
    resolvedCallbackUrl: string | null;
    callbackRoutes: string[];
  }>({ queryKey: ["/api/platform/auth/google-status"] });

  const createEnvelope = useMutation({
    mutationFn: async () => {
      let parsed: unknown = {};
      try {
        parsed = JSON.parse(envelopeForm.permissionsJson || "{}");
      } catch {
        throw new Error("Permissions JSON is invalid");
      }
      const res = await apiRequest("POST", "/api/platform/permission-envelopes", {
        associationId: envelopeForm.associationId || null,
        name: envelopeForm.name,
        audience: envelopeForm.audience,
        permissionsJson: parsed,
        isActive: 1,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/permission-envelopes"] });
      toast({ title: "Permission envelope saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const upsertScope = useMutation({
    mutationFn: async () => {
      if (!scopeForm.adminUserId || !scopeForm.associationId) {
        throw new Error("Admin and association are required");
      }
      const res = await apiRequest("POST", "/api/platform/admin-association-scopes", scopeForm);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/admin-association-scopes"] });
      toast({ title: "Association scope saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const saveTenantConfig = useMutation({
    mutationFn: async () => {
      if (!tenantForm.associationId) throw new Error("Association is required");
      const res = await apiRequest("POST", "/api/platform/tenant-config", {
        ...tenantForm,
        allowContactUpdates: Number(tenantForm.allowContactUpdates),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/tenant-config"] });
      toast({ title: "Tenant config saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createPortalAccess = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/portal/access", {
        associationId: portalAccessForm.associationId,
        personId: portalAccessForm.personId,
        unitId: portalAccessForm.unitId || null,
        email: portalAccessForm.email,
        role: portalAccessForm.role,
        status: portalAccessForm.status,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/access"] });
      toast({ title: "Portal access created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const upsertMembership = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/portal/memberships", {
        associationId: membershipForm.associationId,
        personId: membershipForm.personId,
        unitId: membershipForm.unitId || null,
        membershipType: membershipForm.membershipType,
        status: membershipForm.status,
        isPrimary: Number(membershipForm.isPrimary),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/memberships"] });
      toast({ title: "Membership saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateDocumentPortalVisibility = useMutation({
    mutationFn: async ({ id, isPortalVisible, portalAudience }: { id: string; isPortalVisible: number; portalAudience: string }) => {
      const res = await apiRequest("PATCH", `/api/documents/${id}`, { isPortalVisible, portalAudience });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
  });

  const reviewContactUpdate = useMutation({
    mutationFn: async ({ id, reviewStatus }: { id: string; reviewStatus: "approved" | "rejected" }) => {
      const res = await apiRequest("PATCH", `/api/portal/contact-updates/${id}/review`, { reviewStatus });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/contact-updates/admin"] });
      toast({ title: "Contact update reviewed" });
    },
  });

  const sendEmailTest = useMutation({
    mutationFn: async () => {
      if (!emailTestForm.to.trim()) throw new Error("Recipient email is required");
      const res = await apiRequest("POST", "/api/platform/email/test", {
        associationId: emailTestForm.associationId || null,
        to: emailTestForm.to.trim(),
        subject: emailTestForm.subject.trim() || "Platform Email Integration Test",
        body: emailTestForm.body.trim() || "This is a test email from the platform.",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/email-threads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/history"] });
      toast({ title: "Test email sent" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const assocName = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of associations ?? []) map.set(a.id, a.name);
    return map;
  }, [associations]);

  const adminEmail = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of adminUsers ?? []) map.set(a.id, a.email);
    return map;
  }, [adminUsers]);

  const unitNumber = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of units ?? []) map.set(u.id, u.unitNumber);
    return map;
  }, [units]);

  const personName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of persons ?? []) map.set(p.id, `${p.firstName} ${p.lastName}`);
    return map;
  }, [persons]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Controls</h1>
        <p className="text-muted-foreground">Self-service permission envelopes and multi-association isolation scopes.</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">Google OAuth Routing Status</h2>
              <p className="text-sm text-muted-foreground">Validate hosted sign-in routing and callback resolution for the current environment.</p>
            </div>
            <Badge variant={googleAuthStatus?.enabled ? "default" : "outline"}>
              {googleAuthStatus?.enabled ? "configured" : "not configured"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Request origin</div>
              <div className="mt-1 text-sm font-medium break-all">{googleAuthStatus?.requestOrigin || "Unavailable"}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Resolved callback URL</div>
              <div className="mt-1 text-sm font-medium break-all">{googleAuthStatus?.resolvedCallbackUrl || "Unavailable"}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Configured callback URL</div>
              <div className="mt-1 text-sm font-medium break-all">{googleAuthStatus?.configuredCallbackUrl || "Dynamic by request host"}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Callback mode</div>
              <div className="mt-1 text-sm font-medium">
                {googleAuthStatus?.callbackUrlStrict ? "Pinned to configured URL" : `Host-aware via ${googleAuthStatus?.callbackPath || "/api/auth/google/callback"}`}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Accepted callback routes</div>
            <div className="flex flex-wrap gap-2">
              {(googleAuthStatus?.callbackRoutes ?? []).map((route) => (
                <Badge key={route} variant="outline">{route}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Future Self-Service Permission Envelope</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select value={envelopeForm.associationId || "none"} onValueChange={(v) => setEnvelopeForm((p) => ({ ...p, associationId: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Association scope" /></SelectTrigger>
              <SelectContent><SelectItem value="none">global</SelectItem>{associations?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Envelope name" value={envelopeForm.name} onChange={(e) => setEnvelopeForm((p) => ({ ...p, name: e.target.value }))} />
            <Input placeholder="Audience" value={envelopeForm.audience} onChange={(e) => setEnvelopeForm((p) => ({ ...p, audience: e.target.value }))} />
          </div>
          <Textarea rows={6} value={envelopeForm.permissionsJson} onChange={(e) => setEnvelopeForm((p) => ({ ...p, permissionsJson: e.target.value }))} />
          <Button onClick={() => createEnvelope.mutate()} disabled={createEnvelope.isPending}>Save Envelope</Button>

          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Audience</TableHead><TableHead>Scope</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {(envelopes ?? []).map((e) => (
                <TableRow key={e.id}><TableCell>{e.name}</TableCell><TableCell>{e.audience}</TableCell><TableCell>{e.associationId ? assocName.get(e.associationId) || e.associationId : "global"}</TableCell><TableCell><Badge variant={e.isActive ? "default" : "outline"}>{e.isActive ? "active" : "inactive"}</Badge></TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Multi-Association Data Isolation Foundation</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Select value={scopeForm.adminUserId || "none"} onValueChange={(v) => setScopeForm((p) => ({ ...p, adminUserId: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Admin user" /></SelectTrigger>
              <SelectContent><SelectItem value="none">select admin</SelectItem>{adminUsers?.map((u) => <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={scopeForm.associationId || "none"} onValueChange={(v) => setScopeForm((p) => ({ ...p, associationId: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Association" /></SelectTrigger>
              <SelectContent><SelectItem value="none">select association</SelectItem>{associations?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={scopeForm.scope} onValueChange={(v) => setScopeForm((p) => ({ ...p, scope: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="read-only">read-only</SelectItem><SelectItem value="read-write">read-write</SelectItem><SelectItem value="admin">admin</SelectItem></SelectContent>
            </Select>
            <Button onClick={() => upsertScope.mutate()} disabled={upsertScope.isPending}>Save Scope</Button>
          </div>

          <Table>
            <TableHeader><TableRow><TableHead>Admin</TableHead><TableHead>Association</TableHead><TableHead>Scope</TableHead></TableRow></TableHeader>
            <TableBody>
              {(scopes ?? []).map((s) => (
                <TableRow key={s.id}><TableCell>{adminEmail.get(s.adminUserId) || s.adminUserId}</TableCell><TableCell>{assocName.get(s.associationId) || s.associationId}</TableCell><TableCell><Badge variant="secondary">{s.scope}</Badge></TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Email Provider and SMTP Integration</h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Preferred: {emailProviderStatus?.preferredProvider ?? "-"}</Badge>
            <Badge variant={emailProviderStatus?.smtpConfigured ? "default" : "outline"}>
              SMTP Configured: {emailProviderStatus?.smtpConfigured ? "yes" : "no"}
            </Badge>
            <Badge variant="secondary">Active: {emailProviderStatus?.activeProvider ?? "-"}</Badge>
            <Badge variant="outline">Sender: {emailProviderStatus?.sender || "-"}</Badge>
            <Badge variant="outline">Tracking: {emailProviderStatus?.trackingEnabled ? "enabled" : "disabled"}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select value={emailTestForm.associationId || "none"} onValueChange={(v) => setEmailTestForm((p) => ({ ...p, associationId: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Association (optional)" /></SelectTrigger>
              <SelectContent><SelectItem value="none">none</SelectItem>{associations?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={emailTestForm.to} onChange={(e) => setEmailTestForm((p) => ({ ...p, to: e.target.value }))} placeholder="Recipient email" />
            <Input value={emailTestForm.subject} onChange={(e) => setEmailTestForm((p) => ({ ...p, subject: e.target.value }))} placeholder="Subject" />
          </div>
          <Textarea value={emailTestForm.body} onChange={(e) => setEmailTestForm((p) => ({ ...p, body: e.target.value }))} placeholder="Email body" />
          <Button onClick={() => sendEmailTest.mutate()} disabled={sendEmailTest.isPending}>Send Test Email</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Tenant Config and Email Threads</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select value={tenantForm.associationId || "none"} onValueChange={(v) => setTenantForm((p) => ({ ...p, associationId: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Association" /></SelectTrigger>
              <SelectContent><SelectItem value="none">select association</SelectItem>{associations?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={tenantForm.portalName} onChange={(e) => setTenantForm((p) => ({ ...p, portalName: e.target.value }))} placeholder="Portal name" />
            <Input value={tenantForm.supportEmail} onChange={(e) => setTenantForm((p) => ({ ...p, supportEmail: e.target.value }))} placeholder="Support email" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input value={tenantForm.ownerDocumentVisibility} onChange={(e) => setTenantForm((p) => ({ ...p, ownerDocumentVisibility: e.target.value }))} placeholder="Owner document visibility policy" />
            <Input value={tenantForm.gmailIntegrationStatus} onChange={(e) => setTenantForm((p) => ({ ...p, gmailIntegrationStatus: e.target.value }))} placeholder="Email integration status" />
            <Select value={String(tenantForm.allowContactUpdates)} onValueChange={(v) => setTenantForm((p) => ({ ...p, allowContactUpdates: Number(v) }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="1">contact updates enabled</SelectItem><SelectItem value="0">contact updates disabled</SelectItem></SelectContent>
            </Select>
          </div>
          <Textarea value={tenantForm.defaultNoticeFooter} onChange={(e) => setTenantForm((p) => ({ ...p, defaultNoticeFooter: e.target.value }))} placeholder="Default notice footer" />
          <div className="flex gap-2">
            <Button onClick={() => saveTenantConfig.mutate()} disabled={saveTenantConfig.isPending}>Save Tenant Config</Button>
            {tenantConfig ? <Badge variant="secondary">{tenantConfig.portalName}</Badge> : null}
          </div>

          <Table>
            <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Participants</TableHead><TableHead>Last Message</TableHead></TableRow></TableHeader>
            <TableBody>
              {(emailThreads ?? []).map((thread) => (
                <TableRow key={thread.id}>
                  <TableCell>{thread.subject}</TableCell>
                  <TableCell>{Array.isArray(thread.participantsJson) ? thread.participantsJson.join(", ") : "-"}</TableCell>
                  <TableCell>{new Date(thread.lastMessageAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Owner Portal Access and Memberships</h2>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <Select value={portalAccessForm.associationId || "none"} onValueChange={(v) => setPortalAccessForm((p) => ({ ...p, associationId: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Association" /></SelectTrigger>
              <SelectContent><SelectItem value="none">association</SelectItem>{associations?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={portalAccessForm.personId || "none"} onValueChange={(v) => setPortalAccessForm((p) => ({ ...p, personId: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Person" /></SelectTrigger>
              <SelectContent><SelectItem value="none">person</SelectItem>{persons?.map((p) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={portalAccessForm.unitId || "none"} onValueChange={(v) => setPortalAccessForm((p) => ({ ...p, unitId: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
              <SelectContent><SelectItem value="none">no unit</SelectItem>{units?.map((u) => <SelectItem key={u.id} value={u.id}>{u.unitNumber}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={portalAccessForm.email} onChange={(e) => setPortalAccessForm((p) => ({ ...p, email: e.target.value }))} placeholder="Portal email" />
            <Select value={portalAccessForm.role} onValueChange={(v) => setPortalAccessForm((p) => ({ ...p, role: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="owner">owner</SelectItem><SelectItem value="tenant">tenant</SelectItem><SelectItem value="readonly">readonly</SelectItem><SelectItem value="board-member">board-member</SelectItem></SelectContent>
            </Select>
            <Button onClick={() => createPortalAccess.mutate()} disabled={createPortalAccess.isPending}>Create Access</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <Select value={membershipForm.associationId || "none"} onValueChange={(v) => setMembershipForm((p) => ({ ...p, associationId: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Association" /></SelectTrigger>
              <SelectContent><SelectItem value="none">association</SelectItem>{associations?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={membershipForm.personId || "none"} onValueChange={(v) => setMembershipForm((p) => ({ ...p, personId: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Person" /></SelectTrigger>
              <SelectContent><SelectItem value="none">person</SelectItem>{persons?.map((p) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={membershipForm.unitId || "none"} onValueChange={(v) => setMembershipForm((p) => ({ ...p, unitId: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
              <SelectContent><SelectItem value="none">no unit</SelectItem>{units?.map((u) => <SelectItem key={u.id} value={u.id}>{u.unitNumber}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={membershipForm.membershipType} onChange={(e) => setMembershipForm((p) => ({ ...p, membershipType: e.target.value }))} placeholder="membership type" />
            <Input value={membershipForm.status} onChange={(e) => setMembershipForm((p) => ({ ...p, status: e.target.value }))} placeholder="status" />
            <Button onClick={() => upsertMembership.mutate()} disabled={upsertMembership.isPending}>Save Membership</Button>
          </div>

          <Table>
            <TableHeader><TableRow><TableHead>Access</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Last Login</TableHead></TableRow></TableHeader>
            <TableBody>
              {(portalAccesses ?? []).map((access) => (
                <TableRow key={access.id}>
                  <TableCell>{access.email} / {assocName.get(access.associationId) || access.associationId}</TableCell>
                  <TableCell><Badge variant="secondary">{access.role}</Badge></TableCell>
                  <TableCell><Badge variant={access.status === "active" ? "default" : "outline"}>{access.status}</Badge></TableCell>
                  <TableCell>{access.lastLoginAt ? new Date(access.lastLoginAt).toLocaleString() : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Table>
            <TableHeader><TableRow><TableHead>Association</TableHead><TableHead>Person</TableHead><TableHead>Unit</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {(memberships ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{assocName.get(m.associationId) || m.associationId}</TableCell>
                  <TableCell>{personName.get(m.personId) || m.personId}</TableCell>
                  <TableCell>{m.unitId ? unitNumber.get(m.unitId) || m.unitId : "-"}</TableCell>
                  <TableCell>{m.membershipType}</TableCell>
                  <TableCell>{m.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Owner-Safe Document Access and Contact Moderation</h2>
          <Table>
            <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Portal Visibility</TableHead><TableHead>Audience</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {(documents ?? []).map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>{doc.title}</TableCell>
                  <TableCell><Badge variant={doc.isPortalVisible ? "default" : "outline"}>{doc.isPortalVisible ? "visible" : "hidden"}</Badge></TableCell>
                  <TableCell>{doc.portalAudience}</TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => updateDocumentPortalVisibility.mutate({ id: doc.id, isPortalVisible: doc.isPortalVisible ? 0 : 1, portalAudience: doc.portalAudience || "owner" })}>
                      Toggle
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateDocumentPortalVisibility.mutate({ id: doc.id, isPortalVisible: 1, portalAudience: "owner" })}>Owner Only</Button>
                    <Button size="sm" variant="outline" onClick={() => updateDocumentPortalVisibility.mutate({ id: doc.id, isPortalVisible: 1, portalAudience: "all" })}>All Portal Users</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Table>
            <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Requested Change</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {(contactUpdateRequests ?? []).map((request) => (
                <TableRow key={request.id}>
                  <TableCell>{personName.get(request.personId) || request.personId}</TableCell>
                  <TableCell className="max-w-[340px]"><pre className="text-xs whitespace-pre-wrap">{JSON.stringify(request.requestJson, null, 2)}</pre></TableCell>
                  <TableCell>
                    <Badge variant={request.reviewStatus === "approved" ? "default" : request.reviewStatus === "rejected" ? "destructive" : "outline"}>
                      {request.reviewStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => reviewContactUpdate.mutate({ id: request.id, reviewStatus: "approved" })}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => reviewContactUpdate.mutate({ id: request.id, reviewStatus: "rejected" })}>Reject</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* QA Seed Data Management */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> QA / UAT Seed Data Management
          </CardTitle>
          <CardDescription>Identify and remove QA validation associations after UAT sign-off. This action is irreversible.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setQaPreviewDone(true); void refetchQaPreview(); }}
            >
              Preview QA Associations
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => purgeMutation.mutate(true)}
              disabled={purgeMutation.isPending}
            >
              Dry Run
            </Button>
            {!qaPurgeConfirm ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setQaPurgeConfirm(true)}
                disabled={purgeMutation.isPending}
              >
                Purge QA Data…
              </Button>
            ) : (
              <>
                <Button size="sm" variant="destructive" onClick={() => purgeMutation.mutate(false)} disabled={purgeMutation.isPending}>
                  Confirm Purge
                </Button>
                <Button size="sm" variant="outline" onClick={() => setQaPurgeConfirm(false)}>Cancel</Button>
              </>
            )}
          </div>

          {qaPreview && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-amber-700">{qaPreview.count} QA associations identified:</div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {qaPreview.associations.map(a => (
                  <div key={a.id} className="text-xs font-mono bg-muted/30 rounded px-2 py-1 flex justify-between">
                    <span>{a.name}</span>
                    <span className="text-muted-foreground">{a.id.slice(0, 8)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
