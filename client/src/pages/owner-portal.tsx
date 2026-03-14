import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CommunicationHistory, ContactUpdateRequest, Document, MaintenanceRequest, PortalAccess } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const maintenanceCategories = ["general", "plumbing", "electrical", "hvac", "common-area", "security", "other"];
const maintenancePriorities = ["low", "medium", "high", "urgent"] as const;

function portalHeaders(portalAccessId: string) {
  return {
    "x-portal-access-id": portalAccessId,
  };
}

export default function OwnerPortalPage() {
  const [associationId, setAssociationId] = useState("");
  const [email, setEmail] = useState("");
  const [portalAccessId, setPortalAccessId] = useState(() => window.localStorage.getItem("portalAccessId") || "");
  const [requestedPhone, setRequestedPhone] = useState("");
  const [requestedMailingAddress, setRequestedMailingAddress] = useState("");
  const [requestedEmergencyContactName, setRequestedEmergencyContactName] = useState("");
  const [requestedEmergencyContactPhone, setRequestedEmergencyContactPhone] = useState("");
  const [requestedContactPreference, setRequestedContactPreference] = useState("");
  const [maintenanceTitle, setMaintenanceTitle] = useState("");
  const [maintenanceDescription, setMaintenanceDescription] = useState("");
  const [maintenanceLocation, setMaintenanceLocation] = useState("");
  const [maintenanceCategory, setMaintenanceCategory] = useState("general");
  const [maintenancePriority, setMaintenancePriority] = useState("medium");
  const [maintenanceFiles, setMaintenanceFiles] = useState<File[]>([]);

  const login = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/portal/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associationId, email }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ portalAccessId: string }>;
    },
    onSuccess: (result) => {
      setPortalAccessId(result.portalAccessId);
      window.localStorage.setItem("portalAccessId", result.portalAccessId);
    },
  });

  const { data: me } = useQuery<PortalAccess | null>({
    queryKey: ["/api/portal/me", portalAccessId || "none"],
    enabled: Boolean(portalAccessId),
    queryFn: async () => {
      const res = await fetch("/api/portal/me", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: documents } = useQuery<Document[]>({
    queryKey: ["/api/portal/documents", portalAccessId || "none"],
    enabled: Boolean(portalAccessId),
    queryFn: async () => {
      const res = await fetch("/api/portal/documents", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: notices } = useQuery<CommunicationHistory[]>({
    queryKey: ["/api/portal/notices", portalAccessId || "none"],
    enabled: Boolean(portalAccessId),
    queryFn: async () => {
      const res = await fetch("/api/portal/notices", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: requests, refetch: refetchRequests } = useQuery<ContactUpdateRequest[]>({
    queryKey: ["/api/portal/contact-updates", portalAccessId || "none"],
    enabled: Boolean(portalAccessId),
    queryFn: async () => {
      const res = await fetch("/api/portal/contact-updates", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: maintenanceRequests, refetch: refetchMaintenanceRequests } = useQuery<MaintenanceRequest[]>({
    queryKey: ["/api/portal/maintenance-requests", portalAccessId || "none"],
    enabled: Boolean(portalAccessId),
    queryFn: async () => {
      const res = await fetch("/api/portal/maintenance-requests", { headers: portalHeaders(portalAccessId) });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const submitContactUpdate = useMutation({
    mutationFn: async () => {
      const requestJson: Record<string, string> = {};
      if (requestedPhone.trim()) requestJson.phone = requestedPhone.trim();
      if (requestedMailingAddress.trim()) requestJson.mailingAddress = requestedMailingAddress.trim();
      if (requestedEmergencyContactName.trim()) requestJson.emergencyContactName = requestedEmergencyContactName.trim();
      if (requestedEmergencyContactPhone.trim()) requestJson.emergencyContactPhone = requestedEmergencyContactPhone.trim();
      if (requestedContactPreference.trim()) requestJson.contactPreference = requestedContactPreference.trim();
      const res = await fetch("/api/portal/contact-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({ requestJson }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      setRequestedPhone("");
      setRequestedMailingAddress("");
      setRequestedEmergencyContactName("");
      setRequestedEmergencyContactPhone("");
      setRequestedContactPreference("");
      await refetchRequests();
    },
  });

  const submitMaintenanceRequest = useMutation({
    mutationFn: async () => {
      let attachmentUrlsJson: string[] = [];
      if (maintenanceFiles.length > 0) {
        const formData = new FormData();
        for (const file of maintenanceFiles) {
          formData.append("files", file);
        }
        const uploadRes = await fetch("/api/portal/maintenance-attachments", {
          method: "POST",
          headers: portalHeaders(portalAccessId),
          body: formData,
        });
        if (!uploadRes.ok) throw new Error(await uploadRes.text());
        const uploadJson = await uploadRes.json() as { urls: string[] };
        attachmentUrlsJson = uploadJson.urls;
      }

      const res = await fetch("/api/portal/maintenance-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...portalHeaders(portalAccessId) },
        body: JSON.stringify({
          title: maintenanceTitle,
          description: maintenanceDescription,
          locationText: maintenanceLocation || null,
          category: maintenanceCategory,
          priority: maintenancePriority,
          attachmentUrlsJson,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      setMaintenanceTitle("");
      setMaintenanceDescription("");
      setMaintenanceLocation("");
      setMaintenanceCategory("general");
      setMaintenancePriority("medium");
      setMaintenanceFiles([]);
      await refetchMaintenanceRequests();
    },
  });

  const displayName = useMemo(() => {
    if (!me) return "Portal User";
    return `${me.email} (${me.role})`;
  }, [me]);

  const maintenanceUpdates = useMemo(
    () => (notices ?? []).filter((notice) => (notice.relatedType || "").startsWith("maintenance") || (notice.relatedType || "").startsWith("work-order")),
    [notices],
  );

  if (!portalAccessId) {
    return (
      <div className="p-6 max-w-xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Owner Portal</h1>
        <p className="text-muted-foreground">Sign in with association and email to access your documents and notices.</p>
        <Card>
          <CardContent className="p-6 space-y-3">
            <Input placeholder="Association ID" value={associationId} onChange={(e) => setAssociationId(e.target.value)} />
            <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button onClick={() => login.mutate()} disabled={login.isPending || !associationId || !email}>Start Portal Session</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Owner Portal</h1>
          <p className="text-muted-foreground">Signed in as {displayName}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            window.localStorage.removeItem("portalAccessId");
            setPortalAccessId("");
          }}
        >
          Sign Out
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Access</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(documents ?? []).map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>{doc.title}</TableCell>
                  <TableCell>{doc.documentType}</TableCell>
                  <TableCell><Badge variant="secondary">{doc.portalAudience}</Badge></TableCell>
                  <TableCell><a href={doc.fileUrl} className="underline text-sm" target="_blank" rel="noreferrer">Open</a></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Snippet</TableHead>
                <TableHead>Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(notices ?? []).map((notice) => (
                <TableRow key={notice.id}>
                  <TableCell>{notice.subject || "-"}</TableCell>
                  <TableCell className="max-w-[420px]">{notice.bodySnippet || "-"}</TableCell>
                  <TableCell>{new Date(notice.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="text-lg font-semibold">Request Contact Update</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input placeholder="New phone" value={requestedPhone} onChange={(e) => setRequestedPhone(e.target.value)} />
            <Textarea placeholder="New mailing address" value={requestedMailingAddress} onChange={(e) => setRequestedMailingAddress(e.target.value)} />
            <Input placeholder="Emergency contact name" value={requestedEmergencyContactName} onChange={(e) => setRequestedEmergencyContactName(e.target.value)} />
            <Input placeholder="Emergency contact phone" value={requestedEmergencyContactPhone} onChange={(e) => setRequestedEmergencyContactPhone(e.target.value)} />
            <Input placeholder="Contact preference (email/phone/sms)" value={requestedContactPreference} onChange={(e) => setRequestedContactPreference(e.target.value)} />
          </div>
          <Button
            onClick={() => submitContactUpdate.mutate()}
            disabled={
              submitContactUpdate.isPending ||
              (
                !requestedPhone.trim() &&
                !requestedMailingAddress.trim() &&
                !requestedEmergencyContactName.trim() &&
                !requestedEmergencyContactPhone.trim() &&
                !requestedContactPreference.trim()
              )
            }
          >
            Submit Update Request
          </Button>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requested Changes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(requests ?? []).map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="max-w-[460px]">
                    <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(request.requestJson, null, 2)}</pre>
                  </TableCell>
                  <TableCell>
                    <Badge variant={request.reviewStatus === "approved" ? "default" : request.reviewStatus === "rejected" ? "destructive" : "outline"}>
                      {request.reviewStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(request.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="text-lg font-semibold">Submit Maintenance Request</h2>
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            SLA policy: `urgent` requests target response within 4 hours and escalate faster if overdue. `high` targets 12 hours, `medium` 48 hours, `low` 120 hours.
          </div>
          <Input placeholder="Issue title" value={maintenanceTitle} onChange={(e) => setMaintenanceTitle(e.target.value)} />
          <Textarea placeholder="Describe the issue" value={maintenanceDescription} onChange={(e) => setMaintenanceDescription(e.target.value)} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input placeholder="Location (unit/common area)" value={maintenanceLocation} onChange={(e) => setMaintenanceLocation(e.target.value)} />
            <Select value={maintenanceCategory} onValueChange={setMaintenanceCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {maintenanceCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={maintenancePriority} onValueChange={setMaintenancePriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {maintenancePriorities.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setMaintenanceFiles(Array.from(e.target.files ?? []))}
            />
            {maintenanceFiles.length > 0 ? (
              <div className="text-xs text-muted-foreground">
                Photos ready: {maintenanceFiles.map((file) => file.name).join(", ")}
              </div>
            ) : null}
          </div>
          <Button
            onClick={() => submitMaintenanceRequest.mutate()}
            disabled={submitMaintenanceRequest.isPending || !maintenanceTitle.trim() || !maintenanceDescription.trim()}
          >
            Submit Maintenance Request
          </Button>

          <div className="space-y-3">
            {(maintenanceRequests ?? []).map((request) => (
              <div key={request.id} className="rounded-md border p-4 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium">{request.title}</div>
                    <div className="text-xs text-muted-foreground">{request.locationText || "Location not specified"} · {request.category}</div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="secondary">{request.status}</Badge>
                    <Badge variant={request.priority === "urgent" ? "destructive" : "outline"}>{request.priority}</Badge>
                    <Badge variant="outline">Escalation {request.escalationStage}</Badge>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">{request.description}</div>
                <div className="text-xs text-muted-foreground">
                  Submitted {new Date(request.createdAt).toLocaleString()} · SLA due {request.responseDueAt ? new Date(request.responseDueAt).toLocaleString() : "-"}
                </div>
                {request.resolutionNotes ? <div className="text-sm">Resolution: {request.resolutionNotes}</div> : null}
                {Array.isArray(request.attachmentUrlsJson) && request.attachmentUrlsJson.length > 0 ? (
                  <div className="flex gap-2 flex-wrap">
                    {request.attachmentUrlsJson.map((url, index) => (
                      <a key={url} href={url} className="underline text-xs" target="_blank" rel="noreferrer">Photo {index + 1}</a>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {(maintenanceRequests ?? []).length === 0 ? <div className="text-sm text-muted-foreground">No maintenance requests submitted yet.</div> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="text-lg font-semibold">Maintenance Updates</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Update</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {maintenanceUpdates.map((notice) => (
                <TableRow key={notice.id}>
                  <TableCell>{notice.subject || "-"}</TableCell>
                  <TableCell className="max-w-[520px]">{notice.bodySnippet || "-"}</TableCell>
                  <TableCell>{new Date(notice.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {maintenanceUpdates.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-muted-foreground">No maintenance updates yet.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
