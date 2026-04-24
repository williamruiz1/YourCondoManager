// zone: My Requests
// persona: Owner
//
// 3.5 — PortalRequests hub (/portal/requests) replaces the `maintenance`
// tab of the owner-portal.tsx mega-file. First-person label "My Requests"
// per 1.1 Q5; hub per 1.2 Q4; title "My Requests — YCM" per 1.4 Q7.
//
// Sub-route: /portal/requests/:requestId for per-request detail.

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MaintenanceRequest } from "@shared/schema";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PortalShell, usePortalContext } from "./portal-shell";

const CATEGORIES = ["general", "plumbing", "electrical", "hvac", "common-area", "security", "other"];
const PRIORITIES = ["low", "medium", "high", "urgent"];

function getOwnerReadableState(status: string): string {
  const stateMap: Record<string, string> = {
    submitted: "Submitted",
    triaged: "In review",
    "in-progress": "In progress",
    resolved: "Resolved",
    closed: "Closed",
    rejected: "Not approved",
  };
  return stateMap[status] || status;
}

function getStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (["resolved", "closed"].includes(status)) return "secondary";
  if (status === "rejected") return "destructive";
  return "default";
}

// ---------- Hub (/portal/requests) ----------

function RequestsHubContent() {
  const { portalFetch, session } = usePortalContext();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");

  const { data: requests = [] } = useQuery<MaintenanceRequest[]>({
    queryKey: ["portal/maintenance-requests", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/maintenance-requests");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const res = await portalFetch("/api/portal/submit-maintenance-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, locationText: location, category, priority }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setLocation("");
      setCategory("general");
      setPriority("medium");
      qc.invalidateQueries({ queryKey: ["portal/maintenance-requests"] });
      qc.invalidateQueries({ queryKey: ["portal/requests/open-count"] });
    },
  });

  const open = requests.filter((r) => !["resolved", "closed", "rejected"].includes(r.status));
  const closed = requests.filter((r) => ["resolved", "closed", "rejected"].includes(r.status));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6" data-testid="portal-requests">
      <div>
        <h1 className="font-headline text-3xl md:text-4xl" data-testid="portal-requests-heading">
          My Requests
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Submit a new maintenance or community request and track the status of everything you've sent.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 py-5" data-testid="portal-requests-form">
          <h2 className="font-headline text-lg">Submit a request</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="portal-requests-input-title"
            />
            <Input
              placeholder="Location (optional)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              data-testid="portal-requests-input-location"
            />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="portal-requests-select-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">
                    {c.replace(/-/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger data-testid="portal-requests-select-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder="Describe the issue"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            data-testid="portal-requests-input-description"
          />
          <div className="flex items-center justify-end">
            <Button
              onClick={() => submit.mutate()}
              disabled={submit.isPending || !title.trim()}
              data-testid="portal-requests-submit"
            >
              {submit.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <section data-testid="portal-requests-open">
        <h2 className="mb-3 font-headline text-lg">Open ({open.length})</h2>
        {open.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-on-surface-variant">
              No open requests. When you submit one it will show here.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {open.map((r) => (
              <RequestRow key={r.id} request={r} />
            ))}
          </div>
        )}
      </section>

      {closed.length > 0 ? (
        <section data-testid="portal-requests-closed">
          <h2 className="mb-3 font-headline text-lg">Closed ({closed.length})</h2>
          <div className="space-y-2">
            {closed.slice(0, 10).map((r) => (
              <RequestRow key={r.id} request={r} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function RequestRow({ request }: { request: MaintenanceRequest }) {
  return (
    <Link
      href={`/portal/requests/${request.id}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/10 bg-surface p-4 hover:border-primary/30"
      data-testid={`portal-requests-row-${request.id}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{request.title}</p>
        <p className="mt-0.5 text-xs text-on-surface-variant">
          {request.category} · {new Date(request.createdAt).toLocaleDateString()}
          {request.locationText ? ` · ${request.locationText}` : ""}
        </p>
      </div>
      <Badge variant={getStatusVariant(request.status)} className="capitalize">
        {getOwnerReadableState(request.status)}
      </Badge>
    </Link>
  );
}

// ---------- Sub-page: /portal/requests/:id ----------

function RequestDetailContent({ requestId }: { requestId: string }) {
  const { portalFetch, session } = usePortalContext();

  const { data: requests = [] } = useQuery<MaintenanceRequest[]>({
    queryKey: ["portal/maintenance-requests", session.id],
    queryFn: async () => {
      const res = await portalFetch("/api/portal/maintenance-requests");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const request = requests.find((r) => r.id === requestId);

  if (!request) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4" data-testid="portal-requests-detail-missing">
        <Link href="/portal/requests" className="text-xs font-semibold text-primary hover:underline">
          ← Back to My Requests
        </Link>
        <Card>
          <CardContent className="py-6 text-center text-sm text-on-surface-variant">
            Request not found. It may have been removed.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4" data-testid="portal-requests-detail">
      <Link href="/portal/requests" className="text-xs font-semibold text-primary hover:underline">
        ← Back to My Requests
      </Link>
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-headline text-3xl" data-testid="portal-requests-detail-heading">
          {request.title}
        </h1>
        <Badge variant={getStatusVariant(request.status)} className="capitalize">
          {getOwnerReadableState(request.status)}
        </Badge>
      </div>
      <Card>
        <CardContent className="space-y-3 py-5">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-semibold uppercase tracking-widest text-on-surface-variant">Category</p>
              <p className="mt-1 capitalize">{request.category.replace(/-/g, " ")}</p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-widest text-on-surface-variant">Priority</p>
              <p className="mt-1 capitalize">{request.priority}</p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-widest text-on-surface-variant">Submitted</p>
              <p className="mt-1">{new Date(request.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-widest text-on-surface-variant">Location</p>
              <p className="mt-1">{request.locationText ?? "—"}</p>
            </div>
          </div>
          {request.description ? (
            <div>
              <p className="font-semibold uppercase tracking-widest text-on-surface-variant text-xs">Description</p>
              <p className="mt-1 text-sm">{request.description}</p>
            </div>
          ) : null}
          {request.resolutionNotes ? (
            <div className="rounded-lg bg-surface-container-low p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Resolution notes</p>
              <p className="mt-1 text-sm">{request.resolutionNotes}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Router entry ----------

export default function PortalRequestsPage({ requestId }: { requestId?: string } = {}) {
  const [location] = useLocation();
  const title = requestId || location.match(/\/portal\/requests\/[^/]+/) ? "Request detail" : "My Requests";
  useDocumentTitle(title);

  return (
    <PortalShell>
      {requestId ? <RequestDetailContent requestId={requestId} /> : <RequestsHubContent />}
    </PortalShell>
  );
}

export { RequestsHubContent, RequestDetailContent };
