import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Amenity, AmenityBlock, AmenityReservation } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AsyncStateBoundary } from "@/components/async-state-boundary";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const CATEGORIES = ["general", "pool", "gym", "community-room", "bbq", "tennis-court", "clubhouse", "other"];

const emptyAmenityForm = {
  name: "",
  description: "",
  category: "general",
  capacity: "",
  bookingWindowDays: "30",
  minDurationMinutes: "30",
  maxDurationMinutes: "240",
  requiresApproval: "0",
  isActive: "1",
};

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "approved") return "default";
  if (status === "pending") return "secondary";
  if (status === "rejected" || status === "cancelled") return "destructive";
  return "outline";
}

function formatDt(dt: string | Date | null | undefined): string {
  if (!dt) return "-";
  return new Date(dt).toLocaleString();
}

export default function AmenitiesAdminPage() {
  useDocumentTitle("Amenities");
  const { toast } = useToast();
  const { activeAssociationId } = useActiveAssociation();
  const [tab, setTab] = useState("amenities");
  const [amenityDialogOpen, setAmenityDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [editingAmenity, setEditingAmenity] = useState<Amenity | null>(null);
  const [selectedAmenityId, setSelectedAmenityId] = useState<string>("");
  const [amenityForm, setAmenityForm] = useState(emptyAmenityForm);
  const [blockForm, setBlockForm] = useState({ startAt: "", endAt: "", reason: "" });
  const [reservationRange, setReservationRange] = useState({ from: "", to: "" });

  const { data: amenityList = [], isLoading, isError } = useQuery<Amenity[]>({
    queryKey: ["/api/amenities", activeAssociationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/amenities?associationId=${activeAssociationId}`);
      return res.json();
    },
    enabled: Boolean(activeAssociationId),
  });

  const { data: reservations = [], isLoading: resLoading } = useQuery<AmenityReservation[]>({
    queryKey: ["/api/amenities", selectedAmenityId, "reservations", reservationRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (reservationRange.from) params.set("from", reservationRange.from);
      if (reservationRange.to) params.set("to", reservationRange.to);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await apiRequest("GET", `/api/amenities/${selectedAmenityId}/reservations${qs}`);
      return res.json();
    },
    enabled: Boolean(selectedAmenityId),
  });

  const { data: blocks = [], isLoading: blocksLoading } = useQuery<AmenityBlock[]>({
    queryKey: ["/api/amenities", selectedAmenityId, "blocks"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/amenities/${selectedAmenityId}/blocks`);
      return res.json();
    },
    enabled: Boolean(selectedAmenityId),
  });

  const saveAmenity = useMutation({
    mutationFn: async () => {
      if (!activeAssociationId) throw new Error("Select an association first");
      const payload = {
        associationId: activeAssociationId,
        name: amenityForm.name,
        description: amenityForm.description || null,
        category: amenityForm.category,
        capacity: amenityForm.capacity ? Number(amenityForm.capacity) : null,
        bookingWindowDays: Number(amenityForm.bookingWindowDays),
        minDurationMinutes: Number(amenityForm.minDurationMinutes),
        maxDurationMinutes: Number(amenityForm.maxDurationMinutes),
        requiresApproval: Number(amenityForm.requiresApproval),
        isActive: Number(amenityForm.isActive),
      };
      if (editingAmenity) {
        const res = await apiRequest("PATCH", `/api/amenities/${editingAmenity.id}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", `/api/amenities`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/amenities", activeAssociationId] });
      setAmenityDialogOpen(false);
      setEditingAmenity(null);
      setAmenityForm(emptyAmenityForm);
      toast({ title: editingAmenity ? "Amenity updated" : "Amenity created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteAmenity = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/amenities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/amenities", activeAssociationId] });
      toast({ title: "Amenity deactivated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateReservation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/amenity-reservations/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/amenities", selectedAmenityId, "reservations"] });
      toast({ title: "Reservation updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createBlock = useMutation({
    mutationFn: async () => {
      if (!selectedAmenityId) throw new Error("Select an amenity first");
      const res = await apiRequest("POST", `/api/amenities/${selectedAmenityId}/blocks`, {
        associationId: activeAssociationId,
        startAt: blockForm.startAt,
        endAt: blockForm.endAt,
        reason: blockForm.reason || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/amenities", selectedAmenityId, "blocks"] });
      setBlockDialogOpen(false);
      setBlockForm({ startAt: "", endAt: "", reason: "" });
      toast({ title: "Block created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteBlock = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/amenity-blocks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/amenities", selectedAmenityId, "blocks"] });
      toast({ title: "Block removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openEditDialog(amenity: Amenity) {
    setEditingAmenity(amenity);
    setAmenityForm({
      name: amenity.name,
      description: amenity.description ?? "",
      category: amenity.category,
      capacity: amenity.capacity?.toString() ?? "",
      bookingWindowDays: amenity.bookingWindowDays.toString(),
      minDurationMinutes: amenity.minDurationMinutes.toString(),
      maxDurationMinutes: amenity.maxDurationMinutes.toString(),
      requiresApproval: amenity.requiresApproval.toString(),
      isActive: amenity.isActive.toString(),
    });
    setAmenityDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">Amenity Booking</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="amenities">Amenities</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="blocks">Blackout Dates</TabsTrigger>
        </TabsList>

        <TabsContent value="amenities" className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">All Amenities</h2>
            <Dialog open={amenityDialogOpen} onOpenChange={(o) => {
              if (!o) { setEditingAmenity(null); setAmenityForm(emptyAmenityForm); }
              setAmenityDialogOpen(o);
            }}>
              <DialogTrigger asChild>
                <Button size="sm">Add Amenity</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
                <DialogHeader><DialogTitle>{editingAmenity ? "Edit Amenity" : "Add Amenity"}</DialogTitle></DialogHeader>
                <div className="flex flex-col gap-3">
                  <div>
                    <Label>Name</Label>
                    <Input value={amenityForm.name} onChange={(e) => setAmenityForm((f) => ({ ...f, name: e.target.value }))} placeholder="Pool, Gym, BBQ..." />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select value={amenityForm.category} onValueChange={(v) => setAmenityForm((f) => ({ ...f, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={amenityForm.description} onChange={(e) => setAmenityForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Capacity</Label>
                      <Input type="number" value={amenityForm.capacity} onChange={(e) => setAmenityForm((f) => ({ ...f, capacity: e.target.value }))} placeholder="Optional" />
                    </div>
                    <div>
                      <Label>Booking Window (days)</Label>
                      <Input type="number" value={amenityForm.bookingWindowDays} onChange={(e) => setAmenityForm((f) => ({ ...f, bookingWindowDays: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Min Duration (min)</Label>
                      <Input type="number" value={amenityForm.minDurationMinutes} onChange={(e) => setAmenityForm((f) => ({ ...f, minDurationMinutes: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Max Duration (min)</Label>
                      <Input type="number" value={amenityForm.maxDurationMinutes} onChange={(e) => setAmenityForm((f) => ({ ...f, maxDurationMinutes: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Requires Approval</Label>
                    <Select value={amenityForm.requiresApproval} onValueChange={(v) => setAmenityForm((f) => ({ ...f, requiresApproval: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">No — auto-approve</SelectItem>
                        <SelectItem value="1">Yes — admin approval required</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={amenityForm.isActive} onValueChange={(v) => setAmenityForm((f) => ({ ...f, isActive: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Active</SelectItem>
                        <SelectItem value="0">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => saveAmenity.mutate()} disabled={saveAmenity.isPending || !amenityForm.name}>
                    {saveAmenity.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <AsyncStateBoundary isLoading={isLoading} error={isError ? new Error("Failed to load") : undefined} isEmpty={amenityList.length === 0} emptyMessage="No amenities configured yet.">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Window</TableHead>
                    <TableHead>Approval</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {amenityList.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell>{a.category}</TableCell>
                      <TableCell>{a.capacity ?? "-"}</TableCell>
                      <TableCell>{a.bookingWindowDays}d</TableCell>
                      <TableCell>{a.requiresApproval ? "Required" : "Auto"}</TableCell>
                      <TableCell><Badge variant={a.isActive ? "default" : "secondary"}>{a.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(a)}>Edit</Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteAmenity.mutate(a.id)} disabled={deleteAmenity.isPending}>
                            Deactivate
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </AsyncStateBoundary>
        </TabsContent>

        <TabsContent value="reservations" className="mt-4">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <div>
              <Label>Amenity</Label>
              <Select value={selectedAmenityId} onValueChange={setSelectedAmenityId}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Select amenity" /></SelectTrigger>
                <SelectContent>{amenityList.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>From</Label>
              <Input type="date" value={reservationRange.from} onChange={(e) => setReservationRange((r) => ({ ...r, from: e.target.value }))} className="w-36" />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={reservationRange.to} onChange={(e) => setReservationRange((r) => ({ ...r, to: e.target.value }))} className="w-36" />
            </div>
          </div>
          {!selectedAmenityId ? (
            <Card><CardContent className="py-6 text-sm text-muted-foreground">Select an amenity to view reservations.</CardContent></Card>
          ) : (
            <AsyncStateBoundary isLoading={resLoading} error={undefined} isEmpty={reservations.length === 0} emptyMessage="No reservations in this range.">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Person ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{formatDt(r.startAt)}</TableCell>
                        <TableCell>{formatDt(r.endAt)}</TableCell>
                        <TableCell className="font-mono text-xs">{r.personId}</TableCell>
                        <TableCell><Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge></TableCell>
                        <TableCell>{r.notes ?? "-"}</TableCell>
                        <TableCell>
                          {r.status === "pending" && (
                            <div className="flex gap-1">
                              <Button size="sm" onClick={() => updateReservation.mutate({ id: r.id, status: "approved" })} disabled={updateReservation.isPending}>Approve</Button>
                              <Button size="sm" variant="destructive" onClick={() => updateReservation.mutate({ id: r.id, status: "rejected" })} disabled={updateReservation.isPending}>Reject</Button>
                            </div>
                          )}
                          {r.status === "approved" && (
                            <Button size="sm" variant="outline" onClick={() => updateReservation.mutate({ id: r.id, status: "cancelled" })} disabled={updateReservation.isPending}>Cancel</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </AsyncStateBoundary>
          )}
        </TabsContent>

        <TabsContent value="blocks" className="mt-4">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <div>
              <Label>Amenity</Label>
              <Select value={selectedAmenityId} onValueChange={setSelectedAmenityId}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Select amenity" /></SelectTrigger>
                <SelectContent>{amenityList.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!selectedAmenityId}>Add Blackout</Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle>Add Blackout / Maintenance Hold</DialogTitle></DialogHeader>
                <div className="flex flex-col gap-3">
                  <div>
                    <Label>Start</Label>
                    <Input type="datetime-local" value={blockForm.startAt} onChange={(e) => setBlockForm((f) => ({ ...f, startAt: e.target.value }))} />
                  </div>
                  <div>
                    <Label>End</Label>
                    <Input type="datetime-local" value={blockForm.endAt} onChange={(e) => setBlockForm((f) => ({ ...f, endAt: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Reason</Label>
                    <Input value={blockForm.reason} onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Maintenance, private event..." />
                  </div>
                  <Button onClick={() => createBlock.mutate()} disabled={createBlock.isPending || !blockForm.startAt || !blockForm.endAt}>
                    {createBlock.isPending ? "Saving..." : "Create Block"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {!selectedAmenityId && (
            <Card><CardContent className="py-6 text-sm text-muted-foreground">Select an amenity to manage blackout dates.</CardContent></Card>
          )}
          {selectedAmenityId && (
            <AsyncStateBoundary isLoading={blocksLoading} error={undefined} isEmpty={blocks.length === 0} emptyMessage="No blackout dates. Use the button above to add one.">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blocks.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>{formatDt(b.startAt)}</TableCell>
                        <TableCell>{formatDt(b.endAt)}</TableCell>
                        <TableCell>{b.reason ?? "-"}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="destructive" onClick={() => deleteBlock.mutate(b.id)} disabled={deleteBlock.isPending}>
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </AsyncStateBoundary>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
